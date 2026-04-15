/**
 * Bezier connections between paper blocks on the whiteboard.
 */

import { state } from './state.js';
import { getBlockCenter, CONNECTION_COLORS } from './utils.js';

let draggingControlPoint = null;
let draggingLabel = null;
let editingConnIdx = -1;

export function initConnections() {
  // Control point drag
  document.addEventListener('pointermove', onDragControlPoint);
  document.addEventListener('pointerup', () => {
    draggingControlPoint = null;
    draggingLabel = null;
  });

  // Connection edit popup
  document.getElementById('connSaveBtn').addEventListener('click', saveConnEdit);
  document.getElementById('connDeleteBtn').addEventListener('click', deleteConn);
}

export function renderConnections() {
  const svg = document.getElementById('connectionsSvg');
  // Clear existing paths
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  // Clear labels
  document.querySelectorAll('.conn-label').forEach(el => el.remove());

  const map = document.getElementById('mapboard');

  state.connections.forEach((conn, idx) => {
    const c1 = getBlockCenter(conn.from);
    const c2 = getBlockCenter(conn.to);
    if (!c1 || !c2) return;

    // Auto-assign color
    if (!conn.color) {
      conn.color = CONNECTION_COLORS[idx % CONNECTION_COLORS.length];
    }

    // Midpoint
    const lineMid = { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 };
    if (!conn.mid) conn.mid = { ...lineMid };
    const mid = conn.mid;

    // Quadratic Bezier control point from midpoint
    const ctrl = {
      x: 2 * mid.x - 0.5 * (c1.x + c2.x),
      y: 2 * mid.y - 0.5 * (c1.y + c2.y),
    };

    // Draw path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${c1.x} ${c1.y} Q ${ctrl.x} ${ctrl.y} ${c2.x} ${c2.y}`);
    path.style.stroke = conn.color;
    path.style.fill = 'none';
    path.style.pointerEvents = 'stroke';
    path.style.cursor = 'pointer';
    path.addEventListener('click', (e) => {
      e.stopPropagation();
      openConnEdit(idx, e.clientX, e.clientY);
    });
    svg.appendChild(path);

    // Arrow at t=0.85
    const tA = 0.85;
    const ax = (1-tA)*(1-tA)*c1.x + 2*(1-tA)*tA*ctrl.x + tA*tA*c2.x;
    const ay = (1-tA)*(1-tA)*c1.y + 2*(1-tA)*tA*ctrl.y + tA*tA*c2.y;
    const tx = 2*(1-tA)*(ctrl.x-c1.x) + 2*tA*(c2.x-ctrl.x);
    const ty = 2*(1-tA)*(ctrl.y-c1.y) + 2*tA*(c2.y-ctrl.y);
    const angle = Math.atan2(ty, tx);
    const arrowLen = 10;

    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const p1x = ax, p1y = ay;
    const p2x = ax - arrowLen * Math.cos(angle - 0.4), p2y = ay - arrowLen * Math.sin(angle - 0.4);
    const p3x = ax - arrowLen * Math.cos(angle + 0.4), p3y = ay - arrowLen * Math.sin(angle + 0.4);
    arrow.setAttribute('points', `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`);
    arrow.style.fill = conn.color;
    arrow.style.pointerEvents = 'none';
    svg.appendChild(arrow);

    // Draggable control/midpoint
    const midPt = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    midPt.setAttribute('cx', mid.x);
    midPt.setAttribute('cy', mid.y);
    midPt.setAttribute('r', 6);
    midPt.classList.add('conn-control-point');
    midPt.style.stroke = conn.color;
    midPt.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      draggingControlPoint = { idx };
    });
    svg.appendChild(midPt);

    // Label
    if (conn.text) {
      const t = conn.labelT || 0.5;
      const lx = (1-t)*(1-t)*c1.x + 2*(1-t)*t*ctrl.x + t*t*c2.x;
      const ly = (1-t)*(1-t)*c1.y + 2*(1-t)*t*ctrl.y + t*t*c2.y;

      const label = document.createElement('div');
      label.className = 'conn-label';
      label.textContent = conn.text;
      label.style.left = lx + 'px';
      label.style.top = (ly - 12) + 'px';
      label.style.borderColor = conn.color;
      label.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        draggingLabel = { idx, c1, c2, ctrl };
      });
      label.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        openConnEdit(idx, e.clientX, e.clientY);
      });
      map.appendChild(label);
    }
  });
}

function onDragControlPoint(e) {
  if (draggingControlPoint) {
    const wrapper = document.getElementById('mapWrapper');
    const rect = wrapper.getBoundingClientRect();
    const zoom = state.viewport.zoom;
    const x = (e.clientX - rect.left - state.viewport.panX) / zoom;
    const y = (e.clientY - rect.top - state.viewport.panY) / zoom;

    const conn = state.connections[draggingControlPoint.idx];
    if (conn) {
      conn.mid = { x, y };
      renderConnections();
    }
  }

  if (draggingLabel) {
    const wrapper = document.getElementById('mapWrapper');
    const rect = wrapper.getBoundingClientRect();
    const zoom = state.viewport.zoom;
    const mouseX = (e.clientX - rect.left - state.viewport.panX) / zoom;
    const mouseY = (e.clientY - rect.top - state.viewport.panY) / zoom;

    const { idx, c1, c2, ctrl } = draggingLabel;
    const conn = state.connections[idx];
    if (!conn) return;

    // Find closest t on curve
    let bestT = 0.5, bestDist = Infinity;
    for (let t = 0; t <= 1; t += 0.02) {
      const px = (1-t)*(1-t)*c1.x + 2*(1-t)*t*ctrl.x + t*t*c2.x;
      const py = (1-t)*(1-t)*c1.y + 2*(1-t)*t*ctrl.y + t*t*c2.y;
      const dist = (px - mouseX) ** 2 + (py - mouseY) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }
    conn.labelT = Math.max(0.1, Math.min(0.9, bestT));
    renderConnections();
  }
}

function openConnEdit(idx, x, y) {
  editingConnIdx = idx;
  const conn = state.connections[idx];
  const popup = document.getElementById('connEditPopup');
  document.getElementById('connEditText').value = conn.text || '';
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
  popup.style.display = 'block';
  document.getElementById('connEditText').focus();
}

function saveConnEdit() {
  if (editingConnIdx < 0) return;
  const conn = state.connections[editingConnIdx];
  conn.text = document.getElementById('connEditText').value.trim();
  document.getElementById('connEditPopup').style.display = 'none';
  editingConnIdx = -1;
  renderConnections();
}

function deleteConn() {
  if (editingConnIdx < 0) return;
  state.connections.splice(editingConnIdx, 1);
  document.getElementById('connEditPopup').style.display = 'none';
  editingConnIdx = -1;
  renderConnections();
}
