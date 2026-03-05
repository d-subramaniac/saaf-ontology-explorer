'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { getOntologyByType, type OntologyRecord } from '@/lib/supabase';

interface EnumValue {
  value: string;
  definition?: string;
  impact?: string;
}

interface PricingImpact {
  category?: string;
  typical_adjustment?: string;
  lookup_source?: string;
  update_frequency?: string;
}

interface FieldMetadata {
  name?: string;
  table?: string;
  type?: string;
  concept_id?: string;
  has_pricing_impact?: boolean;
  ui_section?: string;
  ui_subsection?: string;
  depends_on?: string[];
  affects?: string[];
  business_rules?: string[];
  validation_rules?: string[];
  enum_values?: EnumValue[];
  pricing_impact?: PricingImpact;
  source_provenance?: string;
  enrichment_status?: string;
  db_column?: string;
  nullable?: boolean;
  range?: string;
}

const STATUS_BADGES: Record<string, { label: string; color: string; dot: string }> = {
  expert_reviewed: { label: 'Expert Reviewed', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  ai_drafted:      { label: 'AI Drafted',       color: 'text-amber-400',  dot: 'bg-amber-400'  },
  needs_review:    { label: 'Needs Review',      color: 'text-red-400',    dot: 'bg-red-400'    },
  incomplete:      { label: 'Incomplete',         color: 'text-gray-500',   dot: 'bg-gray-500'   },
};

function FieldCard({ f, allFields }: { f: OntologyRecord; allFields: OntologyRecord[] }) {
  const [expanded, setExpanded] = useState(false);
  const m = f.metadata as FieldMetadata;
  const status = STATUS_BADGES[m.enrichment_status ?? 'incomplete'] ?? STATUS_BADGES.incomplete;

  const deps = m.depends_on ?? [];
  const affects = m.affects ?? [];
  const rules = m.business_rules ?? [];
  const validations = m.validation_rules ?? [];
  const enums = m.enum_values ?? [];

  const hasDetail = deps.length > 0 || affects.length > 0 || rules.length > 0 || validations.length > 0 || enums.length > 0 || m.pricing_impact;

  // Find fields by short name for linking
  const findField = (shortName: string) =>
    allFields.find(af => af.content_id.endsWith('.' + shortName) || af.content_id === shortName);

  return (
    <div className={`border rounded-lg transition-all ${expanded ? 'border-blue-600 bg-gray-900' : 'border-gray-800 bg-gray-900 hover:border-gray-700'}`}>
      {/* Header row — always visible */}
      <button
        onClick={() => hasDetail && setExpanded(e => !e)}
        className={`w-full text-left px-4 py-3 ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${status.dot}`} />
              <span className="font-mono text-sm text-white">{f.content_id}</span>
              {m.name && m.name !== f.content_id && (
                <span className="text-sm text-gray-400">{m.name}</span>
              )}
              {m.has_pricing_impact && (
                <span className="text-xs bg-amber-900/60 text-amber-300 px-1.5 py-0.5 rounded">pricing</span>
              )}
              {deps.length > 0 && (
                <span className="text-xs bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded">{deps.length} deps</span>
              )}
              {affects.length > 0 && (
                <span className="text-xs bg-orange-900/40 text-orange-400 px-1.5 py-0.5 rounded">affects {affects.length}</span>
              )}
              {rules.length > 0 && (
                <span className="text-xs bg-indigo-900/40 text-indigo-400 px-1.5 py-0.5 rounded">{rules.length} rules</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{f.content_text}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              {m.type && <span className="text-xs font-mono text-gray-600">{m.type}</span>}
              {m.ui_subsection && (
                <p className="text-xs text-gray-600 mt-0.5">{m.ui_subsection}</p>
              )}
            </div>
            {hasDetail && (
              <svg
                className={`w-4 h-4 text-gray-600 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-800 px-4 py-4 space-y-4">
          {/* Full definition */}
          <p className="text-sm text-gray-300 leading-relaxed">{f.content_text}</p>

          {/* Type / nullable / range */}
          <div className="flex flex-wrap gap-3">
            {m.type && (
              <div className="bg-gray-800 rounded px-2.5 py-1.5">
                <span className="text-xs text-gray-500 block">Type</span>
                <span className="text-sm font-mono text-white">{m.type}</span>
              </div>
            )}
            {m.nullable !== undefined && (
              <div className="bg-gray-800 rounded px-2.5 py-1.5">
                <span className="text-xs text-gray-500 block">Nullable</span>
                <span className={`text-sm font-medium ${m.nullable ? 'text-gray-400' : 'text-emerald-400'}`}>
                  {m.nullable ? 'yes' : 'required'}
                </span>
              </div>
            )}
            {m.range && (
              <div className="bg-gray-800 rounded px-2.5 py-1.5">
                <span className="text-xs text-gray-500 block">Range</span>
                <span className="text-sm font-mono text-white">{m.range}</span>
              </div>
            )}
            {m.has_pricing_impact && m.pricing_impact && (
              <div className="bg-amber-900/30 border border-amber-800/50 rounded px-2.5 py-1.5">
                <span className="text-xs text-amber-500 block">Pricing Impact</span>
                <span className="text-sm text-amber-300">
                  {m.pricing_impact.typical_adjustment ?? m.pricing_impact.category ?? 'Affects LLPA'}
                </span>
                {m.pricing_impact.update_frequency && (
                  <span className="text-xs text-amber-500 block mt-0.5">Updates: {m.pricing_impact.update_frequency}</span>
                )}
              </div>
            )}
          </div>

          {/* Dependency graph */}
          {(deps.length > 0 || affects.length > 0) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Traceability</h4>
              <div className="flex items-start gap-3 overflow-x-auto pb-1">
                {deps.length > 0 && (
                  <div className="min-w-fit">
                    <p className="text-xs text-blue-500 font-medium mb-1.5">INPUTS</p>
                    <div className="space-y-1">
                      {deps.map(d => {
                        const linked = findField(d);
                        return linked ? (
                          <span key={d} className="block px-2 py-1 bg-blue-900/40 border border-blue-800/50 rounded text-xs text-blue-300 font-mono cursor-default" title={linked.content_text.slice(0, 120)}>
                            {d}
                          </span>
                        ) : (
                          <span key={d} className="block px-2 py-1 bg-blue-900/20 border border-blue-900/40 rounded text-xs text-blue-500 font-mono">{d}</span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {deps.length > 0 && (
                  <div className="self-center text-gray-600 text-lg shrink-0">→</div>
                )}
                <div className="px-3 py-2 bg-indigo-900/50 border-2 border-indigo-600 rounded-lg min-w-fit self-center">
                  <div className="text-xs font-bold text-indigo-200">{m.name ?? f.content_id.split('.').pop()}</div>
                  <div className="text-xs text-indigo-400 font-mono">{m.type}</div>
                </div>
                {affects.length > 0 && (
                  <div className="self-center text-gray-600 text-lg shrink-0">→</div>
                )}
                {affects.length > 0 && (
                  <div className="min-w-fit">
                    <p className="text-xs text-orange-500 font-medium mb-1.5">DOWNSTREAM</p>
                    <div className="space-y-1">
                      {affects.map(a => {
                        const linked = findField(a);
                        return linked ? (
                          <span key={a} className="block px-2 py-1 bg-orange-900/40 border border-orange-800/50 rounded text-xs text-orange-300 font-mono cursor-default" title={linked.content_text.slice(0, 120)}>
                            {a}
                          </span>
                        ) : (
                          <span key={a} className="block px-2 py-1 bg-orange-900/20 border border-orange-900/40 rounded text-xs text-orange-500 font-mono">{a}</span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enum values */}
          {enums.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Allowed Values</h4>
              <div className="space-y-1">
                {enums.map(ev => (
                  <div key={ev.value} className="flex items-start gap-2">
                    <code className="px-1.5 py-0.5 bg-gray-800 text-gray-200 rounded text-xs font-mono shrink-0">{ev.value}</code>
                    <span className="text-xs text-gray-500">{ev.impact ?? ev.definition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Business rules */}
          {rules.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Business Rules</h4>
              <div className="space-y-1.5">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-indigo-500 mt-0.5 shrink-0">→</span>
                    <span className="text-gray-300 leading-relaxed">{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation rules */}
          {validations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Validation</h4>
              <div className="space-y-1">
                {validations.map((v, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                    <span className="text-gray-400">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source */}
          {m.source_provenance && (
            <div className="pt-1 border-t border-gray-800">
              <span className="text-xs text-gray-600">Source: {m.source_provenance}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FieldsPage() {
  const [fields, setFields] = useState<OntologyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [pricingOnly, setPricingOnly] = useState(false);
  const [withDepsOnly, setWithDepsOnly] = useState(false);

  useEffect(() => {
    getOntologyByType('field', 700)
      .then(setFields)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const sections = useMemo(() => {
    const sectionMap = new Map<string, Set<string>>();
    for (const f of fields) {
      const m = f.metadata as FieldMetadata;
      const sec = m.ui_section ?? 'Uncategorized';
      const sub = m.ui_subsection ?? '';
      if (!sectionMap.has(sec)) sectionMap.set(sec, new Set());
      if (sub) sectionMap.get(sec)!.add(sub);
    }
    return Array.from(sectionMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [fields]);

  const tables = useMemo(() => {
    const t = new Set<string>();
    for (const f of fields) {
      const m = f.metadata as FieldMetadata;
      if (m.table) t.add(m.table);
    }
    return Array.from(t).sort();
  }, [fields]);

  const filtered = useMemo(() => {
    return fields.filter(f => {
      const m = f.metadata as FieldMetadata;
      const q = search.toLowerCase();
      if (q && !f.content_id.toLowerCase().includes(q) && !f.content_text.toLowerCase().includes(q) && !(m.name ?? '').toLowerCase().includes(q)) return false;
      if (activeSection && (m.ui_section ?? 'Uncategorized') !== activeSection) return false;
      if (activeTable && m.table !== activeTable) return false;
      if (pricingOnly && !m.has_pricing_impact) return false;
      if (withDepsOnly) {
        const deps = m.depends_on ?? [];
        const affects = m.affects ?? [];
        if (deps.length === 0 && affects.length === 0) return false;
      }
      return true;
    });
  }, [fields, search, activeSection, activeTable, pricingOnly, withDepsOnly]);

  // Stats
  const stats = useMemo(() => {
    let withDeps = 0, withAffects = 0, withPricing = 0;
    for (const f of fields) {
      const m = f.metadata as FieldMetadata;
      if ((m.depends_on ?? []).length > 0) withDeps++;
      if ((m.affects ?? []).length > 0) withAffects++;
      if (m.has_pricing_impact) withPricing++;
    }
    return { withDeps, withAffects, withPricing };
  }, [fields]);

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-500">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
      Loading {fields.length} fields...
    </div>
  );

  if (error) return (
    <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300 text-sm">{error}</div>
  );

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0">
        <div className="sticky top-8 space-y-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter fields..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-blue-900/30 rounded-lg py-1.5 px-1">
              <div className="text-xs font-bold text-blue-300">{stats.withDeps}</div>
              <div className="text-xs text-blue-500">deps</div>
            </div>
            <div className="bg-orange-900/30 rounded-lg py-1.5 px-1">
              <div className="text-xs font-bold text-orange-300">{stats.withAffects}</div>
              <div className="text-xs text-orange-500">affects</div>
            </div>
            <div className="bg-amber-900/30 rounded-lg py-1.5 px-1">
              <div className="text-xs font-bold text-amber-300">{stats.withPricing}</div>
              <div className="text-xs text-amber-500">pricing</div>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={pricingOnly} onChange={e => setPricingOnly(e.target.checked)} className="rounded" />
              Pricing impact only
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={withDepsOnly} onChange={e => setWithDepsOnly(e.target.checked)} className="rounded" />
              Has dependencies
            </label>
          </div>

          {/* By table */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">By Table</p>
            <button
              onClick={() => setActiveTable(null)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${!activeTable && !activeSection ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              All tables
            </button>
            {tables.map(t => (
              <button
                key={t}
                onClick={() => { setActiveTable(t); setActiveSection(null); }}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors font-mono ${activeTable === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {t.replace('application_', '')}
              </button>
            ))}
          </div>

          {/* By section */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">By UI Section</p>
            <button
              onClick={() => setActiveSection(null)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${!activeSection && !activeTable ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              All sections
            </button>
            {sections.map(([sec]) => (
              <button
                key={sec}
                onClick={() => { setActiveSection(sec); setActiveTable(null); }}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${activeSection === sec ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-white">
            {activeSection ?? activeTable ?? 'All Fields'}
          </h1>
          <span className="text-sm text-gray-500">{filtered.length} fields — click to expand</span>
        </div>

        <div className="space-y-1.5">
          {filtered.map(f => (
            <FieldCard key={f.id} f={f} allFields={fields} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-600 text-sm">No fields match the current filters.</div>
        )}
      </div>
    </div>
  );
}
