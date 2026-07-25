import type { RaceDistance } from '../domain/athlete';

// Ernährungscoach für Läufer. Grundlage: Recherche (ACSM/ISSN-Kohlenhydrat-
// Periodisierung, Thomas/Erdman/Burke 2016, Burke 2011, u.a.) + benannte Sport-RD-
// Rezepte. WICHTIG (Vorbehalte der Recherche): Makros nur angeben, wo die Quelle
// sie nennt (keine erfundenen Zahlen). „Run Fast. Eat Slow." – Autorinnen sind
// KEINE RDs und der Verlag nennt keine Makros. Eisen immer food-first + ärztlich
// begleitet, nie pauschale Supplementierung. Keine medizinische Beratung.

export type NutritionPhase = 'preRun' | 'postRun' | 'fuel' | 'raceWeek' | 'iron';

export interface Macros {
  calories?: number;
  carbG?: number;
  proteinG?: number;
  fatG?: number;
  fiberG?: number;
  ironMg?: number;
}

export interface NutritionRecipe {
  id: string;
  title: string;
  phase: NutritionPhase;
  source: string; // benannte Quelle inkl. Credential
  ingredients: string[]; // kurze Inspiration, NICHT der Originaltext
  macros?: Macros; // nur wo die Quelle sie angibt
  note?: string;
  /** true = Quelle liefert bewusst keine Makros / Autor:innen sind keine RDs. */
  noMacrosByDesign?: boolean;
}

export const NUTRITION_PHASE_LABEL: Record<NutritionPhase, string> = {
  preRun: 'Vor dem Lauf',
  postRun: 'Nach dem Lauf (Regeneration)',
  fuel: 'Energie-Mahlzeit (harte/lange Tage)',
  raceWeek: 'Wettkampfwoche (Carb-Load)',
  iron: 'Eisenreich',
};

export const NUTRITION_LIBRARY: NutritionRecipe[] = [
  // --- Pre-Run: kohlenhydratbetont, fett-/ballaststoffarm, ~2–3 h vorher --------
  {
    id: 'pre-toast-banane',
    title: 'Toast/Bagel + Banane + etwas Honig',
    phase: 'preRun',
    source: 'Sarah Schlichter, MPH, RDN (Bucket List Tummy)',
    ingredients: ['Toast oder halber Bagel', 'Banane', 'etwas Honig'],
    note: '2–3 h vorher · kohlenhydratbetont, fett- und ballaststoffarm.',
  },
  {
    id: 'pre-cream-of-rice',
    title: 'Cream of Rice mit Ahornsirup + Sportgetränk',
    phase: 'preRun',
    source: 'Alex Larson, RD',
    ingredients: ['Reisgrieß (Cream of Rice)', 'Ahornsirup', 'Sportgetränk'],
    note: 'Race-Day-Frühstück ~2–3 h vorher · leicht verdaulich.',
  },
  {
    id: 'pre-oatmeal',
    title: 'Haferflocken mit Banane',
    phase: 'preRun',
    source: 'Sarah Schlichter, MPH, RDN (Bucket List Tummy)',
    ingredients: ['Haferflocken', 'Banane', 'Wasser oder wenig Milch'],
    note: 'Bei >60 min Läufen 30–60 g KH vorher, 30–60 g KH/h während.',
  },
  // --- Post-Run: ~3:1–4:1 Carb:Protein -----------------------------------------
  {
    id: 'post-pb-banana-smoothie',
    title: 'Peanut-Butter-Banana-Oat-Smoothie',
    phase: 'postRun',
    source: 'Kylee Van Horn, RDN (FlyNutrition)',
    ingredients: ['Banane', 'Haferflocken', 'Erdnussbutter', 'Milch'],
    macros: { calories: 389, carbG: 48, proteinG: 12, fatG: 20 },
    note: 'Sauberes 4:1 Carb:Protein · ideal nach dem langen Lauf.',
  },
  {
    id: 'post-yogurt-parfait',
    title: 'Joghurt-Beeren-Granola-Parfait',
    phase: 'postRun',
    source: 'Kylee Van Horn, RDN (FlyNutrition)',
    ingredients: ['Joghurt', 'Beeren', 'Granola'],
    note: 'Richtwert 3:1 (≈45–60 g KH, 15–20 g Protein).',
  },
  {
    id: 'post-cant-beet-me',
    title: '„Can’t Beet Me“ Recovery-Smoothie',
    phase: 'postRun',
    source: 'Kochbuch „Run Fast. Eat Slow." (S. Flanagan & E. Kopecky)',
    ingredients: ['Rote Bete', 'Beeren', 'Banane', 'Ingwer', 'Mandelmilch/Joghurt'],
    note: 'Nur als Inspiration – Autorinnen sind keine RDs, der Verlag nennt keine Nährwerte.',
    noMacrosByDesign: true,
  },
  // --- Fuel: harte/lange Trainingstage -----------------------------------------
  {
    id: 'fuel-sweetpotato-mac',
    title: 'Süßkartoffel-Mac-and-Cheese-Auflauf',
    phase: 'fuel',
    source: 'Sarah Schlichter, MPH, RDN (Bucket List Tummy)',
    ingredients: ['Süßkartoffel', 'Vollkornnudeln', 'Grünkohl', 'Eier', 'fettarme Milch', 'Mozzarella'],
    macros: { calories: 438, carbG: 60, proteinG: 20, fatG: 16, fiberG: 9 },
    note: 'Sauberes 3:1 · passt vor dem langen Lauf und danach.',
  },
  // --- Race-Week: Carb-Load ------------------------------------------------------
  {
    id: 'race-pasta',
    title: 'Pasta mit Hähnchen oder Hackbällchen',
    phase: 'raceWeek',
    source: 'Emily Moore, RD, CPT (The Dietitian Runner)',
    ingredients: ['Weiße Pasta', 'Hähnchen/Hackbällchen', 'einfache Tomatensauce'],
    note: '8–12 g/kg/Tag, 2–3 Tage vorher · einfache Carbs, wenig Ballaststoffe/Fett.',
  },
  {
    id: 'race-rice-salmon',
    title: 'Reis + Lachs + Süßkartoffel',
    phase: 'raceWeek',
    source: 'Emily Moore, RD, CPT (The Dietitian Runner)',
    ingredients: ['Reis', 'Lachs oder Tofu', 'Süßkartoffel'],
    note: 'Nancy Clark, MS, RD, CSSD: weiße Pasta/Reis sind okay – mit Proteinquelle zur runden Mahlzeit.',
  },
  // --- Iron: food-first ---------------------------------------------------------
  {
    id: 'iron-greek-lentil-bowl',
    title: 'Griechische Linsen-Power-Bowl',
    phase: 'iron',
    source: 'Natalie Rizzo, MS, RD (Greenletes / Planted Performance)',
    ingredients: ['Braune Linsen', 'griech. Joghurt', 'Dill', 'Zitrone', 'Gurke', 'Kirschtomate', 'Kichererbsen', 'Feta'],
    macros: { calories: 333, carbG: 52, proteinG: 23, fatG: 4, fiberG: 22, ironMg: 6 },
    note: 'Pflanzeneisen (Nicht-Häm) mit Vitamin C für bessere Aufnahme.',
  },
];

export function recipesForPhase(phase: NutritionPhase): NutritionRecipe[] {
  return NUTRITION_LIBRARY.filter((r) => r.phase === phase);
}

// ---- Guidance-Rechner (pure, testbar) ---------------------------------------

/** Pre-Run-Kohlenhydrate: 1–4 g/kg, ~1 g/kg bei 1 h Vorlauf, mehr mit mehr Zeit. */
export function preRunCarb(weightKg: number, hoursBefore: number): { perKg: number; grams: number } {
  const perKg = Math.min(4, Math.max(1, Math.round(hoursBefore)));
  return { perKg, grams: Math.round(weightKg * perKg) };
}

/** Post-Run-Regeneration: ~1,0–1,2 g/kg/h KH + ~0,3 g/kg Protein (hier 1-h-Fenster). */
export function postRunRecovery(weightKg: number): { carbG: number; proteinG: number } {
  return { carbG: Math.round(weightKg * 1.1), proteinG: Math.round(weightKg * 0.3) };
}

/**
 * Wettkampfwochen-Kohlenhydrate pro Tag. Voller Carb-Load (10–12 g/kg/Tag) nur für
 * Events > 90 min (Halbmarathon/Marathon); 5k/10k brauchen nur ein Top-up (6–7 g/kg).
 */
export function raceWeekCarbPerDay(
  weightKg: number,
  distance: RaceDistance,
): { perKgLow: number; perKgHigh: number; grams: number; fullLoad: boolean } {
  const fullLoad = distance === 'half' || distance === 'marathon' || distance === 'custom';
  const perKgLow = fullLoad ? 10 : 6;
  const perKgHigh = fullLoad ? 12 : 7;
  const perKg = (perKgLow + perKgHigh) / 2;
  return { perKgLow, perKgHigh, grams: Math.round(weightKg * perKg), fullLoad };
}

export const IRON_GUIDANCE =
  'Ausdauersport erhöht das Eisenmangel-Risiko. Food-first: Häm-Eisen (mageres Fleisch, Fisch, Eigelb) bevorzugen; Nicht-Häm-Eisen (Linsen, Bohnen, dunkles Blattgemüse) mit Vitamin C kombinieren; Kaffee/Tee/Calcium zeitlich trennen. Ein Ferritin unter ~35 µg/L signalisiert leere Speicher – Supplementierung nur ärztlich begleitet, nie pauschal.';

export const NUTRITION_DISCLAIMER =
  'Allgemeine, quellenbasierte Orientierung – keine individuelle Ernährungs- oder medizinische Beratung.';
