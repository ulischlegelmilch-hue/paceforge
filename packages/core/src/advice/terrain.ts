// Gelände-Einschätzung fürs Zielrennen: eine grobe, selbst eingeschätzte
// Höhenmeter-pro-Kilometer-Kategorie der Strecke. Getrennt vom `grade`-Modul
// (das rückwirkend tatsächliche Läufe/Testläufe fair bewertet) – hier geht es
// vorausschauend darum, ob das Training gezielt Bergreize braucht.

export type CourseTerrain = 'flat' | 'rolling' | 'moderate' | 'hilly';

export const TERRAIN_LABEL: Record<CourseTerrain, string> = {
  flat: 'Flach',
  rolling: 'Leicht hügelig',
  moderate: 'Moderat',
  hilly: 'Bergig',
};

/** Grobe Orientierung in Höhenmeter/km – zur Einordnung im Onboarding. */
export const TERRAIN_RANGE_LABEL: Record<CourseTerrain, string> = {
  flat: 'unter 5 Hm/km',
  rolling: 'etwa 5–10 Hm/km',
  moderate: 'etwa 10–20 Hm/km',
  hilly: 'über 20 Hm/km',
};

/** Trainings-Hinweis passend zur gewählten Geländekategorie. */
export function terrainAdvice(terrain: CourseTerrain): string {
  switch (terrain) {
    case 'flat':
      return 'Deine Strecke ist flach – kein gezieltes Bergtraining nötig, Fokus bleibt auf Tempo/Ausdauer.';
    case 'rolling':
      return 'Leicht hügelig – baue gelegentlich sanfte Anstiege in deine lockeren Läufe ein, um dich daran zu gewöhnen.';
    case 'moderate':
      return 'Moderates Profil – plane etwa alle 1–2 Wochen einen Lauf mit spürbaren Anstiegen ein, idealerweise im Long Run.';
    case 'hilly':
      return 'Bergige Strecke – integriere regelmäßig gezieltes Bergtraining (kurze knackige Anstiege UND lange Anstiege im Long Run), damit dein Körper am Renntag vorbereitet ist.';
  }
}
