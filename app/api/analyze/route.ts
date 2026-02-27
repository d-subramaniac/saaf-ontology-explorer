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

Structure your scenario analysis with these sections:
1. Eligibility Status (eligible / eligible with restrictions / ineligible)
2. Conditions Required
3. Pricing Adjustments (LLPAs)
4. Key Restrictions
5. Documentation Requirements

Be specific with exact thresholds. Flag eligibility blockers first. Never guess — only use what's in the provided ontology context.`;

interface SearchResult {
  content_type: string;
  content_id: string;
  content_text: string;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_key_here') {
    return new Response('ANTHROPIC_API_KEY is not configured on the server.', { status: 500 });
  }

  const { prompt } = await req.json() as { prompt: string };

  let systemWithContext = SYSTEM;

  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/search-ontology`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: prompt, match_count: 15, match_threshold: 0.2 }),
    });
    if (res.ok) {
      const { results } = await res.json() as { results: SearchResult[] };
      if (results?.length) {
        const ctx = results
          .map(r => `[${r.content_type.toUpperCase()}] ${r.content_id}:\n${r.content_text}`)
          .join('\n\n---\n\n');
        systemWithContext = `${SYSTEM}\n\n## Ontology Context\n\n${ctx}`;
      }
    }
  } catch { /* proceed without context */ }

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemWithContext,
    prompt,
  });

  return result.toTextStreamResponse();
}
