/**
 * Entry point: initialize all modules.
 */

import { loadPapers } from './data.js?v=2';
import { state } from './state.js?v=2';
import { initPaperList } from './paper-list.js?v=2';
import { initWhiteboard, placeAllPapers } from './whiteboard.js?v=2';
import { initConnections } from './connections.js?v=2';
import { initAnnotations } from './annotations.js?v=2';
import { initDetailModal } from './detail-modal.js?v=2';
import { initLayoutIO } from './layout-io.js?v=2';
import { initTheme } from './theme.js?v=2';

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
        import('./paper-block.js?v=2').then(m => {
          for (const name of [...state.selectedBlocks]) {
            m.removePaper(name);
          }
        });
      }
    }
  });
}

init();
