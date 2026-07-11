
const state = {
  manifest: null,
  latest: null,
  catalog: null,
  currentWeek: null,
  currentChart: null,
  filteredEntries: [],
  filters: {
    query: '',
    movement: 'all',
    rankMin: 1,
    rankMax: 100,
  },
  theme: null,
};

const el = {
  weekPicker: document.getElementById('week-picker'),
  weekOf: document.getElementById('week-of'),
  archiveNav: document.getElementById('archive-nav'),
  archiveCurrentWeek: document.getElementById('archive-current-week'),
  archiveWeekCount: document.getElementById('archive-week-count'),
  chartSearch: document.getElementById('chart-search'),
  clearSearch: document.getElementById('clear-search'),
  rankMin: document.getElementById('rank-min'),
  rankMax: document.getElementById('rank-max'),
  resetFilters: document.getElementById('reset-filters'),
  resultsSummary: document.getElementById('results-summary'),
  statNewSongs: document.getElementById('stat-new-songs'),
  statReEntries: document.getElementById('stat-re-entries'),
  statCarryovers: document.getElementById('stat-carryovers'),
  statBiggestRise: document.getElementById('stat-biggest-rise'),
  statTopPoints: document.getElementById('stat-top-points'),
  spotlightSongLink: document.getElementById('spotlight-song-link'),
  spotlightArtistLink: document.getElementById('spotlight-artist-link'),
  spotlightSummary: document.getElementById('spotlight-summary'),
  spotlightMovement: document.getElementById('spotlight-movement'),
  spotlightPoints: document.getElementById('spotlight-points'),
  spotlightCover: document.getElementById('spotlight-cover'),
  viewRoot: document.getElementById('view-root'),
  template: document.getElementById('chart-row-template'),
  backToChart: document.getElementById('back-to-chart'),
  themeToggle: document.querySelector('[data-theme-toggle]'),
  movementPills: Array.from(document.querySelectorAll('[data-movement-filter]')),
  songModal: document.getElementById('song-modal'),
  songModalClose: document.getElementById('song-modal-close'),
  songModalTitle: document.getElementById('song-modal-title'),
  songModalArtist: document.getElementById('song-modal-artist'),
  songModalCover: document.getElementById('song-modal-cover'),
  songModalRank: document.getElementById('song-modal-rank'),
  songModalMovement: document.getElementById('song-modal-movement'),
  songModalPoints: document.getElementById('song-modal-points'),
  songModalListeners: document.getElementById('song-modal-listeners'),
  songModalLastWeek: document.getElementById('song-modal-last-week'),
  songModalPeak: document.getElementById('song-modal-peak'),
  songModalWeeks: document.getElementById('song-modal-weeks'),
  songModalSummary: document.getElementById('song-modal-summary'),
  songModalOpenSong: document.getElementById('song-modal-open-song'),
  songModalOpenArtist: document.getElementById('song-modal-open-artist'),
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
  return dt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getSongKey(title, artist) {
  return `${String(artist || '').trim()} - ${String(title || '').trim()}`.toLowerCase();
}

function imagePath(relativePath) {
  return `./${relativePath || 'covers/_placeholder.png'}`;
}

function setImageWithFallback(img, relativePath, altText) {
  if (!img) return;
  img.src = imagePath(relativePath);
  img.alt = altText || '';
  img.addEventListener('error', () => {
    img.src = './covers/_placeholder.png';
  }, { once: true });
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

function movementBadgeText(movement) {
  if (!movement) return '—';
  if (movement.type === 'new') return 'NEW';
  if (movement.type === 're') return 'RE-ENTRY';
  if (movement.type === 'stay') return '→ STAY';
  if (movement.type === 'up') return `▲ UP ${movement.value}`;
  if (movement.type === 'down') return `▼ DOWN ${movement.value}`;
  return '—';
}

function movementBadgeClass(movement) {
  const type = movement?.type || 'stay';
  return `movement-badge movement-badge-${type}`;
}

function applyMovementBadge(node, movement, large = false) {
  if (!node) return;
  node.className = movementBadgeClass(movement) + (large ? ' movement-badge-lg' : '');
  node.textContent = movementBadgeText(movement);
}

function updateArchiveRail() {
  if (el.archiveCurrentWeek) {
    el.archiveCurrentWeek.textContent = state.currentWeek ? formatWeekLabel(state.currentWeek) : '—';
  }

  if (el.archiveWeekCount) {
    el.archiveWeekCount.textContent = String((state.manifest?.weeks || []).length || 0);
  }

  if (!el.archiveNav) return;

  el.archiveNav.innerHTML = '';
  const weeks = state.manifest?.weeks || [];
  const fragment = document.createDocumentFragment();

  weeks.forEach((week) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'archive-link' + (week === state.currentWeek ? ' is-active' : '');
    button.innerHTML = `
      <span class="archive-link-week">${escapeHtml(formatWeekLabel(week))}</span>
      <span class="archive-link-meta">${week === state.currentWeek ? 'Loaded week' : 'Open week'}</span>
    `;
    button.addEventListener('click', async () => {
      await loadWeek(week);
    });
    fragment.appendChild(button);
  });

  el.archiveNav.appendChild(fragment);
}

function updateSpotlight(chart) {
  const top = chart?.entries?.find((entry) => Number(entry.rank) === 1) || chart?.entries?.[0];
  if (!top) return;

  if (el.weekOf) el.weekOf.textContent = formatWeekLabel(chart.week);
  if (el.spotlightSongLink) el.spotlightSongLink.textContent = top.title || 'Untitled';
  if (el.spotlightArtistLink) el.spotlightArtistLink.textContent = top.artist || 'Unknown artist';
  if (el.spotlightSummary) {
    el.spotlightSummary.textContent = `${top.title} by ${top.artist} leads the chart this week with ${Number(top.points || 0).toFixed(1)} points.`;
  }
  if (el.spotlightPoints) {
    el.spotlightPoints.textContent = `${Number(top.points || 0).toFixed(1)} pts`;
  }

  applyMovementBadge(el.spotlightMovement, top.movement, true);
  setImageWithFallback(el.spotlightCover, top.cover, `${top.title} cover art`);

  el.spotlightSongLink?.replaceWith(el.spotlightSongLink.cloneNode(true));
  el.spotlightArtistLink?.replaceWith(el.spotlightArtistLink.cloneNode(true));

  el.spotlightSongLink = document.getElementById('spotlight-song-link');
  el.spotlightArtistLink = document.getElementById('spotlight-artist-link');

  el.spotlightSongLink?.addEventListener('click', () => renderSongView(top.artist, getSongKey(top.title, top.artist)));
  el.spotlightArtistLink?.addEventListener('click', () => renderArtistView(top.artist));
}

function updateStats(chart) {
  const entries = chart?.entries || [];
  const newSongs = entries.filter((entry) => entry.movement?.type === 'new').length;
  const reEntries = entries.filter((entry) => entry.movement?.type === 're').length;
  const carryovers = entries.filter((entry) => !['new', 're'].includes(entry.movement?.type)).length;
  const biggestRiseEntry = [...entries]
    .filter((entry) => entry.movement?.type === 'up')
    .sort((a, b) => (b.movement?.value || 0) - (a.movement?.value || 0))[0];
  const topPoints = [...entries].sort((a, b) => Number(b.points || 0) - Number(a.points || 0))[0];

  if (el.statNewSongs) el.statNewSongs.textContent = newSongs ? String(newSongs) : '—';
  if (el.statReEntries) el.statReEntries.textContent = reEntries ? String(reEntries) : '—';
  if (el.statCarryovers) el.statCarryovers.textContent = carryovers ? String(carryovers) : '—';
  if (el.statBiggestRise) el.statBiggestRise.textContent = biggestRiseEntry ? `+${biggestRiseEntry.movement.value}` : '—';
  if (el.statTopPoints) el.statTopPoints.textContent = topPoints ? `${Number(topPoints.points || 0).toFixed(1)}` : '—';
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

function getFilteredEntries(chart) {
  const query = state.filters.query.trim().toLowerCase();
  const movement = state.filters.movement;
  const rankMin = Math.max(1, Number(state.filters.rankMin || 1));
  const rankMax = Math.min(100, Number(state.filters.rankMax || 100));

  return (chart?.entries || []).filter((entry) => {
    const rank = Number(entry.rank || 0);
    if (rank < rankMin || rank > rankMax) return false;
    if (movement !== 'all' && entry.movement?.type !== movement) return false;
    if (!query) return true;

    const haystack = `${entry.title || ''} ${entry.artist || ''}`.toLowerCase();
    return haystack.includes(query);
  });
}

function updateResultsSummary(entries) {
  if (!el.resultsSummary) return;
  if (!entries.length) {
    el.resultsSummary.textContent = 'No songs matched your current search and filters.';
    return;
  }

  const rangeText = `${state.filters.rankMin}-${state.filters.rankMax}`;
  const movementTextLabel = state.filters.movement === 'all' ? 'all movement types' : `${state.filters.movement} moves`;
  const queryText = state.filters.query ? ` for "${state.filters.query}"` : '';
  el.resultsSummary.textContent = `Showing ${entries.length} charted songs in ranks ${rangeText} across ${movementTextLabel}${queryText}.`;
}

function openSongModal(entry) {
  if (!el.songModal) return;

  if (el.songModalTitle) el.songModalTitle.textContent = entry.title || 'Untitled';
  if (el.songModalArtist) el.songModalArtist.textContent = entry.artist || 'Unknown artist';
  if (el.songModalRank) el.songModalRank.textContent = `Rank #${entry.rank ?? '—'}`;
  if (el.songModalPoints) el.songModalPoints.textContent = `${Number(entry.points || 0).toFixed(1)}`;
  if (el.songModalListeners) el.songModalListeners.textContent = `${entry.listeners ?? '—'}`;
  if (el.songModalLastWeek) el.songModalLastWeek.textContent = `${entry.lastWeek ?? '—'}`;
  if (el.songModalPeak) el.songModalPeak.textContent = `${entry.peak ?? '—'}`;
  if (el.songModalWeeks) el.songModalWeeks.textContent = `${entry.weeks ?? '—'}`;
  if (el.songModalSummary) {
    el.songModalSummary.textContent = `${entry.title} by ${entry.artist} is currently ranked #${entry.rank} with ${Number(entry.points || 0).toFixed(1)} points.`;
  }

  setImageWithFallback(el.songModalCover, entry.cover, `${entry.title} cover art`);
  applyMovementBadge(el.songModalMovement, entry.movement, true);

  el.songModalArtist?.replaceWith(el.songModalArtist.cloneNode(true));
  el.songModalOpenSong?.replaceWith(el.songModalOpenSong.cloneNode(true));
  el.songModalOpenArtist?.replaceWith(el.songModalOpenArtist.cloneNode(true));

  el.songModalArtist = document.getElementById('song-modal-artist');
  el.songModalOpenSong = document.getElementById('song-modal-open-song');
  el.songModalOpenArtist = document.getElementById('song-modal-open-artist');

  el.songModalArtist?.addEventListener('click', () => {
    el.songModal.close();
    renderArtistView(entry.artist);
  });

  el.songModalOpenSong?.addEventListener('click', () => {
    el.songModal.close();
    renderSongView(entry.artist, getSongKey(entry.title, entry.artist));
  });

  el.songModalOpenArtist?.addEventListener('click', () => {
    el.songModal.close();
    renderArtistView(entry.artist);
  });

  if (typeof el.songModal.showModal === 'function') {
    el.songModal.showModal();
  }
}

function renderChart(chart) {
  updateArchiveRail();
  updateSpotlight(chart);
  updateStats(chart);

  el.viewRoot.innerHTML = '';
  el.backToChart.classList.add('hidden');

  const filteredEntries = getFilteredEntries(chart);
  state.filteredEntries = filteredEntries;
  updateResultsSummary(filteredEntries);

  if (!filteredEntries.length) {
    el.viewRoot.innerHTML = '<div class="empty-state">No songs matched the current search and filter settings.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  filteredEntries.forEach((entry) => {
    const node = el.template.content.firstElementChild.cloneNode(true);
    if (entry.rank === 1) node.classList.add('top-spot');

    const rankEl = node.querySelector('.rank-number');
    if (rankEl) rankEl.textContent = entry.rank;

    const img = node.querySelector('.cover-image');
    setImageWithFallback(img, entry.cover, `${entry.title} cover art`);

    const moveEl = node.querySelector('.movement-badge');
    applyMovementBadge(moveEl, entry.movement, false);

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

    const pointText = `${Number(entry.points || 0).toFixed(1)} pts`;

    const desktopPtsEl = node.querySelector('.desktop-points');
    if (desktopPtsEl) desktopPtsEl.textContent = pointText;

    const mobilePtsEl = node.querySelector('.mobile-points');
    if (mobilePtsEl) mobilePtsEl.textContent = pointText;

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
        openSongModal(entry);
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
    <p class="view-panel-subtitle">${songs.length} charted song${songs.length === 1 ? '' : 's'} in the archive.</p>
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
      <img src="${escapeHtml(imagePath(song.cover || 'covers/_placeholder.png'))}" alt="${escapeHtml(song.title)} cover art" loading="lazy" decoding="async" width="84" height="84">
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
        <img src="${escapeHtml(imagePath(song.cover || 'covers/_placeholder.png'))}" alt="${escapeHtml(song.title)} cover art" loading="lazy" decoding="async" width="84" height="84">
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
  if (!el.weekPicker) return;
  el.weekPicker.innerHTML = '';
  weeks.forEach((week) => {
    const option = document.createElement('option');
    option.value = week;
    option.textContent = formatWeekLabel(week);
    option.selected = week === selectedWeek;
    el.weekPicker.appendChild(option);
  });
}

function syncFilterUi() {
  if (el.chartSearch) el.chartSearch.value = state.filters.query;
  if (el.rankMin) el.rankMin.value = String(state.filters.rankMin);
  if (el.rankMax) el.rankMax.value = String(state.filters.rankMax);

  el.movementPills.forEach((pill) => {
    pill.classList.toggle('is-active', pill.dataset.movementFilter === state.filters.movement);
  });
}

function resetFilters() {
  state.filters.query = '';
  state.filters.movement = 'all';
  state.filters.rankMin = 1;
  state.filters.rankMax = 100;
  syncFilterUi();
  if (state.currentChart) renderChart(state.currentChart);
}

function bindFilterEvents() {
  el.chartSearch?.addEventListener('input', (event) => {
    state.filters.query = event.target.value || '';
    if (state.currentChart) renderChart(state.currentChart);
  });

  el.clearSearch?.addEventListener('click', () => {
    state.filters.query = '';
    syncFilterUi();
    if (state.currentChart) renderChart(state.currentChart);
  });

  el.rankMin?.addEventListener('input', (event) => {
    state.filters.rankMin = Math.max(1, Math.min(100, Number(event.target.value || 1)));
    if (state.currentChart) renderChart(state.currentChart);
  });

  el.rankMax?.addEventListener('input', (event) => {
    state.filters.rankMax = Math.max(1, Math.min(100, Number(event.target.value || 100)));
    if (state.currentChart) renderChart(state.currentChart);
  });

  el.resetFilters?.addEventListener('click', () => {
    resetFilters();
  });

  el.movementPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      state.filters.movement = pill.dataset.movementFilter || 'all';
      syncFilterUi();
      if (state.currentChart) renderChart(state.currentChart);
    });
  });

  el.songModalClose?.addEventListener('click', () => {
    el.songModal?.close();
  });

  el.songModal?.addEventListener('click', (event) => {
    const rect = el.songModal.getBoundingClientRect();
    const inDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!inDialog) el.songModal.close();
  });
}

async function loadWeek(week) {
  const chart = await fetchJson(`./data/${week}.json`);
  state.currentWeek = week;
  state.currentChart = chart;
  populateWeekPicker(state.manifest.weeks, week);
  updateArchiveRail();
  renderChart(chart);
}

async function init() {
  initTheme();
  bindFilterEvents();

  state.manifest = await fetchJson('./data/manifest.json');
  state.latest = await fetchJson('./data/latest.json');
  state.catalog = await fetchJson('./data/catalog.json');

  const weeks = state.manifest?.weeks || [];
  const initialWeek = state.latest?.week || weeks[0];

  if (!initialWeek) {
    if (el.viewRoot) {
      el.viewRoot.innerHTML = '<div class="empty-state">No chart weeks have been exported yet.</div>';
    }
    return;
  }

  populateWeekPicker(weeks, initialWeek);
  syncFilterUi();

  el.weekPicker?.addEventListener('change', async (event) => {
    await loadWeek(event.target.value);
  });

  el.backToChart?.addEventListener('click', () => {
    if (state.currentChart) renderChart(state.currentChart);
  });

  await loadWeek(initialWeek);
}

init().catch((error) => {
  console.error(error);
  if (el.viewRoot) {
    el.viewRoot.innerHTML = `<div class="empty-state">Could not load the chart site files. ${escapeHtml(error.message)}</div>`;
  }
});
