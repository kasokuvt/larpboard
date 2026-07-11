
const state = {
  manifest: null,
  latest: null,
  catalog: null,
  currentWeek: null,
  currentChart: null,
  theme: null,
  filters: { movement: 'all', rankMin: null, rankMax: null },
  railOpen: false,
};

const el = {
  weekPicker: document.getElementById('week-picker'),
  weekOf: document.getElementById('week-of'),
  statNewSongs: document.getElementById('stat-new-songs'),
  statReEntries: document.getElementById('stat-re-entries'),
  statCarryovers: document.getElementById('stat-carryovers'),
  statClimbing: document.getElementById('stat-climbing'),
  statFalling: document.getElementById('stat-falling'),
  statNoChange: document.getElementById('stat-no-change'),
  viewRoot: document.getElementById('view-root'),
  template: document.getElementById('chart-row-template'),
  backToChart: document.getElementById('back-to-chart'),
  themeToggle: document.querySelector('[data-theme-toggle]'),
  archiveRail: document.getElementById('archive-rail'),
  archiveWeekList: document.getElementById('archive-week-list'),
  archiveWeekSearch: document.getElementById('archive-week-search'),
  railToggle: document.getElementById('rail-toggle'),
  globalSearch: document.getElementById('global-search'),
  searchResults: document.getElementById('search-results'),
  spotlightSection: document.getElementById('spotlight-section'),
  spotlightCover: document.getElementById('spotlight-cover'),
  spotlightMovement: document.getElementById('spotlight-movement'),
  spotlightTitle: document.getElementById('spotlight-title'),
  spotlightArtist: document.getElementById('spotlight-artist'),
  spotlightPoints: document.getElementById('spotlight-points'),
  spotlightPeak: document.getElementById('spotlight-peak'),
  spotlightWeeks: document.getElementById('spotlight-weeks'),
  spotlightListeners: document.getElementById('spotlight-listeners'),
  filterMovement: document.getElementById('filter-movement'),
  filterRankMin: document.getElementById('filter-rank-min'),
  filterRankMax: document.getElementById('filter-rank-max'),
  filterReset: document.getElementById('filter-reset'),
  modalOverlay: document.getElementById('song-modal-overlay'),
  modalPanel: document.getElementById('song-modal-panel'),
  modalBody: document.getElementById('modal-body'),
  modalClose: document.getElementById('modal-close'),
};

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  if (el.themeToggle) {
    el.themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    el.themeToggle.innerHTML = `<span class="theme-toggle-inner">${theme === 'dark' ? '●' : '◑'}</span>`;
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
  if (!movement) return '<span class="movement-badge move-stay">—</span>';
  if (movement.type === 'new') return '<span class="movement-badge move-new">NEW</span>';
  if (movement.type === 're') return '<span class="movement-badge move-re">RE</span>';
  if (movement.type === 'stay') return '<span class="movement-badge move-stay">→</span>';
  if (movement.type === 'up') return `<span class="movement-badge move-up"><span class="movement-arrow-up"></span>${movement.value}</span>`;
  if (movement.type === 'down') return `<span class="movement-badge move-down"><span class="movement-arrow-down"></span>${movement.value}</span>`;
  return '<span class="movement-badge move-stay">—</span>';
}

function getSongKey(title, artist) {
  return `${String(artist || '').trim()} - ${String(title || '').trim()}`.toLowerCase();
}

function updateHero(chart) {
  if (el.weekOf) el.weekOf.textContent = formatWeekLabel(chart.week);

  const entries = chart.entries || [];

  if (el.statNewSongs) {
    const count = entries.filter((entry) => entry.movement?.type === 'new').length;
    el.statNewSongs.textContent = count ? String(count) : '—';
  }

  if (el.statReEntries) {
    const count = entries.filter((entry) => entry.movement?.type === 're').length;
    el.statReEntries.textContent = count ? String(count) : '—';
  }

  if (el.statCarryovers) {
    const count = entries.filter((entry) => !['new', 're'].includes(entry.movement?.type)).length;
    el.statCarryovers.textContent = count ? String(count) : '—';
  }

  if (el.statClimbing) {
    const count = entries.filter((entry) => entry.movement?.type === 'up').length;
    el.statClimbing.textContent = count ? String(count) : '—';
  }

  if (el.statFalling) {
    const count = entries.filter((entry) => entry.movement?.type === 'down').length;
    el.statFalling.textContent = count ? String(count) : '—';
  }

  if (el.statNoChange) {
    const count = entries.filter((entry) => entry.movement?.type === 'stay').length;
    el.statNoChange.textContent = count ? String(count) : '—';
  }
}

function renderSpotlight(chart) {
  if (!el.spotlightSection) return;
  const top = (chart.entries || []).find((entry) => entry.rank === 1);
  if (!top) {
    el.spotlightSection.classList.add('hidden');
    return;
  }
  el.spotlightSection.classList.remove('hidden');

  if (el.spotlightCover) {
    el.spotlightCover.src = `./${top.cover}`;
    el.spotlightCover.alt = `${top.title} cover art`;
    el.spotlightCover.onerror = () => { el.spotlightCover.src = './covers/_placeholder.png'; };
  }

  if (el.spotlightMovement) el.spotlightMovement.outerHTML = movementBadge(top.movement).replace('movement-badge', 'movement-badge').replace('<span', '<span id="spotlight-movement"');
  if (el.spotlightTitle) {
    el.spotlightTitle.textContent = top.title;
    el.spotlightTitle.onclick = () => openSongModal(top.artist, getSongKey(top.title, top.artist));
  }
  if (el.spotlightArtist) {
    el.spotlightArtist.textContent = top.artist;
    el.spotlightArtist.onclick = () => renderArtistView(top.artist);
  }
  if (el.spotlightPoints) el.spotlightPoints.textContent = `${Number(top.points || 0).toFixed(1)} pts`;
  if (el.spotlightPeak) el.spotlightPeak.textContent = top.peak ?? '—';
  if (el.spotlightWeeks) el.spotlightWeeks.textContent = top.weeks ?? '—';
  if (el.spotlightListeners) el.spotlightListeners.textContent = top.listeners ?? '—';
}

function passesFilters(entry) {
  const { movement, rankMin, rankMax } = state.filters;
  if (movement && movement !== 'all' && entry.movement?.type !== movement) return false;
  if (rankMin && entry.rank < rankMin) return false;
  if (rankMax && entry.rank > rankMax) return false;
  return true;
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
        <li><button type="button" class="ghost-button detail-open-modal">Open full song page</button></li>
        <li>Open the artist page to browse every charted song.</li>
      </ul>
    </div>
  `;
}

function renderChart(chart) {
  updateHero(chart);
  renderSpotlight(chart);
  el.viewRoot.innerHTML = '';
  el.backToChart.classList.add('hidden');

  const fragment = document.createDocumentFragment();
  const entries = (chart.entries || []).filter(passesFilters);

  if (!entries.length) {
    el.viewRoot.innerHTML = '<div class="empty-state">No songs match the current filters.</div>';
    return;
  }

  entries.forEach((entry) => {
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
    if (moveEl) moveEl.outerHTML = movementBadge(entry.movement);

    const titleBtn = node.querySelector('.song-title-link');
    if (titleBtn) {
      titleBtn.textContent = entry.title;
      titleBtn.addEventListener('click', () => openSongModal(entry.artist, getSongKey(entry.title, entry.artist)));
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

    const modalOpenBtn = detailPanel.querySelector('.detail-open-modal');
    if (modalOpenBtn) {
      modalOpenBtn.addEventListener('click', () => openSongModal(entry.artist, getSongKey(entry.title, entry.artist)));
    }

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
    btn.addEventListener('click', () => openSongModal(artistName, getSongKey(song.title, artistName)));

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

function openSongModal(artistName, songKey) {
  const artist = state.catalog?.artists?.[artistName];
  const song = artist?.songs?.[songKey];
  if (!el.modalOverlay || !el.modalBody) {
    renderSongView(artistName, songKey);
    return;
  }

  if (!song) {
    el.modalBody.innerHTML = `<h3>Song page</h3><p class="view-panel-subtitle">No archive data found for this song.</p>`;
  } else {
    const history = [...(song.history || [])].sort((a, b) => String(b.week).localeCompare(String(a.week)));
    el.modalBody.innerHTML = `
      <h3 id="modal-song-title">${escapeHtml(song.title)}</h3>
      <p class="view-panel-subtitle">${escapeHtml(artistName)}</p>
      <img class="modal-cover" src="./${escapeHtml(song.cover || 'covers/_placeholder.png')}" alt="${escapeHtml(song.title)} cover art" loading="lazy" decoding="async">
      <dl class="modal-meta-grid">
        <div><dt>Peak</dt><dd>${escapeHtml(song.peak ?? '—')}</dd></div>
        <div><dt>Weeks on chart</dt><dd>${escapeHtml(song.weeks ?? '—')}</dd></div>
        <div><dt>Total entries</dt><dd>${escapeHtml(history.length)}</dd></div>
      </dl>
      <ul class="history-list"></ul>
      <button type="button" class="ghost-button" id="modal-artist-link" style="margin-top:1rem;">View full artist page</button>
    `;
    const modalImg = el.modalBody.querySelector('.modal-cover');
    if (modalImg) modalImg.onerror = () => { modalImg.src = './covers/_placeholder.png'; };

    const list = el.modalBody.querySelector('.history-list');
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

    const artistLinkBtn = el.modalBody.querySelector('#modal-artist-link');
    if (artistLinkBtn) {
      artistLinkBtn.addEventListener('click', () => {
        closeSongModal();
        renderArtistView(artistName);
      });
    }
  }

  el.modalOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSongModal() {
  if (!el.modalOverlay) return;
  el.modalOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

function initModal() {
  el.modalClose?.addEventListener('click', closeSongModal);
  el.modalOverlay?.addEventListener('click', (event) => {
    if (event.target === el.modalOverlay) closeSongModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSongModal();
  });
}

function initFilters() {
  el.filterMovement?.addEventListener('change', () => {
    state.filters.movement = el.filterMovement.value;
    if (state.currentChart) renderChart(state.currentChart);
  });
  el.filterRankMin?.addEventListener('input', () => {
    const val = parseInt(el.filterRankMin.value, 10);
    state.filters.rankMin = Number.isFinite(val) ? val : null;
    if (state.currentChart) renderChart(state.currentChart);
  });
  el.filterRankMax?.addEventListener('input', () => {
    const val = parseInt(el.filterRankMax.value, 10);
    state.filters.rankMax = Number.isFinite(val) ? val : null;
    if (state.currentChart) renderChart(state.currentChart);
  });
  el.filterReset?.addEventListener('click', () => {
    state.filters = { movement: 'all', rankMin: null, rankMax: null };
    if (el.filterMovement) el.filterMovement.value = 'all';
    if (el.filterRankMin) el.filterRankMin.value = '';
    if (el.filterRankMax) el.filterRankMax.value = '';
    if (state.currentChart) renderChart(state.currentChart);
  });
}

function populateArchiveRail(weeks, selectedWeek) {
  if (!el.archiveWeekList) return;
  const render = (filterText) => {
    el.archiveWeekList.innerHTML = '';
    const needle = (filterText || '').trim().toLowerCase();
    weeks
      .slice()
      .reverse()
      .filter((week) => !needle || formatWeekLabel(week).toLowerCase().includes(needle) || week.includes(needle))
      .forEach((week) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = formatWeekLabel(week);
        if (week === selectedWeek) btn.classList.add('active');
        btn.addEventListener('click', async () => {
          await loadWeek(week);
          if (window.innerWidth <= 1080) toggleRail(false);
        });
        li.appendChild(btn);
        el.archiveWeekList.appendChild(li);
      });
  };
  render('');
  el.archiveWeekSearch?.addEventListener('input', () => render(el.archiveWeekSearch.value));
}

function toggleRail(force) {
  state.railOpen = typeof force === 'boolean' ? force : !state.railOpen;
  el.archiveRail?.classList.toggle('open', state.railOpen);
  el.railToggle?.setAttribute('aria-expanded', state.railOpen ? 'true' : 'false');
}

function initRailToggle() {
  el.railToggle?.addEventListener('click', () => toggleRail());
}

function buildSearchIndex() {
  const index = [];
  const artists = state.catalog?.artists || {};
  Object.entries(artists).forEach(([artistName, artist]) => {
    Object.values(artist.songs || {}).forEach((song) => {
      index.push({
        artist: artistName,
        title: song.title,
        cover: song.cover,
        peak: song.peak,
        weeks: song.weeks,
        key: getSongKey(song.title, artistName),
      });
    });
  });
  return index;
}

function runSearch(query) {
  if (!el.searchResults) return;
  const needle = query.trim().toLowerCase();
  if (!needle) {
    el.searchResults.classList.add('hidden');
    el.searchResults.innerHTML = '';
    return;
  }

  const matches = (state.searchIndex || [])
    .filter((item) => item.title.toLowerCase().includes(needle) || item.artist.toLowerCase().includes(needle))
    .slice(0, 20);

  if (!matches.length) {
    el.searchResults.innerHTML = '<div class="search-empty">No songs or artists found.</div>';
    el.searchResults.classList.remove('hidden');
    return;
  }

  el.searchResults.innerHTML = '';
  matches.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-result-item';
    btn.innerHTML = `
      <img src="./${escapeHtml(item.cover || 'covers/_placeholder.png')}" alt="" loading="lazy" decoding="async">
      <div class="search-result-meta">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.artist)} · Peak ${escapeHtml(item.peak ?? '—')}</span>
      </div>
    `;
    btn.addEventListener('click', () => {
      el.searchResults.classList.add('hidden');
      if (el.globalSearch) el.globalSearch.value = '';
      openSongModal(item.artist, item.key);
    });
    el.searchResults.appendChild(btn);
  });
  el.searchResults.classList.remove('hidden');
}

function initSearch() {
  el.globalSearch?.addEventListener('input', () => runSearch(el.globalSearch.value));
  document.addEventListener('click', (event) => {
    if (el.searchResults && !el.searchResults.contains(event.target) && event.target !== el.globalSearch) {
      el.searchResults.classList.add('hidden');
    }
  });
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
  populateArchiveRail(state.manifest.weeks, week);
  renderChart(chart);
}

async function init() {
  initTheme();
  initModal();
  initFilters();
  initSearch();
  initRailToggle();

  state.manifest = await fetchJson('./data/manifest.json');
  state.latest = await fetchJson('./data/latest.json');
  state.catalog = await fetchJson('./data/catalog.json');
  state.searchIndex = buildSearchIndex();

  const weeks = state.manifest?.weeks || [];
  const initialWeek = state.latest?.week || weeks[0];

  if (!initialWeek) {
    el.viewRoot.innerHTML = '<div class="empty-state">No chart weeks have been exported yet.</div>';
    return;
  }

  populateWeekPicker(weeks, initialWeek);
  populateArchiveRail(weeks, initialWeek);

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
