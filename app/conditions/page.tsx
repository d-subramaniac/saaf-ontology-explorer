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

const TRIGGER_COLORS: Record<string, { badge: string; border: string }> = {
  data_missing:        { badge: 'bg-red-900/60 text-red-300',     border: 'border-red-800/40' },
  milestone_reached:   { badge: 'bg-blue-900/60 text-blue-300',   border: 'border-blue-800/40' },
  ltv_threshold:       { badge: 'bg-amber-900/60 text-amber-300', border: 'border-amber-800/40' },
  loan_purpose_check:  { badge: 'bg-purple-900/60 text-purple-300', border: 'border-purple-800/40' },
  entity_vesting:      { badge: 'bg-teal-900/60 text-teal-300',   border: 'border-teal-800/40' },
  manual_trigger:      { badge: 'bg-gray-700 text-gray-300',      border: 'border-gray-700' },
  property_type_check: { badge: 'bg-orange-900/60 text-orange-300', border: 'border-orange-800/40' },
  document_received:   { badge: 'bg-emerald-900/60 text-emerald-300', border: 'border-emerald-800/40' },
};

const PRIORITY_LABELS: Record<number, string> = { 1: 'Critical', 2: 'High', 3: 'Normal', 4: 'Low', 5: 'Minimal' };

function ConditionDetail({ c }: { c: OntologyRecord }) {
  const m = c.metadata as ConditionMetadata;
  const tc = TRIGGER_COLORS[m.trigger_type ?? ''] ?? TRIGGER_COLORS.manual_trigger;
  const tasks = m.auto_generated_tasks ?? [];
  const trigger = m.trigger ?? {};

  return (
    <div className="border border-gray-700 rounded-xl bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-gray-500">{c.content_id}</span>
              {m.waivable && (
                <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">waivable</span>
              )}
            </div>
            <h3 className="text-base font-semibold text-white">{m.name ?? c.content_id}</h3>
          </div>
          {m.trigger_type && (
            <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${tc.badge}`}>
              {m.trigger_type.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">{c.content_text}</p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Trigger details */}
        {(trigger.field || trigger.event || trigger.threshold !== undefined) && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Trigger</h4>
            <div className={`rounded-lg border px-3 py-2.5 space-y-1 ${tc.border} bg-gray-800/50`}>
              {trigger.field && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 w-14 shrink-0">Field</span>
                  <code className="text-blue-300 font-mono">{trigger.field}</code>
                </div>
              )}
              {trigger.event && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 w-14 shrink-0">Event</span>
                  <span className="text-gray-300">{trigger.event}</span>
                </div>
              )}
              {trigger.threshold !== undefined && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500 w-14 shrink-0">Threshold</span>
                  <span className="text-gray-300">{trigger.operator} {trigger.threshold}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loan programs */}
        {(m.loan_programs ?? []).length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Loan Programs</h4>
            <div className="flex flex-wrap gap-1.5">
              {m.loan_programs!.map(p => (
                <span key={p} className="text-xs bg-gray-800 text-gray-300 border border-gray-700 px-2 py-0.5 rounded-full">{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* Auto-generated tasks */}
        {tasks.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Tasks Generated ({tasks.length})
            </h4>
            <div className="space-y-2">
              {tasks.map((task, i) => (
                <div key={i} className="bg-gray-800 rounded-lg px-3 py-2.5 border border-gray-700">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-200">{task.title ?? task.task_type}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.priority && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${task.priority <= 2 ? 'bg-red-900/60 text-red-300' : 'bg-gray-700 text-gray-400'}`}>
                          {PRIORITY_LABELS[task.priority] ?? `P${task.priority}`}
                        </span>
                      )}
                      {task.sla_hours && (
                        <span className="text-xs text-gray-500">{task.sla_hours}h SLA</span>
                      )}
                    </div>
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-400 mb-1.5">{task.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {task.task_type && (
                      <span className="bg-indigo-900/40 text-indigo-400 px-1.5 py-0.5 rounded font-mono">{task.task_type}</span>
                    )}
                    {task.assignee_role && (
                      <span className="text-gray-500">→ <span className="text-gray-400">{task.assignee_role}</span></span>
                    )}
                  </div>
                  {task.required_fields && task.required_fields.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <span className="text-xs text-gray-600 mr-1">Requires fields:</span>
                      {task.required_fields.map(f => (
                        <code key={f} className="text-xs text-blue-400 font-mono mr-1.5">{f}</code>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rule reference & source */}
        {(m.rule_reference || m.source_provenance) && (
          <div className="pt-2 border-t border-gray-800 space-y-1">
            {m.rule_reference && (
              <div className="text-xs text-gray-600">
                Rule: <code className="text-gray-500 font-mono">{m.rule_reference}</code>
              </div>
            )}
            {m.source_provenance && (
              <div className="text-xs text-gray-600">Source: {m.source_provenance}</div>
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

  // Stats
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
    <div className="flex items-center justify-center py-24 text-gray-500">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
      Loading conditions...
    </div>
  );

  if (error) return (
    <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300 text-sm">{error}</div>
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-140px)]">
      {/* Left: sidebar + list */}
      <div className="flex flex-col w-80 flex-shrink-0">
        {/* Sidebar filters */}
        <div className="space-y-3 mb-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter conditions..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-gray-900 border border-gray-800 rounded-lg py-1.5 px-1">
              <div className="text-xs font-bold text-white">{conditions.length}</div>
              <div className="text-xs text-gray-500">total</div>
            </div>
            <div className="bg-indigo-900/30 rounded-lg py-1.5 px-1">
              <div className="text-xs font-bold text-indigo-300">{stats.withTasks}</div>
              <div className="text-xs text-indigo-500">with tasks</div>
            </div>
            <div className="bg-teal-900/30 rounded-lg py-1.5 px-1">
              <div className="text-xs font-bold text-teal-300">{stats.waivable}</div>
              <div className="text-xs text-teal-500">waivable</div>
            </div>
          </div>

          {/* Trigger type filter */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Trigger Type</p>
            <button
              onClick={() => setActiveTrigger(null)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${!activeTrigger ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              All triggers
            </button>
            {triggerTypes.map(([t, count]) => {
              const tc = TRIGGER_COLORS[t] ?? TRIGGER_COLORS.manual_trigger;
              return (
                <button
                  key={t}
                  onClick={() => setActiveTrigger(t)}
                  className={`w-full text-left px-2 py-1 rounded text-xs transition-colors flex items-center justify-between ${activeTrigger === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  <span>{t.replace(/_/g, ' ')}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTrigger === t ? 'bg-blue-500 text-white' : tc.badge}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {loanPrograms.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Loan Program</p>
              <button
                onClick={() => setActiveProgram(null)}
                className={`w-full text-left px-2 py-1 rounded text-xs ${!activeProgram ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                All programs
              </button>
              {loanPrograms.map(p => (
                <button
                  key={p}
                  onClick={() => setActiveProgram(p)}
                  className={`w-full text-left px-2 py-1 rounded text-xs ${activeProgram === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Condition list */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {filtered.map(c => {
            const m = c.metadata as ConditionMetadata;
            const tc = TRIGGER_COLORS[m.trigger_type ?? ''] ?? TRIGGER_COLORS.manual_trigger;
            const tasks = m.auto_generated_tasks ?? [];
            const isSelected = selected?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${isSelected ? 'border-blue-600 bg-blue-900/20' : 'border-gray-800 bg-gray-900 hover:border-gray-700'}`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className="font-mono text-xs text-gray-600">{c.content_id}</span>
                      {m.trigger_type && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${tc.badge}`}>
                          {m.trigger_type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-200 truncate">{m.name ?? c.content_id}</p>
                    <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{c.content_text}</p>
                    {tasks.length > 0 && (
                      <div className="mt-1 text-xs text-indigo-500">{tasks.length} task{tasks.length > 1 ? 's' : ''}</div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-600 text-sm">No conditions match.</div>
          )}
        </div>
      </div>

      {/* Right: condition detail */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <ConditionDetail c={selected} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Select a condition to view details
          </div>
        )}
      </div>
    </div>
  );
}
