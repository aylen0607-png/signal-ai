#!/usr/bin/env python3
"""Collect official AI videos from YouTube.

Normal mode reads lightweight public Atom feeds for daily updates.  Pass
--history once to backfill AI-relevant videos published in the past 365 days;
that mode requires `yt-dlp` but does not require a YouTube API key.
"""
import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES_PATH, OUTPUT_PATH, CACHE_PATH = ROOT / "data" / "sources.json", ROOT / "data" / "videos.json", ROOT / "data" / "channel_cache.json"
ATOM = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}
AI_TERMS = re.compile(r"\b(ai|llm|gpt|agent|agents|model|models|generative|genai|machine learning|deep learning|copilot|claude|chatgpt|gemini|llama|mistral|perplexity|firefly|magic studio|magic media|diffusion|robotics)\b", re.I)
AI_FIRST_COMPANIES = {"OpenAI", "Google DeepMind", "Claude（Anthropic）", "Meta AI", "Mistral AI", "Microsoft AI", "Runway", "ElevenLabs", "Perplexity", "Cohere", "Hugging Face"}

def get(url):
    request = urllib.request.Request(url, headers={"User-Agent": "SignalAICollector/1.0", "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read().decode("utf-8", errors="replace"), response.geturl()

def load_json(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default

def is_relevant(source, title, description=""):
    """Keep all videos from AI-native channels; require an AI signal on broad channels."""
    return source["company"] in AI_FIRST_COMPANIES or bool(AI_TERMS.search(f"{title} {description}"))

def resolve_channel_id(source, cache):
    if source["channel_url"] in cache:
        return cache[source["channel_url"]]
    html, final_url = get(source["channel_url"])
    matches = [re.search(r'<link rel="canonical" href="https://www\\.youtube\\.com/channel/(UC[A-Za-z0-9_-]{22})"', html), re.search(r'"channelId":"(UC[A-Za-z0-9_-]{22})"', html), re.search(r'"browseId":"(UC[A-Za-z0-9_-]{22})"', html), re.search(r'/channel/(UC[A-Za-z0-9_-]{22})', final_url)]
    channel_id = next((match.group(1) for match in matches if match), None)
    if not channel_id:
        raise ValueError(f"Could not resolve {source['channel_url']}")
    cache[source["channel_url"]] = channel_id
    return channel_id

def record(source, video_id, title, published_at, description=""):
    return {"id": video_id, "company": source["company"], "title": title, "description": description[:500], "published_at": published_at, "source_url": f"https://www.youtube.com/watch?v={video_id}", "thumbnail_url": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg", "channel_url": source["channel_url"], "platform": "YouTube", **make_editorial_notes(title, description, source["company"])}

def parse_feed(source, channel_id):
    xml, _ = get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}")
    records = []
    for entry in ET.fromstring(xml).findall("atom:entry", ATOM):
        title = entry.findtext("atom:title", default="", namespaces=ATOM).strip()
        video_id = entry.findtext("yt:videoId", default="", namespaces=ATOM)
        published = entry.findtext("atom:published", default="", namespaces=ATOM)
        description = entry.findtext("atom:content", default="", namespaces=ATOM).strip()
        if is_relevant(source, title, description):
            records.append(record(source, video_id, title, published, description))
    return records

def parse_history(source, cutoff):
    try:
        import yt_dlp  # noqa: F401
    except ImportError as error:
        raise RuntimeError("History mode requires yt-dlp. Install it with: python3 -m pip install yt-dlp") from error
    # Flat-playlist mode is fast but does not contain upload dates.  Full
    # metadata is needed here so --dateafter is applied accurately.
    command = [sys.executable, "-m", "yt_dlp", "--skip-download", "--dump-json", "--ignore-errors", "--no-warnings", "--dateafter", cutoff.strftime("%Y%m%d"), f"{source['channel_url'].rstrip('/')}/videos"]
    process = subprocess.run(command, capture_output=True, text=True, timeout=300, check=False)
    if process.returncode not in (0, 1):
        raise RuntimeError(process.stderr.strip() or "yt-dlp could not read this channel")
    records = []
    for line in process.stdout.splitlines():
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        date = item.get("upload_date")
        if not date or len(date) != 8:
            continue
        published = f"{date[:4]}-{date[4:6]}-{date[6:]}T00:00:00+00:00"
        title, description, video_id = item.get("title", ""), item.get("description", "") or "", item.get("id", "")
        if video_id and is_relevant(source, title, description):
            records.append(record(source, video_id, title, published, description))
    return records

def make_editorial_notes(title, description, company):
    """Create a transparent first-pass Chinese brief without sharing video data with a third party."""
    text, topic = f"{title} {description}".lower(), title.strip().rstrip(".")
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--history", action="store_true", help="Backfill AI-relevant videos from the past 365 days using yt-dlp.")
    args = parser.parse_args()
    sources, cache = load_json(SOURCES_PATH, []), load_json(CACHE_PATH, {})
    current = load_json(OUTPUT_PATH, {"videos": []})
    cutoff = datetime.now(timezone.utc) - timedelta(days=365)
    existing, errors = {video["id"]: video for video in current.get("videos", [])}, []
    for source in sources:
        try:
            latest = parse_history(source, cutoff) if args.history else parse_feed(source, resolve_channel_id(source, cache))
            for video in latest:
                existing[video["id"]] = {**existing.get(video["id"], {}), **video}
            print(f"✓ {source['company']} ({len(latest)} 条)")
        except (urllib.error.URLError, urllib.error.HTTPError, ET.ParseError, ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
            errors.append(f"{source['company']}: {error}")
            print(f"! {errors[-1]}", file=sys.stderr)
        time.sleep(.4)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    videos = [video for video in existing.values() if video.get("published_at", "") >= cutoff.isoformat()]
    videos.sort(key=lambda item: item.get("published_at", ""), reverse=True)
    OUTPUT_PATH.write_text(json.dumps({"updated_at": datetime.now(timezone.utc).isoformat(), "videos": videos}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {len(videos)} videos from the past 365 days.")
    if errors and not videos:
        sys.exit("All sources failed; existing data remains empty.")

if __name__ == "__main__":
    main()
