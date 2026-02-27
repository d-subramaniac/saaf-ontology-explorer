import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const functionsUrl = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

  const res = await fetch(`${functionsUrl}/search-ontology`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, match_count, match_threshold, filter_type }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Search failed: ${res.status}`);
  }

  const data = await res.json();
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
  const { data, error } = await supabase
    .from('ontology_embeddings')
    .select('id, content_type, content_id, content_text, metadata')
    .eq('content_type', content_type)
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
