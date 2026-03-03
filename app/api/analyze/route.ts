import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

const SUPABASE_FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL!;

const SYSTEM = `You are an expert DSCR loan underwriter assistant for Saaf Finance, a non-QM lender specializing in DSCR investment property loans.

Core DSCR lending facts:
- DSCR = NOI / PITIA
- Minimum DSCR: 0.75 SFR, 1.0 STR/Foreign National/NW Condo/Condotel, 1.1 for 5-10 unit
- DSCR < 0.75 is ineligible
- DSCR 0.75-0.99 requires 0x30x12 mortgage history and reduced max LTV
- DSCR ≥ 1.25 receives a pricing bonus; 0.75-0.99 gets penalty; <0.75 ineligible
- PITIA = P&I (or IO) + Tax + Insurance + HOA + Flood + Other

Structure your scenario analysis with these exact sections:
## Eligibility Status
State: ELIGIBLE / ELIGIBLE WITH RESTRICTIONS / INELIGIBLE, then explain why.

## Eligibility Blockers
List anything that makes this loan ineligible (if none, say "None").

## Max LTV
State the maximum LTV for this scenario based on DSCR tier + FICO + loan amount + property type.

## Pricing Adjustments (LLPAs)
List each applicable LLPA with its exact value. Show the calculation.

## Conditions Required
List all underwriting conditions that would be triggered.

## Key Restrictions
List specific restrictions for this scenario.

## Documentation Requirements
List documents specific to this scenario.

Be specific with exact thresholds from the ontology context. Never guess — if context is missing for something, say so explicitly.`;

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

  // Extract key scenario parameters from the prompt for targeted sub-queries
  const hasDscr = /DSCR of ([\d.]+)/.exec(prompt);
  const hasLtv = /LTV of (\d+)/.exec(prompt);
  const hasFico = /credit score of (\d+)/.exec(prompt);
  const dscrVal = hasDscr ? parseFloat(hasDscr[1]) : null;

  // Build targeted sub-queries for parallel search
  const dscrTier = dscrVal === null ? 'dscr ratio' :
    dscrVal < 0.75 ? 'DSCR less than 0.75 ineligible' :
    dscrVal < 1.0 ? 'DSCR 0.75-0.99 restrictions mortgage history reserves' :
    dscrVal >= 1.25 ? 'DSCR 1.25 pricing bonus' : 'DSCR 1.0-1.24 standard';

  const pricingQuery = [
    hasLtv ? `LTV ${hasLtv[1]} FICO ${hasFico?.[1] ?? ''} loan amount LLPA adjustment` : 'FICO LTV price adjustment LLPA matrix',
    prompt.includes('interest-only') ? 'interest only pricing adjustment' : '',
    prompt.includes('Foreign National') ? 'foreign national LLPA adjustment' : '',
    prompt.includes('Short-Term') || prompt.includes('STR') ? 'short term rental LLPA adjustment' : '',
  ].filter(Boolean).join(' ');

  // Run 4 targeted searches in parallel
  const [generalResults, eligibilityResults, pricingResults, conditionResults] = await Promise.all([
    search(prompt, 10),
    search(`${dscrTier} eligibility requirements max LTV restrictions`, 10),
    search(pricingQuery || 'LLPA pricing adjustment matrix', 10),
    search(`conditions required ${prompt.match(/SFR|Condo|5-10 Unit|2-4 Unit|STR|Condotel/)?.[0] ?? ''} underwriting`, 8),
  ]);

  const allResults = dedup([...generalResults, ...eligibilityResults, ...pricingResults, ...conditionResults]);

  let systemWithContext = SYSTEM;
  if (allResults.length) {
    const ctx = allResults
      .slice(0, 30) // cap at 30 to stay within token budget
      .map(r => `[${r.content_type.toUpperCase()}] ${r.content_id}:\n${r.content_text}`)
      .join('\n\n---\n\n');
    systemWithContext = `${SYSTEM}\n\n## Ontology Context (${allResults.length} results from 4 targeted searches)\n\n${ctx}`;
  }

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemWithContext,
    prompt,
  });

  return result.toTextStreamResponse();
}
