let videos = [];
let selectedCompany = 'all';
let searchQuery = '';
let favorites = new Set();
try { favorites = new Set(JSON.parse(localStorage.getItem('signal-ai-favorites') || '[]')); } catch { /* local storage unavailable */ }

const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
document.querySelector('#currentDate').textContent = `${dateParts.find((part) => part.type === 'year').value}.${dateParts.find((part) => part.type === 'month').value}.${dateParts.find((part) => part.type === 'day').value}`;

const grid = document.querySelector('#videoGrid');
const favoriteGrid = document.querySelector('#favoriteGrid');
const emptyState = document.querySelector('#emptyState');
const favoritesEmpty = document.querySelector('#favoritesEmpty');
const count = document.querySelector('#videoCount');
const filterRow = document.querySelector('#companies');
const navCount = document.querySelector('#favoriteNavCount');
const titleCount = document.querySelector('#favoriteTitleCount');
const videoSearch = document.querySelector('#videoSearch');
const videoSearchForm = document.querySelector('#videoSearchForm');
const companyClass = { OpenAI: 'openai', 'Google DeepMind': 'google', Anthropic: 'anthropic', 'Meta AI': 'meta', 'Mistral AI': 'mistral' };

function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function relativeTime(isoDate) { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(isoDate)); return `${parts.find((part) => part.type === 'year').value}.${parts.find((part) => part.type === 'month').value}.${parts.find((part) => part.type === 'day').value}`; }
function colorFor(company) { return { OpenAI: ['#283b38', '#d2ff65'], 'Google DeepMind': ['#1c2943', '#7fa6ff'], Anthropic: ['#473c34', '#e6a879'], 'Meta AI': ['#18336a', '#76a7ff'], 'Mistral AI': ['#5d281f', '#ff8a55'] }[company] || ['#303740', '#aeb9c0']; }
function fallbackNotes(video) { return { summary_zh: `${video.company} 的官方视频围绕「${video.title}」展开，重点呈现产品或能力的定位、使用场景与核心价值。`, marketing_takeaway_zh: '留意官方如何选择主角、场景和视觉重点。把复杂能力压缩成单一、可复述的信息，是 AI 营销内容的关键。' }; }

function cardMarkup(video) {
  const [bg, accent] = colorFor(video.company);
  const notes = { ...fallbackNotes(video), ...video };
  const saved = favorites.has(video.id);
  return `<article class="video-card"><div class="thumb" style="--thumb:${bg};--accent:${accent}"><img src="${escapeHtml(video.thumbnail_url)}" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.78"><span class="thumb-label" style="text-shadow:0 1px 3px #000">${escapeHtml(video.company)}</span><button class="favorite-button" type="button" data-favorite-id="${escapeHtml(video.id)}" aria-label="${saved ? '取消星标' : '星标此视频'}" title="${saved ? '取消星标' : '加入星标'}" style="position:absolute;z-index:3;right:12px;top:12px;width:32px;height:32px;border:0;border-radius:50%;background:${saved ? '#c8ff58' : 'rgba(255,255,255,.92)'};color:#17222b;font-size:19px;cursor:pointer">${saved ? '★' : '☆'}</button><button class="play" type="button" data-video-id="${escapeHtml(video.id)}" data-video-title="${escapeHtml(video.title)}">▶</button></div><div class="card-content"><div class="card-meta"><i class="company-dot ${companyClass[video.company] || ''}"></i>${escapeHtml(video.company).toUpperCase()}</div><h3 class="card-title">${escapeHtml(video.title)}</h3><div style="border-top:1px solid #e3e4dc;margin-top:14px;padding-top:12px"><p style="font-size:11px;font-weight:800;margin:0 0 5px;color:#68726c">视频讲了什么</p><p style="font-size:12px;line-height:1.65;margin:0 0 11px;color:#4f5c55">${escapeHtml(notes.summary_zh)}</p><p style="font-size:11px;font-weight:800;margin:0 0 5px;color:#68726c">给 AI 营销人员的参考</p><p style="font-size:12px;line-height:1.65;margin:0;color:#4f5c55">${escapeHtml(notes.marketing_takeaway_zh)}</p></div><div class="card-bottom" style="margin-top:15px"><span>${relativeTime(video.published_at)}</span><a href="${escapeHtml(video.source_url)}" target="_blank" rel="noreferrer">原视频 ↗</a></div></div></article>`;
}
function renderFilters() {
  const preferredCompanies = ['OpenAI', 'Google DeepMind', 'Claude（Anthropic）'];
  const companies = [...new Set(videos.map((video) => video.company))].sort((a, b) => {
    const aRank = preferredCompanies.indexOf(a), bRank = preferredCompanies.indexOf(b);
    if (aRank !== -1 || bRank !== -1) return (aRank === -1 ? 99 : aRank) - (bRank === -1 ? 99 : bRank);
    return a.localeCompare(b);
  });
  filterRow.innerHTML = `<button class="chip ${selectedCompany === 'all' ? 'selected' : ''}" data-company="all" type="button">全部 <span>${videos.length}</span></button>` + companies.map((company) => { const [, accent] = colorFor(company); const total = videos.filter((video) => video.company === company).length; return `<button class="chip ${selectedCompany === company ? 'selected' : ''}" data-company="${escapeHtml(company)}" type="button"><i class="company-dot" style="background:${accent}"></i>${escapeHtml(company)} <span>${total}</span></button>`; }).join('');
}
function render() {
  const companyVideos = selectedCompany === 'all' ? videos : videos.filter((video) => video.company === selectedCompany);
  const shown = companyVideos.filter((video) => !searchQuery || `${video.company} ${video.title} ${video.summary_zh || ''} ${video.marketing_takeaway_zh || ''}`.toLowerCase().includes(searchQuery));
  const savedVideos = videos.filter((video) => favorites.has(video.id));
  count.textContent = String(shown.length).padStart(2, '0');
  grid.innerHTML = shown.map(cardMarkup).join('');
  favoriteGrid.innerHTML = savedVideos.map(cardMarkup).join('');
  emptyState.hidden = shown.length !== 0;
  if (!shown.length) emptyState.textContent = searchQuery ? `没有找到与“${searchQuery}”相关的视频。` : '这个公司今天还没有新的精选视频。';
  favoritesEmpty.hidden = savedVideos.length !== 0;
  navCount.textContent = savedVideos.length ? `(${savedVideos.length})` : '';
  titleCount.textContent = savedVideos.length ? `(${savedVideos.length})` : '';
}
function saveFavorites() { try { localStorage.setItem('signal-ai-favorites', JSON.stringify([...favorites])); } catch { /* browser privacy mode */ } }
function closePlayer() { document.querySelector('#playerModal')?.remove(); document.body.style.overflow = ''; }
function openPlayer(button) {
  const modal = document.createElement('div');
  modal.id = 'playerModal'; modal.style.cssText = 'position:fixed;inset:0;z-index:20;background:rgba(10,18,20,.86);display:grid;place-items:center;padding:24px';
  modal.innerHTML = `<section role="dialog" aria-modal="true" aria-label="播放 ${escapeHtml(button.dataset.videoTitle)}" style="width:min(900px,100%);position:relative"><button type="button" aria-label="关闭视频" style="position:absolute;right:0;top:-42px;border:0;background:transparent;color:white;font-size:28px;cursor:pointer">×</button><div style="position:relative;padding-top:56.25%;background:#000"><iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(button.dataset.videoId)}?autoplay=1" title="${escapeHtml(button.dataset.videoTitle)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe></div></section>`;
  modal.addEventListener('click', (event) => { if (event.target === modal || event.target.tagName === 'BUTTON') closePlayer(); }); document.body.appendChild(modal); document.body.style.overflow = 'hidden';
}
function handleVideoAction(event) {
  const favorite = event.target.closest('.favorite-button');
  if (favorite) { favorites.has(favorite.dataset.favoriteId) ? favorites.delete(favorite.dataset.favoriteId) : favorites.add(favorite.dataset.favoriteId); saveFavorites(); render(); return; }
  const play = event.target.closest('.play'); if (play) openPlayer(play);
}
filterRow.addEventListener('click', (event) => { const button = event.target.closest('.chip'); if (!button) return; selectedCompany = button.dataset.company; renderFilters(); render(); });
function runSearch() { searchQuery = videoSearch.value.trim().toLowerCase(); render(); document.querySelector('#latest').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
videoSearch.addEventListener('input', runSearch);
videoSearchForm.addEventListener('submit', (event) => { event.preventDefault(); runSearch(); });
grid.addEventListener('click', handleVideoAction); favoriteGrid.addEventListener('click', handleVideoAction);
document.querySelector('#emailForm').addEventListener('submit', (event) => { event.preventDefault(); document.querySelector('#formMessage').textContent = '已收到，明天开始向你发送每日信号。'; event.currentTarget.reset(); });
document.querySelector('#subscribeButton').addEventListener('click', () => document.querySelector('#email').focus());
document.querySelector('#loadMore').addEventListener('click', (event) => { event.currentTarget.textContent = '已加载全部信号'; event.currentTarget.disabled = true; });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePlayer(); });
fetch('data/videos.json').then((response) => response.ok ? response.json() : Promise.reject()).then((feed) => { videos = feed.videos || []; renderFilters(); render(); }).catch(() => { emptyState.hidden = false; emptyState.textContent = '暂无已收集的视频。运行采集脚本后，最新内容会出现在这里。'; });
