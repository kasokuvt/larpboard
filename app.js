
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
  spotlightTitle: document.getElementById('spotlight-heading'),
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
  if (movement.type === 're') return 'RE-ENTRY';
  if (movement.type === 'stay') return '→ STAY';
  if (movement.type === 'up') return `↑ ${movement.value}`;
  if (movement.type === 'down') return `↓ ${movement.value}`;
  return '—';
}

function movementClass(movement) {
  const type = movement?.type || 'stay';
  return `movement-badge-${type === 're' ? 're' : type}`;
}

function getSongKey(title, artist) {
  return `${String(artist || '').trim()} - ${String(title || '').trim()}`.toLowerCase();
}

function formatPoints(value) {
  return `${Number(value || 0).toFixed(1)} pts`;
}

function applyMovementBadge(element, movement) {
  if (!element) return;
  const wantsLarge = element.dataset.size === 'lg';
  element.className = `movement-badge ${movementClass(movement)}${wantsLarge ? ' movement-badge-lg' : ''}`;
  element.textContent = movementBadge(movement);
  element.setAttribute('title', movementText(movement));
}

function parseRankInput(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function clampRankRange() {
  const maxRank = Math.max(...(state.currentChart?.entries || []).map((entry) => Number(entry.rank || 0)), 100);
  let min = parseRankInput(el.rankMin?.value, 1);
  let max = parseRankInput(el.rankMax?.value, maxRank);
  min = Math.max(1, Math.min(min, maxRank));
  max = Math.max(1, Math.min(max, maxRank));
  if (min > max) [min, max] = [max, min];
  state.filters.rankMin = min;
  state.filters.rankMax = max;
  if (el.rankMin) el.rankMin.value = String(min);
  if (el.rankMax) el.rankMax.value = String(max);
}

function filterEntries(entries) {
  const query = state.filters.query.trim().toLowerCase();
  const movement = state.filters.movement;
  const min = state.filters.rankMin;
  const max = state.filters.rankMax;
  return entries.filter((entry) => {
    const entryMovement = entry.movement?.type || 'stay';
    const matchesMovement = movement === 'all' ? true : entryMovement === movement;
    const matchesRank = Number(entry.rank) >= min && Number(entry.rank) <= max;
    const haystack = `${entry.title || ''} ${entry.artist || ''}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesMovement && matchesRank && matchesQuery;
  });
}

function buildSpotlightSummary(entry) {
  if (!entry) return 'No chart leader available for this week.';
  return `${entry.title} leads the chart for ${formatWeekLabel(state.currentWeek || entry.week || '')}. ${entry.artist} has ${formatPoints(entry.points)} and ${entry.listeners ?? '—'} listeners. ${movementText(entry.movement)}; peak ${entry.peak ?? '—'} across ${entry.weeks ?? '—'} weeks on chart.`;
}

function updateHero(chart) {
  if (el.weekOf) el.weekOf.textContent = formatWeekLabel(chart.week);
  if (el.archiveCurrentWeek) el.archiveCurrentWeek.textContent = formatWeekLabel(chart.week);
  if (el.archiveWeekCount) el.archiveWeekCount.textContent = String((state.manifest?.weeks || []).length || 0);

  const entries = chart.entries || [];
  const topEntry = entries[0];
  const biggestRise = [...entries]
    .filter((entry) => entry.movement?.type === 'up')
    .sort((a, b) => (b.movement?.value || 0) - (a.movement?.value || 0))[0];

  if (el.statNewSongs) el.statNewSongs.textContent = String(entries.filter((entry) => entry.movement?.type === 'new').length || 0);
  if (el.statReEntries) el.statReEntries.textContent = String(entries.filter((entry) => entry.movement?.type === 're').length || 0);
  if (el.statCarryovers) el.statCarryovers.textContent = String(entries.filter((entry) => !['new', 're'].includes(entry.movement?.type)).length || 0);
  if (el.statBiggestRise) el.statBiggestRise.textContent = biggestRise ? `${biggestRise.title} ↑${biggestRise.movement.value}` : '—';
  if (el.statTopPoints) el.statTopPoints.textContent = topEntry ? formatPoints(topEntry.points) : '—';

  if (topEntry) {
    if (el.spotlightTitle) el.spotlightTitle.textContent = 'No. 1 spotlight';
    if (el.spotlightSongLink) {
      el.spotlightSongLink.textContent = topEntry.title;
      el.spotlightSongLink.onclick = () => renderSongView(topEntry.artist, getSongKey(topEntry.title, topEntry.artist));
    }
    if (el.spotlightArtistLink) {
      el.spotlightArtistLink.textContent = topEntry.artist;
      el.spotlightArtistLink.onclick = () => renderArtistView(topEntry.artist);
    }
    if (el.spotlightSummary) el.spotlightSummary.textContent = buildSpotlightSummary(topEntry);
    if (el.spotlightPoints) el.spotlightPoints.textContent = formatPoints(topEntry.points);
    if (el.spotlightCover) {
      el.spotlightCover.src = `./${topEntry.cover}`;
      el.spotlightCover.alt = `${topEntry.title} cover art`;
      el.spotlightCover.onerror = () => {
        el.spotlightCover.src = './covers/_placeholder.png';
      };
    }
    if (el.spotlightMovement) applyMovementBadge(el.spotlightMovement, topEntry.movement);
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
        <li>Use the song detail modal for quick stats.</li>
      </ul>
    </div>
  `;
}

function updateResultsSummary(filteredEntries) {
  const total = state.currentChart?.entries?.length || 0;
  const movementTextValue = state.filters.movement === 'all' ? 'all movement types' : `${state.filters.movement} movers`;
  const queryText = state.filters.query ? ` matching “${state.filters.query}”` : '';
  const rankText = ` in ranks ${state.filters.rankMin}-${state.filters.rankMax}`;
  el.resultsSummary.textContent = `Showing ${filteredEntries.length} of ${total} entries for ${movementTextValue}${queryText}${rankText}.`;
}

function openSongModal(entry) {
  if (!el.songModal || !entry) return;
  el.songModalTitle.textContent = entry.title;
  el.songModalArtist.textContent = entry.artist;
  el.songModalArtist.onclick = () => renderArtistView(entry.artist);
  el.songModalRank.textContent = `#${entry.rank}`;
  el.songModalPoints.textContent = formatPoints(entry.points);
  el.songModalListeners.textContent = String(entry.listeners ?? '—');
  el.songModalLastWeek.textContent = String(entry.lastWeek ?? '—');
  el.songModalPeak.textContent = String(entry.peak ?? '—');
  el.songModalWeeks.textContent = String(entry.weeks ?? '—');
  el.songModalSummary.textContent = buildSpotlightSummary(entry);
  el.songModalCover.src = `./${entry.cover}`;
  el.songModalCover.alt = `${entry.title} cover art`;
  el.songModalCover.onerror = () => {
    el.songModalCover.src = './covers/_placeholder.png';
  };
  el.songModalOpenSong.onclick = () => {
    closeSongModal();
    renderSongView(entry.artist, getSongKey(entry.title, entry.artist));
  };
  el.songModalOpenArtist.onclick = () => {
    closeSongModal();
    renderArtistView(entry.artist);
  };
  applyMovementBadge(el.songModalMovement, entry.movement);
  if (typeof el.songModal.showModal === 'function') {
    el.songModal.showModal();
  }
}

function closeSongModal() {
  if (el.songModal?.open) el.songModal.close();
}

function renderChart(chart) {
  updateHero(chart);
  el.viewRoot.innerHTML = '';
  el.backToChart.classList.add('hidden');
  clampRankRange();
  const filteredEntries = filterEntries(chart.entries || []);
  state.filteredEntries = filteredEntries;
  updateResultsSummary(filteredEntries);

  if (!filteredEntries.length) {
    el.viewRoot.innerHTML = '<div class="empty-state">No songs match the current search and filter settings.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  filteredEntries.forEach((entry) => {
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

    const moveEl = node.querySelector('.movement-badge');
    if (moveEl) applyMovementBadge(moveEl, entry.movement);

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

    const pointText = formatPoints(entry.points);

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
  updateResultsSummary(state.filteredEntries || []);

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
  updateResultsSummary(state.filteredEntries || []);

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

function renderArchiveRail(weeks, selectedWeek) {
  if (!el.archiveNav) return;
  el.archiveNav.innerHTML = '';
  weeks.forEach((week, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `archive-link${week === selectedWeek ? ' is-active' : ''}`;
    button.innerHTML = `
      <span class="archive-link-week">${escapeHtml(formatWeekLabel(week))}</span>
      <span class="archive-link-meta">Week ${weeks.length - index}</span>
    `;
    button.addEventListener('click', async () => {
      await loadWeek(week);
    });
    el.archiveNav.appendChild(button);
  });
}

function setMovementFilter(value) {
  state.filters.movement = value;
  el.movementPills.forEach((pill) => {
    pill.classList.toggle('is-active', pill.dataset.movementFilter === value);
  });
  if (state.currentChart) renderChart(state.currentChart);
}

async function loadWeek(week) {
  const chart = await fetchJson(`./data/${week}.json`);
  state.currentWeek = week;
  state.currentChart = chart;
  populateWeekPicker(state.manifest.weeks, week);
  renderArchiveRail(state.manifest.weeks, week);
  renderChart(chart);
}

function bindUi() {
  el.weekPicker.addEventListener('change', async (event) => {
    await loadWeek(event.target.value);
  });

  el.backToChart.addEventListener('click', () => {
    if (state.currentChart) renderChart(state.currentChart);
  });

  el.chartSearch?.addEventListener('input', () => {
    state.filters.query = el.chartSearch.value || '';
    if (state.currentChart) renderChart(state.currentChart);
  });

  el.clearSearch?.addEventListener('click', () => {
    if (!el.chartSearch) return;
    el.chartSearch.value = '';
    state.filters.query = '';
    if (state.currentChart) renderChart(state.currentChart);
  });

  el.rankMin?.addEventListener('input', () => {
    clampRankRange();
    if (state.currentChart) renderChart(state.currentChart);
  });

  el.rankMax?.addEventListener('input', () => {
    clampRankRange();
    if (state.currentChart) renderChart(state.currentChart);
  });

  el.resetFilters?.addEventListener('click', () => {
    state.filters.query = '';
    state.filters.rankMin = 1;
    state.filters.rankMax = Math.max(...(state.currentChart?.entries || []).map((entry) => Number(entry.rank || 0)), 100);
    if (el.chartSearch) el.chartSearch.value = '';
    if (el.rankMin) el.rankMin.value = '1';
    if (el.rankMax) el.rankMax.value = String(state.filters.rankMax);
    setMovementFilter('all');
  });

  el.movementPills.forEach((pill) => {
    pill.addEventListener('click', () => setMovementFilter(pill.dataset.movementFilter || 'all'));
  });

  el.songModalClose?.addEventListener('click', closeSongModal);
  el.songModal?.addEventListener('click', (event) => {
    const rect = el.songModal.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) closeSongModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSongModal();
  });
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
  renderArchiveRail(weeks, initialWeek);
  bindUi();
  await loadWeek(initialWeek);
}

init().catch((error) => {
  console.error(error);
  el.viewRoot.innerHTML = `<div class="empty-state">Could not load the chart site files. ${escapeHtml(error.message)}</div>`;
});
