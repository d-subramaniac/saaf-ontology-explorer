'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { getOntologyByType, type OntologyRecord } from '@/lib/supabase';

interface ConditionMetadata {
  name?: string;
  loan_programs?: string[];
  trigger_type?: string;
  file?: string;
}

const TRIGGER_COLORS: Record<string, string> = {
  data_missing: 'bg-red-900/60 text-red-300',
  milestone_reached: 'bg-blue-900/60 text-blue-300',
  ltv_threshold: 'bg-amber-900/60 text-amber-300',
  loan_purpose_check: 'bg-purple-900/60 text-purple-300',
  entity_vesting: 'bg-teal-900/60 text-teal-300',
  manual_trigger: 'bg-gray-700 text-gray-300',
  property_type_check: 'bg-orange-900/60 text-orange-300',
  document_received: 'bg-emerald-900/60 text-emerald-300',
};

export default function ConditionsPage() {
  const [conditions, setConditions] = useState<OntologyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTrigger, setActiveTrigger] = useState<string | null>(null);
  const [activeProgram, setActiveProgram] = useState<string | null>(null);

  useEffect(() => {
    getOntologyByType('condition', 200)
      .then(setConditions)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const triggerTypes = useMemo(() => {
    const t = new Set<string>();
    for (const c of conditions) {
      const m = c.metadata as ConditionMetadata;
      if (m.trigger_type) t.add(m.trigger_type);
    }
    return Array.from(t).sort();
  }, [conditions]);

  const loanPrograms = useMemo(() => {
    const p = new Set<string>();
    for (const c of conditions) {
      const m = c.metadata as ConditionMetadata;
      for (const prog of (m.loan_programs ?? [])) p.add(prog);
    }
    return Array.from(p).sort();
  }, [conditions]);

  const filtered = useMemo(() => {
    return conditions.filter(c => {
      const m = c.metadata as ConditionMetadata;
      const q = search.toLowerCase();
      if (q && !c.content_text.toLowerCase().includes(q) && !(m.name ?? '').toLowerCase().includes(q) && !c.content_id.toLowerCase().includes(q)) return false;
      if (activeTrigger && m.trigger_type !== activeTrigger) return false;
      if (activeProgram && !(m.loan_programs ?? []).includes(activeProgram)) return false;
      return true;
    });
  }, [conditions, search, activeTrigger, activeProgram]);

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-500">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
      Loading conditions...
    </div>
  );

  if (error) return (
    <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300 text-sm">{error}</div>
  );

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-48 flex-shrink-0">
        <div className="sticky top-8 space-y-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter conditions..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Trigger Type</p>
            <button
              onClick={() => setActiveTrigger(null)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${!activeTrigger ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              All triggers
            </button>
            {triggerTypes.map(t => (
              <button
                key={t}
                onClick={() => setActiveTrigger(t)}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${activeTrigger === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {t.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {loanPrograms.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Loan Program</p>
              <button
                onClick={() => setActiveProgram(null)}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${!activeProgram ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                All programs
              </button>
              {loanPrograms.map(p => (
                <button
                  key={p}
                  onClick={() => setActiveProgram(p)}
                  className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${activeProgram === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-white">
            {activeTrigger ? activeTrigger.replace(/_/g, ' ') : 'All Conditions'}
          </h1>
          <span className="text-sm text-gray-500">{filtered.length} conditions</span>
        </div>

        <div className="space-y-2">
          {filtered.map(c => {
            const m = c.metadata as ConditionMetadata;
            const triggerClass = TRIGGER_COLORS[m.trigger_type ?? ''] ?? 'bg-gray-700 text-gray-300';
            return (
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 hover:border-gray-700 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs text-gray-500">{c.content_id}</span>
                      {m.name && (
                        <span className="text-sm font-medium text-white">{m.name}</span>
                      )}
                      {m.trigger_type && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${triggerClass}`}>
                          {m.trigger_type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{c.content_text}</p>
                    {(m.loan_programs ?? []).length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {(m.loan_programs ?? []).map(p => (
                          <span key={p} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-600 text-sm">No conditions match the current filters.</div>
        )}
      </div>
    </div>
  );
}
