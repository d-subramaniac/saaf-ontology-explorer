'use client';

import { useState } from 'react';
import { useCompletion } from '@ai-sdk/react';

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

export default function ScenarioPage() {
  const [params, setParams] = useState<ScenarioParams>(DEFAULTS);
  const [submitted, setSubmitted] = useState(false);

  const { completion, complete, isLoading } = useCompletion({ api: '/api/analyze' });

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const question = buildQuestion(params);
    await complete(question);
  }

  function set(key: keyof ScenarioParams, value: string | boolean) {
    setParams(prev => ({ ...prev, [key]: value }));
  }

  const dscrNum = Number(params.dscr);
  const ltvNum = Number(params.ltv);

  // Quick eligibility flags (client-side preview, before AI response)
  const flags: { type: 'error' | 'warn' | 'info'; msg: string }[] = [];
  if (params.dscr) {
    if (dscrNum < 0.75) flags.push({ type: 'error', msg: 'DSCR < 0.75 — ineligible for most programs' });
    else if (dscrNum < 1.0 && params.citizenship === 'Foreign National') flags.push({ type: 'error', msg: 'DSCR < 1.0 — ineligible for Foreign National program' });
    else if (dscrNum < 1.0 && ['NW Condo', 'Condotel', 'STR (Short-Term Rental)'].includes(params.propertyType)) flags.push({ type: 'error', msg: `DSCR < 1.0 — ineligible for ${params.propertyType}` });
    else if (dscrNum < 1.0) flags.push({ type: 'warn', msg: 'DSCR < 1.0 — requires 0x30x12 mortgage history, reduced max LTV, pricing penalty' });
    else if (dscrNum >= 1.25) flags.push({ type: 'info', msg: 'DSCR ≥ 1.25 — qualifies for pricing bonus' });
  }
  if (params.propertyType === '5-10 Unit' && dscrNum > 0 && dscrNum < 1.1) {
    flags.push({ type: 'error', msg: '5-10 Unit requires minimum DSCR of 1.1' });
  }
  if (params.ltv && ltvNum > 80 && params.citizenship === 'Foreign National') {
    flags.push({ type: 'warn', msg: 'Foreign National — LTV likely capped below 80%' });
  }

  const flagColors = { error: 'bg-red-900/50 border-red-700 text-red-300', warn: 'bg-amber-900/50 border-amber-700 text-amber-300', info: 'bg-blue-900/50 border-blue-700 text-blue-200' };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white mb-1">Scenario Analyzer</h1>
        <p className="text-gray-400 text-sm">Input loan parameters to get a full analysis — eligibility, conditions, pricing adjustments, and requirements.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleAnalyze} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">DSCR Ratio</label>
              <input
                type="number" step="0.01" min="0" max="5"
                value={params.dscr}
                onChange={e => set('dscr', e.target.value)}
                placeholder="e.g. 1.15"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">LTV (%)</label>
              <input
                type="number" step="0.5" min="50" max="90"
                value={params.ltv}
                onChange={e => set('ltv', e.target.value)}
                placeholder="e.g. 75"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Credit Score</label>
              <input
                type="number" min="600" max="850"
                value={params.creditScore}
                onChange={e => set('creditScore', e.target.value)}
                placeholder="e.g. 720"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Loan Amount ($)</label>
              <input
                type="number" min="75000"
                value={params.loanAmount}
                onChange={e => set('loanAmount', e.target.value)}
                placeholder="e.g. 500000"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Property Type</label>
            <select
              value={params.propertyType}
              onChange={e => set('propertyType', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Loan Purpose</label>
              <select
                value={params.loanPurpose}
                onChange={e => set('loanPurpose', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {LOAN_PURPOSES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Units</label>
              <select
                value={params.units}
                onChange={e => set('units', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {['1', '2', '3', '4', '5-10'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Citizenship</label>
            <select
              value={params.citizenship}
              onChange={e => set('citizenship', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {CITIZENSHIP_TYPES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={params.isInterestOnly}
                onChange={e => set('isInterestOnly', e.target.checked)}
                className="rounded"
              />
              Interest Only
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={params.isShortTermRental}
                onChange={e => set('isShortTermRental', e.target.checked)}
                className="rounded"
              />
              Short-term Rental
            </label>
          </div>

          {/* Quick flags */}
          {flags.length > 0 && (
            <div className="space-y-2">
              {flags.map((f, i) => (
                <div key={i} className={`border rounded-lg px-3 py-2 text-xs ${flagColors[f.type]}`}>
                  {f.type === 'error' ? '⛔ ' : f.type === 'warn' ? '⚠️ ' : 'ℹ️ '}{f.msg}
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analyzing scenario...
              </>
            ) : 'Analyze Scenario'}
          </button>
        </form>

        {/* Result */}
        <div>
          {!submitted && !completion && (
            <div className="h-full flex items-center justify-center text-center py-12">
              <div>
                <svg className="w-10 h-10 mx-auto mb-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-gray-600 text-sm">Fill in loan parameters<br />and click Analyze</p>
              </div>
            </div>
          )}

          {(completion || isLoading) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Scenario Analysis</span>
                {isLoading && (
                  <span className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                {completion}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
