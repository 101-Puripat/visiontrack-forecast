import { countsAtTime, sumCounts, validateTrack } from './counts.mjs';

const $ = id => document.getElementById(id);
const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn',
});
const timeFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', numberingSystem: 'latn',
});

function updateClock() {
  const now = new Date();
  const date = dateFormatter.format(now);
  if ($('clock-date').textContent !== date) $('clock-date').textContent = date;
  $('clock-time').textContent = timeFormatter.format(now);
  $('site-clock').dateTime = now.toISOString();
}
updateClock();
window.setInterval(updateClock, 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateClock();
});

const dialog = $('scope-dialog');
const grid = $('camera-grid');
const viewControls = document.querySelector('.view-controls');
function updateNavigationOffset() {
  document.documentElement.style.setProperty('--navigation-offset', `${Math.ceil(viewControls.getBoundingClientRect().height) + 12}px`);
}
updateNavigationOffset();
if (typeof ResizeObserver === 'function') new ResizeObserver(updateNavigationOffset).observe(viewControls);
else window.addEventListener('resize', updateNavigationOffset);
let zones = [];
let activeZone = 'all';

$('scope-open').addEventListener('click', () => dialog.showModal());
dialog.addEventListener('close', () => $('scope-open').focus({ preventScroll: true }));
const scopeNoticeKey = 'visiontrack:scope-notice-seen';
let hasSeenScopeNotice = false;
try { hasSeenScopeNotice = localStorage.getItem(scopeNoticeKey) === '1'; } catch { /* Storage may be unavailable in restricted browsers. */ }
if (!hasSeenScopeNotice) {
  dialog.showModal();
  // Remember the first display, including when the visitor refreshes before closing it.
  try { localStorage.setItem(scopeNoticeKey, '1'); } catch { /* Keep the rest of the page usable. */ }
}

function selectedZones() { return zones.filter(z => activeZone === 'all' || z.id === activeZone); }
function playableZones() { return selectedZones().filter(z => z.videoUrl && !z.video.error); }
function primaryVideo() { return playableZones()[0]?.video; }
function showError(message) { $('app-error').textContent = message; $('app-error').hidden = !message; }
function setCount(id, value) { const text = value == null ? '—' : String(value); if ($(id).textContent !== text) $(id).textContent = text; }

function zoneFromUrl() { return /^#(all|zone[1-4])$/.exec(location.hash)?.[1] || 'all'; }
function writeZoneUrl(id, mode) {
  if (location.hash === `#${id}`) return;
  const url = new URL(location.href);
  url.hash = id;
  history[mode === 'replace' ? 'replaceState' : 'pushState']({ zone: id }, '', url);
}
function focusSelectedZone() {
  $('dashboard-title').scrollIntoView({ block: 'start', behavior: 'instant' });
  document.querySelector(`.zone-nav button[data-zone="${activeZone}"]`).focus({ preventScroll: true });
}
function supportsNativeFullscreen(video) {
  return typeof video.webkitEnterFullscreen === 'function' && video.webkitSupportsFullscreen === true;
}
function updateFullscreenControls() {
  for (const zone of zones) {
    if (!zone.card) continue;
    const expanded = (document.fullscreenElement && zone.card.contains(document.fullscreenElement)) || zone.video.webkitDisplayingFullscreen === true;
    zone.video.controls = false;
    const supported = (document.fullscreenEnabled && typeof zone.card.requestFullscreen === 'function') || supportsNativeFullscreen(zone.video);
    const button = zone.card.querySelector('.fullscreen-toggle');
    button.hidden = !zone.videoUrl || !!zone.video.error || !supported;
    button.disabled = !!zone.fullscreenPending || zone.video.readyState < 1;
    button.textContent = expanded ? 'ออกเต็มจอ' : 'เต็มจอ';
    button.setAttribute('aria-pressed', String(expanded));
    button.setAttribute('aria-label', expanded ? 'ออกจากวิดีโอเต็มจอ' : `ดูวิดีโอโซน ${zone.number} เต็มจอ`);
  }
}
async function toggleFullscreen(zone) {
  const error = zone.card.querySelector('.fullscreen-error');
  error.hidden = true;
  zone.fullscreenPending = true;
  updateFullscreenControls();
  try {
    if (document.fullscreenElement === zone.card) await document.exitFullscreen();
    else if (zone.video.webkitDisplayingFullscreen && typeof zone.video.webkitExitFullscreen === 'function') zone.video.webkitExitFullscreen();
    else if (document.fullscreenEnabled && zone.card.requestFullscreen) await zone.card.requestFullscreen();
    else if (supportsNativeFullscreen(zone.video)) zone.video.webkitEnterFullscreen();
  } catch {
    error.hidden = false;
  } finally {
    zone.fullscreenPending = false;
    updateFullscreenControls();
  }
}
document.addEventListener('fullscreenchange', updateFullscreenControls);

function updateDashboard() {
  const current = primaryVideo();
  const visible = selectedZones();
  const counts = zones.map(zone => {
    // Each camera has its own video and playback position.
    const available = zone.videoUrl && zone.video.readyState >= 2 && !zone.video.error && zone.track;
    const value = available ? countsAtTime(zone.track, zone.video.currentTime) : null;
    for (const key of ['total', 'free', 'occupied']) setCount(`${zone.id}-${key}`, value?.[key]);
    return { zone, value };
  });
  const known = counts.filter(({ zone, value }) => visible.includes(zone) && value);
  const summary = sumCounts(known.map(({ value }) => value));
  $('count-coverage').textContent = activeZone === 'all' ? `มีข้อมูล ${known.length} จาก 4 โซน` : known.length ? `ข้อมูลโซน ${visible[0].number}` : 'ยังไม่มีข้อมูลโซนนี้';
  for (const key of ['total', 'free', 'occupied']) setCount(`stat-${key}`, summary?.[key]);
  const percentage = summary?.total ? Math.round(summary.free / summary.total * 100) : summary ? 0 : null;
  $('free-percent').textContent = percentage == null ? '—' : `${percentage}%`;
  $('availability-fill').style.width = `${percentage || 0}%`;
  if (percentage == null) $('availability-bar').removeAttribute('aria-valuenow');
  else $('availability-bar').setAttribute('aria-valuenow', String(percentage));
  const status = !playableZones().length ? 'ไม่พบกล้อง' : !playableZones().some(z => z.track) ? 'ยังไม่มีข้อมูลจำนวนโต๊ะ' : !summary ? 'กำลังโหลดข้อมูล' : current?.readyState < 3 ? 'กำลังโหลดภาพ' : '';
  $('data-status').textContent = status;
  $('data-status').hidden = !status;
  updateFullscreenControls();
}

async function playVisible() {
  await Promise.all(playableZones().map(async zone => {
    try { await zone.video.play(); } catch { /* Media errors are shown by the camera's error handler. */ }
  }));
  updateDashboard();
}

function selectZone(id, { historyMode = 'push' } = {}) {
  if (id !== 'all' && !zones.some(zone => zone.id === id)) return;
  activeZone = id;
  writeZoneUrl(id, historyMode);
  document.querySelectorAll('.zone-nav button').forEach(button => {
    if (button.dataset.zone === id) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  grid.classList.toggle('single-view', id !== 'all');
  for (const zone of zones) {
    zone.card.hidden = id !== 'all' && zone.id !== id;
    zone.card.querySelector('.zone-link').textContent = id === 'all' ? 'ดูโซนนี้' : 'ดูทุกโซน';
    zone.card.querySelector('.zone-link').setAttribute('aria-label', id === 'all' ? `ดูโซน ${zone.number}` : 'ดูทุกโซน');
    if (zone.card.hidden) zone.video.pause();
  }
  const title = id === 'all' ? 'ภาพรวมทั้ง 4 โซน' : `สรุปจำนวนโต๊ะ · โซน ${zones.find(z => z.id === id).number}`;
  $('dashboard-title').textContent = title;
  $('camera-title').textContent = id === 'all' ? 'มุมกล้องทั้งหมด' : `มุมกล้องโซน ${zones.find(z => z.id === id).number}`;
  void playVisible();
  updateDashboard();
}

function renderZone(zone) {
  const card = document.createElement('article');
  card.className = 'camera-card';
  card.setAttribute('aria-label', `กล้องโซน ${zone.number}`);
  // IDs and numbers are validated before rendering. No API strings are inserted as HTML.
  card.innerHTML = `<div class="camera-card-heading"><h3>โซน ${zone.number}</h3><div class="camera-actions"><button type="button" class="button button-secondary fullscreen-toggle" aria-pressed="false" hidden>เต็มจอ</button><button type="button" class="zone-link">ดูโซนนี้</button></div></div>
    <p class="fullscreen-error" role="status" hidden>ไม่สามารถเปิดเต็มจอได้ กรุณาลองอีกครั้ง</p>
    <div class="video-stage"><video autoplay muted playsinline loop preload="auto" aria-label="ภาพจากกล้องโซน ${zone.number}"></video><span class="video-message" role="status">กำลังโหลดภาพ…</span></div>
    <div class="camera-stats"><div class="camera-stat free"><span>ว่าง</span><strong id="${zone.id}-free">—</strong><small>โต๊ะ</small></div><div class="camera-stat occupied"><span>ไม่ว่าง</span><strong id="${zone.id}-occupied">—</strong><small>โต๊ะ</small></div><div class="camera-stat"><span>ตรวจจับได้</span><strong id="${zone.id}-total">—</strong><small>โต๊ะ</small></div></div>
    <p class="camera-missing-message" role="status" hidden>ไม่พบกล้อง</p>`;
  zone.card = card;
  zone.video = card.querySelector('video');
  zone.video.muted = true;
  const message = card.querySelector('.video-message');
  const missingMessage = card.querySelector('.camera-missing-message');
  zone.video.addEventListener('loadeddata', () => { card.classList.remove('is-unavailable'); message.hidden = true; missingMessage.hidden = true; updateDashboard(); });
  zone.video.addEventListener('error', () => { card.classList.add('is-unavailable'); message.hidden = true; missingMessage.hidden = false; updateDashboard(); });
  zone.video.addEventListener('timeupdate', () => {
    if (!zone.card.hidden) updateDashboard();
  });
  for (const event of ['loadedmetadata', 'play', 'pause', 'waiting', 'playing', 'seeked']) zone.video.addEventListener(event, updateDashboard);
  for (const event of ['webkitbeginfullscreen', 'webkitendfullscreen']) zone.video.addEventListener(event, updateFullscreenControls);
  card.querySelector('.fullscreen-toggle').addEventListener('click', () => void toggleFullscreen(zone));
  card.querySelector('.zone-link').addEventListener('click', () => {
    selectZone(activeZone === 'all' ? zone.id : 'all');
    focusSelectedZone();
  });
  if (zone.videoUrl) zone.video.src = zone.videoUrl;
  else { card.classList.add('is-unavailable'); message.hidden = true; missingMessage.hidden = false; }
  grid.append(card);
}

document.querySelectorAll('.zone-nav button').forEach(button => button.addEventListener('click', () => selectZone(button.dataset.zone)));
function restoreZoneFromUrl() {
  if (grid.getAttribute('aria-busy') !== 'false' || !zones.length) return;
  const id = zoneFromUrl();
  if (id !== activeZone) selectZone(id, { historyMode: 'replace' });
  else writeZoneUrl(id, 'replace');
}
window.addEventListener('popstate', restoreZoneFromUrl);
window.addEventListener('hashchange', restoreZoneFromUrl);

async function init() {
  try {
    const response = await fetch('/api/zones');
    if (!response.ok) throw new Error('zones unavailable');
    const data = await response.json();
    if (!Array.isArray(data.zones) || data.zones.length !== 4 || !data.zones.every((z, index) => z.id === `zone${index + 1}` && z.number === index + 1)) throw new Error('invalid zones');
    const tracks = new Map();
    zones = data.zones;
    await Promise.all(zones.map(async zone => {
      if (zone.countsUrl) {
        if (!tracks.has(zone.countsUrl)) tracks.set(zone.countsUrl, fetch(zone.countsUrl).then(async res => {
          if (!res.ok) return null;
          const track = await res.json();
          return validateTrack(track) ? track : null;
        }).catch(() => null));
        zone.track = await tracks.get(zone.countsUrl);
      }
    }));
    grid.replaceChildren();
    zones.forEach(renderZone);
    grid.setAttribute('aria-busy', 'false');
    if (zones.some(z => z.videoUrl && !z.track)) showError('บางโซนยังไม่มีข้อมูลจำนวนโต๊ะ จึงแสดง —');
    selectZone(zoneFromUrl(), { historyMode: 'replace' });
  } catch (error) {
    console.error('Unable to load cameras', error);
    $('data-status').textContent = 'โหลดข้อมูลไม่สำเร็จ';
    $('data-status').hidden = false;
    grid.replaceChildren();
    grid.setAttribute('aria-busy', 'false');
    showError('ไม่สามารถโหลดข้อมูลได้ กรุณาลองโหลดหน้าใหม่');
  }
}
void init();
