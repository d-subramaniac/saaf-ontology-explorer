import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

const SUPABASE_FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SYSTEM = `You are an expert DSCR loan underwriter assistant for Saaf Finance, a non-QM lender specializing in DSCR investment property loans.

FORMATTING RULE — CRITICAL: Every item in every section MUST be a markdown bullet starting with "- ". Never write prose paragraphs. If you have three things to say, write three "- " bullets. Not one sentence, not numbered text — always "- " bullets.

Core DSCR lending facts:
- DSCR = NOI / PITIA
- Minimum DSCR: 0.75 SFR, 1.0 STR/Foreign National/NW Condo/Condotel, 1.1 for 5-10 unit
- DSCR < 0.75 is ineligible
- DSCR 0.75-0.99 requires 0x30x12 mortgage history and reduced max LTV
- DSCR ≥ 1.25 receives a pricing bonus; 0.75-0.99 gets penalty
- PITIA = P&I (or IO) + Tax + Insurance + HOA + Flood + Other

LLPA directional knowledge (use this to reason about pricing even without a live rate sheet):
- DSCR tier adjustment: DSCR ≥ 1.25 → BONUS (negative pts), DSCR 1.0-1.24 → no adjustment, DSCR 0.75-0.99 → PENALTY (positive pts, grows with LTV)
- FICO/LTV matrix: FICO 760+ at LTV ≤70% = best tier (no adjustment); each step down in FICO or up in LTV adds positive pts
- Loan amount: $150K-$2M range = standard tier; <$150K or >$2M = positive adjustment
- Interest Only: PENALTY — moderate positive adjustment
- Foreign National: PENALTY — surcharge applies; max LTV typically 65%
- Non-Permanent Resident: PENALTY — smaller surcharge than Foreign National
- Short-Term Rental: PENALTY — surcharge on top of base rate
- NW Condo / Condotel: PENALTY — surcharge + reduced LTV cap
- Cash-out refinance: PENALTY — positive adjustment vs purchase or R&T
- Prepayment penalty (PPP): BONUS — 5yr PPP gives largest bonus, declining by year (5yr > 4yr > 3yr > 2yr > 1yr); Step-Down slightly better than Fixed
- No PPP: no adjustment (no bonus)

Structure your analysis with these exact ## section headers in this order:
## Eligibility Status
- First bullet: **ELIGIBLE**, **ELIGIBLE WITH RESTRICTIONS**, or **INELIGIBLE** — one word verdict
- 2-3 more bullets explaining why

## Eligibility Blockers
- One bullet per blocker
- If none: "- None identified"

## Max LTV
- State the max LTV ceiling for this scenario (DSCR tier + FICO + property type + citizenship)
- One bullet per constraint that limits LTV

## Pricing Adjustments (LLPAs)
- One bullet per applicable LLPA category, format: **Category**: BONUS or PENALTY — one-line reason
- Cover every category that applies to this scenario
- Include N/A categories only if they are notably absent (e.g., "**No PPP selected** — pricing bonus forfeited")

## Conditions Required
- One bullet per condition triggered by this scenario
- Include trigger reason (e.g., "DSCR < 1.0 → 0x30x12 mortgage history required")

## Key Restrictions
- One bullet per restriction (max loan amount, prohibited features, overlays)

## Documentation Requirements
- One bullet per document required beyond standard package

## Estimated Rate at Par
Using the LLPA directional knowledge above — do NOT say "live pricing needed":
- List each LLPA that applies with BONUS or PENALTY and a brief reason
- Count bonuses vs penalties: state whether the net stack is above par, near par, or below par
- **Net assessment**: "Net pricing is [above/near/below] par — [majority bonuses/majority penalties/mixed]"
- **Par rate implication**: If net is above par → borrower needs a higher note rate to buy down; if net is below par → lender can reduce rate or borrower receives rebate

Rules:
- EVERY item is a "- " markdown bullet. Never prose.
- Keep each bullet under 20 words
- Cite exact thresholds ("DSCR minimum 1.0 for Foreign National", "max LTV 65% at this DSCR tier")
- 3-6 bullets per section (except ## Pricing Adjustments — one per applicable LLPA)
- Use the LLPA directional knowledge in this prompt to reason — do NOT defer to "live pricing needed"`;


interface SearchResult {
  content_type: string;
  content_id: string;
  content_text: string;
  similarity?: number;
}

async function search(query: string, count = 12): Promise<SearchResult[]> {
  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/search-ontology`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, match_count: count, match_threshold: 0.2 }),
    });
    if (!res.ok) return [];
    const { results } = await res.json() as { results: SearchResult[] };
    return results ?? [];
  } catch {
    return [];
  }
}

// Direct lookup by content_id — bypasses vector search for known-relevant pricing rules
async function fetchByIds(ids: string[]): Promise<SearchResult[]> {
  if (!ids.length) return [];
  try {
    const idsParam = ids.join(',');
    const url = `${SUPABASE_URL}/rest/v1/ontology_embeddings?content_id=in.(${idsParam})&select=content_type,content_id,content_text`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return [];
    return await res.json() as SearchResult[];
  } catch {
    return [];
  }
}

function dedup(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.content_id)) return false;
    seen.add(r.content_id);
    return true;
  });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_key_here') {
    return new Response('ANTHROPIC_API_KEY is not configured on the server.', { status: 500 });
  }

  const { prompt } = await req.json() as { prompt: string };

  // Extract scenario parameters for targeted retrieval
  const hasDscr = /DSCR of ([\d.]+)/.exec(prompt);
  const hasLtv = /LTV of (\d+)/.exec(prompt);
  const hasFico = /credit score of (\d+)/.exec(prompt);
  const hasLoanAmount = /\$([\d,]+) loan amount/.exec(prompt);
  const dscrVal = hasDscr ? parseFloat(hasDscr[1]) : null;
  const loanAmountVal = hasLoanAmount ? parseInt(hasLoanAmount[1].replace(/,/g, '')) : null;

  const isForeignNational = prompt.includes('Foreign National');
  const isNonPerm = prompt.includes('Non-Permanent');
  const isPermanentResident = prompt.includes('Permanent Resident') && !isForeignNational && !isNonPerm;
  const isIO = prompt.includes('interest-only');
  const isSTR = prompt.includes('Short-Term') || prompt.includes('STR (Short-Term Rental)');
  const hasPPP = !prompt.includes('no prepayment penalty');
  const pppTermMatch = /(\d)yr.*prepayment penalty/.exec(prompt);
  const pppTerm = pppTermMatch ? parseInt(pppTermMatch[1]) : null;
  const isStepDown = prompt.includes('Step-Down prepayment');
  const isFixed = prompt.includes('Fixed prepayment');
  const propertyStateMatch = /property state: ([A-Z]{2})/.exec(prompt);
  const propertyState = propertyStateMatch ? propertyStateMatch[1] : null;

  // ── Deterministic pricing IDs based on scenario params ─────────────────────
  const pricingIds: string[] = [];

  // DSCR tier: feature adjustment + base LTV matrix tier
  if (dscrVal !== null) {
    if (dscrVal >= 1.25) pricingIds.push('pricing.feature_adjustments.dscr_gte_1_25');
    if (dscrVal >= 0.75 && dscrVal < 1.0) pricingIds.push('pricing.feature_adjustments.dscr_075_to_099');
    if (dscrVal < 0.75) pricingIds.push('pricing.feature_adjustments.dscr_lt_075');
    const ltvTier = dscrVal >= 1.0 ? 'dscr_gte_1_00' : dscrVal >= 0.75 ? 'dscr_075_to_099' : 'dscr_lt_075';
    pricingIds.push(`pricing.ltv_matrix.${ltvTier}`);
  }

  // Always pull base LTV matrix summary + FICO/LTV LLPA
  pricingIds.push('pricing.ltv_matrix', 'pricing.credit_score_llpa');

  // Feature adjustments
  if (isIO) pricingIds.push('pricing.feature_adjustments.interest_only', 'pricing.product_type_caps.feature_interest_only');
  if (isForeignNational) pricingIds.push('pricing.feature_adjustments.foreign_national', 'pricing.product_type_caps.foreign_national');
  if (isNonPerm) pricingIds.push('pricing.feature_adjustments.non_perm_resident', 'pricing.product_type_caps.non_permanent_resident');
  if (isPermanentResident) pricingIds.push('pricing.feature_adjustments.permanent_resident');
  if (isSTR) pricingIds.push('pricing.feature_adjustments.short_term_rental', 'pricing.product_type_caps.str');

  // PPP adjustments
  if (hasPPP && pppTerm) {
    const structure = isStepDown ? 'step_down' : isFixed ? 'fixed' : 'step_down';
    pricingIds.push(`pricing.ppp_adjustments.${pppTerm}yr_${structure}`);
    pricingIds.push('pricing.ppp_adjustments');
  }

  // Loan amount tier
  if (loanAmountVal !== null) {
    if (loanAmountVal <= 100000) pricingIds.push('pricing.loan_amount_adjustments.LA-001');
    else if (loanAmountVal <= 250000) pricingIds.push('pricing.loan_amount_adjustments.LA-002');
    else if (loanAmountVal <= 1000000) pricingIds.push('pricing.loan_amount_adjustments.LA-003');
    else if (loanAmountVal <= 1500000) pricingIds.push('pricing.loan_amount_adjustments.LA-004');
    else if (loanAmountVal <= 2000000) pricingIds.push('pricing.loan_amount_adjustments.LA-005');
    else if (loanAmountVal <= 2500000) pricingIds.push('pricing.loan_amount_adjustments.LA-006');
    else pricingIds.push('pricing.loan_amount_adjustments.LA-007');
  }

  // Property type caps
  if (prompt.includes('2-4 Unit')) pricingIds.push('pricing.product_type_caps.2_4_unit');
  if (prompt.includes('5-10 Unit')) pricingIds.push('pricing.feature_adjustments.five_to_ten_unit');
  if (prompt.includes('NW Condo')) pricingIds.push('pricing.product_type_caps.nw_condo', 'pricing.feature_adjustments.nw_condo');
  if (prompt.includes('Condotel')) pricingIds.push('pricing.product_type_caps.condotel', 'pricing.feature_adjustments.condotel');

  // ── Semantic search sub-queries ─────────────────────────────────────────────
  const dscrTier = dscrVal === null ? 'dscr ratio' :
    dscrVal < 0.75 ? 'DSCR less than 0.75 ineligible' :
    dscrVal < 1.0 ? 'DSCR 0.75-0.99 restrictions mortgage history reserves' :
    dscrVal >= 1.25 ? 'DSCR 1.25 pricing bonus' : 'DSCR 1.0-1.24 standard';

  const pricingQuery = [
    hasLtv ? `LTV ${hasLtv[1]} FICO ${hasFico?.[1] ?? ''} loan amount LLPA adjustment` : 'FICO LTV price adjustment LLPA matrix',
    isIO ? 'interest only pricing adjustment' : '',
    isForeignNational ? 'foreign national LLPA adjustment' : '',
    isSTR ? 'short term rental LLPA adjustment' : '',
    hasPPP && pppTerm ? `prepayment penalty ${pppTerm} year pricing bonus` : 'pricing near par rate adjustment',
    propertyState ? `${propertyState} state restrictions DSCR loan` : '',
  ].filter(Boolean).join(' ');

  // Run all searches in parallel (deterministic + 4 semantic)
  const [deterministicPricing, generalResults, eligibilityResults, pricingResults, conditionResults] = await Promise.all([
    fetchByIds(pricingIds),
    search(prompt, 10),
    search(`${dscrTier} eligibility requirements max LTV restrictions`, 10),
    search(pricingQuery || 'LLPA pricing adjustment matrix', 8),
    search(`conditions required ${prompt.match(/SFR|Condo|5-10 Unit|2-4 Unit|STR|Condotel/)?.[0] ?? ''} underwriting`, 8),
  ]);

  // Deterministic results go first so they're always included before cap
  const allResults = dedup([...deterministicPricing, ...generalResults, ...eligibilityResults, ...pricingResults, ...conditionResults]);

  let systemWithContext = SYSTEM;
  if (allResults.length) {
    const ctx = allResults
      .slice(0, 35)
      .map(r => `[${r.content_type.toUpperCase()}] ${r.content_id}:\n${r.content_text}`)
      .join('\n\n---\n\n');
    systemWithContext = `${SYSTEM}\n\n## Ontology Context (${allResults.length} results)\n\n${ctx}`;
  }

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemWithContext,
    prompt,
  });

  return result.toTextStreamResponse();
}
