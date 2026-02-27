'use client';

import { useState, useCallback, useRef } from 'react';
import { searchOntology, type OntologyResult } from '@/lib/supabase';

const TYPE_FILTERS = [
  { label: 'All', value: null },
  { label: 'Concepts', value: 'concept' },
  { label: 'Fields', value: 'field' },
  { label: 'Conditions', value: 'condition' },
  { label: 'Rules', value: 'rule' },
];

const TYPE_COLORS: Record<string, string> = {
  concept: 'bg-blue-900 text-blue-200',
  field: 'bg-emerald-900 text-emerald-200',
  condition: 'bg-amber-900 text-amber-200',
  rule: 'bg-purple-900 text-purple-200',
};

function similarity_badge(s: number) {
  const pct = Math.round(s * 100);
  const color = pct >= 70 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-gray-500';
  return <span className={`text-xs font-mono ${color}`}>{pct}%</span>;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [results, setResults] = useState<OntologyResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string, type: string | null) => {
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await searchOntology(q, { match_count: 20, match_threshold: 0.25, filter_type: type });
      setResults(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(val: string) {
    setQuery(val);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(val, filterType), 400);
  }

  function handleFilter(type: string | null) {
    setFilterType(type);
    if (query.trim()) runSearch(query, type);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Ontology Search</h1>
        <p className="text-gray-400 text-sm">Semantic search across 799 embeddings — concepts, fields, conditions, and calculation rules.</p>
      </div>

      {/* Search input */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-3 w-5 h-5 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && runSearch(query, filterType)}
          placeholder="e.g. DSCR calculation, credit score impact, property type restrictions..."
          className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {loading && (
          <div className="absolute right-3 top-3.5">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TYPE_FILTERS.map(f => (
          <button
            key={String(f.value)}
            onClick={() => handleFilter(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterType === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-4 text-red-300 text-sm">{error}</div>
      )}

      {/* Empty state */}
      {!query.trim() && !loading && (
        <div className="text-center py-16 text-gray-600">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <p className="text-sm">Start typing to search the ontology</p>
        </div>
      )}

      {/* No results */}
      {results !== null && results.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500 text-sm">No results found. Try lowering specificity or a different query.</div>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-600 mb-3">{results.length} results</p>
          {results.map(r => (
            <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[r.content_type] ?? 'bg-gray-700 text-gray-300'}`}>
                    {r.content_type}
                  </span>
                  <span className="text-sm font-mono text-gray-300">{r.content_id}</span>
                  {r.metadata?.name != null && String(r.metadata.name) !== r.content_id && (
                    <span className="text-sm text-gray-400">· {String(r.metadata.name)}</span>
                  )}
                </div>
                {similarity_badge(r.similarity)}
              </div>
              <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">{r.content_text}</p>
              {!!r.metadata?.table && (
                <p className="text-xs text-gray-600 mt-2 font-mono">table: {String(r.metadata.table)}</p>
              )}
              {!!r.metadata?.trigger_type && (
                <p className="text-xs text-gray-600 mt-1">trigger: {String(r.metadata.trigger_type)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
