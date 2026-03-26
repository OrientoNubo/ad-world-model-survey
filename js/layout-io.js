/**
 * Export/Import layout state as base64.
 */

import { state, notify } from './state.js';
import { lzEncode, lzDecode } from './utils.js';
import { placePaper } from './paper-block.js';
import { applyViewport, resetWhiteboard } from './whiteboard.js';
import { renderConnections } from './connections.js';
import { renderAnnotations } from './annotations.js';

export function initLayoutIO() {
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const resetBtn = document.getElementById('resetBtn');
  const ioOverlay = document.getElementById('ioOverlay');
  const ioClose = document.getElementById('ioClose');
  const ioCopyBtn = document.getElementById('ioCopyBtn');
  const ioApplyBtn = document.getElementById('ioApplyBtn');

  exportBtn.addEventListener('click', exportLayout);
  importBtn.addEventListener('click', () => {
    document.getElementById('ioTitle').textContent = 'Import Layout';
    document.getElementById('layoutCode').value = '';
    ioOverlay.classList.add('open');
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('Clear all papers, connections, and annotations from the whiteboard?')) {
      resetWhiteboard();
    }
  });

  ioClose.addEventListener('click', () => ioOverlay.classList.remove('open'));
  ioOverlay.addEventListener('click', (e) => {
    if (e.target === ioOverlay) ioOverlay.classList.remove('open');
  });

  ioCopyBtn.addEventListener('click', () => {
    const code = document.getElementById('layoutCode').value;
    navigator.clipboard.writeText(code).catch(() => {});
  });

  ioApplyBtn.addEventListener('click', importLayout);
}

function exportLayout() {
  const data = {
    v: 4,
    p: state.positions,
    placed: [...state.placedPapers],
    vp: state.viewport,
    conn: state.connections,
    ann: state.annotations,
  };
  const json = JSON.stringify(data);
  const encoded = lzEncode(json);

  document.getElementById('ioTitle').textContent = 'Export Layout';
  document.getElementById('layoutCode').value = encoded;
  document.getElementById('ioOverlay').classList.add('open');
  navigator.clipboard.writeText(encoded).catch(() => {});
}

function importLayout() {
  const code = document.getElementById('layoutCode').value.trim();
  if (!code) return;

  try {
    const json = lzDecode(code);
    const data = JSON.parse(json);

    // Clear current state
    document.querySelectorAll('.paper-block').forEach(el => el.remove());
    document.querySelectorAll('.text-box').forEach(el => el.remove());
    document.querySelectorAll('.conn-label').forEach(el => el.remove());
    state.placedPapers.clear();
    state.positions = {};
    state.connections = [];
    state.annotations = [];
    state.selectedBlocks.clear();

    // Restore
    if (data.vp) state.viewport = data.vp;
    if (data.conn) state.connections = data.conn;
    if (data.ann) state.annotations = data.ann;
    if (data.p) state.positions = data.p;

    // Place papers
    const papersToPlace = data.placed || Object.keys(data.p || {});
    for (const name of papersToPlace) {
      const pos = state.positions[name];
      if (pos) {
        placePaper(name, pos.x, pos.y);
      }
    }

    applyViewport();
    renderConnections();
    renderAnnotations();

    document.getElementById('ioOverlay').classList.remove('open');
  } catch (e) {
    alert('Invalid layout code: ' + e.message);
  }
}
