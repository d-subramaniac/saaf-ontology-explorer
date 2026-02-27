'use client';

import { useEffect, useState, useMemo } from 'react';
import { getOntologyByType, type OntologyRecord } from '@/lib/supabase';

interface FieldMetadata {
  name?: string;
  table?: string;
  type?: string;
  concept_id?: string;
  has_pricing_impact?: boolean;
  ui_section?: string;
  ui_subsection?: string;
}

export default function FieldsPage() {
  const [fields, setFields] = useState<OntologyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [pricingOnly, setPricingOnly] = useState(false);

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
      return true;
    });
  }, [fields, search, activeSection, activeTable, pricingOnly]);

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
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter fields..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />

          {/* Pricing toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input type="checkbox" checked={pricingOnly} onChange={e => setPricingOnly(e.target.checked)} className="rounded" />
            Pricing impact only
          </label>

          {/* By table */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">By Table</p>
            <button
              onClick={() => setActiveTable(null)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${!activeTable ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
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
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${!activeSection ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
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
          <span className="text-sm text-gray-500">{filtered.length} fields</span>
        </div>

        <div className="space-y-2">
          {filtered.map(f => {
            const m = f.metadata as FieldMetadata;
            return (
              <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-white">{f.content_id}</span>
                      {m.name && m.name !== f.content_id && (
                        <span className="text-sm text-gray-400 truncate">{m.name}</span>
                      )}
                      {m.has_pricing_impact && (
                        <span className="text-xs bg-amber-900/60 text-amber-300 px-1.5 py-0.5 rounded">pricing</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{f.content_text}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {m.type && <span className="text-xs font-mono text-gray-600">{m.type}</span>}
                    {m.ui_subsection && (
                      <p className="text-xs text-gray-600 mt-0.5">{m.ui_subsection}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-600 text-sm">No fields match the current filters.</div>
        )}
      </div>
    </div>
  );
}
