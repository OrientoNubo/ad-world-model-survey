/**
 * Whiteboard: pan/zoom, drop zone, selection rectangle, panel resizer.
 */

import { state, notify } from './state.js';
import { screenToMap } from './utils.js';
import { placePaper, removePaper } from './paper-block.js';
import { renderConnections } from './connections.js';
import { renderAnnotations } from './annotations.js';

let isPanning = false;
let panStartX = 0, panStartY = 0;
let panMoved = false;
let isSelecting = false;
let selStart = { x: 0, y: 0 };
let selRect = null;

export function initWhiteboard() {
  const wrapper = document.getElementById('mapWrapper');
  const map = document.getElementById('mapboard');

  // Hide drop hint once items are placed
  updateDropHint();

  // Zoom +/- buttons
  document.getElementById('zoomInBtn').addEventListener('click', () => zoomByStep(1.2));
  document.getElementById('zoomOutBtn').addEventListener('click', () => zoomByStep(1 / 1.2));

  // Mouse wheel on zoom controls row
  document.getElementById('zoomControls').addEventListener('wheel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zoomByStep(e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });

  // Click zoom value to reset to 100%
  const zoomVal = document.getElementById('zoomIndicator');
  zoomVal.title = 'Click to reset to 100%';
  zoomVal.addEventListener('click', () => {
    const wrapper = document.getElementById('mapWrapper');
    const rect = wrapper.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const scale = 1 / state.viewport.zoom;
    state.viewport.panX = cx - (cx - state.viewport.panX) * scale;
    state.viewport.panY = cy - (cy - state.viewport.panY) * scale;
    state.viewport.zoom = 1;
    applyViewport();
  });

  // Pan: left mouse on empty space
  wrapper.addEventListener('mousedown', (e) => {
    // Only handle clicks on empty whiteboard space
    const t = e.target;
    if (t !== wrapper && t !== map && t.id !== 'dropHint' &&
        !t.classList.contains('connections-svg') && t.tagName !== 'svg') return;

    // Middle mouse: selection rectangle
    if (e.button === 1) {
      e.preventDefault();
      isSelecting = true;
      selStart = { x: e.clientX, y: e.clientY };
      selRect = document.createElement('div');
      selRect.className = 'selection-rect';
      wrapper.appendChild(selRect);
      return;
    }

    if (e.button !== 0) return;

    // Deselect all
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      state.selectedBlocks.clear();
      document.querySelectorAll('.paper-block.selected').forEach(b => b.classList.remove('selected'));
      document.querySelectorAll('.text-box.selected').forEach(b => b.classList.remove('selected'));
      notify('selection');
    }

    isPanning = true;
    panMoved = false;
    panStartX = e.clientX - state.viewport.panX;
    panStartY = e.clientY - state.viewport.panY;
    wrapper.classList.add('panning');
  });

  document.addEventListener('mousemove', (e) => {
    if (isPanning) {
      const dx = e.clientX - panStartX - state.viewport.panX;
      const dy = e.clientY - panStartY - state.viewport.panY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) panMoved = true;
      state.viewport.panX = e.clientX - panStartX;
      state.viewport.panY = e.clientY - panStartY;
      applyViewport();
    }
    if (isSelecting && selRect) {
      const x = Math.min(e.clientX, selStart.x);
      const y = Math.min(e.clientY, selStart.y);
      const w = Math.abs(e.clientX - selStart.x);
      const h = Math.abs(e.clientY - selStart.y);
      selRect.style.left = x + 'px';
      selRect.style.top = y + 'px';
      selRect.style.width = w + 'px';
      selRect.style.height = h + 'px';
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (isPanning) {
      isPanning = false;
      wrapper.classList.remove('panning');
    }
    if (isSelecting && selRect) {
      const sr = selRect.getBoundingClientRect();
      if (!e.ctrlKey && !e.metaKey) {
        state.selectedBlocks.clear();
        document.querySelectorAll('.paper-block.selected').forEach(b => b.classList.remove('selected'));
      }
      document.querySelectorAll('.paper-block').forEach(block => {
        const br = block.getBoundingClientRect();
        if (br.left < sr.right && br.right > sr.left &&
            br.top < sr.bottom && br.bottom > sr.top) {
          state.selectedBlocks.add(block.dataset.name);
          block.classList.add('selected');
        }
      });
      selRect.remove();
      selRect = null;
      isSelecting = false;
      notify('selection');
    }
  });

  // Zoom & pan: mouse wheel + trackpad gestures
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey) {
      // Pinch-to-zoom (trackpad) or Ctrl+wheel (mouse)
      const delta = e.deltaY > 0 ? 0.97 : 1.03;
      const newZoom = Math.min(3, Math.max(0.025, state.viewport.zoom * delta));
      const rect = wrapper.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const scale = newZoom / state.viewport.zoom;
      state.viewport.panX = cx - (cx - state.viewport.panX) * scale;
      state.viewport.panY = cy - (cy - state.viewport.panY) * scale;
      state.viewport.zoom = newZoom;
    } else {
      // Two-finger scroll (trackpad) → pan, or regular mouse wheel → zoom
      if (Math.abs(e.deltaX) > 0 || e.deltaMode === 0) {
        // Trackpad: has deltaX or pixel-level deltaMode
        state.viewport.panX -= e.deltaX;
        state.viewport.panY -= e.deltaY;
      } else {
        // Mouse wheel (line-based): zoom
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(3, Math.max(0.025, state.viewport.zoom * delta));
        const rect = wrapper.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const scale = newZoom / state.viewport.zoom;
        state.viewport.panX = cx - (cx - state.viewport.panX) * scale;
        state.viewport.panY = cy - (cy - state.viewport.panY) * scale;
        state.viewport.zoom = newZoom;
      }
    }
    applyViewport();
  }, { passive: false });

  // Drop zone
  wrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  wrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    const shortName = e.dataTransfer.getData('text/plain');
    if (!shortName) return;
    const pos = screenToMap(e.clientX, e.clientY, state.viewport);
    placePaper(shortName, pos.x - 79, pos.y - 47);
    updateDropHint();
    resizeBoard();
  });

  // Double-click on empty space → add text box
  wrapper.addEventListener('dblclick', (e) => {
    // Skip if clicking on a paper block or text box
    if (e.target.closest('.paper-block') || e.target.closest('.text-box')) return;

    const pos = screenToMap(e.clientX, e.clientY, state.viewport);
    state.annotations.push({
      x: pos.x, y: pos.y,
      text: 'New text',
      width: 150, height: 60,
      colorIdx: 0,
    });
    renderAnnotations();
    updateDropHint();
    resizeBoard();

    // Immediately open edit for the new text box
    const idx = state.annotations.length - 1;
    setTimeout(() => {
      const el = document.querySelector(`.text-box[data-ann-idx="${idx}"]`);
      if (el) {
        el.dispatchEvent(new MouseEvent('dblclick', {
          clientX: e.clientX, clientY: e.clientY, bubbles: true
        }));
      }
    }, 50);
  });

  // Context menu hide
  document.addEventListener('click', () => {
    document.getElementById('contextMenu').style.display = 'none';
  });

  // Panel resizer
  initPanelResizer();
}

export function updateDropHint() {
  const hint = document.getElementById('dropHint');
  if (!hint) return;
  hint.style.display = (state.placedPapers.size > 0 || state.annotations.length > 0) ? 'none' : '';
}

/** Zoom by a multiplier, centered on the viewport center. */
function zoomByStep(factor) {
  const wrapper = document.getElementById('mapWrapper');
  const rect = wrapper.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const newZoom = Math.min(3, Math.max(0.025, state.viewport.zoom * factor));
  const scale = newZoom / state.viewport.zoom;
  state.viewport.panX = cx - (cx - state.viewport.panX) * scale;
  state.viewport.panY = cy - (cy - state.viewport.panY) * scale;
  state.viewport.zoom = newZoom;
  applyViewport();
}

export function applyViewport() {
  const map = document.getElementById('mapboard');
  const wrapper = document.getElementById('mapWrapper');
  const { panX, panY, zoom } = state.viewport;
  map.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  document.getElementById('zoomIndicator').textContent = Math.round(zoom * 100) + '%';

  // Sync infinite grid on wrapper with pan/zoom
  const gs = 40 * zoom;
  wrapper.style.backgroundSize = `${gs}px ${gs}px`;
  wrapper.style.backgroundPosition = `${panX}px ${panY}px`;
}

/** Expand mapboard to fit all content with padding. */
export function resizeBoard() {
  const pad = 1000;
  const minW = 5000, minH = 3500;
  let maxX = 0, maxY = 0;

  for (const k in state.positions) {
    const p = state.positions[k];
    maxX = Math.max(maxX, p.x + (p.width || 220) + pad);
    maxY = Math.max(maxY, p.y + 120 + pad);
  }
  for (const a of state.annotations) {
    maxX = Math.max(maxX, a.x + (a.width || 150) + pad);
    maxY = Math.max(maxY, a.y + (a.height || 60) + pad);
  }

  const map = document.getElementById('mapboard');
  if (!map) return;
  map.style.width = Math.max(minW, maxX) + 'px';
  map.style.height = Math.max(minH, maxY) + 'px';
}

export function placeAllPapers() {
  const papers = state.papers;
  if (!papers.length) return;

  // Group by first task category
  const groups = {};
  for (const p of papers) {
    const cat = (p.task_category && p.task_category[0]) || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  }

  let globalX = 50;
  const cats = Object.keys(groups).sort();

  for (const cat of cats) {
    const group = groups[cat];
    for (let i = 0; i < group.length; i++) {
      const p = group[i];
      const x = globalX + (i % 4) * 180;
      const row = Math.floor(i / 4);
      placePaper(p.short_name, x, 50 + row * 120);
    }
    globalX += 4 * 180 + 80;
  }

  state.viewport = { panX: 20, panY: 20, zoom: 0.5 };
  applyViewport();
  updateDropHint();
  resizeBoard();
}

export function resetWhiteboard() {
  document.querySelectorAll('.paper-block').forEach(el => el.remove());
  document.querySelectorAll('.text-box').forEach(el => el.remove());
  document.querySelectorAll('.conn-label').forEach(el => el.remove());
  document.querySelectorAll('.block-note').forEach(el => el.remove());

  state.positions = {};
  state.placedPapers.clear();
  state.connections = [];
  state.annotations = [];
  state.blockNotes = {};
  state.selectedBlocks.clear();
  state.viewport = { panX: 0, panY: 0, zoom: 1 };

  applyViewport();
  renderConnections();
  updateDropHint();

  import('./paper-list.js').then(m => m.renderCards());
}

/* === Panel Resizer === */
function initPanelResizer() {
  const resizer = document.getElementById('panelResizer');
  const panel = document.getElementById('leftPanel');
  if (!resizer || !panel) return;

  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizer.classList.add('dragging');
    const startX = e.clientX;
    const startW = panel.offsetWidth;

    const onMove = (ev) => {
      ev.preventDefault();
      const dx = ev.clientX - startX;
      const newW = Math.min(600, Math.max(200, startW + dx));
      panel.style.width = newW + 'px';
      panel.style.minWidth = newW + 'px';
    };

    const onUp = () => {
      resizer.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
