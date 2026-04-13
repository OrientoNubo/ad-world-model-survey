/**
 * Left panel: filter UI + paper card list.
 *
 * Filter logic:
 *   - Tri-state per value: neutral / include (✓) / exclude (✗)
 *   - ACROSS groups: AND (paper must pass every group)
 *   - WITHIN a group: toggleable AND/OR mode per group
 *     - OR:  paper matches if it has ANY included value (union, broadens)
 *     - AND: paper matches only if it has ALL included values (intersection, narrows)
 *   - Excludes always use OR (any excluded value hides the paper)
 */

import { state, notify } from './state.js?v=2';

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

  // Each filter key: { include, exclude, mode }
  state.filters = {
    category:  { include: new Set(), exclude: new Set(), mode: 'or' },
    venue:     { include: new Set(), exclude: new Set(), mode: 'or' },
    relevance: { include: new Set(), exclude: new Set(), mode: 'or' },
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
        btn.dataset.state = 'include';
        f.include.add(val);
      } else if (cur === 'include') {
        btn.dataset.state = 'exclude';
        f.include.delete(val);
        f.exclude.add(val);
      } else {
        btn.dataset.state = 'neutral';
        f.exclude.delete(val);
      }

      renderCards();
      notify('filter');
    });
  });

  // Wire up AND/OR toggle buttons
  container.querySelectorAll('.filter-mode-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const key = toggle.dataset.filterKey;
      const f = state.filters[key];
      f.mode = f.mode === 'or' ? 'and' : 'or';
      toggle.dataset.mode = f.mode;
      toggle.textContent = f.mode.toUpperCase();
      renderCards();
      notify('filter');
    });
  });
}

function filterGroupHTML(title, key, values) {
  let html = `<div class="filter-group">
    <div class="filter-group-header">
      <div class="filter-group-title">${title}</div>
      <button class="filter-mode-toggle" data-filter-key="${key}" data-mode="or" title="Toggle AND/OR logic">OR</button>
    </div>`;
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

/**
 * Check if a paper's values pass a filter group.
 * @param {string[]} paperValues - the paper's values for this field (array)
 * @param {{ include: Set, exclude: Set, mode: string }} filter
 */
function passesGroup(paperValues, filter) {
  // Exclude: paper hidden if ANY value is excluded
  if (filter.exclude.size > 0 && paperValues.some(v => filter.exclude.has(v))) return false;

  // Include
  if (filter.include.size > 0) {
    if (filter.mode === 'and') {
      // AND: paper must contain ALL included values
      for (const inc of filter.include) {
        if (!paperValues.includes(inc)) return false;
      }
    } else {
      // OR: paper must contain at least ONE included value
      if (!paperValues.some(v => filter.include.has(v))) return false;
    }
  }

  return true;
}

function matchesFilters(paper) {
  // Category (multi-value)
  if (!passesGroup(paper.task_category || [], state.filters.category)) return false;

  // Venue (single-value → wrap in array)
  if (!passesGroup(paper.venue ? [paper.venue] : [], state.filters.venue)) return false;

  // Relevance (single-value → wrap in array)
  if (!passesGroup(paper.relevance ? [paper.relevance] : [], state.filters.relevance)) return false;

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
