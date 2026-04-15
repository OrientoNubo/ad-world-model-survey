/**
 * Entry point: initialize all modules.
 */

import { loadPapers } from './data.js';
import { state } from './state.js';
import { initPaperList } from './paper-list.js';
import { initWhiteboard, placeAllPapers } from './whiteboard.js';
import { initConnections } from './connections.js';
import { initAnnotations } from './annotations.js';
import { initDetailModal } from './detail-modal.js';
import { initLayoutIO } from './layout-io.js';
import { initTheme } from './theme.js';

async function init() {
  // Theme first (no flash)
  initTheme();

  // Load data
  try {
    const papers = await loadPapers();
    state.papers = papers;
    console.log(`Loaded ${papers.length} papers`);
  } catch (e) {
    console.error('Failed to load papers:', e);
    document.getElementById('cardList').innerHTML =
      '<div style="padding:16px;color:var(--text-muted)">Failed to load paper data. Run build/build_data.py first.</div>';
    return;
  }

  // Init modules
  initPaperList(state.papers);
  initWhiteboard();
  initConnections();
  initAnnotations();
  initDetailModal();
  initLayoutIO();

  // Wire header buttons
  document.getElementById('placeAllBtn').addEventListener('click', placeAllPapers);

  document.getElementById('connectBtn').addEventListener('click', () => {
    state.connectMode = !state.connectMode;
    state.connectSource = null;
    document.getElementById('connectBtn').classList.toggle('active', state.connectMode);
    document.getElementById('mapWrapper').classList.toggle('connect-mode', state.connectMode);
    // Clear source highlight
    document.querySelectorAll('.paper-block').forEach(b => b.style.outline = '');
  });

  // Notes visibility toggle
  const notesToggleBtn = document.getElementById('notesToggleBtn');
  notesToggleBtn.classList.add('active');
  notesToggleBtn.addEventListener('click', () => {
    state.notesVisible = !state.notesVisible;
    notesToggleBtn.classList.toggle('active', state.notesVisible);
    document.querySelectorAll('.block-note').forEach(el => el.classList.toggle('notes-hidden', !state.notesVisible));
    document.querySelectorAll('.paper-block').forEach(el => el.classList.toggle('notes-hidden', !state.notesVisible));
  });

  // Paper block font size control
  let blockFontSize = 16;
  const fontSizeVal = document.getElementById('fontSizeVal');
  function applyBlockFontSize() {
    document.documentElement.style.setProperty('--block-font-size', blockFontSize + 'px');
    fontSizeVal.textContent = blockFontSize;
    // Wait for reflow then reposition notes
    requestAnimationFrame(() => {
      import('./paper-block.js').then(m => m.repositionAllNotes());
    });
  }
  document.getElementById('fontDecBtn').addEventListener('click', () => {
    blockFontSize = Math.max(6, blockFontSize - 2);
    applyBlockFontSize();
  });
  document.getElementById('fontIncBtn').addEventListener('click', () => {
    blockFontSize = Math.min(120, blockFontSize + 2);
    applyBlockFontSize();
  });
  // Click on value to reset to default
  fontSizeVal.style.cursor = 'pointer';
  fontSizeVal.title = 'Click to reset to default (16)';
  fontSizeVal.addEventListener('click', () => {
    blockFontSize = 16;
    applyBlockFontSize();
  });

  document.getElementById('fullscreenBtn').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  });

  // Close popups on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('connEditPopup').style.display = 'none';
      document.getElementById('annEditPopup').style.display = 'none';
      if (state.connectMode) {
        state.connectMode = false;
        state.connectSource = null;
        document.getElementById('connectBtn').classList.remove('active');
        document.getElementById('mapWrapper').classList.remove('connect-mode');
        document.querySelectorAll('.paper-block').forEach(b => b.style.outline = '');
      }
    }
  });

  // Delete key to remove selected blocks
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (state.selectedBlocks.size > 0) {
        import('./paper-block.js').then(m => {
          for (const name of [...state.selectedBlocks]) {
            m.removePaper(name);
          }
        });
      }
    }
  });
}

init();
