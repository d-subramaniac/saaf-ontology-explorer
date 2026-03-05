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

const STATUS_COLORS: Record<string, { dot: string; label: string }> = {
  expert_reviewed: { dot: 'bg-emerald-500', label: 'Expert Reviewed' },
  ai_drafted:      { dot: 'bg-amber-400',   label: 'AI Drafted' },
  needs_review:    { dot: 'bg-red-500',      label: 'Needs Review' },
  incomplete:      { dot: 'bg-gray-300',     label: 'Incomplete' },
};

const TYPE_COLOR: Record<string, string> = {
  numeric:  'text-blue-700 bg-blue-50 border-blue-200',
  integer:  'text-blue-700 bg-blue-50 border-blue-200',
  text:     'text-violet-700 bg-violet-50 border-violet-200',
  varchar:  'text-violet-700 bg-violet-50 border-violet-200',
  boolean:  'text-teal-700 bg-teal-50 border-teal-200',
  enum:     'text-orange-700 bg-orange-50 border-orange-200',
  date:     'text-rose-700 bg-rose-50 border-rose-200',
  jsonb:    'text-gray-600 bg-gray-100 border-gray-300',
};

function typeColor(t?: string) {
  if (!t) return 'text-gray-500 bg-gray-100 border-gray-200';
  const base = t.toLowerCase().replace(/[^a-z]/g, '');
  return TYPE_COLOR[base] ?? 'text-gray-600 bg-gray-100 border-gray-200';
}

function FieldCard({ f, allFields }: { f: OntologyRecord; allFields: OntologyRecord[] }) {
  const [open, setOpen] = useState(false);
  const m = f.metadata as FieldMetadata;
  const status = STATUS_COLORS[m.enrichment_status ?? 'incomplete'] ?? STATUS_COLORS.incomplete;

  const deps = m.depends_on ?? [];
  const affects = m.affects ?? [];
  const rules = m.business_rules ?? [];
  const validations = m.validation_rules ?? [];
  const enums = m.enum_values ?? [];
  const hasDetail = deps.length > 0 || affects.length > 0 || rules.length > 0 ||
    validations.length > 0 || enums.length > 0 || !!m.pricing_impact || !!m.source_provenance;

  const shortName = f.content_id.split('.').pop() ?? f.content_id;

  const findField = (name: string) =>
    allFields.find(af => af.content_id.endsWith('.' + name) || af.content_id === name);

  return (
    <div className={`bg-white rounded-lg border transition-all ${open ? 'border-blue-400 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
      {/* Header — always visible */}
      <button
        onClick={() => hasDetail && setOpen(o => !o)}
        className={`w-full text-left px-4 py-3 ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-3">
          {/* Status dot */}
          <span className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`} title={status.label} />

          {/* Field ID */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-mono text-sm font-medium text-gray-900">{shortName}</span>
              {m.name && m.name !== shortName && (
                <span className="text-sm text-gray-500">{m.name}</span>
              )}
              {/* Type badge */}
              {m.type && (
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${typeColor(m.type)}`}>
                  {m.type}
                </span>
              )}
              {/* Relationship badges */}
              {deps.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                  {deps.length} input{deps.length > 1 ? 's' : ''}
                </span>
              )}
              {affects.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">
                  affects {affects.length}
                </span>
              )}
              {rules.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
                  {rules.length} rule{rules.length > 1 ? 's' : ''}
                </span>
              )}
              {m.has_pricing_impact && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                  pricing
                </span>
              )}
              {m.nullable === false && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                  required
                </span>
              )}
            </div>
            {/* One-line description */}
            <p className="text-xs text-gray-400 mt-0.5 truncate">{f.content_text}</p>
          </div>

          {/* Right side: section + expand indicator */}
          <div className="flex items-center gap-3 shrink-0">
            {m.ui_subsection && (
              <span className="text-xs text-gray-400 hidden lg:block max-w-32 truncate">{m.ui_subsection}</span>
            )}
            {hasDetail && (
              <div className={`flex items-center gap-1 text-xs font-medium transition-colors ${open ? 'text-blue-600' : 'text-gray-400'}`}>
                <span className="hidden sm:block">{open ? 'collapse' : 'details'}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-5 bg-gray-50 rounded-b-lg">
          {/* Full definition */}
          <p className="text-sm text-gray-700 leading-relaxed">{f.content_text}</p>

          {/* Meta grid */}
          <div className="flex flex-wrap gap-2">
            {m.type && (
              <div className="bg-white border border-gray-200 rounded px-2.5 py-1.5">
                <p className="text-xs text-gray-400">Type</p>
                <p className={`text-sm font-mono font-medium ${typeColor(m.type).split(' ')[0]}`}>{m.type}</p>
              </div>
            )}
            {m.nullable !== undefined && (
              <div className="bg-white border border-gray-200 rounded px-2.5 py-1.5">
                <p className="text-xs text-gray-400">Nullable</p>
                <p className={`text-sm font-medium ${m.nullable ? 'text-gray-600' : 'text-red-600'}`}>
                  {m.nullable ? 'yes' : 'required'}
                </p>
              </div>
            )}
            {m.range && (
              <div className="bg-white border border-gray-200 rounded px-2.5 py-1.5">
                <p className="text-xs text-gray-400">Range</p>
                <p className="text-sm font-mono text-gray-700">{m.range}</p>
              </div>
            )}
            {m.db_column && (
              <div className="bg-white border border-gray-200 rounded px-2.5 py-1.5">
                <p className="text-xs text-gray-400">DB Column</p>
                <p className="text-sm font-mono text-gray-700">{m.db_column}</p>
              </div>
            )}
          </div>

          {/* Traceability / dependency chain */}
          {(deps.length > 0 || affects.length > 0) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Traceability</h4>
              <div className="flex items-start gap-3 overflow-x-auto pb-1">
                {deps.length > 0 && (
                  <div className="min-w-fit">
                    <p className="text-xs font-semibold text-blue-600 mb-1.5">INPUTS</p>
                    <div className="space-y-1">
                      {deps.map(d => {
                        const linked = findField(d);
                        return (
                          <div key={d}
                            className="px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 font-mono cursor-default"
                            title={linked ? linked.content_text.slice(0, 150) : d}
                          >
                            {d}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {deps.length > 0 && (
                  <div className="self-center text-gray-400 text-base shrink-0 pt-5">→</div>
                )}
                <div className="px-3 py-2 bg-indigo-600 rounded-lg min-w-fit self-center text-white">
                  <p className="text-xs font-bold">{m.name ?? shortName}</p>
                  {m.type && <p className="text-xs opacity-70 font-mono">{m.type}</p>}
                </div>
                {affects.length > 0 && (
                  <div className="self-center text-gray-400 text-base shrink-0 pt-5">→</div>
                )}
                {affects.length > 0 && (
                  <div className="min-w-fit">
                    <p className="text-xs font-semibold text-orange-600 mb-1.5">DOWNSTREAM</p>
                    <div className="space-y-1">
                      {affects.map(a => {
                        const linked = findField(a);
                        return (
                          <div key={a}
                            className="px-2 py-1 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800 font-mono cursor-default"
                            title={linked ? linked.content_text.slice(0, 150) : a}
                          >
                            {a}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pricing impact */}
          {m.has_pricing_impact && m.pricing_impact && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1.5">Pricing Impact</h4>
              <p className="text-sm text-amber-800">
                {m.pricing_impact.typical_adjustment ?? m.pricing_impact.category ?? 'Affects LLPA'}
              </p>
              {m.pricing_impact.update_frequency && (
                <p className="text-xs text-amber-600 mt-1">Updates: {m.pricing_impact.update_frequency}</p>
              )}
              {m.pricing_impact.lookup_source && (
                <p className="text-xs text-amber-600">Source: {m.pricing_impact.lookup_source}</p>
              )}
            </div>
          )}

          {/* Enum values */}
          {enums.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Allowed Values</h4>
              <div className="flex flex-wrap gap-1.5">
                {enums.map(ev => (
                  <div key={ev.value}
                    className="flex items-center gap-1.5 bg-white border border-gray-200 rounded px-2 py-1"
                    title={ev.impact ?? ev.definition}
                  >
                    <code className="text-xs font-mono text-gray-800">{ev.value}</code>
                    {(ev.impact ?? ev.definition) && (
                      <span className="text-xs text-gray-400">{(ev.impact ?? ev.definition)?.slice(0, 50)}</span>
                    )}
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
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-indigo-400 mt-0.5 shrink-0">›</span>
                    <span className="text-gray-700 leading-snug">{rule}</span>
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
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                    <span className="text-gray-600">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source */}
          {m.source_provenance && (
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-400">
                <span className="font-medium text-gray-500">Source:</span> {m.source_provenance}
              </p>
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
    const m = new Map<string, number>();
    for (const f of fields) {
      const meta = f.metadata as FieldMetadata;
      const sec = meta.ui_section ?? 'Other';
      m.set(sec, (m.get(sec) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [fields]);

  const tables = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of fields) {
      const meta = f.metadata as FieldMetadata;
      if (meta.table) m.set(meta.table, (m.get(meta.table) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [fields]);

  const filtered = useMemo(() => {
    return fields.filter(f => {
      const m = f.metadata as FieldMetadata;
      const q = search.toLowerCase();
      if (q && !f.content_id.toLowerCase().includes(q) && !f.content_text.toLowerCase().includes(q) && !(m.name ?? '').toLowerCase().includes(q)) return false;
      if (activeSection && (m.ui_section ?? 'Other') !== activeSection) return false;
      if (activeTable && m.table !== activeTable) return false;
      if (pricingOnly && !m.has_pricing_impact) return false;
      if (withDepsOnly && (m.depends_on ?? []).length === 0 && (m.affects ?? []).length === 0) return false;
      return true;
    });
  }, [fields, search, activeSection, activeTable, pricingOnly, withDepsOnly]);

  const stats = useMemo(() => {
    let withDeps = 0, withPricing = 0, withRules = 0;
    for (const f of fields) {
      const m = f.metadata as FieldMetadata;
      if ((m.depends_on ?? []).length > 0 || (m.affects ?? []).length > 0) withDeps++;
      if (m.has_pricing_impact) withPricing++;
      if ((m.business_rules ?? []).length > 0) withRules++;
    }
    return { withDeps, withPricing, withRules };
  }, [fields]);

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
      Loading {fields.length} fields...
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
  );

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0">
        <div className="sticky top-8 space-y-5">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search fields..."
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />

          {/* Quick stats */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overview</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total fields</span>
                <span className="font-medium text-gray-900">{fields.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">With relationships</span>
                <span className="font-medium text-blue-700">{stats.withDeps}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pricing impact</span>
                <span className="font-medium text-amber-700">{stats.withPricing}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">With rules</span>
                <span className="font-medium text-indigo-700">{stats.withRules}</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Filters</p>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={pricingOnly} onChange={e => setPricingOnly(e.target.checked)}
                className="rounded border-gray-300 text-blue-600" />
              Pricing impact only
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={withDepsOnly} onChange={e => setWithDepsOnly(e.target.checked)}
                className="rounded border-gray-300 text-blue-600" />
              Has relationships
            </label>
          </div>

          {/* By table */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">By Table</p>
            <div className="space-y-0.5">
              <button
                onClick={() => { setActiveTable(null); setActiveSection(null); }}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex justify-between items-center ${!activeTable && !activeSection ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <span>All tables</span>
                <span className={`text-xs ${!activeTable && !activeSection ? 'text-blue-200' : 'text-gray-400'}`}>{fields.length}</span>
              </button>
              {tables.map(([t, count]) => (
                <button
                  key={t}
                  onClick={() => { setActiveTable(t); setActiveSection(null); }}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex justify-between items-center font-mono ${activeTable === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <span className="truncate text-xs">{t.replace('application_', '')}</span>
                  <span className={`text-xs shrink-0 ml-1 ${activeTable === t ? 'text-blue-200' : 'text-gray-400'}`}>{count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* By UI section */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">By UI Section</p>
            <div className="space-y-0.5">
              <button
                onClick={() => { setActiveSection(null); setActiveTable(null); }}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${!activeSection && !activeTable ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                All sections
              </button>
              {sections.map(([sec, count]) => (
                <button
                  key={sec}
                  onClick={() => { setActiveSection(sec); setActiveTable(null); }}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex justify-between items-center ${activeSection === sec ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <span className="truncate text-xs">{sec}</span>
                  <span className={`text-xs shrink-0 ml-1 ${activeSection === sec ? 'text-blue-200' : 'text-gray-400'}`}>{count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {activeSection ?? (activeTable ? activeTable.replace('application_', '') : 'All Fields')}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {filtered.length} field{filtered.length !== 1 ? 's' : ''} — click any row to expand details
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          {filtered.map(f => (
            <FieldCard key={f.id} f={f} allFields={fields} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">No fields match the current filters.</div>
        )}
      </div>
    </div>
  );
}
