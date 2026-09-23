import type { SearchOptions, SearchResult } from './types';

const CONTENT_CHAR_LIMIT = 1500;

const truncate = (text: string, limit = CONTENT_CHAR_LIMIT): string =>
  text.length > limit ? `${text.slice(0, limit).trim()}…` : text;

const stripHtml = (html: string): string => html.replace(/<[^>]+>/g, '');

/**
 * Cloud-backed search via Tavily (https://tavily.com). Used only when the user has
 * supplied their own API key -- never required to use the app.
 */
async function searchTavily(query: string, apiKey: string, maxResults: number): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.slice(0, maxResults).map((r: any, i: number): SearchResult => ({
    id: i + 1,
    title: r.title || r.url,
    url: r.url,
    content: truncate(r.content || ''),
    source: 'tavily',
  }));
}

/**
 * Cloud-backed search via Brave Search API. Alternative to Tavily; also opt-in only.
 */
async function searchBrave(query: string, apiKey: string, maxResults: number): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
  const response = await fetch(url, {
    headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Brave search failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  const results = data.web?.results ?? [];
  return results.slice(0, maxResults).map((r: any, i: number): SearchResult => ({
    id: i + 1,
    title: r.title,
    url: r.url,
    content: truncate(stripHtml(r.description || '')),
    source: 'brave',
  }));
}

/**
 * Keyless, CORS-enabled grounding fallback so the app works with zero configuration.
 * Uses Wikipedia's public search + summary REST endpoints (no API key required).
 */
async function searchWikipedia(query: string, maxResults: number): Promise<SearchResult[]> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=${maxResults}&srsearch=${encodeURIComponent(query)}`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    throw new Error(`Wikipedia search failed: HTTP ${searchRes.status}`);
  }
  const searchData = await searchRes.json();
  const hits: Array<{ title: string; snippet: string }> = searchData?.query?.search ?? [];

  const summaries = await Promise.all(
    hits.map(async (hit) => {
      try {
        const titlePath = encodeURIComponent(hit.title.replace(/ /g, '_'));
        const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${titlePath}`);
        if (!summaryRes.ok) return null;
        const summary = await summaryRes.json();
        return {
          title: summary.title || hit.title,
          url: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${titlePath}`,
          content: summary.extract || stripHtml(hit.snippet || ''),
        };
      } catch {
        return null;
      }
    })
  );

  return summaries
    .filter((s): s is { title: string; url: string; content: string } => !!s && s.content.length > 0)
    .slice(0, maxResults)
    .map((s, i): SearchResult => ({
      id: i + 1,
      title: s.title,
      url: s.url,
      content: truncate(s.content),
      source: 'wikipedia',
    }));
}

/**
 * The runtime search connector used by the orchestrator. Prefers the user's own cloud
 * search API key when one is configured; otherwise grounds the query against the
 * keyless Wikipedia fallback so the app never requires a cloud credential to function.
 */
export async function executeWebSearch(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
  const maxResults = opts.maxResults ?? 5;
  const provider = opts.provider ?? 'auto';
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  if (opts.apiKey && (provider === 'auto' || provider === 'tavily')) {
    try {
      return await searchTavily(trimmedQuery, opts.apiKey, maxResults);
    } catch (err) {
      console.warn('[executeWebSearch] Tavily lookup failed, falling back:', err);
    }
  }

  if (opts.apiKey && provider === 'brave') {
    try {
      return await searchBrave(trimmedQuery, opts.apiKey, maxResults);
    } catch (err) {
      console.warn('[executeWebSearch] Brave lookup failed, falling back:', err);
    }
  }

  try {
    return await searchWikipedia(trimmedQuery, maxResults);
  } catch (err) {
    console.warn('[executeWebSearch] Wikipedia grounding failed:', err);
    return [];
  }
}
