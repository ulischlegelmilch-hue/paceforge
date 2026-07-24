import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// Die SDK-Zod-Helfer sind auf die v4-API (zod/v4) getypt; daraus importieren,
// damit die Structured-Output-Typinferenz greift.
import * as z from 'zod/v4';
import { parseGoalText, type ParsedGoal } from '@paceforge/core';

// LLM-gestützte natürlichsprachliche Zieleingabe (Phase 2).
// - Ist ein ANTHROPIC_API_KEY gesetzt, extrahiert Claude die Ziel-Felder robust
//   auch aus freiem/umgangssprachlichem Text (Structured Output erzwingt das Schema).
// - Sonst (oder bei jedem Fehler) fällt es auf den deterministischen, unit-
//   getesteten Regel-Parser aus @paceforge/core zurück.
// Die eigentliche Trainingslogik (VDOT/Plan) bleibt davon unberührt regelbasiert.

// Nullable statt optional: robustes Structured-Output-Schema (Modell füllt fehlende
// Felder explizit mit null statt sie wegzulassen).
const ParsedGoalSchema = z.object({
  distance: z.enum(['5k', '10k', 'half', 'marathon', 'custom']).nullable(),
  targetTimeSeconds: z.number().int().nullable(),
  weeks: z.number().int().nullable(),
  daysPerWeek: z.number().int().nullable(),
});

const SYSTEM = [
  'Du extrahierst Lauf-Trainingsziele aus freiem Text (deutsch oder englisch).',
  'Gib ausschließlich die erkannten Felder zurück; unbekannte Felder sind null.',
  '- distance: "5k", "10k", "half" (Halbmarathon), "marathon" oder "custom".',
  '- targetTimeSeconds: die Wunsch-Zielzeit in SEKUNDEN (z. B. "unter 45 min" = 2700).',
  '- weeks: Planlänge in Wochen als ganze Zahl.',
  '- daysPerWeek: Trainingstage pro Woche, ganze Zahl 3–6.',
  'Rate nichts dazu; wenn etwas nicht genannt ist, setze null.',
].join('\n');

export type ParseSource = 'llm' | 'rules';

export async function parseGoalSmart(text: string): Promise<{ result: ParsedGoal; source: ParseSource }> {
  // Ohne API-Key gar nicht erst versuchen (spart einen sicher scheiternden Call).
  if (!process.env.ANTHROPIC_API_KEY) {
    return { result: parseGoalText(text), source: 'rules' };
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { format: zodOutputFormat(ParsedGoalSchema) },
      messages: [{ role: 'user', content: text }],
    });

    const p = response.parsed_output;
    if (!p) throw new Error('kein parsed_output');

    const result: ParsedGoal = {};
    if (p.distance) result.distance = p.distance;
    if (p.targetTimeSeconds != null && p.targetTimeSeconds > 0) result.targetTimeSeconds = p.targetTimeSeconds;
    if (p.weeks != null && p.weeks > 0) result.weeks = p.weeks;
    if (p.daysPerWeek != null) result.daysPerWeek = Math.min(6, Math.max(3, p.daysPerWeek));
    return { result, source: 'llm' };
  } catch {
    // Jeder Fehler (Auth, Netzwerk, Schema) -> deterministischer Fallback.
    return { result: parseGoalText(text), source: 'rules' };
  }
}
