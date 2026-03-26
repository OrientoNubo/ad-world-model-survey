/**
 * Left panel: filter UI + paper card list.
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

  state.filters = {
    category: new Set(),
    venue: new Set(),
    relevance: new Set(),
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

  // Wire up checkbox events
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const key = cb.dataset.filterKey;
      const val = cb.dataset.filterVal;
      if (cb.checked) {
        state.filters[key].add(val);
      } else {
        state.filters[key].delete(val);
      }
      renderCards();
      notify('filter');
    });
  });
}

function filterGroupHTML(title, key, values) {
  let html = `<div class="filter-group"><div class="filter-group-title">${title}</div>`;
  for (const v of values) {
    const id = `f_${key}_${v.replace(/\W/g, '_')}`;
    html += `<label><input type="checkbox" id="${id}" data-filter-key="${key}" data-filter-val="${v}"> ${v}</label>`;
  }
  html += '</div>';
  return html;
}

function matchesFilters(paper) {
  // Category filter (OR within category)
  if (state.filters.category.size > 0) {
    const cats = paper.task_category || [];
    if (!cats.some(c => state.filters.category.has(c))) return false;
  }

  // Venue filter
  if (state.filters.venue.size > 0) {
    if (!state.filters.venue.has(paper.venue)) return false;
  }

  // Relevance filter
  if (state.filters.relevance.size > 0) {
    if (!state.filters.relevance.has(paper.relevance)) return false;
  }

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
