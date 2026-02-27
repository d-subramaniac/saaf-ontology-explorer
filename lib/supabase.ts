import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy client — not initialized at module eval time so Vercel static prerender doesn't fail
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

export interface OntologyResult {
  id: string;
  content_type: string;
  content_id: string;
  content_text: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export async function searchOntology(
  query: string,
  options: {
    match_count?: number;
    match_threshold?: number;
    filter_type?: string | null;
  } = {}
): Promise<OntologyResult[]> {
  const { match_count = 10, match_threshold = 0.3, filter_type = null } = options;
  const functionsUrl = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL!;

  const res = await fetch(`${functionsUrl}/search-ontology`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, match_count, match_threshold, filter_type }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Search failed: ${res.status}`);
  }

  const data = await res.json() as { results?: OntologyResult[] };
  return data.results ?? [];
}

export interface OntologyRecord {
  id: string;
  content_type: string;
  content_id: string;
  content_text: string;
  metadata: Record<string, unknown>;
  created_at?: string;
}

export async function getOntologyByType(
  content_type: string,
  limit = 500
): Promise<OntologyRecord[]> {
  const { data, error } = await getSupabase()
    .from('ontology_embeddings')
    .select('id, content_type, content_id, content_text, metadata')
    .eq('content_type', content_type)
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as OntologyRecord[];
}
