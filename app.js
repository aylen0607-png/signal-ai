let videos = [];
const grid = document.querySelector('#videoGrid');
const emptyState = document.querySelector('#emptyState');
const count = document.querySelector('#videoCount');
const companyClass = { OpenAI: 'openai', 'Google DeepMind': 'google', Anthropic: 'anthropic', 'Meta AI': 'meta', 'Mistral AI': 'mistral' };
function relativeTime(isoDate) { const hours = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 3600000)); return hours < 1 ? '刚刚' : hours < 24 ? `${hours} 小时前` : `${Math.floor(hours / 24)} 天前`; }
function colorFor(company) { return { OpenAI: ['#283b38', '#d2ff65'], 'Google DeepMind': ['#1c2943', '#7fa6ff'], Anthropic: ['#473c34', '#e6a879'], 'Meta AI': ['#18336a', '#76a7ff'], 'Mistral AI': ['#5d281f', '#ff8a55'] }[company] || ['#303740', '#aeb9c0']; }
function fallbackNotes(video) { return { summary_zh: `${video.company} 的官方视频围绕「${video.title}」展开，重点呈现产品或能力的定位、使用场景与核心价值。`, marketing_takeaway_zh: '留意官方如何选择主角、场景和视觉重点。把复杂能力压缩成单一、可复述的信息，是 AI 营销内容的关键。' }; }
function render(company = 'all') {
  const shown = company === 'all' ? videos : videos.filter((video) => video.company === company);
  count.textContent = String(shown.length).padStart(2, '0');
  grid.innerHTML = shown.map((video) => { const [bg, accent] = colorFor(video.company); const notes = { ...fallbackNotes(video), ...video }; return `<article class="video-card"><div class="thumb" style="--thumb:${bg};--accent:${accent}"><img src="${video.thumbnail_url}" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.78"><span class="thumb-label" style="text-shadow:0 1px 3px #000">${video.company}</span><button class="play" type="button" data-video-id="${video.id}" data-video-title="${video.title.replace(/&/g, '&amp;').replace(/\"/g, '&quot;')}">▶</button></div><div class="card-content"><div class="card-meta"><i class="company-dot ${companyClass[video.company] || ''}"></i>${video.company.toUpperCase()}</div><h3 class="card-title">${video.title}</h3><div style="border-top:1px solid #e3e4dc;margin-top:14px;padding-top:12px"><p style="font-size:11px;font-weight:800;margin:0 0 5px;color:#68726c">视频讲了什么</p><p style="font-size:12px;line-height:1.65;margin:0 0 11px;color:#4f5c55">${notes.summary_zh}</p><p style="font-size:11px;font-weight:800;margin:0 0 5px;color:#68726c">给 AI 营销人员的参考</p><p style="font-size:12px;line-height:1.65;margin:0;color:#4f5c55">${notes.marketing_takeaway_zh}</p></div><div class="card-bottom" style="margin-top:15px"><span>${relativeTime(video.published_at)}</span><a href="${video.source_url}" target="_blank" rel="noreferrer">原视频 ↗</a></div></div></article>`; }).join('');
  emptyState.hidden = shown.length !== 0;
}
document.querySelectorAll('.chip').forEach((button) => button.addEventListener('click', () => { document.querySelector('.chip.selected').classList.remove('selected'); button.classList.add('selected'); render(button.dataset.company); }));
document.querySelector('#emailForm').addEventListener('submit', (event) => { event.preventDefault(); document.querySelector('#formMessage').textContent = '已收到，明天开始向你发送每日信号。'; event.currentTarget.reset(); });
document.querySelector('#subscribeButton').addEventListener('click', () => document.querySelector('#email').focus());
document.querySelector('#loadMore').addEventListener('click', (event) => { event.currentTarget.textContent = '已加载全部信号'; event.currentTarget.disabled = true; });
function closePlayer() { document.querySelector('#playerModal')?.remove(); document.body.style.overflow = ''; }
grid.addEventListener('click', (event) => {
  const button = event.target.closest('.play');
  if (!button) return;
  const modal = document.createElement('div');
  modal.id = 'playerModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:20;background:rgba(10,18,20,.86);display:grid;place-items:center;padding:24px';
  modal.innerHTML = `<section role="dialog" aria-modal="true" aria-label="播放 ${button.dataset.videoTitle}" style="width:min(900px,100%);position:relative"><button type="button" aria-label="关闭视频" style="position:absolute;right:0;top:-42px;border:0;background:transparent;color:white;font-size:28px;cursor:pointer">×</button><div style="position:relative;padding-top:56.25%;background:#000"><iframe src="https://www.youtube-nocookie.com/embed/${button.dataset.videoId}?autoplay=1" title="${button.dataset.videoTitle}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe></div></section>`;
  modal.addEventListener('click', (click) => { if (click.target === modal || click.target.tagName === 'BUTTON') closePlayer(); });
  document.body.appendChild(modal); document.body.style.overflow = 'hidden';
});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePlayer(); });
fetch('data/videos.json').then((response) => response.ok ? response.json() : Promise.reject()).then((feed) => { videos = feed.videos || []; render(); }).catch(() => { emptyState.hidden = false; emptyState.textContent = '暂无已收集的视频。运行采集脚本后，最新内容会出现在这里。'; });
