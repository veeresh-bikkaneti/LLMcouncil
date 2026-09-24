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
 * Keyless, CORS-enabled second fallback source (DuckDuckGo's Instant Answer API).
 * Narrower than Wikipedia -- it returns an infobox-style abstract plus related-topic
 * blurbs for a well-known entity or term, not general web search -- so it's tried
 * only when Wikipedia comes back empty or fails, not as a primary source.
 */
async function searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&t=llmcouncil`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: HTTP ${response.status}`);
  }
  const data = await response.json();

  interface Topic {
    Text?: string;
    FirstURL?: string;
    Topics?: Topic[];
  }
  const flatten = (topics: Topic[] | undefined): Topic[] =>
    (topics ?? []).flatMap((t) => (t.Topics ? flatten(t.Topics) : [t]));

  const items: Array<{ title: string; url: string; content: string }> = [];
  if (data.AbstractText) {
    items.push({ title: data.Heading || query, url: data.AbstractURL, content: data.AbstractText });
  }
  for (const topic of flatten(data.RelatedTopics)) {
    if (!topic.Text || !topic.FirstURL) continue;
    // DDG's related-topic "title" is just the article name repeated at the start of
    // Text (e.g. "Paris - Capital of France..."); split it back out for a real title.
    const [title, ...rest] = topic.Text.split(' - ');
    items.push({ title: title || topic.Text, url: topic.FirstURL, content: rest.join(' - ') || topic.Text });
  }

  return items.slice(0, maxResults).map((item, i): SearchResult => ({
    id: i + 1,
    title: item.title,
    url: item.url,
    content: truncate(item.content),
    source: 'duckduckgo',
  }));
}

/**
 * The runtime search connector used by the orchestrator. Prefers the user's own cloud
 * search API key when one is configured; otherwise grounds the query against the
 * keyless Wikipedia fallback, with a second keyless attempt (DuckDuckGo) so the app
 * never requires a cloud credential to function.
 */
export async function executeWebSearch(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
  const maxResults = opts.maxResults ?? 5;
  const provider = opts.provider ?? 'auto';
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  if (opts.apiKey && provider !== 'brave') {
    try {
      return await searchTavily(trimmedQuery, opts.apiKey, maxResults);
    } catch (err) {
      console.warn('[executeWebSearch] Tavily lookup failed, falling back:', err);
    }
  }

  // In 'auto' mode we don't know which provider the pasted key belongs to, so a
  // failed Tavily attempt also gets a Brave attempt before giving up on the key
  // entirely -- otherwise a valid Brave key silently never gets used.
  if (opts.apiKey && provider !== 'tavily') {
    try {
      return await searchBrave(trimmedQuery, opts.apiKey, maxResults);
    } catch (err) {
      console.warn('[executeWebSearch] Brave lookup failed, falling back:', err);
    }
  }

  try {
    const results = await searchWikipedia(trimmedQuery, maxResults);
    if (results.length > 0) return results;
  } catch (err) {
    console.warn('[executeWebSearch] Wikipedia grounding failed, trying DuckDuckGo:', err);
  }

  try {
    return await searchDuckDuckGo(trimmedQuery, maxResults);
  } catch (err) {
    console.warn('[executeWebSearch] DuckDuckGo grounding failed:', err);
    return [];
  }
}
