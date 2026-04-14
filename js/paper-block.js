/**
 * Whiteboard paper blocks: create, drag, select, context menu.
 */

import { state, notify } from './state.js';
import { getPaper } from './data.js';
import { renderConnections } from './connections.js';
import { resizeBoard } from './whiteboard.js';
import { TB_COLORS, TB_COLORS_DARK, setPopupHandler } from './annotations.js';

let isDragging = false;
let dragTarget = null;
let dragStartX = 0, dragStartY = 0;
let dragOrigPositions = {};

export function placePaper(shortName, x, y) {
  if (state.placedPapers.has(shortName)) {
    // Already placed — just move it, preserve width
    const existing = state.positions[shortName];
    state.positions[shortName] = { x, y, ...(existing?.width != null && { width: existing.width }) };
    const el = document.querySelector(`.paper-block[data-name="${shortName}"]`);
    if (el) {
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      // Sync attached note
      const noteEl = document.querySelector(`.block-note[data-note-for="${shortName}"]`);
      if (noteEl) {
        noteEl.style.left = x + 'px';
        noteEl.style.top = (y + el.offsetHeight) + 'px';
      }
    }
    renderConnections();
    return;
  }

  const paper = getPaper(shortName);
  if (!paper) return;

  // Preserve width if already set (e.g. from imported layout)
  const existing = state.positions[shortName];
  state.positions[shortName] = { x, y, ...(existing?.width != null && { width: existing.width }) };
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
    <button class="block-add-note" title="Add note">+</button>
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
      // Sync attached note width
      const noteEl = document.querySelector(`.block-note[data-note-for="${shortName}"]`);
      if (noteEl) noteEl.style.width = newW + 'px';
    };

    const onUp = (ev) => {
      const dw = (ev.clientX - startX) / zoom;
      const newW = Math.max(100, origW + dw);
      el.style.width = newW + 'px';
      state.positions[shortName].width = newW;
      // Sync attached note width and vertical position
      const noteEl = document.querySelector(`.block-note[data-note-for="${shortName}"]`);
      if (noteEl) {
        noteEl.style.width = newW + 'px';
        noteEl.style.top = (state.positions[shortName].y + el.offsetHeight) + 'px';
      }
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

  // "+" button to add/toggle note
  el.querySelector('.block-add-note').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleBlockNote(shortName, e.clientX, e.clientY);
  });

  document.getElementById('mapboard').appendChild(el);

  // Render attached note if exists (e.g. from import)
  if (state.blockNotes[shortName]) {
    renderBlockNote(shortName);
  }

  // Hide drop hint
  const hint = document.getElementById('dropHint');
  if (hint) hint.style.display = 'none';

  // Update card list indicator
  import('./paper-list.js').then(m => m.renderCards());
}

function onBlockPointerDown(e) {
  if (e.button !== 0) return;
  e.stopPropagation();

  if (e.target.closest('.block-resize') || e.target.closest('.block-add-note')) return;
  const el = e.currentTarget;
  const name = el.dataset.name;
  const zoom = state.viewport.zoom;

  isDragging = false;
  dragTarget = el;
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  // If this block is selected, drag all selected; otherwise just this one
  const dragging = state.selectedBlocks.has(name) ? [...state.selectedBlocks] : [name];
  const draggingSet = new Set(dragging);
  dragOrigPositions = {};
  for (const n of dragging) {
    const pos = state.positions[n];
    if (pos) dragOrigPositions[n] = { ...pos };
  }

  // Snapshot original midpoints for affected connections
  const connOrigMids = [];
  state.connections.forEach((conn, idx) => {
    if (!conn.mid) return;
    const fromDragged = draggingSet.has(conn.from);
    const toDragged = draggingSet.has(conn.to);
    if (fromDragged || toDragged) {
      connOrigMids.push({ idx, origMid: { ...conn.mid }, fromDragged, toDragged });
    }
  });

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
      const prev = state.positions[n];
      state.positions[n] = { x: nx, y: ny, ...(prev?.width != null && { width: prev.width }) };
      const bel = document.querySelector(`.paper-block[data-name="${n}"]`);
      if (bel) {
        bel.style.left = nx + 'px';
        bel.style.top = ny + 'px';
        // Sync attached note position
        const noteEl = document.querySelector(`.block-note[data-note-for="${n}"]`);
        if (noteEl) {
          noteEl.style.left = nx + 'px';
          noteEl.style.top = (ny + bel.offsetHeight) + 'px';
        }
      }
    }

    // Shift connection midpoints proportionally
    for (const { idx, origMid, fromDragged, toDragged } of connOrigMids) {
      const conn = state.connections[idx];
      if (!conn) continue;
      // If both endpoints drag, mid shifts by full dx/dy; if one, by half
      const factor = (fromDragged && toDragged) ? 1 : 0.5;
      conn.mid = { x: origMid.x + dx * factor, y: origMid.y + dy * factor };
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
      resizeBoard();
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

  // Remove attached note
  delete state.blockNotes[shortName];
  const noteEl = document.querySelector(`.block-note[data-note-for="${shortName}"]`);
  if (noteEl) noteEl.remove();

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

/* === Block Notes === */

function toggleBlockNote(shortName, clientX, clientY) {
  if (state.blockNotes[shortName]) {
    // Note exists — open edit popup (delete via popup's Delete button)
    openBlockNoteEdit(shortName, clientX, clientY);
  } else {
    // Create new note
    state.blockNotes[shortName] = { text: 'Note', colorIdx: 0, fontSize: 14 };
    renderBlockNote(shortName);
    // Open edit popup immediately
    openBlockNoteEdit(shortName, clientX, clientY);
  }
}

export function renderBlockNote(shortName) {
  // Remove existing DOM
  const old = document.querySelector(`.block-note[data-note-for="${shortName}"]`);
  if (old) old.remove();

  const note = state.blockNotes[shortName];
  if (!note) return;

  const blockEl = document.querySelector(`.paper-block[data-name="${shortName}"]`);
  if (!blockEl) return;

  const pos = state.positions[shortName];
  if (!pos) return;

  blockEl.classList.add('has-note');

  const el = document.createElement('div');
  el.className = 'block-note' + (state.notesVisible ? '' : ' notes-hidden');
  el.dataset.noteFor = shortName;
  el.style.left = pos.x + 'px';
  el.style.top = (pos.y + blockEl.offsetHeight) + 'px';
  el.style.width = blockEl.offsetWidth + 'px';

  const fontSize = note.fontSize || 14;
  el.style.fontSize = fontSize + 'px';

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const palette = isDark ? TB_COLORS_DARK : TB_COLORS;
  const color = palette[note.colorIdx || 0] || palette[0];

  el.style.background = color.value;

  const bar = document.createElement('div');
  bar.className = 'bn-color-bar';
  bar.style.background = color.bar;
  el.appendChild(bar);

  const content = document.createElement('div');
  content.className = 'bn-content';
  content.textContent = note.text || '';
  el.appendChild(content);

  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    openBlockNoteEdit(shortName, e.clientX, e.clientY);
  });

  document.getElementById('mapboard').appendChild(el);
}

/** Reposition all block notes to match current block heights. */
export function repositionAllNotes() {
  for (const shortName of Object.keys(state.blockNotes)) {
    const blockEl = document.querySelector(`.paper-block[data-name="${shortName}"]`);
    const noteEl = document.querySelector(`.block-note[data-note-for="${shortName}"]`);
    if (!blockEl || !noteEl) continue;
    const pos = state.positions[shortName];
    if (!pos) continue;
    noteEl.style.left = pos.x + 'px';
    noteEl.style.top = (pos.y + blockEl.offsetHeight) + 'px';
    noteEl.style.width = blockEl.offsetWidth + 'px';
  }
}

function openBlockNoteEdit(shortName, clientX, clientY) {
  const note = state.blockNotes[shortName];
  if (!note) return;

  const popup = document.getElementById('annEditPopup');
  document.getElementById('annEditText').value = note.text || '';

  // Build color picker
  let pickerEl = popup.querySelector('.tb-color-picker');
  if (!pickerEl) {
    pickerEl = document.createElement('div');
    pickerEl.className = 'tb-color-picker';
    popup.insertBefore(pickerEl, popup.querySelector('.popup-actions'));
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const palette = isDark ? TB_COLORS_DARK : TB_COLORS;
  const currentIdx = note.colorIdx || 0;

  pickerEl.innerHTML = palette.map((c, i) =>
    `<div class="tb-color-swatch${i === currentIdx ? ' active' : ''}"
       data-color-idx="${i}"
       style="background:${c.bar}"
       title="${c.name}"></div>`
  ).join('');

  pickerEl.querySelectorAll('.tb-color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      pickerEl.querySelectorAll('.tb-color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });
  });

  // Font size control
  let fontRow = popup.querySelector('.tb-font-row');
  if (!fontRow) {
    fontRow = document.createElement('div');
    fontRow.className = 'tb-font-row';
    fontRow.innerHTML = `
      <span style="font-size:11px;color:var(--text-secondary);margin-right:6px">Size</span>
      <button class="tb-font-dec" type="button" style="width:26px;height:26px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font-size:14px;font-weight:700;cursor:pointer">−</button>
      <span class="tb-font-val" style="display:inline-block;width:36px;text-align:center;font-size:12px;font-weight:600"></span>
      <button class="tb-font-inc" type="button" style="width:26px;height:26px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font-size:14px;font-weight:700;cursor:pointer">+</button>
    `;
    fontRow.style.cssText = 'display:flex;align-items:center;margin-bottom:8px';
    popup.insertBefore(fontRow, popup.querySelector('.popup-actions'));
  }

  const currentFontSize = note.fontSize || 14;
  const valSpan = fontRow.querySelector('.tb-font-val');
  valSpan.textContent = currentFontSize + 'px';

  // Replace buttons to remove old listeners
  const decBtn = fontRow.querySelector('.tb-font-dec');
  const incBtn = fontRow.querySelector('.tb-font-inc');
  const newDec = decBtn.cloneNode(true);
  const newInc = incBtn.cloneNode(true);
  decBtn.replaceWith(newDec);
  incBtn.replaceWith(newInc);

  newDec.addEventListener('click', () => {
    let v = parseInt(valSpan.textContent) || 14;
    v = Math.max(8, v - 2);
    valSpan.textContent = v + 'px';
  });
  newInc.addEventListener('click', () => {
    let v = parseInt(valSpan.textContent) || 14;
    v = Math.min(72, v + 2);
    valSpan.textContent = v + 'px';
  });

  // Set popup handler for block note save/delete
  setPopupHandler({
    save() {
      const text = document.getElementById('annEditText').value.trim();
      if (text) note.text = text;

      const activeSwatch = popup.querySelector('.tb-color-swatch.active');
      if (activeSwatch) note.colorIdx = parseInt(activeSwatch.dataset.colorIdx) || 0;

      const fontVal = popup.querySelector('.tb-font-val');
      if (fontVal) note.fontSize = parseInt(fontVal.textContent) || 14;

      popup.style.display = 'none';
      renderBlockNote(shortName);
    },
    delete() {
      delete state.blockNotes[shortName];
      const noteEl = document.querySelector(`.block-note[data-note-for="${shortName}"]`);
      if (noteEl) noteEl.remove();
      const blockEl = document.querySelector(`.paper-block[data-name="${shortName}"]`);
      if (blockEl) blockEl.classList.remove('has-note');
      popup.style.display = 'none';
    }
  });

  // Center the popup on screen
  popup.style.display = 'block';
  popup.style.left = ((window.innerWidth - popup.offsetWidth) / 2) + 'px';
  popup.style.top = ((window.innerHeight - popup.offsetHeight) / 2) + 'px';
  document.getElementById('annEditText').focus();
}
