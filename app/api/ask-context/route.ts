const SUPABASE_FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL!;

interface SearchResult {
  content_type: string;
  content_id: string;
  content_text: string;
  similarity: number;
}

export async function POST(req: Request) {
  const { query } = await req.json() as { query: string };
  if (!query?.trim()) return Response.json({ results: [] });

  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/search-ontology`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, match_count: 15, match_threshold: 0.2 }),
    });
    if (!res.ok) return Response.json({ results: [] });
    const { results } = await res.json() as { results: SearchResult[] };
    return Response.json({ results: results ?? [] });
  } catch {
    return Response.json({ results: [] });
  }
}
