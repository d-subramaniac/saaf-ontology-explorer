'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { getOntologyByType, type OntologyRecord } from '@/lib/supabase';

interface AutoTask {
  task_type?: string;
  title?: string;
  description?: string;
  assignee_role?: string;
  required_fields?: string[];
  sla_hours?: number;
  priority?: number;
}

interface ConditionTrigger {
  type?: string;
  field?: string;
  event?: string;
  threshold?: string | number;
  operator?: string;
}

interface ConditionMetadata {
  name?: string;
  loan_programs?: string[];
  trigger_type?: string;
  trigger?: ConditionTrigger;
  auto_generated_tasks?: AutoTask[];
  waivable?: boolean;
  condition_type?: string;
  rule_reference?: string;
  source_provenance?: string;
  file?: string;
}

const TRIGGER_STYLES: Record<string, { badge: string; dot: string }> = {
  data_missing:        { badge: 'bg-red-100 text-red-700 border border-red-200',       dot: 'bg-red-400' },
  milestone_reached:   { badge: 'bg-blue-100 text-blue-700 border border-blue-200',    dot: 'bg-blue-400' },
  ltv_threshold:       { badge: 'bg-amber-100 text-amber-700 border border-amber-200', dot: 'bg-amber-400' },
  loan_purpose_check:  { badge: 'bg-purple-100 text-purple-700 border border-purple-200', dot: 'bg-purple-400' },
  entity_vesting:      { badge: 'bg-teal-100 text-teal-700 border border-teal-200',    dot: 'bg-teal-400' },
  manual_trigger:      { badge: 'bg-gray-100 text-gray-600 border border-gray-200',    dot: 'bg-gray-400' },
  property_type_check: { badge: 'bg-orange-100 text-orange-700 border border-orange-200', dot: 'bg-orange-400' },
  document_received:   { badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-400' },
};

const PRIORITY_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: 'Critical', color: 'bg-red-100 text-red-700 border border-red-200' },
  2: { label: 'High',     color: 'bg-orange-100 text-orange-700 border border-orange-200' },
  3: { label: 'Normal',   color: 'bg-gray-100 text-gray-600 border border-gray-200' },
  4: { label: 'Low',      color: 'bg-gray-100 text-gray-500 border border-gray-200' },
  5: { label: 'Minimal',  color: 'bg-gray-50 text-gray-400 border border-gray-200' },
};

function ConditionDetail({ c }: { c: OntologyRecord }) {
  const m = c.metadata as ConditionMetadata;
  const ts = TRIGGER_STYLES[m.trigger_type ?? ''] ?? TRIGGER_STYLES.manual_trigger;
  const tasks = m.auto_generated_tasks ?? [];
  const trigger = m.trigger ?? {};

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs text-gray-400">{c.content_id}</span>
              {m.waivable && (
                <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded">waivable</span>
              )}
              {m.condition_type && (
                <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded">{m.condition_type}</span>
              )}
            </div>
            <h3 className="text-base font-semibold text-gray-900">{m.name ?? c.content_id}</h3>
          </div>
          {m.trigger_type && (
            <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 font-medium ${ts.badge}`}>
              {m.trigger_type.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{c.content_text}</p>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Trigger details */}
        {(trigger.field || trigger.event || trigger.threshold !== undefined) && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Trigger</h4>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 space-y-2">
              {trigger.field && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400 w-16 shrink-0 text-xs">Field</span>
                  <code className="text-blue-700 font-mono bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-xs">{trigger.field}</code>
                </div>
              )}
              {trigger.event && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400 w-16 shrink-0 text-xs">Event</span>
                  <span className="text-gray-700">{trigger.event}</span>
                </div>
              )}
              {trigger.threshold !== undefined && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400 w-16 shrink-0 text-xs">Threshold</span>
                  <span className="text-gray-700 font-mono">{trigger.operator} {trigger.threshold}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loan programs */}
        {(m.loan_programs ?? []).length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Loan Programs</h4>
            <div className="flex flex-wrap gap-1.5">
              {m.loan_programs!.map(p => (
                <span key={p} className="text-xs bg-white text-gray-700 border border-gray-300 px-2.5 py-1 rounded-full font-medium">{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* Tasks */}
        {tasks.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Tasks Generated <span className="text-gray-400 font-normal">({tasks.length})</span>
            </h4>
            <div className="space-y-2">
              {tasks.map((task, i) => {
                const pconf = PRIORITY_CONFIG[task.priority ?? 3] ?? PRIORITY_CONFIG[3];
                return (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg px-3.5 py-3 shadow-xs">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-sm font-medium text-gray-900">{task.title ?? task.task_type}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${pconf.color}`}>
                          {pconf.label}
                        </span>
                        {task.sla_hours && (
                          <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">{task.sla_hours}h SLA</span>
                        )}
                      </div>
                    </div>
                    {task.description && (
                      <p className="text-xs text-gray-500 mb-2 leading-snug">{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {task.task_type && (
                        <span className="text-xs font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">{task.task_type}</span>
                      )}
                      {task.assignee_role && (
                        <span className="text-xs text-gray-500">→ <span className="text-gray-700 font-medium">{task.assignee_role}</span></span>
                      )}
                    </div>
                    {task.required_fields && task.required_fields.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-400 mr-1">Requires:</span>
                        {task.required_fields.map(f => (
                          <code key={f} className="text-xs text-blue-700 font-mono mr-2 bg-blue-50 px-1 rounded">{f}</code>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rule ref + source */}
        {(m.rule_reference || m.source_provenance) && (
          <div className="pt-3 border-t border-gray-100 space-y-1">
            {m.rule_reference && (
              <p className="text-xs text-gray-400">
                Rule: <code className="text-gray-600 font-mono">{m.rule_reference}</code>
              </p>
            )}
            {m.source_provenance && (
              <p className="text-xs text-gray-400">Source: {m.source_provenance}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConditionsPage() {
  const [conditions, setConditions] = useState<OntologyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTrigger, setActiveTrigger] = useState<string | null>(null);
  const [activeProgram, setActiveProgram] = useState<string | null>(null);
  const [selected, setSelected] = useState<OntologyRecord | null>(null);

  useEffect(() => {
    getOntologyByType('condition', 200)
      .then(data => {
        setConditions(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const triggerTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of conditions) {
      const m = c.metadata as ConditionMetadata;
      if (m.trigger_type) counts.set(m.trigger_type, (counts.get(m.trigger_type) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
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

  const stats = useMemo(() => {
    let withTasks = 0, waivable = 0;
    for (const c of conditions) {
      const m = c.metadata as ConditionMetadata;
      if ((m.auto_generated_tasks ?? []).length > 0) withTasks++;
      if (m.waivable) waivable++;
    }
    return { withTasks, waivable };
  }, [conditions]);

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
      Loading conditions...
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {/* Left: filters + list */}
      <div className="flex flex-col w-80 flex-shrink-0">
        <div className="space-y-3 mb-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conditions..."
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-gray-200 rounded-lg py-2 px-2 text-center">
              <p className="text-sm font-semibold text-gray-900">{conditions.length}</p>
              <p className="text-xs text-gray-400">total</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg py-2 px-2 text-center">
              <p className="text-sm font-semibold text-indigo-700">{stats.withTasks}</p>
              <p className="text-xs text-gray-400">with tasks</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg py-2 px-2 text-center">
              <p className="text-sm font-semibold text-teal-700">{stats.waivable}</p>
              <p className="text-xs text-gray-400">waivable</p>
            </div>
          </div>

          {/* Trigger type filter */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Trigger Type</p>
            <div className="space-y-0.5">
              <button
                onClick={() => setActiveTrigger(null)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${!activeTrigger ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                All triggers
              </button>
              {triggerTypes.map(([t, count]) => {
                const ts = TRIGGER_STYLES[t] ?? TRIGGER_STYLES.manual_trigger;
                const isActive = activeTrigger === t;
                return (
                  <button
                    key={t}
                    onClick={() => setActiveTrigger(t)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center justify-between ${isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {!isActive && <span className={`w-2 h-2 rounded-full shrink-0 ${ts.dot}`} />}
                      <span className="text-xs">{t.replace(/_/g, ' ')}</span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {loanPrograms.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Loan Program</p>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveProgram(null)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm ${!activeProgram ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  All programs
                </button>
                {loanPrograms.map(p => (
                  <button
                    key={p}
                    onClick={() => setActiveProgram(p)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm ${activeProgram === p ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Condition list */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {filtered.map(c => {
            const m = c.metadata as ConditionMetadata;
            const ts = TRIGGER_STYLES[m.trigger_type ?? ''] ?? TRIGGER_STYLES.manual_trigger;
            const tasks = m.auto_generated_tasks ?? [];
            const isSelected = selected?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${isSelected ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${ts.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                      {m.name ?? c.content_id}
                    </p>
                    <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{c.content_text}</p>
                    {tasks.length > 0 && (
                      <p className="text-xs text-indigo-600 mt-1 font-medium">{tasks.length} task{tasks.length > 1 ? 's' : ''}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">No conditions match.</div>
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <ConditionDetail c={selected} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a condition to view details
          </div>
        )}
      </div>
    </div>
  );
}
