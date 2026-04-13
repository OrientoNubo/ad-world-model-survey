/**
 * Full notes detail modal with section navigation.
 */

import { loadNotes, getPaper } from './data.js?v=2';

const SECTION_TITLES = {
  'basic_info': '1. Basic Info',
  'research_overview': '2. Research Overview',
  'paper_assessment': '3. Paper Assessment',
  'problems_motivation': '4. Problems & Motivation',
  'contributions': '5. Contributions',
  'related_work': '6. Related Work',
  'methodology': '7. Methodology',
  'model_details': '8. Model Details',
  'training_settings': '9. Training Settings',
  'experiments': '10. Experiments',
  'results': '11. Results',
  'discussion': '12. Discussion',
  'personal_thoughts': '13. Personal Thoughts',
  'key_citations': '14. Key Citations',
  'appendix': '15. Appendix',
};

let observer = null;

export function initDetailModal() {
  const overlay = document.getElementById('modalOverlay');
  const closeBtn = document.getElementById('modalClose');

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  // Listen for open-detail events
  document.addEventListener('open-detail', (e) => {
    openModal(e.detail);
  });
}

async function openModal(shortName) {
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const subtitleEl = document.getElementById('modalSubtitle');
  const navEl = document.getElementById('modalNav');
  const contentEl = document.getElementById('modalContent');

  const paper = getPaper(shortName);

  // Set header
  titleEl.textContent = shortName;
  subtitleEl.textContent = paper ? `${paper.title || ''} | ${paper.venue || ''} ${paper.year || ''}` : '';

  // Phyra buttons
  let phyraContainer = document.getElementById('phyraBtns');
  if (!phyraContainer) {
    phyraContainer = document.createElement('div');
    phyraContainer.id = 'phyraBtns';
    phyraContainer.className = 'phyra-btns';
    const headerEl = document.querySelector('.modal-header');
    headerEl.insertBefore(phyraContainer, document.getElementById('modalClose'));
  }
  if (paper && paper.phyra_slides) {
    const slidesBtn = `<a class="phyra-btn" href="${paper.phyra_slides}" target="_blank" rel="noopener">Phyra Slides</a>`;
    const notesBtn = paper.phyra_notes
      ? `<a class="phyra-btn" href="${paper.phyra_notes}" target="_blank" rel="noopener">Phyra Notes</a>`
      : '';
    phyraContainer.innerHTML = slidesBtn + notesBtn;
    phyraContainer.style.display = '';
  } else {
    phyraContainer.innerHTML = '';
    phyraContainer.style.display = 'none';
  }

  // Show loading
  contentEl.innerHTML = '<div class="modal-loading">Loading notes...</div>';
  navEl.innerHTML = '';
  overlay.classList.add('open');

  // Load notes
  const notes = paper?.has_notes ? await loadNotes(shortName) : null;

  if (!notes || !notes.sections) {
    // Fallback: show basic metadata
    contentEl.innerHTML = renderFallback(paper);
    return;
  }

  // Build navigation and content
  const sections = notes.sections;
  const sectionKeys = Object.keys(SECTION_TITLES);
  let navHtml = '';
  let contentHtml = '';

  for (const key of sectionKeys) {
    const md = sections[key];
    if (!md) continue;

    const title = SECTION_TITLES[key];
    const anchorId = `section-${key}`;
    navHtml += `<a href="#${anchorId}" data-section="${key}">${title}</a>`;
    contentHtml += `<div id="${anchorId}" data-section="${key}">${renderMarkdown(md)}</div>`;
  }

  navEl.innerHTML = navHtml;
  contentEl.innerHTML = contentHtml;

  // Section navigation click
  navEl.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = contentEl.querySelector(`#${link.getAttribute('href').slice(1)}`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // IntersectionObserver for active section tracking
  if (observer) observer.disconnect();
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const key = entry.target.dataset.section;
        navEl.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        const activeLink = navEl.querySelector(`a[data-section="${key}"]`);
        if (activeLink) activeLink.classList.add('active');
      }
    }
  }, { root: contentEl, threshold: 0.1, rootMargin: '-10% 0px -80% 0px' });

  contentEl.querySelectorAll('[data-section]').forEach(el => observer.observe(el));

  // Activate first section
  const firstLink = navEl.querySelector('a');
  if (firstLink) firstLink.classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  if (observer) observer.disconnect();
}

function renderMarkdown(md) {
  if (typeof marked !== 'undefined') {
    try {
      return marked.parse(md);
    } catch {
      return escapeHtml(md).replace(/\n/g, '<br>');
    }
  }
  return escapeHtml(md).replace(/\n/g, '<br>');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderFallback(paper) {
  if (!paper) return '<div class="modal-loading">Paper not found</div>';
  return `
    <h2>${paper.short_name}</h2>
    <p><strong>Title:</strong> ${paper.title || 'N/A'}</p>
    <p><strong>Year:</strong> ${paper.year || 'N/A'}</p>
    <p><strong>Venue:</strong> ${paper.venue || 'N/A'}</p>
    <p><strong>Phase:</strong> ${paper.timeline_phase || 'N/A'}</p>
    <p><strong>Organization:</strong> ${paper.organization || 'N/A'}</p>
    <p><strong>Categories:</strong> ${(paper.task_category || []).join(', ') || 'N/A'}</p>
    <p><strong>Keywords:</strong> ${(paper.keywords || []).join(', ') || 'N/A'}</p>
    <p><strong>Architecture:</strong> ${paper.architecture || 'N/A'}</p>
    <p><strong>Motivation:</strong> ${paper.motivation || 'N/A'}</p>
    <p><strong>Core Contribution:</strong> ${paper.core_contribution || 'N/A'}</p>
    <p style="color:var(--text-muted);margin-top:16px"><em>Full notes not available for this paper.</em></p>
  `;
}
