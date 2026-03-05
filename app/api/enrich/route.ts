import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

interface FieldData {
  id: string;
  name: string;
  concept_id?: string;
  type?: string;
  definition?: string;
  depends_on?: string[];
  affects?: string[];
  business_rules?: string[];
  validation_rules?: string[];
  source_provenance?: string;
  enrichment_status?: string;
}

export interface EnrichmentResult {
  enriched_definition: string;
  suggested_rules: Array<{ rule: string; confidence: 'high' | 'medium' | 'low'; source: string }>;
  suggested_dependencies: Array<{ field: string; relationship: 'depends_on' | 'affects'; reason: string }>;
  expert_questions: string[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an expert DSCR loan underwriter and ontology engineer for Saaf Finance.
Your task is to enrich ontology field definitions with accurate business rules, dependencies, and expert questions.

Guidelines:
- Only state rules you are confident about from DSCR lending knowledge
- DSCR = NOI / PITIA; minimum varies by product: 0.75 SFR, 1.0 STR/Foreign National/NW Condo/Condotel, 1.1 for 5-10 unit
- DSCR < 0.75 = ineligible; 0.75-0.99 = restricted tier with lower LTV caps; ≥ 1.25 = pricing bonus
- PITIA = P&I (or IO payment) + Property Tax + HOI + HOA + Flood + Other monthly obligations
- Reserve tiers: 12 months (DSCR<1 / LTV>80 / FTI / 5-10 unit), 6 months (standard), 3 months (DSCR≥1.25 eligible)
- LTV limits are driven by 62+ rules considering DSCR tier, property type, citizenship, loan features
- Cite AHL Guidelines or Numeriquai rule IDs when referencing specific thresholds
- Flag uncertainty with LOW confidence and add to expert_questions
- Do NOT state specific pricing adjustment values (those change weekly)

Respond ONLY with a valid JSON object. No markdown, no explanation outside the JSON.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_key_here') {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
  }

  const body = await req.json() as { field?: FieldData } | FieldData;
  const field = ('field' in body && body.field) ? body.field : body as FieldData;

  const userPrompt = `Enrich this DSCR loan ontology field. Return a JSON object with exactly these keys. Be concise — keep strings short, limit arrays to 5 items max:
- enriched_definition (string): 1-2 sentence precise domain definition
- suggested_rules (array, max 5): each { rule: string (max 120 chars), confidence: "high"|"medium"|"low", source: string }
- suggested_dependencies (array, max 5): each { field: string, relationship: "depends_on"|"affects", reason: string (max 80 chars) }
- expert_questions (array, max 3 strings): key gaps to fill with domain expert
- confidence ("high"|"medium"|"low"): overall confidence in this enrichment
- reasoning (string, max 150 chars): brief explanation

Field to enrich:
  ID: ${field.id}
  Name: ${field.name}
  Concept: ${field.concept_id ?? 'unknown'}
  Type: ${field.type ?? 'unknown'}
  Current Definition: ${field.definition ?? '(none)'}
  Depends On: ${(field.depends_on ?? []).join(', ') || 'none'}
  Affects: ${(field.affects ?? []).join(', ') || 'none'}
  Current Business Rules: ${(field.business_rules ?? []).join('; ') || 'none'}
  Current Validation Rules: ${(field.validation_rules ?? []).join('; ') || 'none'}
  Source Provenance: ${field.source_provenance ?? 'unknown'}`;

  try {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 4096,
    });

    // Strip markdown code fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
    const result: EnrichmentResult = JSON.parse(jsonStr);
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: `Enrichment failed: ${String(e)}` },
      { status: 500 }
    );
  }
}
