/**
 * Central state management with simple pub/sub.
 */

export const state = {
  papers: [],              // from papers.json
  positions: {},           // { shortName: {x, y} }
  placedPapers: new Set(), // which papers are on whiteboard
  filters: {},             // { filterKey: Set([selectedValues]) }
  searchQuery: '',
  viewport: { panX: 0, panY: 0, zoom: 1 },
  connections: [],         // [{ from, to, text, color, mid:{x,y}, labelT }]
  annotations: [],         // [{ x, y, text, width, height, colorIdx }]
  connectMode: false,
  connectSource: null,
  selectedBlocks: new Set(),
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(topic) {
  for (const fn of listeners) {
    try { fn(topic); } catch (e) { console.error('state listener error:', e); }
  }
}
