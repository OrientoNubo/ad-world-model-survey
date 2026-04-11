/**
 * Whiteboard paper blocks: create, drag, select, context menu.
 */

import { state, notify } from './state.js';
import { getPaper } from './data.js';
import { renderConnections } from './connections.js';

let isDragging = false;
let dragTarget = null;
let dragStartX = 0, dragStartY = 0;
let dragOrigPositions = {};

export function placePaper(shortName, x, y) {
  if (state.placedPapers.has(shortName)) {
    // Already placed — just move it
    state.positions[shortName] = { x, y };
    const el = document.querySelector(`.paper-block[data-name="${shortName}"]`);
    if (el) {
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    }
    renderConnections();
    return;
  }

  const paper = getPaper(shortName);
  if (!paper) return;

  state.positions[shortName] = { x, y };
  state.placedPapers.add(shortName);

  const cat = (paper.task_category && paper.task_category[0]) || '';

  const el = document.createElement('div');
  el.className = 'paper-block';
  el.dataset.name = shortName;
  el.dataset.cat = cat;
  el.style.left = x + 'px';
  el.style.top = y + 'px';

  // Apply saved width if any
  if (state.positions[shortName]?.width) {
    el.style.width = state.positions[shortName].width + 'px';
  }

  el.innerHTML = `
    <div class="block-name">${shortName}</div>
    <div class="block-meta">
      <span class="badge badge-year">${paper.year || ''}</span>
      ${paper.venue ? `<span class="badge badge-venue">${paper.venue}</span>` : ''}
    </div>
    <div class="block-category">${cat}</div>
    <div class="block-resize"></div>
  `;

  // Width resize
  const resizer = el.querySelector('.block-resize');
  resizer.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    resizer.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const origW = el.offsetWidth;
    const zoom = state.viewport.zoom;

    const onMove = (ev) => {
      const dw = (ev.clientX - startX) / zoom;
      const newW = Math.max(100, origW + dw);
      el.style.width = newW + 'px';
    };

    const onUp = (ev) => {
      const dw = (ev.clientX - startX) / zoom;
      const newW = Math.max(100, origW + dw);
      el.style.width = newW + 'px';
      state.positions[shortName].width = newW;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      renderConnections();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });

  // Drag to reposition
  el.addEventListener('pointerdown', onBlockPointerDown);

  // Single click: select
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isDragging) return;

    if (state.connectMode) {
      handleConnectClick(shortName);
      return;
    }

    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      if (state.selectedBlocks.has(shortName)) {
        state.selectedBlocks.delete(shortName);
        el.classList.remove('selected');
      } else {
        state.selectedBlocks.add(shortName);
        el.classList.add('selected');
      }
    } else {
      state.selectedBlocks.clear();
      document.querySelectorAll('.paper-block.selected').forEach(b => b.classList.remove('selected'));
      state.selectedBlocks.add(shortName);
      el.classList.add('selected');
    }
    notify('selection');
  });

  // Double-click: open detail modal
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    document.dispatchEvent(new CustomEvent('open-detail', { detail: shortName }));
  });

  // Right-click: context menu
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, shortName);
  });

  document.getElementById('mapboard').appendChild(el);

  // Hide drop hint
  const hint = document.getElementById('dropHint');
  if (hint) hint.style.display = 'none';

  // Update card list indicator
  import('./paper-list.js').then(m => m.renderCards());
}

function onBlockPointerDown(e) {
  if (e.button !== 0) return;
  e.stopPropagation();

  if (e.target.closest('.block-resize')) return;
  const el = e.currentTarget;
  const name = el.dataset.name;
  const zoom = state.viewport.zoom;

  isDragging = false;
  dragTarget = el;
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  // If this block is selected, drag all selected; otherwise just this one
  const dragging = state.selectedBlocks.has(name) ? [...state.selectedBlocks] : [name];
  dragOrigPositions = {};
  for (const n of dragging) {
    const pos = state.positions[n];
    if (pos) dragOrigPositions[n] = { ...pos };
  }

  const onMove = (ev) => {
    const dx = (ev.clientX - dragStartX) / zoom;
    const dy = (ev.clientY - dragStartY) / zoom;
    if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      isDragging = true;
      el.classList.add('dragging');
    }
    if (!isDragging) return;

    for (const [n, orig] of Object.entries(dragOrigPositions)) {
      const nx = orig.x + dx;
      const ny = orig.y + dy;
      state.positions[n] = { x: nx, y: ny };
      const bel = document.querySelector(`.paper-block[data-name="${n}"]`);
      if (bel) {
        bel.style.left = nx + 'px';
        bel.style.top = ny + 'px';
      }
    }
    renderConnections();
  };

  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    if (isDragging) {
      el.classList.remove('dragging');
      // Small delay to prevent click from firing
      setTimeout(() => { isDragging = false; }, 50);
    }
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function handleConnectClick(shortName) {
  if (!state.connectSource) {
    state.connectSource = shortName;
    const el = document.querySelector(`.paper-block[data-name="${shortName}"]`);
    if (el) el.style.outline = '2px dashed var(--accent)';
  } else if (state.connectSource !== shortName) {
    // Create connection
    const from = state.connectSource;
    const to = shortName;
    state.connections.push({
      from, to,
      text: '',
      color: null, // auto-assign
      mid: null,
      labelT: 0.5,
    });
    // Clear source highlight
    const el = document.querySelector(`.paper-block[data-name="${from}"]`);
    if (el) el.style.outline = '';
    state.connectSource = null;
    renderConnections();
  } else {
    // Clicked same block, cancel
    const el = document.querySelector(`.paper-block[data-name="${shortName}"]`);
    if (el) el.style.outline = '';
    state.connectSource = null;
  }
}

export function removePaper(shortName) {
  state.placedPapers.delete(shortName);
  delete state.positions[shortName];
  state.selectedBlocks.delete(shortName);

  const el = document.querySelector(`.paper-block[data-name="${shortName}"]`);
  if (el) el.remove();

  // Remove related connections
  state.connections = state.connections.filter(c => c.from !== shortName && c.to !== shortName);
  renderConnections();

  // Show drop hint if empty
  if (state.placedPapers.size === 0) {
    const hint = document.getElementById('dropHint');
    if (hint) hint.style.display = '';
  }

  import('./paper-list.js').then(m => m.renderCards());
}

function showContextMenu(x, y, shortName) {
  const menu = document.getElementById('contextMenu');
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.display = 'block';
  menu.innerHTML = `
    <div class="context-menu-item" data-action="details">View Details</div>
    <div class="context-menu-item" data-action="connect">Start Connection</div>
    <div class="context-menu-item" data-action="remove">Remove from Board</div>
  `;

  menu.onclick = (e) => {
    const action = e.target.dataset.action;
    menu.style.display = 'none';
    if (action === 'details') {
      document.dispatchEvent(new CustomEvent('open-detail', { detail: shortName }));
    } else if (action === 'connect') {
      state.connectMode = true;
      document.getElementById('connectBtn').classList.add('active');
      document.getElementById('mapWrapper').classList.add('connect-mode');
      handleConnectClick(shortName);
    } else if (action === 'remove') {
      removePaper(shortName);
    }
  };
}
