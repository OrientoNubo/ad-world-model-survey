/**
 * Left panel: filter UI + paper card list.
 *
 * Filter logic:
 *   - Tri-state per value: neutral / include (✓) / exclude (✗)
 *   - Include = AND: paper must satisfy ALL include constraints
 *   - Exclude = AND: paper is hidden if it matches ANY exclude value
 *   - Within a single filter group with multiple includes, category uses
 *     AND (paper must have every selected category), venue/relevance use
 *     AND as well (single-value fields, so multiple includes = intersection).
 */

import { state, notify } from './state.js';

let allPapers = [];

export function initPaperList(papers) {
  allPapers = papers;
  buildFilters(papers);
  renderCards();

  // Search
  document.getElementById('searchBox').addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    renderCards();
  });

  // Filter toggle
  document.getElementById('filterToggle').addEventListener('click', () => {
    document.getElementById('filterArea').classList.toggle('collapsed');
  });
}

function buildFilters(papers) {
  const container = document.getElementById('filterContent');

  const categories = new Set();
  const venues = new Set();
  const relevances = new Set();

  for (const p of papers) {
    for (const c of (p.task_category || [])) categories.add(c);
    if (p.venue) venues.add(p.venue);
    if (p.relevance) relevances.add(p.relevance);
  }

  // Each filter key maps to { include: Set, exclude: Set }
  state.filters = {
    category:  { include: new Set(), exclude: new Set() },
    venue:     { include: new Set(), exclude: new Set() },
    relevance: { include: new Set(), exclude: new Set() },
  };

  let html = '';

  // Relevance filter
  const relOrder = ['World Model Core', 'Survey', 'Long Tail & Corner Case'];
  const relValues = relOrder.filter(r => relevances.has(r));
  html += filterGroupHTML('Relevance', 'relevance', relValues);

  // Category filter
  html += filterGroupHTML('Task Category', 'category', [...categories].sort());

  // Venue filter
  const venueList = [...venues].sort();
  html += filterGroupHTML('Venue', 'venue', venueList.length > 15 ? venueList.slice(0, 15) : venueList);

  container.innerHTML = html;

  // Wire up tri-state click events
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.filterKey;
      const val = btn.dataset.filterVal;
      const f = state.filters[key];
      const cur = btn.dataset.state || 'neutral';

      if (cur === 'neutral') {
        // → include
        btn.dataset.state = 'include';
        f.include.add(val);
      } else if (cur === 'include') {
        // → exclude
        btn.dataset.state = 'exclude';
        f.include.delete(val);
        f.exclude.add(val);
      } else {
        // → neutral
        btn.dataset.state = 'neutral';
        f.exclude.delete(val);
      }

      renderCards();
      notify('filter');
    });
  });
}

function filterGroupHTML(title, key, values) {
  let html = `<div class="filter-group"><div class="filter-group-title">${title}</div>`;
  for (const v of values) {
    html += `<div class="filter-item">
      <button class="filter-btn" data-filter-key="${key}" data-filter-val="${v}" data-state="neutral">
        <span class="filter-icon"></span>
      </button>
      <span class="filter-label">${v}</span>
    </div>`;
  }
  html += '</div>';
  return html;
}

function matchesFilters(paper) {
  // --- Category (multi-value field, AND for includes) ---
  const catF = state.filters.category;
  const cats = paper.task_category || [];
  // Exclude: if paper has ANY excluded category → hide
  if (catF.exclude.size > 0 && cats.some(c => catF.exclude.has(c))) return false;
  // Include (AND): paper must have EVERY included category
  if (catF.include.size > 0) {
    for (const inc of catF.include) {
      if (!cats.includes(inc)) return false;
    }
  }

  // --- Venue (single-value field) ---
  const venF = state.filters.venue;
  if (venF.exclude.size > 0 && venF.exclude.has(paper.venue)) return false;
  if (venF.include.size > 0 && !venF.include.has(paper.venue)) return false;

  // --- Relevance (single-value field) ---
  const relF = state.filters.relevance;
  if (relF.exclude.size > 0 && relF.exclude.has(paper.relevance)) return false;
  if (relF.include.size > 0 && !relF.include.has(paper.relevance)) return false;

  // Search
  if (state.searchQuery) {
    const q = state.searchQuery;
    const haystack = [
      paper.short_name,
      paper.title,
      paper.venue,
      paper.relevance || '',
      ...(paper.keywords || []),
      ...(paper.task_category || []),
    ].join(' ').toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  return true;
}

export function renderCards() {
  const container = document.getElementById('cardList');
  const filtered = allPapers.filter(matchesFilters);

  let html = '';
  for (const p of filtered) {
    const onBoard = state.placedPapers.has(p.short_name);
    const cat = (p.task_category && p.task_category[0]) || '';

    html += `<div class="paper-card${onBoard ? ' on-board' : ''}"
      draggable="true"
      data-name="${p.short_name}"
      data-cat="${cat}">
      ${onBoard ? `<button class="card-remove-btn" data-remove="${p.short_name}" title="Remove from board">&times;</button>` : ''}
      <div class="paper-card-name">${p.short_name}</div>
      <div class="paper-card-meta">
        <span class="badge badge-year">${p.year || ''}</span>
        ${p.venue ? `<span class="badge badge-venue">${p.venue}</span>` : ''}
      </div>
      <div class="paper-card-tags">
        ${(p.keywords || []).slice(0, 3).map(k => `<span class="tag">${k}</span>`).join('')}
      </div>
    </div>`;
  }

  container.innerHTML = html;

  document.getElementById('cardCount').textContent = `${filtered.length} papers`;
  document.getElementById('boardCount').textContent = `${state.placedPapers.size} on board`;

  container.querySelectorAll('.paper-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.name);
      e.dataTransfer.effectAllowed = 'copy';
    });

    card.addEventListener('dblclick', () => {
      document.dispatchEvent(new CustomEvent('open-detail', { detail: card.dataset.name }));
    });
  });

  // Remove-from-board buttons
  container.querySelectorAll('.card-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const name = btn.dataset.remove;
      import('./paper-block.js').then(m => m.removePaper(name));
    });
  });
}
