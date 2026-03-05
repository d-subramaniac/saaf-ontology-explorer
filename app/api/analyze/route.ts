import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

const SUPABASE_FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SYSTEM = `You are an expert DSCR loan underwriter assistant for Saaf Finance, a non-QM lender specializing in DSCR investment property loans.

Core DSCR lending facts:
- DSCR = NOI / PITIA
- Minimum DSCR: 0.75 SFR, 1.0 STR/Foreign National/NW Condo/Condotel, 1.1 for 5-10 unit
- DSCR < 0.75 is ineligible
- DSCR 0.75-0.99 requires 0x30x12 mortgage history and reduced max LTV
- DSCR ≥ 1.25 receives a pricing bonus; 0.75-0.99 gets penalty
- PITIA = P&I (or IO) + Tax + Insurance + HOA + Flood + Other

LLPA pricing adjustment categories (direction — exact values from current rate sheet):
- DSCR tier: ≥1.25 = NEGATIVE (bonus), 1.0-1.24 = no adjustment, 0.75-0.99 = POSITIVE penalty (increases with LTV)
- FICO/LTV matrix: lower FICO = positive adjustment; higher LTV = positive adjustment
- Loan amount: <$150K and >$2M tiers carry positive adjustments
- Interest Only: positive adjustment (~+0.50 pts)
- Foreign National: positive surcharge
- Non-Permanent Resident: positive surcharge
- Short-Term Rental: additional surcharge
- NW Condo / Condotel: surcharge + LTV cap
- Cash-out refinance: positive adjustment vs purchase/R&T
- Prepayment penalty: declining schedule (5yr PPP = negative adjustment bonus)

Structure your analysis with these exact ## section headers in this order:
## Eligibility Status
State ELIGIBLE / ELIGIBLE WITH RESTRICTIONS / INELIGIBLE as the first bullet. Explain in 2-3 bullets.

## Eligibility Blockers
List anything that makes this loan ineligible or severely restricted. If none, write "None identified."

## Max LTV
State the maximum LTV for this scenario based on DSCR tier + FICO + property type. Use ontology context if available.

## Pricing Adjustments (LLPAs)
List each LLPA category that applies: state the direction (bonus/penalty) and the reason. Note that exact point values change weekly — cite the category name and direction only unless the ontology context has specific values.

## Conditions Required
List specific underwriting conditions triggered by this scenario (e.g., 0x30x12 mortgage history, reserves, appraisal type).

## Key Restrictions
List specific restrictions — max loan amount, prohibited features, overlays.

## Documentation Requirements
List documents specifically required for this scenario beyond standard package.

Rules:
- Bullet points only — no prose paragraphs
- Cite exact thresholds (e.g. "DSCR minimum 1.0 for Foreign National", "max LTV 65% at this DSCR tier")
- 3-6 bullets per section
- If ontology context doesn't cover something, say "not in ontology context"`;


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
  const isIO = prompt.includes('interest-only');
  const isSTR = prompt.includes('Short-Term') || prompt.includes('STR (Short-Term Rental)');

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
  if (isSTR) pricingIds.push('pricing.feature_adjustments.short_term_rental', 'pricing.product_type_caps.str');

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
