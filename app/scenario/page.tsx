'use client';

import { useState } from 'react';
import { useCompletion } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';

interface ScenarioParams {
  dscr: string;
  ltv: string;
  creditScore: string;
  propertyType: string;
  loanPurpose: string;
  citizenship: string;
  loanAmount: string;
  units: string;
  isInterestOnly: boolean;
  isShortTermRental: boolean;
}

const DEFAULTS: ScenarioParams = {
  dscr: '',
  ltv: '',
  creditScore: '',
  propertyType: 'SFR',
  loanPurpose: 'Purchase',
  citizenship: 'US Citizen / Permanent Resident',
  loanAmount: '',
  units: '1',
  isInterestOnly: false,
  isShortTermRental: false,
};

interface DemoScenario {
  label: string;
  description: string;
  color: string;
  params: ScenarioParams;
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    label: 'Standard SFR',
    description: 'Strong DSCR, clean profile',
    color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-800',
    params: { dscr: '1.30', ltv: '70', creditScore: '740', propertyType: 'SFR', loanPurpose: 'Purchase', citizenship: 'US Citizen / Permanent Resident', loanAmount: '500000', units: '1', isInterestOnly: false, isShortTermRental: false },
  },
  {
    label: 'Foreign National',
    description: 'DSCR < 1.0 — ineligibility triggers',
    color: 'bg-red-50 border-red-200 hover:border-red-400 text-red-800',
    params: { dscr: '0.92', ltv: '65', creditScore: '720', propertyType: 'SFR', loanPurpose: 'Purchase', citizenship: 'Foreign National', loanAmount: '750000', units: '1', isInterestOnly: false, isShortTermRental: false },
  },
  {
    label: '5-10 Unit',
    description: 'Multi-family near DSCR threshold',
    color: 'bg-amber-50 border-amber-200 hover:border-amber-400 text-amber-800',
    params: { dscr: '1.05', ltv: '75', creditScore: '700', propertyType: '5-10 Unit', loanPurpose: 'Purchase', citizenship: 'US Citizen / Permanent Resident', loanAmount: '1200000', units: '5-10', isInterestOnly: false, isShortTermRental: false },
  },
  {
    label: 'STR Interest-Only',
    description: 'Short-term rental, IO, high LTV',
    color: 'bg-purple-50 border-purple-200 hover:border-purple-400 text-purple-800',
    params: { dscr: '1.10', ltv: '80', creditScore: '760', propertyType: 'STR (Short-Term Rental)', loanPurpose: 'Cash-out Refinance', citizenship: 'US Citizen / Permanent Resident', loanAmount: '650000', units: '1', isInterestOnly: true, isShortTermRental: true },
  },
];

function buildQuestion(p: ScenarioParams): string {
  const parts: string[] = [];
  if (p.dscr) parts.push(`DSCR of ${p.dscr}`);
  if (p.ltv) parts.push(`LTV of ${p.ltv}%`);
  if (p.creditScore) parts.push(`credit score of ${p.creditScore}`);
  parts.push(p.propertyType);
  if (p.units && Number(p.units) > 1) parts.push(`${p.units} units`);
  parts.push(p.loanPurpose.toLowerCase());
  if (p.citizenship !== 'US Citizen / Permanent Resident') parts.push(p.citizenship.toLowerCase());
  if (p.loanAmount) parts.push(`$${Number(p.loanAmount).toLocaleString()} loan amount`);
  if (p.isInterestOnly) parts.push('interest-only');
  if (p.isShortTermRental) parts.push('short-term rental');

  return `Analyze this DSCR loan scenario and provide:
1. Eligibility status (eligible, eligible with restrictions, or ineligible) and why
2. All applicable underwriting conditions that would be triggered
3. Pricing adjustments (LLPAs) that apply
4. Key requirements or restrictions specific to this scenario
5. Any documentation requirements specific to this scenario

Loan parameters: ${parts.join(', ')}.

Be specific and cite exact thresholds. Flag any eligibility blockers clearly.`;
}

const PROPERTY_TYPES = ['SFR', '2-4 Unit', '5-10 Unit', 'Warrantable Condo', 'NW Condo', 'Condotel', 'STR (Short-Term Rental)'];
const LOAN_PURPOSES = ['Purchase', 'Rate & Term Refinance', 'Cash-out Refinance'];
const CITIZENSHIP_TYPES = ['US Citizen / Permanent Resident', 'Foreign National', 'Non-Permanent Resident'];

const inputCls = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
const labelCls = 'text-xs font-medium text-gray-600 mb-1 block';

export default function ScenarioPage() {
  const [params, setParams] = useState<ScenarioParams>(DEFAULTS);
  const [submitted, setSubmitted] = useState(false);

  const { completion, complete, isLoading } = useCompletion({ api: '/api/analyze', streamProtocol: 'text' });

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    await complete(buildQuestion(params));
  }

  function set(key: keyof ScenarioParams, value: string | boolean) {
    setParams(prev => ({ ...prev, [key]: value }));
  }

  const dscrNum = Number(params.dscr);
  const ltvNum = Number(params.ltv);

  const flags: { type: 'error' | 'warn' | 'ok'; msg: string }[] = [];
  if (params.dscr) {
    if (dscrNum < 0.75) flags.push({ type: 'error', msg: 'DSCR < 0.75 — ineligible for most programs' });
    else if (dscrNum < 1.0 && params.citizenship === 'Foreign National') flags.push({ type: 'error', msg: 'DSCR < 1.0 — ineligible for Foreign National program' });
    else if (dscrNum < 1.0 && ['NW Condo', 'Condotel', 'STR (Short-Term Rental)'].includes(params.propertyType)) flags.push({ type: 'error', msg: `DSCR < 1.0 — ineligible for ${params.propertyType}` });
    else if (dscrNum < 1.0) flags.push({ type: 'warn', msg: 'DSCR < 1.0 — requires 0x30x12 mortgage history, reduced max LTV, pricing penalty' });
    else if (dscrNum >= 1.25) flags.push({ type: 'ok', msg: 'DSCR ≥ 1.25 — qualifies for pricing bonus' });
  }
  if (params.propertyType === '5-10 Unit' && dscrNum > 0 && dscrNum < 1.1) {
    flags.push({ type: 'error', msg: '5-10 Unit requires minimum DSCR of 1.1' });
  }
  if (params.ltv && ltvNum > 80 && params.citizenship === 'Foreign National') {
    flags.push({ type: 'warn', msg: 'Foreign National — LTV likely capped below 80%' });
  }

  const flagStyle = {
    error: 'bg-red-50 border-red-200 text-red-700',
    warn:  'bg-amber-50 border-amber-200 text-amber-700',
    ok:    'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
  const flagIcon = { error: '⛔', warn: '⚠️', ok: '✓' };

  // Build the scenario summary chips for the result header
  const summaryChips: string[] = [];
  if (params.dscr) summaryChips.push(`DSCR ${params.dscr}`);
  if (params.ltv) summaryChips.push(`LTV ${params.ltv}%`);
  if (params.creditScore) summaryChips.push(`FICO ${params.creditScore}`);
  summaryChips.push(params.propertyType);
  summaryChips.push(params.loanPurpose);
  if (params.citizenship !== 'US Citizen / Permanent Resident') summaryChips.push(params.citizenship);
  if (params.loanAmount) summaryChips.push(`$${Number(params.loanAmount).toLocaleString()}`);
  if (params.isInterestOnly) summaryChips.push('IO');
  if (params.isShortTermRental) summaryChips.push('STR');

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Scenario Analyzer</h1>
        <p className="text-sm text-gray-500">Input loan parameters to get a complete analysis — eligibility, conditions, pricing adjustments, and requirements.</p>
      </div>

      {/* Demo scenario quick-fills */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Demo Scenarios — click to load</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {DEMO_SCENARIOS.map(ds => (
            <button
              key={ds.label}
              type="button"
              onClick={() => setParams(ds.params)}
              className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${ds.color}`}
            >
              <p className="font-semibold text-xs">{ds.label}</p>
              <p className="text-xs opacity-70 mt-0.5">{ds.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6 items-start">
        {/* Form panel */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Loan Parameters</p>

            {/* Numeric inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>DSCR Ratio</label>
                <input type="number" step="0.01" min="0" max="5" value={params.dscr}
                  onChange={e => set('dscr', e.target.value)} placeholder="e.g. 1.15" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>LTV (%)</label>
                <input type="number" step="0.5" min="50" max="90" value={params.ltv}
                  onChange={e => set('ltv', e.target.value)} placeholder="e.g. 75" className={inputCls} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Credit Score</label>
                <input type="number" min="600" max="850" value={params.creditScore}
                  onChange={e => set('creditScore', e.target.value)} placeholder="e.g. 720" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Loan Amount ($)</label>
                <input type="number" min="75000" value={params.loanAmount}
                  onChange={e => set('loanAmount', e.target.value)} placeholder="e.g. 500000" className={inputCls} />
              </div>
            </div>

            {/* Selects */}
            <div>
              <label className={labelCls}>Property Type</label>
              <select value={params.propertyType} onChange={e => set('propertyType', e.target.value)} className={inputCls}>
                {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Loan Purpose</label>
                <select value={params.loanPurpose} onChange={e => set('loanPurpose', e.target.value)} className={inputCls}>
                  {LOAN_PURPOSES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Units</label>
                <select value={params.units} onChange={e => set('units', e.target.value)} className={inputCls}>
                  {['1', '2', '3', '4', '5-10'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Citizenship</label>
              <select value={params.citizenship} onChange={e => set('citizenship', e.target.value)} className={inputCls}>
                {CITIZENSHIP_TYPES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Toggles */}
            <div className="flex gap-5 pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={params.isInterestOnly}
                  onChange={e => set('isInterestOnly', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600" />
                Interest Only
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={params.isShortTermRental}
                  onChange={e => set('isShortTermRental', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600" />
                Short-term Rental
              </label>
            </div>

            {/* Quick flags */}
            {flags.length > 0 && (
              <div className="space-y-2 pt-1">
                {flags.map((f, i) => (
                  <div key={i} className={`border rounded-lg px-3 py-2 text-xs font-medium flex items-start gap-2 ${flagStyle[f.type]}`}>
                    <span className="shrink-0">{flagIcon[f.type]}</span>
                    {f.msg}
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : 'Analyze Scenario'}
            </button>
          </form>
        </div>

        {/* Result panel */}
        <div>
          {!submitted && !completion && (
            <div className="h-64 flex items-center justify-center bg-white border border-gray-200 border-dashed rounded-xl">
              <div className="text-center text-gray-400">
                <svg className="w-9 h-9 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm">Fill in loan parameters and click Analyze</p>
              </div>
            </div>
          )}

          {(completion || (isLoading && submitted)) && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* Result header */}
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Scenario Analysis</span>
                  {isLoading && (
                    <span className="flex gap-1 ml-1">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                  )}
                </div>
                {/* Scenario chips */}
                {summaryChips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {summaryChips.map(chip => (
                      <span key={chip} className="text-xs bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono">{chip}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Rendered markdown */}
              <div className="px-5 py-5">
                <div className="prose prose-sm max-w-none
                  prose-headings:font-semibold prose-headings:text-gray-900
                  prose-h1:text-base prose-h1:mt-4 prose-h1:mb-2
                  prose-h2:text-sm prose-h2:mt-5 prose-h2:mb-2 prose-h2:pb-1.5 prose-h2:border-b prose-h2:border-gray-100
                  prose-h3:text-sm prose-h3:text-gray-700 prose-h3:mt-3 prose-h3:mb-1 prose-h3:font-semibold
                  prose-p:text-gray-700 prose-p:leading-relaxed prose-p:my-1.5 prose-p:text-sm
                  prose-ul:my-2 prose-ul:pl-4
                  prose-li:text-gray-700 prose-li:text-sm prose-li:my-0.5
                  prose-ol:my-2 prose-ol:pl-4
                  prose-strong:text-gray-900 prose-strong:font-semibold
                  prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                  prose-blockquote:border-l-2 prose-blockquote:border-blue-300 prose-blockquote:pl-3 prose-blockquote:text-gray-600 prose-blockquote:not-italic
                  prose-hr:border-gray-100">
                  <ReactMarkdown>{completion}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
