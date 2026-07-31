# Signal AI · 每日视频雷达

一个用于展示全球 AI 公司官方宣传视频的网页。采集器会解析官方频道并读取公开的 YouTube Atom feed，不需要 API Key。

## 本地预览

在此目录运行：

```bash
python3 -m http.server 8080
```

然后打开 `http://localhost:8080`。

## 更新视频数据

```bash
python3 scripts/collect_youtube.py
```

采集结果写入 `data/videos.json`，网页加载时会读取它。频道名单在 `data/sources.json`，可直接增加公司的官方 YouTube `@handle` URL。

## 自动执行

`.github/workflows/daily-collect.yml` 已配置为每天北京时间 08:10 执行。将该目录推送至 GitHub 后，在仓库 **Actions** 页面启用工作流即可；更新后的数据会自动提交回仓库。

## 筛选机制

采集器会用发布、演示、产品、模型名称等关键词初筛。规则位于 `scripts/collect_youtube.py` 的 `PROMO_TERMS`，建议每周查看一次结果并补充关键词；后续可接入模型生成中文摘要和标签。

项目只链接和展示官方来源的封面，不下载或转存视频文件。
