/** Thin wrapper around Tavily's search API — used for the two discovery-based sectors (commercial BD targets, institutional pipeline) that have no structured registry to query directly. */

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

export async function tavilySearch(apiKey: string, query: string, maxResults = 5): Promise<TavilyResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_results: maxResults }),
  });
  if (!res.ok) throw new Error(`Tavily search failed for "${query}": ${res.status}`);
  const json = await res.json();
  return (json.results ?? []).map((r: { title: string; url: string; content: string }) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));
}
