/**
 * Text box annotations on the whiteboard.
 * Features: drag, resize, edit, change color.
 */

import { state } from './state.js';

export const TB_COLORS = [
  { name: 'Default', value: 'var(--surface)', bar: 'var(--border)' },
  { name: 'Red',     value: '#fef2f2', bar: '#ef4444' },
  { name: 'Blue',    value: '#eff6ff', bar: '#3b82f6' },
  { name: 'Green',   value: '#f0fdf4', bar: '#22c55e' },
  { name: 'Yellow',  value: '#fefce8', bar: '#eab308' },
  { name: 'Purple',  value: '#faf5ff', bar: '#a855f7' },
  { name: 'Orange',  value: '#fff7ed', bar: '#f97316' },
  { name: 'Cyan',    value: '#ecfeff', bar: '#06b6d4' },
];

export const TB_COLORS_DARK = [
  { name: 'Default', value: 'var(--surface)', bar: 'var(--border)' },
  { name: 'Red',     value: '#2a1515', bar: '#ef4444' },
  { name: 'Blue',    value: '#15192a', bar: '#3b82f6' },
  { name: 'Green',   value: '#152a18', bar: '#22c55e' },
  { name: 'Yellow',  value: '#2a2815', bar: '#eab308' },
  { name: 'Purple',  value: '#221528', bar: '#a855f7' },
  { name: 'Orange',  value: '#2a2015', bar: '#f97316' },
  { name: 'Cyan',    value: '#152828', bar: '#06b6d4' },
];

let editingAnnIdx = -1;
let _activeHandler = null;

export function setPopupHandler(handler) {
  _activeHandler = handler;
}

export function initAnnotations() {
  document.getElementById('annSaveBtn').addEventListener('click', () => {
    if (_activeHandler && _activeHandler.save) _activeHandler.save();
  });
  document.getElementById('annDeleteBtn').addEventListener('click', () => {
    if (_activeHandler && _activeHandler.delete) _activeHandler.delete();
  });
}

export function renderAnnotations() {
  document.querySelectorAll('.text-box').forEach(el => el.remove());
  const map = document.getElementById('mapboard');

  state.annotations.forEach((ann, idx) => {
    const el = createTextBoxElement(ann, idx);
    map.appendChild(el);
  });
}

function createTextBoxElement(ann, idx) {
  const el = document.createElement('div');
  el.className = 'text-box';
  el.dataset.annIdx = idx;
  el.style.left = ann.x + 'px';
  el.style.top = ann.y + 'px';

  const fontSize = ann.fontSize || 14;
  el.style.fontSize = fontSize + 'px';

  const colorIdx = ann.colorIdx || 0;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const palette = isDark ? TB_COLORS_DARK : TB_COLORS;
  const color = palette[colorIdx] || palette[0];

  el.style.background = color.value;

  // Color bar
  const bar = document.createElement('div');
  bar.className = 'tb-color-bar';
  bar.style.background = color.bar;
  el.appendChild(bar);

  // Content
  const content = document.createElement('div');
  content.className = 'tb-content';
  content.textContent = ann.text || '';
  el.appendChild(content);

  // Click to select
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.text-box.selected').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
  });

  // Double-click to edit
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    editingAnnIdx = idx;
    openAnnEdit(e.clientX, e.clientY, ann);
  });

  setupDrag(el, idx);

  return el;
}

function setupDrag(el, idx) {
  let dragging = false;
  let startX, startY, origX, origY;

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragging = false;
    el.setPointerCapture(e.pointerId);
    origX = state.annotations[idx].x;
    origY = state.annotations[idx].y;
    startX = e.clientX;
    startY = e.clientY;

    const onMove = (ev) => {
      const zoom = state.viewport.zoom;
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      if (!dragging && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) dragging = true;
      if (!dragging) return;
      const nx = origX + dx;
      const ny = origY + dy;
      el.style.left = nx + 'px';
      el.style.top = ny + 'px';
      state.annotations[idx].x = nx;
      state.annotations[idx].y = ny;
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
}

function openAnnEdit(x, y, ann) {
  _activeHandler = { save: saveAnn, delete: deleteAnn };
  const popup = document.getElementById('annEditPopup');
  document.getElementById('annEditText').value = ann ? ann.text : '';

  // Build color picker
  let pickerEl = popup.querySelector('.tb-color-picker');
  if (!pickerEl) {
    pickerEl = document.createElement('div');
    pickerEl.className = 'tb-color-picker';
    popup.insertBefore(pickerEl, popup.querySelector('.popup-actions'));
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const palette = isDark ? TB_COLORS_DARK : TB_COLORS;
  const currentIdx = ann ? (ann.colorIdx || 0) : 0;

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

  const currentFontSize = ann ? (ann.fontSize || 14) : 14;
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

  popup.style.left = Math.min(x, window.innerWidth - 280) + 'px';
  popup.style.top = Math.min(y, window.innerHeight - 240) + 'px';
  popup.style.display = 'block';
  document.getElementById('annEditText').focus();
}

function saveAnn() {
  if (editingAnnIdx < 0) return;
  const text = document.getElementById('annEditText').value.trim();
  if (text) {
    state.annotations[editingAnnIdx].text = text;
  }

  // Get selected color
  const popup = document.getElementById('annEditPopup');
  const activeSwatch = popup.querySelector('.tb-color-swatch.active');
  if (activeSwatch) {
    state.annotations[editingAnnIdx].colorIdx = parseInt(activeSwatch.dataset.colorIdx) || 0;
  }

  // Get font size
  const fontVal = popup.querySelector('.tb-font-val');
  if (fontVal) {
    state.annotations[editingAnnIdx].fontSize = parseInt(fontVal.textContent) || 14;
  }

  popup.style.display = 'none';
  editingAnnIdx = -1;
  renderAnnotations();
}

function deleteAnn() {
  if (editingAnnIdx < 0) return;
  state.annotations.splice(editingAnnIdx, 1);
  document.getElementById('annEditPopup').style.display = 'none';
  editingAnnIdx = -1;
  renderAnnotations();
}
