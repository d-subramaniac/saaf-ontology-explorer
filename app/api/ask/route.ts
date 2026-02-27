import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

const SUPABASE_FUNCTIONS_URL = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL!;

const SYSTEM = `You are an expert DSCR loan underwriter assistant for Saaf Finance, a non-QM lender specializing in DSCR investment property loans.

The Saaf Finance ontology contains 675 database fields, 94 underwriting conditions, 23 domain concepts, and 8 core calculations (DSCR, NOI, PITIA, MaxLTV, GrossRentalIncome, etc.).

Core DSCR lending facts embedded in the ontology:
- DSCR = NOI / PITIA (Net Operating Income divided by monthly debt obligations)
- Minimum DSCR: 0.75 SFR, 1.0 for STR/Foreign National/NW Condo/Condotel, 1.1 for 5-10 unit properties
- DSCR < 0.75 is ineligible
- DSCR 0.75-0.99 requires 0x30x12 mortgage history and reduces max LTV
- DSCR ≥ 1.25 receives a pricing bonus (negative LLPA)
- LTV limits vary by DSCR tier, property type, citizenship status, and loan features
- PITIA = Principal & Interest (or IO payment) + Property Tax + Homeowners Insurance + HOA + Flood + Other

How to answer:
- Be specific with exact thresholds from the context — no vague ranges
- Use clear headers and sections for multi-part answers
- Put eligibility blockers (anything that makes a loan ineligible) at the top
- List conditions/requirements as bullet points
- When showing pricing adjustments, be precise about which LTV band and DSCR tier applies
- If the ontology context doesn't cover something, say "not in ontology context" rather than guessing
- Keep answers focused and actionable — a loan officer should be able to act on your answer`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SearchResult {
  content_type: string;
  content_id: string;
  content_text: string;
  similarity: number;
}

export async function POST(req: Request) {
  const { messages } = await req.json() as { messages: Message[] };

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');

  let systemWithContext = SYSTEM;

  if (lastUserMsg?.content) {
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/search-ontology`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: lastUserMsg.content,
          match_count: 15,
          match_threshold: 0.2,
        }),
      });
      if (res.ok) {
        const { results } = await res.json() as { results: SearchResult[] };
        if (results?.length) {
          const ctx = results
            .map(r => `[${r.content_type.toUpperCase()}] ${r.content_id}:\n${r.content_text}`)
            .join('\n\n---\n\n');
          systemWithContext = `${SYSTEM}\n\n## Relevant Ontology Context (retrieved for this query)\n\n${ctx}`;
        }
      }
    } catch {
      // proceed without context
    }
  }

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemWithContext,
    messages,
  });

  return result.toTextStreamResponse();
}
