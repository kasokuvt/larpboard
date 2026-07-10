
const state = {
  manifest: null,
  latest: null,
  catalog: null,
  currentWeek: null,
  currentChart: null,
  theme: null,
};

const el = {
  weekPicker: document.getElementById('week-picker'),
  weekOf: document.getElementById('week-of'),
  statNewSongs: document.getElementById('stat-new-songs'),
  statReEntries: document.getElementById('stat-re-entries'),
  statCarryovers: document.getElementById('stat-carryovers'),
  viewRoot: document.getElementById('view-root'),
  template: document.getElementById('chart-row-template'),
  backToChart: document.getElementById('back-to-chart'),
  themeToggle: document.querySelector('[data-theme-toggle]'),
};

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  if (el.themeToggle) {
    el.themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    el.themeToggle.innerHTML = `<span class="theme-toggle-inner">${theme === 'dark' ? '◐' : '◑'}</span>`;
  }
}

function initTheme() {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(prefersDark ? 'dark' : 'light');
  el.themeToggle?.addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
  });
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to fetch ${path}`);
  return response.json();
}

function formatWeekLabel(week) {
  const dt = new Date(`${week}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return week;
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function movementText(movement) {
  if (!movement) return '—';
  if (movement.type === 'new') return 'New this week';
  if (movement.type === 're') return 'Re-entry';
  if (movement.type === 'stay') return 'No movement';
  if (movement.type === 'up') return `Up ${movement.value}`;
  if (movement.type === 'down') return `Down ${movement.value}`;
  return '—';
}

function movementBadge(movement) {
  if (!movement) return '—';
  if (movement.type === 'new') return 'NEW';
  if (movement.type === 're') return 'RE';
  if (movement.type === 'stay') return '→';
  if (movement.type === 'up') return `↑ ${movement.value}`;
  if (movement.type === 'down') return `↓ ${movement.value}`;
  return '—';
}

function getSongKey(title, artist) {
  return `${String(artist || '').trim()} - ${String(title || '').trim()}`.toLowerCase();
}

function updateHero(chart) {
  if (el.weekOf) el.weekOf.textContent = formatWeekLabel(chart.week);
  if (el.statNewSongs) {
    const count = chart.entries.filter((entry) => entry.movement?.type === 'new').length;
    el.statNewSongs.textContent = count ? String(count) : '—';
  }
  if (el.statReEntries) {
    const count = chart.entries.filter((entry) => entry.movement?.type === 're').length;
    el.statReEntries.textContent = count ? String(count) : '—';
  }
  if (el.statCarryovers) {
    const count = chart.entries.filter((entry) => !['new', 're'].includes(entry.movement?.type)).length;
    el.statCarryovers.textContent = count ? String(count) : '—';
  }
}

function buildDetailPanel(entry) {
  const points = Number(entry.points || 0).toFixed(1);
  return `
    <div class="detail-card">
      <h3>Movement</h3>
      <p>${escapeHtml(movementText(entry.movement))}</p>
    </div>
    <div class="detail-card">
      <h3>Chart stats</h3>
      <ul>
        <li>Last week: ${escapeHtml(entry.lastWeek ?? '—')}</li>
        <li>Peak: ${escapeHtml(entry.peak ?? '—')}</li>
        <li>Weeks on chart: ${escapeHtml(entry.weeks ?? '—')}</li>
        <li>Points: ${escapeHtml(points)}</li>
        <li>Listeners: ${escapeHtml(entry.listeners ?? '—')}</li>
      </ul>
    </div>
    <div class="detail-card">
      <h3>Explore</h3>
      <ul>
        <li>Open the song page for archive history.</li>
        <li>Open the artist page to browse every charted song.</li>
      </ul>
    </div>
  `;
}

function renderChart(chart) {
  updateHero(chart);
  el.viewRoot.innerHTML = '';
  el.backToChart.classList.add('hidden');

  const fragment = document.createDocumentFragment();

  chart.entries.forEach((entry) => {
    const node = el.template.content.firstElementChild.cloneNode(true);
    if (entry.rank === 1) node.classList.add('top-spot');

    const rankEl = node.querySelector('.rank-number');
    if (rankEl) rankEl.textContent = entry.rank;

    const img = node.querySelector('.cover-image');
    if (img) {
      img.src = `./${entry.cover}`;
      img.alt = `${entry.title} cover art`;
      img.addEventListener('error', () => {
        img.src = './covers/_placeholder.png';
      }, { once: true });
    }

    const moveEl = node.querySelector('.movement-line');
    if (moveEl) moveEl.textContent = movementBadge(entry.movement);

    const titleBtn = node.querySelector('.song-title-link');
    if (titleBtn) {
      titleBtn.textContent = entry.title;
      titleBtn.addEventListener('click', () => renderSongView(entry.artist, getSongKey(entry.title, entry.artist)));
    }

    const artistBtn = node.querySelector('.artist-link');
    if (artistBtn) {
      artistBtn.textContent = entry.artist;
      artistBtn.addEventListener('click', () => renderArtistView(entry.artist));
    }

    const ptsEl = node.querySelector('.song-points');
    if (ptsEl) ptsEl.textContent = `${Number(entry.points || 0).toFixed(1)} pts`;
    const lwEl = node.querySelector('.meta-lw');
    if (lwEl) lwEl.textContent = entry.lastWeek ?? '—';
    const peakEl = node.querySelector('.meta-peak');
    if (peakEl) peakEl.textContent = entry.peak ?? '—';
    const weeksEl = node.querySelector('.meta-weeks');
    if (weeksEl) weeksEl.textContent = entry.weeks ?? '—';

    let detailPanel = node.querySelector('.detail-panel');
    if (!detailPanel) {
      detailPanel = document.createElement('div');
      detailPanel.className = 'detail-panel hidden';
      node.appendChild(detailPanel);
    }
    detailPanel.innerHTML = buildDetailPanel(entry);
    detailPanel.classList.add('hidden');

    const expandButton = node.querySelector('.expand-button');
    if (expandButton) {
      expandButton.textContent = '+';
      expandButton.type = 'button';
      expandButton.dataset.open = 'false';
      expandButton.setAttribute('aria-expanded', 'false');
      expandButton.setAttribute('aria-label', 'Open song details');
      expandButton.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = detailPanel.classList.contains('hidden');
        detailPanel.classList.toggle('hidden', !willOpen);
        expandButton.dataset.open = willOpen ? 'true' : 'false';
        expandButton.textContent = willOpen ? '−' : '+';
        expandButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        expandButton.setAttribute('aria-label', willOpen ? 'Close song details' : 'Open song details');
      };
    }

    fragment.appendChild(node);
  });

  el.viewRoot.appendChild(fragment);
}

function renderArtistView(artistName) {
  const artist = state.catalog?.artists?.[artistName];
  el.backToChart.classList.remove('hidden');

  if (!artist) {
    el.viewRoot.innerHTML = `
      <section class="view-panel">
        <h3>Artist page</h3>
        <p class="view-panel-subtitle">No archive data found for ${escapeHtml(artistName)}.</p>
      </section>
    `;
    return;
  }

  const songs = Object.values(artist.songs || {}).sort((a, b) =>
    (a.peak ?? 999) - (b.peak ?? 999) || (b.weeks ?? 0) - (a.weeks ?? 0)
  );

  const panel = document.createElement('section');
  panel.className = 'view-panel';
  panel.innerHTML = `
    <h3>${escapeHtml(artistName)}</h3>
    <p class="view-panel-subtitle">${songs.length} charted song${songs.length === 1 ? '' : 's'} in the Larpboard archive.</p>
    <div class="artist-song-grid"></div>
  `;

  const grid = panel.querySelector('.artist-song-grid');

  if (!songs.length) {
    grid.innerHTML = '<div class="empty-state">No songs found for this artist yet.</div>';
    el.viewRoot.innerHTML = '';
    el.viewRoot.appendChild(panel);
    return;
  }

  songs.forEach((song) => {
    const card = document.createElement('article');
    card.className = 'artist-song-card';
    card.innerHTML = `
      <img src="./${escapeHtml(song.cover || 'covers/_placeholder.png')}" alt="${escapeHtml(song.title)} cover art" loading="lazy" decoding="async" width="84" height="84">
      <div>
        <button type="button" class="artist-song-link">${escapeHtml(song.title)}</button>
        <p class="view-panel-subtitle">Peak ${escapeHtml(song.peak)} · ${escapeHtml(song.weeks)} weeks</p>
      </div>
      <span>#${escapeHtml(song.peak)}</span>
    `;

    const btn = card.querySelector('.artist-song-link');
    btn.addEventListener('click', () => renderSongView(artistName, getSongKey(song.title, artistName)));

    const image = card.querySelector('img');
    image.addEventListener('error', () => {
      image.src = './covers/_placeholder.png';
    }, { once: true });

    grid.appendChild(card);
  });

  el.viewRoot.innerHTML = '';
  el.viewRoot.appendChild(panel);
}

function renderSongView(artistName, songKey) {
  const artist = state.catalog?.artists?.[artistName];
  const song = artist?.songs?.[songKey];
  el.backToChart.classList.remove('hidden');

  if (!song) {
    el.viewRoot.innerHTML = `
      <section class="view-panel">
        <h3>Song page</h3>
        <p class="view-panel-subtitle">No archive data found for this song.</p>
      </section>
    `;
    return;
  }

  const history = [...(song.history || [])].sort((a, b) => String(b.week).localeCompare(String(a.week)));

  const panel = document.createElement('section');
  panel.className = 'view-panel';
  panel.innerHTML = `
    <h3>${escapeHtml(song.title)}</h3>
    <p class="view-panel-subtitle">${escapeHtml(artistName)} · Peak ${escapeHtml(song.peak)} · ${escapeHtml(song.weeks)} weeks on chart</p>
    <div class="artist-song-grid">
      <article class="artist-song-card">
        <img src="./${escapeHtml(song.cover || 'covers/_placeholder.png')}" alt="${escapeHtml(song.title)} cover art" loading="lazy" decoding="async" width="84" height="84">
        <div>
          <button type="button" class="artist-song-link">Browse this artist page</button>
          <p class="view-panel-subtitle">Return to ${escapeHtml(artistName)}&#39;s charted songs.</p>
        </div>
        <span>#${escapeHtml(song.peak)}</span>
      </article>
    </div>
    <ul class="history-list"></ul>
  `;

  const image = panel.querySelector('img');
  image.addEventListener('error', () => {
    image.src = './covers/_placeholder.png';
  }, { once: true });

  panel.querySelector('.artist-song-link').addEventListener('click', () => renderArtistView(artistName));

  const list = panel.querySelector('.history-list');
  if (!history.length) {
    list.innerHTML = '<li class="empty-state">No weekly history available yet.</li>';
  } else {
    history.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <span>${escapeHtml(formatWeekLabel(item.week))}</span>
        <span>Rank ${escapeHtml(item.rank)} · ${escapeHtml(Number(item.points || 0).toFixed(1))} pts · ${escapeHtml(item.listeners ?? '—')} listeners</span>
      `;
      list.appendChild(li);
    });
  }

  el.viewRoot.innerHTML = '';
  el.viewRoot.appendChild(panel);
}

function populateWeekPicker(weeks, selectedWeek) {
  el.weekPicker.innerHTML = '';
  weeks.forEach((week) => {
    const option = document.createElement('option');
    option.value = week;
    option.textContent = formatWeekLabel(week);
    option.selected = week === selectedWeek;
    el.weekPicker.appendChild(option);
  });
}

async function loadWeek(week) {
  const chart = await fetchJson(`./data/${week}.json`);
  state.currentWeek = week;
  state.currentChart = chart;
  populateWeekPicker(state.manifest.weeks, week);
  renderChart(chart);
}

async function init() {
  initTheme();
  state.manifest = await fetchJson('./data/manifest.json');
  state.latest = await fetchJson('./data/latest.json');
  state.catalog = await fetchJson('./data/catalog.json');

  const weeks = state.manifest?.weeks || [];
  const initialWeek = state.latest?.week || weeks[0];

  if (!initialWeek) {
    el.viewRoot.innerHTML = '<div class="empty-state">No chart weeks have been exported yet.</div>';
    return;
  }

  populateWeekPicker(weeks, initialWeek);

  el.weekPicker.addEventListener('change', async (event) => {
    await loadWeek(event.target.value);
  });

  el.backToChart.addEventListener('click', () => {
    if (state.currentChart) renderChart(state.currentChart);
  });

  await loadWeek(initialWeek);
}

init().catch((error) => {
  console.error(error);
  el.viewRoot.innerHTML = `<div class="empty-state">Could not load the chart site files. ${escapeHtml(error.message)}</div>`;
});
