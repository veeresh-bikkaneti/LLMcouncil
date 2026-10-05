export interface Source {
  id: number;
  title: string;
  url: string;
  content: string;
}

const MAX_CHARS = 900;
const clip = (s: string) => (s.length > MAX_CHARS ? `${s.slice(0, MAX_CHARS).trim()}…` : s);
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '');

/**
 * Optional, keyless grounding from Wikipedia's public API. The only thing that leaves
 * the machine is the (PII-scrubbed) question text, and only when the user turns
 * grounding on. One request: the extracts API returns the intro text with the hits.
 */
export async function searchWikipedia(query: string, signal?: AbortSignal, limit = 4): Promise<Source[]> {
  const q = query.trim();
  if (!q) return [];
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search' +
    `&gsrlimit=${limit}&gsrsearch=${encodeURIComponent(q)}` +
    '&prop=extracts|info&exintro=1&explaintext=1&exlimit=max&inprop=url';
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Wikipedia search failed: HTTP ${res.status}`);
  const pages: Array<{ index: number; title: string; fullurl: string; extract?: string }> = Object.values(
    (await res.json())?.query?.pages ?? {}
  );
  return pages
    .filter((p) => p.extract)
    .sort((a, b) => a.index - b.index)
    .map((p, i) => ({ id: i + 1, title: p.title, url: p.fullurl, content: clip(stripHtml(p.extract!)) }));
}
