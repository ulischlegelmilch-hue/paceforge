import { parseGoalText, type ParsedGoal } from '@paceforge/core';
import { API_BASE_URL } from '@/config';

export type GoalSource = 'llm' | 'rules' | 'local';

// Zieleingabe parsen: nutzt das Backend (/api/parse-goal, ggf. LLM), wenn eine
// Backend-URL konfiguriert und erreichbar ist; sonst den lokalen Regel-Parser.
export async function parseGoalSmart(text: string): Promise<{ parsed: ParsedGoal; source: GoalSource }> {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/parse-goal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const body = (await res.json()) as { parsed: ParsedGoal; source: 'llm' | 'rules' };
        return { parsed: body.parsed, source: body.source };
      }
    } catch {
      // Backend nicht erreichbar -> lokaler Fallback unten.
    }
  }
  return { parsed: parseGoalText(text), source: 'local' };
}
