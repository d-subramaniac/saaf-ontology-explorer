'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getOntologyByType, type OntologyRecord } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpertNote {
  author: string;
  date: string;
  text: string;
}

interface Concept {
  id: string;
  name: string;
  definition: string;
  category: string;
  children: string[];
  lifecycle?: string[];
  expert_notes: ExpertNote[];
  related_concepts?: string[];
  database_tables?: string[];
  source_provenance?: string;
  enrichment_status?: string;
  field_count?: number;
  rule_count?: number;
}

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

interface Field {
  id: string;
  concept_id: string;
  name: string;
  definition: string;
  type: string;
  nullable?: boolean;
  db_table?: string;
  db_column?: string;
  depends_on?: string[];
  affects?: string[];
  business_rules?: string[];
  validation_rules?: string[];
  enum_values?: EnumValue[];
  pricing_impact?: PricingImpact;
  mismo_xpath?: string;
  enrichment_status?: string;
  source_provenance?: string;
  ui_section?: string;
  range?: string;
}

interface Relationship {
  from: string;
  to: string;
  type: 'has_many' | 'has_one' | 'many_to_many' | 'influences';
  label: string;
  description?: string;
}

interface EnrichmentSuggestion {
  suggested_rules?: string[];
  suggested_dependencies?: string[];
  suggested_affects?: string[];
  enriched_definition?: string;
  expert_questions?: string[];
  confidence?: 'high' | 'medium' | 'low';
  reasoning?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { color: string; bg: string }> = {
  Core:          { color: '#3b82f6', bg: '#eff6ff' },
  Pricing:       { color: '#8b5cf6', bg: '#f5f3ff' },
  Underwriting:  { color: '#f59e0b', bg: '#fffbeb' },
  Financial:     { color: '#10b981', bg: '#ecfdf5' },
  Property:      { color: '#ef4444', bg: '#fef2f2' },
  Metric:        { color: '#ec4899', bg: '#fdf2f8' },
  Compliance:    { color: '#6366f1', bg: '#eef2ff' },
  Workflow:      { color: '#64748b', bg: '#f8fafc' },
};

const STATUS_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  expert_reviewed: { label: 'Expert Reviewed', color: '#10b981', bg: '#ecfdf5' },
  ai_drafted:      { label: 'AI Drafted',       color: '#f59e0b', bg: '#fffbeb' },
  needs_review:    { label: 'Needs Review',      color: '#ef4444', bg: '#fef2f2' },
  incomplete:      { label: 'Incomplete',         color: '#6b7280', bg: '#f3f4f6' },
};

const STATIC_RELATIONSHIPS: Relationship[] = [
  { from: 'loan_application', to: 'borrower',        type: 'has_many',      label: '1:many (1-4)',  description: 'Primary + Co-Borrowers + Guarantors' },
  { from: 'loan_application', to: 'entity',           type: 'has_many',      label: '1:many (0-3)',  description: 'Vesting LLC / Trust' },
  { from: 'loan_application', to: 'loan_details',     type: 'has_one',       label: '1:1',           description: 'Exactly one set of loan terms' },
  { from: 'loan_application', to: 'pricing_version',  type: 'has_many',      label: '1:many (3-15)', description: 'Full pricing history for LE comparison' },
  { from: 'loan_application', to: 'asset',            type: 'has_many',      label: '1:many',        description: 'Bank accounts, investments for reserves' },
  { from: 'loan_application', to: 'liability',        type: 'has_many',      label: '1:many',        description: 'Credit obligations' },
  { from: 'loan_application', to: 'real_estate_owned',type: 'has_many',      label: '1:many (0-20)', description: 'Investment portfolio' },
  { from: 'borrower',         to: 'entity',           type: 'many_to_many',  label: 'M:N',           description: 'Borrowers own/manage entities' },
  { from: 'borrower',         to: 'credit_profile',   type: 'has_one',       label: '1:1',           description: 'Bureau scores from tri-merge' },
  { from: 'credit_profile',   to: 'dscr_ratio',       type: 'influences',    label: 'affects pricing', description: 'Credit score band determines LLPA tier' },
  { from: 'dscr_ratio',       to: 'pricing_version',  type: 'influences',    label: 'LLPA input',    description: 'DSCR band is a key LLPA factor' },
  { from: 'real_estate_owned',to: 'dscr_ratio',       type: 'influences',    label: 'rental income', description: 'REO rental income feeds DSCR numerator' },
];

// ─── Components ───────────────────────────────────────────────────────────────

function DependencyGraph({ field }: { field: Field }) {
  const deps = field.depends_on ?? [];
  const affects = field.affects ?? [];
  if (deps.length === 0 && affects.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Dependency Graph</h4>
      <div className="flex items-start gap-2 overflow-x-auto pb-2">
        {deps.length > 0 && (
          <div className="flex flex-col gap-1 min-w-fit">
            <span className="text-xs text-gray-500 font-medium">INPUTS</span>
            {deps.map((d) => (
              <div key={d} className="px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 font-mono">
                {d}
              </div>
            ))}
          </div>
        )}
        {deps.length > 0 && (
          <div className="flex items-center self-center min-w-fit pt-4">
            <svg width="40" height="20">
              <defs>
                <marker id="arrowIn" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
                </marker>
              </defs>
              <line x1="0" y1="10" x2="30" y2="10" stroke="#9ca3af" strokeWidth="2" markerEnd="url(#arrowIn)" />
            </svg>
          </div>
        )}
        <div className="px-3 py-2 bg-indigo-100 border-2 border-indigo-400 rounded-lg min-w-fit self-center">
          <div className="text-xs font-bold text-indigo-900">{field.name}</div>
          <div className="text-xs text-indigo-600 font-mono">{field.type}</div>
        </div>
        {affects.length > 0 && (
          <div className="flex items-center self-center min-w-fit pt-4">
            <svg width="40" height="20">
              <defs>
                <marker id="arrowOut" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
                </marker>
              </defs>
              <line x1="0" y1="10" x2="30" y2="10" stroke="#9ca3af" strokeWidth="2" markerEnd="url(#arrowOut)" />
            </svg>
          </div>
        )}
        {affects.length > 0 && (
          <div className="flex flex-col gap-1 min-w-fit">
            <span className="text-xs text-gray-500 font-medium">AFFECTS</span>
            {affects.map((a) => (
              <div key={a} className="px-2 py-1 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800 font-mono">
                {a}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldDetail({ field, onRequestEnrichment }: { field: Field; onRequestEnrichment: (f: Field) => void }) {
  const status = STATUS_BADGES[field.enrichment_status ?? 'incomplete'] ?? STATUS_BADGES.incomplete;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{field.name}</h3>
          {field.db_table && field.db_column && (
            <span className="text-xs font-mono text-gray-500">{field.db_table}.{field.db_column}</span>
          )}
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-3" style={{ color: status.color, backgroundColor: status.bg }}>
          {status.label}
        </span>
      </div>

      <p className="text-sm text-gray-700 mb-4 leading-relaxed">{field.definition}</p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-2">
          <span className="text-xs text-gray-500 block">Type</span>
          <span className="text-sm font-mono font-medium text-gray-900">{field.type}</span>
        </div>
        {field.range && (
          <div className="bg-gray-50 rounded-lg p-2">
            <span className="text-xs text-gray-500 block">Range</span>
            <span className="text-sm font-mono font-medium text-gray-900">{field.range}</span>
          </div>
        )}
        {field.pricing_impact && (
          <div className="bg-purple-50 rounded-lg p-2">
            <span className="text-xs text-purple-600 block">Pricing Impact</span>
            <span className="text-sm font-medium text-purple-900">
              {field.pricing_impact.typical_adjustment ?? field.pricing_impact.category ?? 'Affects pricing'}
            </span>
          </div>
        )}
      </div>

      {field.enum_values && field.enum_values.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Enum Values</h4>
          <div className="space-y-1">
            {field.enum_values.map((ev) => (
              <div key={ev.value} className="flex items-start gap-2 text-xs">
                <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-800 shrink-0">{ev.value}</code>
                <span className="text-gray-600">{ev.impact ?? ev.definition}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <DependencyGraph field={field} />

      {field.business_rules && field.business_rules.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Business Rules</h4>
          <div className="space-y-1">
            {field.business_rules.map((rule, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="text-indigo-500 mt-0.5 shrink-0">→</span>
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {field.validation_rules && field.validation_rules.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Validation Rules</h4>
          <div className="space-y-1">
            {field.validation_rules.map((rule, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <span className="text-amber-500 mt-0.5 shrink-0">✓</span>
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {field.mismo_xpath && (
        <div className="mt-4 bg-gray-50 rounded-lg p-2">
          <span className="text-xs text-gray-500">MISMO 3.5 XPath: </span>
          <code className="text-xs font-mono text-gray-700">{field.mismo_xpath}</code>
        </div>
      )}

      {field.source_provenance && (
        <div className="mt-3">
          <span className="text-xs text-gray-400">Source: {field.source_provenance}</span>
        </div>
      )}

      {field.enrichment_status !== 'expert_reviewed' && (
        <button
          onClick={() => onRequestEnrichment(field)}
          className="mt-4 w-full py-2 px-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI Enrich — Suggest Rules &amp; Dependencies
        </button>
      )}
    </div>
  );
}

function ConceptCard({
  concept,
  isSelected,
  onClick,
  fieldCount,
}: {
  concept: Concept;
  isSelected: boolean;
  onClick: () => void;
  fieldCount: number;
}) {
  const cat = CATEGORIES[concept.category] ?? CATEGORIES.Core;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
        <span className="font-semibold text-sm text-gray-900 truncate flex-1">{concept.name}</span>
        <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ color: cat.color, backgroundColor: cat.bg }}>
          {concept.category}
        </span>
      </div>
      <p className="text-xs text-gray-500 line-clamp-2 mb-1.5">{concept.definition}</p>
      <div className="flex gap-3 text-xs text-gray-400">
        <span>{fieldCount > 0 ? fieldCount : concept.field_count ?? 0} fields</span>
        {concept.rule_count && <span>{concept.rule_count} rules</span>}
        {concept.expert_notes?.length > 0 && <span className="text-amber-500">{concept.expert_notes.length} notes</span>}
      </div>
    </button>
  );
}

function RelationshipMap({
  relationships,
  selectedConcept,
}: {
  relationships: Relationship[];
  selectedConcept: string | null;
}) {
  const relevant = selectedConcept
    ? relationships.filter((r) => r.from === selectedConcept || r.to === selectedConcept)
    : relationships;

  const typeStyles: Record<string, { color: string; dashed: boolean }> = {
    has_many:     { color: '#3b82f6', dashed: false },
    has_one:      { color: '#10b981', dashed: false },
    many_to_many: { color: '#8b5cf6', dashed: false },
    influences:   { color: '#f59e0b', dashed: true },
  };

  return (
    <div className="space-y-1.5">
      {relevant.map((r, i) => {
        const style = typeStyles[r.type] ?? typeStyles.has_many;
        return (
          <div key={i} className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded-lg">
            <span className="font-medium text-gray-800 min-w-[5rem]">{r.from.replace(/_/g, ' ')}</span>
            <div className="flex items-center gap-1 flex-1">
              <div
                className="h-px flex-1"
                style={{
                  borderTop: `2px ${style.dashed ? 'dashed' : 'solid'} ${style.color}`,
                }}
              />
              <span className="text-gray-500 bg-white px-1.5 py-0.5 rounded border text-xs shrink-0">{r.label}</span>
              <div className="h-px flex-1" style={{ borderTop: `2px solid ${style.color}` }} />
              <span style={{ color: style.color }}>→</span>
            </div>
            <span className="font-medium text-gray-800 min-w-[5rem] text-right">{r.to.replace(/_/g, ' ')}</span>
          </div>
        );
      })}
    </div>
  );
}

function AIEnrichmentModal({
  field,
  onClose,
}: {
  field: Field;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<EnrichmentSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestEnrichment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
      }
      const data = await res.json() as EnrichmentSuggestion;
      setSuggestion(data);
    } catch (e) {
      setError('Could not get AI suggestions. ' + String(e));
    }
    setLoading(false);
  }, [field]);

  useEffect(() => {
    requestEnrichment();
  }, [requestEnrichment]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">AI Enrichment: {field.name}</h3>
            <p className="text-xs text-gray-500">Agent suggests, you validate</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-indigo-600">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm font-medium">Analyzing field semantics and mortgage domain rules...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={requestEnrichment} className="mt-2 text-sm text-red-600 underline">Retry</button>
            </div>
          )}

          {suggestion && (
            <>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  suggestion.confidence === 'high' ? 'bg-green-100 text-green-700' :
                  suggestion.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {suggestion.confidence} confidence
                </span>
              </div>

              {suggestion.enriched_definition && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-blue-800 mb-1">📝 Enriched Definition</h4>
                  <p className="text-sm text-blue-900">{suggestion.enriched_definition}</p>
                </div>
              )}

              {suggestion.suggested_rules && suggestion.suggested_rules.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-indigo-800 mb-2">📋 Suggested Business Rules</h4>
                  {suggestion.suggested_rules.map((rule, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-indigo-900 mb-1">
                      <input type="checkbox" defaultChecked className="mt-1" />
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              )}

              {suggestion.suggested_dependencies && suggestion.suggested_dependencies.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-green-800 mb-2">🔗 Suggested Dependencies</h4>
                  <div className="flex flex-wrap gap-1">
                    {suggestion.suggested_dependencies.map((dep, i) => (
                      <span key={i} className="px-2 py-0.5 bg-green-100 rounded text-xs text-green-800 font-mono">{dep}</span>
                    ))}
                  </div>
                </div>
              )}

              {suggestion.expert_questions && suggestion.expert_questions.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-amber-800 mb-2">❓ Questions for Domain Expert</h4>
                  {suggestion.expert_questions.map((q, i) => (
                    <div key={i} className="text-sm text-amber-900 mb-2">
                      <p className="font-medium">{q}</p>
                      <input type="text" placeholder="Your answer..." className="mt-1 w-full px-2 py-1 text-xs border border-amber-300 rounded bg-white" />
                    </div>
                  ))}
                </div>
              )}

              {suggestion.reasoning && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-gray-700 mb-1">🤖 Agent Reasoning</h4>
                  <p className="text-xs text-gray-600">{suggestion.reasoning}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
                  Apply Selected Suggestions
                </button>
                <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

function recordToField(r: OntologyRecord): Field {
  const m = r.metadata as Record<string, unknown>;
  return {
    id: r.content_id,
    concept_id: (m.concept_id as string) ?? '',
    name: (m.name as string) ?? r.content_id.replace(/_/g, ' '),
    definition: r.content_text,
    type: (m.type as string) ?? 'text',
    nullable: m.nullable as boolean | undefined,
    db_table: m.table as string | undefined,
    db_column: (m.db_column as string) ?? r.content_id.split('.').pop(),
    depends_on: m.depends_on as string[] | undefined,
    affects: m.affects as string[] | undefined,
    business_rules: m.business_rules as string[] | undefined,
    validation_rules: m.validation_rules as string[] | undefined,
    enum_values: m.enum_values as EnumValue[] | undefined,
    pricing_impact: m.pricing_impact as PricingImpact | undefined,
    mismo_xpath: m.mismo_xpath as string | undefined,
    enrichment_status: (m.enrichment_status as string) ?? 'ai_drafted',
    source_provenance: m.source_provenance as string | undefined,
    ui_section: m.ui_section as string | undefined,
    range: m.range as string | undefined,
  };
}

function recordToConcept(r: OntologyRecord): Concept {
  const m = r.metadata as Record<string, unknown>;
  return {
    id: r.content_id,
    name: (m.name as string) ?? r.content_id.replace(/_/g, ' '),
    definition: r.content_text,
    category: (m.category as string) ?? 'Core',
    children: (m.children as string[]) ?? [],
    lifecycle: m.lifecycle as string[] | undefined,
    expert_notes: [],
    related_concepts: m.related_concepts as string[] | undefined,
    database_tables: m.database_tables as string[] | undefined,
    enrichment_status: m.enrichment_status as string | undefined,
    source_provenance: m.source_provenance as string | undefined,
  };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [enrichmentField, setEnrichmentField] = useState<Field | null>(null);
  const [view, setView] = useState<'concepts' | 'fields' | 'relationships'>('concepts');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [conceptRecs, fieldRecs] = await Promise.all([
          getOntologyByType('concept', 100),
          getOntologyByType('field', 700),
        ]);
        const loadedConcepts = conceptRecs.map(recordToConcept);
        setConcepts(loadedConcepts);
        setFields(fieldRecs.map(recordToField));
        if (loadedConcepts.length > 0) setSelectedConcept(loadedConcepts[0].id);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const concept = concepts.find((c) => c.id === selectedConcept);
  const conceptFields = useMemo(
    () => fields.filter((f) => f.concept_id === selectedConcept),
    [fields, selectedConcept]
  );

  const fieldsByConceptId = useMemo(() => {
    const map: Record<string, number> = {};
    fields.forEach((f) => { map[f.concept_id] = (map[f.concept_id] ?? 0) + 1; });
    return map;
  }, [fields]);

  const filteredConcepts = useMemo(() => {
    if (!searchQuery) return concepts;
    const q = searchQuery.toLowerCase();
    return concepts.filter((c) => c.name.toLowerCase().includes(q) || c.definition.toLowerCase().includes(q));
  }, [concepts, searchQuery]);

  const filteredFields = useMemo(() => {
    if (!searchQuery) return fields;
    const q = searchQuery.toLowerCase();
    return fields.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.definition.toLowerCase().includes(q) ||
        (f.db_column ?? '').toLowerCase().includes(q)
    );
  }, [fields, searchQuery]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-56px)] flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-indigo-600">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="font-medium">Loading ontology...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-56px)] flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
          <h3 className="font-bold text-red-800 mb-2">Failed to load ontology</h3>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    // Full-height panel layout — override the parent's max-w and padding from layout.tsx
    <div
      className="flex flex-col bg-gray-50"
      style={{ height: 'calc(100vh - 56px)', marginTop: '-2rem', marginLeft: '-1rem', marginRight: '-1rem', marginBottom: '-2rem' }}
    >
      {/* Sub-header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">S</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Ontology Explorer</h1>
              <p className="text-xs text-gray-500">
                {concepts.length} concepts · {fields.length} fields · Domain knowledge graph for NonQM mortgage lending
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {(['concepts', 'fields', 'relationships'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    view === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts, fields..."
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg w-48 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>
      </div>

      {/* Body: Sidebar + Right Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto p-3 space-y-2 shrink-0">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-1">
            {view === 'concepts' ? 'Domain Concepts' : view === 'fields' ? 'All Fields' : 'Relationships'}
          </div>

          {view === 'concepts' &&
            filteredConcepts.map((c) => (
              <ConceptCard
                key={c.id}
                concept={c}
                isSelected={selectedConcept === c.id}
                onClick={() => { setSelectedConcept(c.id); setSelectedField(null); }}
                fieldCount={fieldsByConceptId[c.id] ?? 0}
              />
            ))}

          {view === 'fields' &&
            filteredFields.slice(0, 200).map((f) => (
              <button
                key={f.id}
                onClick={() => { setSelectedField(f); setSelectedConcept(f.concept_id); }}
                className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                  selectedField?.id === f.id
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-900 truncate flex-1">{f.name}</span>
                  <span
                    className="w-2 h-2 rounded-full shrink-0 ml-2"
                    style={{ backgroundColor: STATUS_BADGES[f.enrichment_status ?? 'incomplete']?.color }}
                  />
                </div>
                {f.db_column && <span className="text-xs text-gray-500 font-mono">{f.db_column}</span>}
              </button>
            ))}

          {view === 'relationships' && (
            <div className="space-y-2">
              <div className="space-y-1.5 px-1">
                {Object.entries(CATEGORIES).map(([cat, style]) => (
                  <div key={cat} className="flex items-center gap-2 py-0.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: style.color }} />
                    <span className="text-xs text-gray-600">{cat}</span>
                  </div>
                ))}
              </div>
              <hr className="border-gray-200" />
              <p className="text-xs text-gray-500 px-1">
                Select a concept to filter its relationships, or view all.
              </p>
              <button
                onClick={() => setSelectedConcept(null)}
                className={`w-full text-left p-2 rounded-lg border text-xs transition-colors ${
                  !selectedConcept ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Show all relationships
              </button>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="flex-1 overflow-y-auto p-5">
          {view === 'relationships' ? (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                {selectedConcept && concept ? `Relationships: ${concept.name}` : 'All Relationships'}
              </h2>
              <RelationshipMap relationships={STATIC_RELATIONSHIPS} selectedConcept={selectedConcept} />
            </div>
          ) : selectedField ? (
            <FieldDetail field={selectedField} onRequestEnrichment={setEnrichmentField} />
          ) : concept ? (
            <div className="space-y-4">
              {/* Concept Header Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-xl font-bold text-gray-900">{concept.name}</h2>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-3"
                    style={{
                      color: CATEGORIES[concept.category]?.color,
                      backgroundColor: CATEGORIES[concept.category]?.bg,
                    }}
                  >
                    {concept.category}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-4">{concept.definition}</p>

                {concept.lifecycle && concept.lifecycle.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Lifecycle</h4>
                    <div className="flex flex-wrap gap-1 items-center">
                      {concept.lifecycle.map((s, i) => (
                        <span key={s} className="flex items-center">
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium text-gray-700">{s}</span>
                          {i < concept.lifecycle!.length - 1 && (
                            <span className="text-gray-300 mx-0.5 text-xs">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {concept.children && concept.children.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contains</h4>
                    <div className="flex flex-wrap gap-1">
                      {concept.children.map((childId) => {
                        const child = concepts.find((c) => c.id === childId);
                        return (
                          <button
                            key={childId}
                            onClick={() => { setSelectedConcept(childId); setSelectedField(null); }}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors"
                          >
                            {child?.name ?? childId.replace(/_/g, ' ')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {concept.database_tables && concept.database_tables.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Database Tables</h4>
                    <div className="flex flex-wrap gap-1">
                      {concept.database_tables.map((t) => (
                        <code key={t} className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-700">{t}</code>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expert Notes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expert Notes</h4>
                  </div>
                  {concept.expert_notes.length === 0 && (
                    <p className="text-xs text-gray-400 italic">
                      No expert notes yet. Add domain knowledge to help AI agents understand this concept.
                    </p>
                  )}
                  {concept.expert_notes.map((note, i) => (
                    <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-1 text-xs">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="font-semibold text-amber-900">{note.author}</span>
                        <span className="text-amber-600">· {note.date}</span>
                      </div>
                      <p className="text-amber-800">{note.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fields for this concept */}
              {conceptFields.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Fields ({conceptFields.length})</h3>
                  <div className="grid gap-2">
                    {conceptFields.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedField(f)}
                        className="bg-white border border-gray-200 rounded-lg p-3 text-left hover:border-indigo-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm text-gray-900">{f.name}</span>
                          <div className="flex items-center gap-2">
                            {f.pricing_impact && <span className="text-xs text-purple-600">💰</span>}
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: STATUS_BADGES[f.enrichment_status ?? 'incomplete']?.color }}
                              title={STATUS_BADGES[f.enrichment_status ?? 'incomplete']?.label}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{f.definition}</p>
                        <div className="flex gap-3 mt-1 text-xs text-gray-400">
                          <span className="font-mono">{f.type}</span>
                          {f.business_rules && f.business_rules.length > 0 && (
                            <span>{f.business_rules.length} rules</span>
                          )}
                          {f.depends_on && f.depends_on.length > 0 && (
                            <span>{f.depends_on.length} deps</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-sm">Select a concept from the left sidebar to explore</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Enrichment Modal */}
      {enrichmentField && (
        <AIEnrichmentModal
          field={enrichmentField}
          onClose={() => setEnrichmentField(null)}
        />
      )}
    </div>
  );
}
