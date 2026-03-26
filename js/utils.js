/**
 * Shared utility helpers.
 */

/** Get the center position of a paper block on the whiteboard. */
export function getBlockCenter(shortName) {
  const el = document.querySelector(`.paper-block[data-name="${shortName}"]`);
  if (!el) return null;
  const x = parseFloat(el.style.left) + el.offsetWidth / 2;
  const y = parseFloat(el.style.top) + el.offsetHeight / 2;
  return { x, y };
}

/** Convert screen coordinates to mapboard coordinates. */
export function screenToMap(clientX, clientY, viewport) {
  const wrapper = document.getElementById('mapWrapper');
  const rect = wrapper.getBoundingClientRect();
  return {
    x: (clientX - rect.left - viewport.panX) / viewport.zoom,
    y: (clientY - rect.top - viewport.panY) / viewport.zoom,
  };
}

/** Get category color CSS variable name. */
const CAT_COLOR_MAP = {
  'World Model': '--cat-world-model',
  'Video Generation': '--cat-video',
  '3D Scene Understanding': '--cat-3d-scene',
  'Motion Planning': '--cat-motion-planning',
  'End-to-End Driving': '--cat-e2e-driving',
  'Simulation': '--cat-simulation',
  'Occupancy Prediction': '--cat-occupancy',
  'Neural Rendering': '--cat-neural-rendering',
};

export function getCategoryColor(category) {
  const varName = CAT_COLOR_MAP[category];
  if (varName) return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return '#888';
}

/** 12-color palette for connections. */
export const CONNECTION_COLORS = [
  '#4361ee', '#e63946', '#2ec4b6', '#f9a825', '#7b2d8e',
  '#ff6b35', '#06d6a0', '#118ab2', '#ef476f', '#ffd166',
  '#073b4c', '#06d6a0',
];

/** Base64 encode/decode for layout persistence. */
export function lzEncode(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

export function lzDecode(str) {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch {
    return str;
  }
}
