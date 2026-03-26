/**
 * Data loading: papers.json and lazy-loaded individual notes.
 */

let papersCache = null;
const notesCache = new Map();

export async function loadPapers() {
  if (papersCache) return papersCache;
  const resp = await fetch('data/papers.json');
  if (!resp.ok) throw new Error(`Failed to load papers.json: ${resp.status}`);
  papersCache = await resp.json();
  return papersCache;
}

export async function loadNotes(shortName) {
  if (notesCache.has(shortName)) return notesCache.get(shortName);
  try {
    const resp = await fetch(`data/notes/${encodeURIComponent(shortName)}.json`);
    if (!resp.ok) return null;
    const data = await resp.json();
    notesCache.set(shortName, data);
    return data;
  } catch {
    return null;
  }
}

export function getPaper(shortName) {
  if (!papersCache) return null;
  return papersCache.find(p => p.short_name === shortName) || null;
}
