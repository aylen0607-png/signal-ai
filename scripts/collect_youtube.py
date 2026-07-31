#!/usr/bin/env python3
"""Collect new videos from official YouTube channels without an API key."""
import json
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES_PATH, OUTPUT_PATH, CACHE_PATH = ROOT / "data" / "sources.json", ROOT / "data" / "videos.json", ROOT / "data" / "channel_cache.json"
ATOM = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
PROMO_TERMS = re.compile(r"introducing|announce|launch|release|new |meet |demo|build with|how to|product|model|claude|chatgpt|gemini|llama|copilot|ai", re.I)

def get(url):
    request = urllib.request.Request(url, headers={"User-Agent": "SignalAICollector/1.0", "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read().decode("utf-8", errors="replace"), response.geturl()

def load_json(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default

def resolve_channel_id(source, cache):
    if source["channel_url"] in cache:
        return cache[source["channel_url"]]
    html, final_url = get(source["channel_url"])
    matches = [re.search(r'<link rel="canonical" href="https://www\\.youtube\\.com/channel/(UC[A-Za-z0-9_-]{22})"', html), re.search(r'"channelId":"(UC[A-Za-z0-9_-]{22})"', html), re.search(r'"browseId":"(UC[A-Za-z0-9_-]{22})"', html), re.search(r'/channel/(UC[A-Za-z0-9_-]{22})', final_url)]
    channel_id = next((m.group(1) for m in matches if m), None)
    if not channel_id:
        raise ValueError(f"Could not resolve {source['channel_url']}")
    cache[source["channel_url"]] = channel_id
    return channel_id

def parse_feed(source, channel_id):
    xml, _ = get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}")
    root, records = ET.fromstring(xml), []
    for entry in root.findall("atom:entry", ATOM):
        title = entry.findtext("atom:title", default="", namespaces=ATOM).strip()
        video_id = entry.findtext("yt:videoId", default="", namespaces=ATOM)
        published = entry.findtext("atom:published", default="", namespaces=ATOM)
        description = entry.findtext("atom:content", default="", namespaces=ATOM).strip()
        if not PROMO_TERMS.search(f"{title} {description}"):
            continue
        records.append({"id": video_id, "company": source["company"], "title": title, "description": description[:500], "published_at": published, "source_url": f"https://www.youtube.com/watch?v={video_id}", "thumbnail_url": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg", "channel_url": source["channel_url"], "platform": "YouTube", **make_editorial_notes(title, description, source["company"])})
    return records

def make_editorial_notes(title, description, company):
    """Create a transparent first-pass Chinese brief without sending video data to a third party."""
    text = f"{title} {description}".lower()
    topic = title.strip().rstrip(".")
    if any(word in text for word in ("launch", "introducing", "announce", "release", "new")):
        takeaway = "新品发布内容要先交代“新在哪里”，再用一个具体场景证明它为何重要；首屏信息应让受众在几秒内看懂变化。"
    elif any(word in text for word in ("demo", "how to", "build", "tutorial")):
        takeaway = "用真实任务而非抽象参数展示能力。营销物料可沿用“问题—操作—结果”的三段叙事，降低新功能的理解成本。"
    elif any(word in text for word in ("research", "think", "model", "benchmark")):
        takeaway = "把技术能力翻译为用户能感知的结果，并补充可信的验证线索；这比单独强调模型指标更易形成传播。"
    else:
        takeaway = "可留意官方如何选择主角、场景和视觉重点。将一个复杂能力压缩成单一、可复述的信息，是 AI 营销内容的关键。"
    return {"summary_zh": f"{company} 的官方视频围绕「{topic}」展开，重点呈现相关产品或能力的定位、使用场景与核心价值。", "marketing_takeaway_zh": takeaway}

def main():
    sources, cache = load_json(SOURCES_PATH, []), load_json(CACHE_PATH, {})
    current = load_json(OUTPUT_PATH, {"videos": []})
    existing, errors = {video["id"]: video for video in current.get("videos", [])}, []
    for source in sources:
        try:
            for video in parse_feed(source, resolve_channel_id(source, cache)):
                existing[video["id"]] = {**existing.get(video["id"], {}), **video}
            print(f"✓ {source['company']}")
        except (urllib.error.URLError, urllib.error.HTTPError, ET.ParseError, ValueError) as error:
            errors.append(f"{source['company']}: {error}")
            print(f"! {errors[-1]}", file=sys.stderr)
        time.sleep(.6)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    videos = sorted(existing.values(), key=lambda item: item.get("published_at", ""), reverse=True)[:100]
    OUTPUT_PATH.write_text(json.dumps({"updated_at": datetime.now(timezone.utc).isoformat(), "videos": videos}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {len(videos)} videos.")
    if errors and not videos:
        sys.exit("All sources failed; existing data remains empty.")

if __name__ == "__main__": main()
