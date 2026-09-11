import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  applyAdaptation as applyAdaptationCore,
  applyPlanEvent as applyPlanEventCore,
  applyReturnRamp as applyReturnRampCore,
  applyWeekLightening as applyWeekLighteningCore,
  equipmentFromOwnedItems,
  generatePlan,
  gradeAdjustedDistance,
  matchActivity,
  mergePreservingHistory,
  removePlanEvent as removePlanEventCore,
  vdotFromFitness,
  vdotFromRace,
  type AdaptationResult,
  type AthleteProfile,
  type CompletedActivity,
  type EquipmentItem,
  type FitnessInput,
  type Goal,
  type PlanEvent,
  type PlanEventStatus,
  type ReturnRampAssessment,
  type ScheduledWorkoutStatus,
  type TrainingPlan,
  type WeeklyAnalysis,
  type WeekLighteningAssessment,
  type Workout,
} from '@paceforge/core';

import { createPersistStorage } from './storage';

// In-Memory-Store für Profil, generierten Trainingsplan und importierte Aktivitäten
// (MVP). Persistenz via expo-sqlite ist als Folgeschritt vorgesehen. Profil-Erstellung,
// Plan-Generierung und Adaption liegen vollständig in @paceforge/core (unit-getestet).

interface CreateProfileInput {
  goal: Goal;
  fitness: FitnessInput;
  daysPerWeek: number;
  longRunDay?: number;
  /** Wochentag des ersten Laufs der Woche (0=So..6=Sa) – verschiebt das gesamte Tages-Muster. */
  weekStartDay?: number;
  /** Wochentage, an denen grundsätzlich trainiert werden kann (0=So..6=Sa). */
  availableDays?: number[];
  strength?: { sessionsPerWeek: number; equipment: 'gym' | 'bodyweight' };
  /** Gewünschtes Startdatum des Plans (Default: heute). */
  startDate?: Date;
}

interface SnapshotInput {
  profile: AthleteProfile | null;
  plan: TrainingPlan | null;
  activities: CompletedActivity[];
  /** Serverstand des Snapshots (setzt `lastSyncedAt`, falls vorhanden). */
  updatedAt?: string;
}

interface ProfileState {
  profile: AthleteProfile | null;
  plan: TrainingPlan | null;
  activities: CompletedActivity[];
  /** Stabile Geräte-ID als Sync-Schlüssel (einmalig erzeugt, persistiert). */
  deviceId: string;
  /**
   * `updatedAt` des zuletzt gesehenen Cloud-Stands. Wird beim Sichern mitgeschickt,
   * damit der Server erkennt, ob inzwischen ein anderes Gerät geschrieben hat.
   */
  lastSyncedAt: string | null;
  setLastSyncedAt: (at: string | null) => void;
  /** ISO-Zeitpunkt des zuletzt von Garmin übernommenen Laufs (Cursor für den nächsten Abruf). */
  garminLastPullAt: string | null;
  setGarminLastPullAt: (at: string | null) => void;
  /** Einmalig mit Max' PaceForge-Kids-App ausgetauschter Kopplungs-Code (siehe /max). */
  kidsChildCode: string | null;
  setKidsChildCode: (code: string | null) => void;
  /** Überschreibt die geplante Einheit an einem konkreten Datum (z. B. "Max' Training übernehmen"). */
  overrideWorkoutForDate: (date: string, workout: Workout) => void;
  createProfile: (input: CreateProfileInput) => AthleteProfile;
  addActivity: (activity: CompletedActivity) => void;
  /** Wie addActivity, aber für mehrere auf einmal - überspringt bereits vorhandene IDs (z. B. Doppel-Abruf von Garmin). */
  addActivities: (activities: CompletedActivity[]) => void;
  /** Ordnet eine Aktivität manuell einem ANDEREN Plan-Tag zu (z. B. ein Lauf, der ein
   *  verpasstes Training vom Vortag nachholt) - überschreibt die automatische
   *  Gleicher-Kalendertag-Zuordnung aus matchActivity/linkActivity. */
  relinkActivity: (activityId: string, date: string) => void;
  /** Setzt den Status einer geplanten Einheit (z. B. manuell "erledigt" ohne FIT-Import, oder "skipped"). */
  setWorkoutStatus: (weekIndex: number, dayOfWeek: number, status: ScheduledWorkoutStatus) => void;
  /** Tauscht die Inhalte zweier Tage DERSELBEN Woche (Datum/Wochentag jedes Slots bleiben fix). */
  moveWorkout: (weekIndex: number, fromDayOfWeek: number, toDayOfWeek: number) => void;
  applyAdaptation: (result: AdaptationResult) => void;
  /** Trägt ein Zwischenevent (Ad-hoc-Wettkampf) ein: Wettkampf-Tag + Taper/Erholung im Plan. */
  addRaceEvent: (input: {
    date: string;
    distanceMeters: number;
    name?: string;
    targetTimeSeconds?: number;
  }) => PlanEventStatus;
  /** Entfernt ein Zwischenevent wieder, stellt das betroffene Zeitfenster zurück. */
  removeRaceEvent: (eventId: string) => void;
  /** Wendet eine Rückkehr-Rampe nach einer Trainingspause an (siehe returnToRunning.ts). */
  applyReturnRamp: (assessment: ReturnRampAssessment) => void;
  /** Dämpft die restlichen geplanten Einheiten der Woche nach viel planfremdem Laufen. */
  applyWeekLightening: (assessment: WeekLighteningAssessment, analysis: WeeklyAnalysis) => void;
  /** Fitness aus einer neuen Bestzeit/Testleistung neu berechnen (VDOT + Plan). */
  updateFitnessFromRace: (input: {
    distanceMeters: number;
    timeSeconds: number;
    ascentMeters?: number;
  }) => void;
  setStrengthEquipment: (equipment: 'gym' | 'bodyweight') => void;
  setOwnedEquipment: (ownedEquipment: EquipmentItem[]) => void;
  setStrengthSessions: (sessionsPerWeek: number) => void;
  setDaysPerWeek: (daysPerWeek: number) => void;
  setWeekStartDay: (weekStartDay: number | undefined) => void;
  setAvailableDays: (availableDays: number[] | undefined) => void;
  setWeightKg: (kg: number | undefined) => void;
  hydrateFromSnapshot: (snap: SnapshotInput) => void;
  reset: () => void;
}

function patchProfile(
  s: { profile: AthleteProfile | null },
  patch: Partial<AthleteProfile>,
): { profile: AthleteProfile | null } {
  if (!s.profile) return s;
  return { profile: { ...s.profile, ...patch } };
}

/**
 * Ordnet eine neu übernommene Aktivität einmalig der geplanten Einheit desselben
 * Tages zu und schreibt das Ergebnis in `linkedScheduledWorkoutDate`, statt es bei
 * jedem Render neu zu berechnen (siehe activities.tsx) - macht die Zuordnung
 * stabil gegenüber späteren Plan-Neuberechnungen (mergePreservingHistory).
 */
function linkActivity(plan: TrainingPlan | null, activity: CompletedActivity): CompletedActivity {
  if (!plan || activity.linkedScheduledWorkoutDate) return activity;
  const matched = matchActivity(plan, activity);
  return matched ? { ...activity, linkedScheduledWorkoutDate: matched.date } : activity;
}

function makeDeviceId(): string {
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeEventId(): string {
  return `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Migrations-Reparatur: Pläne, die VOR der Wochenstart-Montag-Umstellung
// generiert wurden, gruppieren ihre PlanWeek-Blöcke noch So-Sa (siehe
// project-Notiz "WOCHENSTART AUF MONTAG UMGESTELLT") - ein an einem Sonntag
// eingetragener Wettkampf landet dadurch in der Anzeige fälschlich in der
// "nächsten Woche" statt der laufenden. Erkennbar daran, dass der erste Tag
// von Woche 0 kein Montag ist. Regeneriert den Plan mit demselben Startdatum
// (jetzt Montag-anchored) und behält per mergePreservingHistory alle bereits
// erledigten/übersprungenen/modifizierten Tage (inkl. eingetragener Wettkämpfe,
// die als "modified" markiert sind) unverändert bei - nur die Wochen-Gruppierung
// wird korrigiert, kein Trainingsinhalt geht verloren.
function repairWeekAnchorIfNeeded(profile: AthleteProfile | null, plan: TrainingPlan | null): TrainingPlan | null {
  const firstDate = plan?.weeks[0]?.workouts[0]?.date;
  if (!profile || !plan || !firstDate) return plan;
  const isMondayAnchored = new Date(`${firstDate}T00:00:00`).getDay() === 1;
  if (isMondayAnchored) return plan;
  const startDate = new Date(`${firstDate}T00:00:00`);
  return mergePreservingHistory(plan, generatePlan(profile, { startDate }));
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
  profile: null,
  plan: null,
  activities: [],
  deviceId: makeDeviceId(),
  lastSyncedAt: null,
  setLastSyncedAt: (at) => set({ lastSyncedAt: at }),
  garminLastPullAt: null,
  setGarminLastPullAt: (at) => set({ garminLastPullAt: at }),
  kidsChildCode: null,
  setKidsChildCode: (code) => set({ kidsChildCode: code }),
  overrideWorkoutForDate: (date, workout) =>
    set((s) => {
      if (!s.plan) return s;
      const weeks = s.plan.weeks.map((w) => {
        const workouts = w.workouts.map((sw) => (sw.date === date ? { ...sw, workout, status: 'modified' as const } : sw));
        return {
          ...w,
          workouts,
          targetWeeklyDistanceMeters: workouts.reduce((sum, sw) => sum + (sw.workout.estimatedDistanceMeters ?? 0), 0),
        };
      });
      return { plan: { ...s.plan, weeks } };
    }),
  createProfile: ({ goal, fitness, daysPerWeek, longRunDay, weekStartDay, availableDays, strength, startDate }) => {
    const profile: AthleteProfile = {
      id: `athlete-${Date.now()}`,
      createdAt: new Date().toISOString(),
      goal,
      fitness,
      currentVdot: Math.round(vdotFromFitness(fitness) * 10) / 10,
      daysPerWeek,
      longRunDay,
      weekStartDay,
      availableDays,
      units: 'metric',
      strength: strength ?? { sessionsPerWeek: 2, equipment: 'bodyweight' },
    };
    const plan = generatePlan(profile, { startDate });
    set({ profile, plan, activities: [] });
    return profile;
  },
  addActivity: (activity) =>
    set((s) => ({ activities: [...s.activities, linkActivity(s.plan, activity)] })),
  addActivities: (newActivities) =>
    set((s) => {
      const existingIds = new Set(s.activities.map((a) => a.id));
      const fresh = newActivities.filter((a) => !existingIds.has(a.id)).map((a) => linkActivity(s.plan, a));
      return fresh.length > 0 ? { activities: [...s.activities, ...fresh] } : s;
    }),
  relinkActivity: (activityId, date) =>
    set((s) => ({
      activities: s.activities.map((a) => (a.id === activityId ? { ...a, linkedScheduledWorkoutDate: date } : a)),
    })),
  setWorkoutStatus: (weekIndex, dayOfWeek, status) =>
    set((s) => {
      if (!s.plan) return s;
      const weeks = s.plan.weeks.map((w) =>
        w.index !== weekIndex
          ? w
          : { ...w, workouts: w.workouts.map((wo) => (wo.dayOfWeek === dayOfWeek ? { ...wo, status } : wo)) },
      );
      return { plan: { ...s.plan, weeks } };
    }),
  moveWorkout: (weekIndex, fromDayOfWeek, toDayOfWeek) =>
    set((s) => {
      if (!s.plan || fromDayOfWeek === toDayOfWeek) return s;
      // Status "planned" wird beim Tausch zu "modified", damit spätere Plan-
      // Neuberechnungen (mergePreservingHistory) den Tausch nicht stillschweigend
      // rückgängig machen (siehe mergePlan.ts: nur status!=='planned' bleibt erhalten).
      // Bereits erledigte/übersprungene Tage behalten ihren Status - der reist
      // mit dem Workout-Inhalt mit, weil er beschreibt, ob DIESES Training
      // stattgefunden hat.
      const carryStatus = (status: ScheduledWorkoutStatus): ScheduledWorkoutStatus =>
        status === 'planned' ? 'modified' : status;
      const weeks = s.plan.weeks.map((w) => {
        if (w.index !== weekIndex) return w;
        const from = w.workouts.find((wo) => wo.dayOfWeek === fromDayOfWeek);
        const to = w.workouts.find((wo) => wo.dayOfWeek === toDayOfWeek);
        if (!from || !to) return w;
        const workouts = w.workouts.map((wo) => {
          if (wo.dayOfWeek === fromDayOfWeek) {
            return { ...wo, workout: to.workout, status: carryStatus(to.status), completedActivityId: to.completedActivityId };
          }
          if (wo.dayOfWeek === toDayOfWeek) {
            return { ...wo, workout: from.workout, status: carryStatus(from.status), completedActivityId: from.completedActivityId };
          }
          return wo;
        });
        return {
          ...w,
          workouts,
          targetWeeklyDistanceMeters: workouts.reduce((sum, wo) => sum + (wo.workout.estimatedDistanceMeters ?? 0), 0),
        };
      });
      return { plan: { ...s.plan, weeks } };
    }),
  applyAdaptation: (result) =>
    set((s) => {
      if (!s.profile || !s.plan) return s;
      return applyAdaptationCore(s.profile, s.plan, result);
    }),
  addRaceEvent: (input) => {
    const { profile, plan } = get();
    if (!profile || !plan) return 'out-of-range';
    const event: PlanEvent = {
      id: makeEventId(),
      date: input.date,
      distanceMeters: input.distanceMeters,
      ...(input.name ? { name: input.name } : {}),
      ...(input.targetTimeSeconds ? { targetTimeSeconds: input.targetTimeSeconds } : {}),
    };
    const result = applyPlanEventCore(plan, event, profile.currentVdot, new Date());
    if (result.status === 'applied') {
      const raceEvents = [...(profile.raceEvents ?? []), event];
      set({ profile: { ...profile, raceEvents }, plan: result.plan });
    }
    return result.status;
  },
  removeRaceEvent: (eventId) => {
    const { profile, plan } = get();
    if (!profile || !plan) return;
    const event = profile.raceEvents?.find((e) => e.id === eventId);
    if (!event) return;
    const raceEvents = profile.raceEvents!.filter((e) => e.id !== eventId);
    const profileWithoutEvent: AthleteProfile = { ...profile, raceEvents };
    const newPlan = removePlanEventCore(plan, profileWithoutEvent, event, new Date());
    set({ profile: profileWithoutEvent, plan: newPlan });
  },
  applyReturnRamp: (assessment) =>
    set((s) => {
      if (!s.profile || !s.plan) return s;
      const plan = applyReturnRampCore(s.plan, assessment, s.profile.currentVdot, new Date());
      return { plan };
    }),
  applyWeekLightening: (assessment, analysis) =>
    set((s) => {
      if (!s.plan) return s;
      const plan = applyWeekLighteningCore(s.plan, assessment, analysis, new Date());
      return { plan };
    }),
  updateFitnessFromRace: ({ distanceMeters, timeSeconds, ascentMeters }) =>
    set((s) => {
      if (!s.profile) return s;
      const eq = gradeAdjustedDistance(distanceMeters, ascentMeters ?? 0);
      const currentVdot = Math.round(vdotFromRace(eq, timeSeconds) * 10) / 10;
      const profile: AthleteProfile = {
        ...s.profile,
        currentVdot,
        fitness: {
          ...s.profile.fitness,
          recentRace: { distanceMeters, timeSeconds, ...(ascentMeters ? { ascentMeters } : {}) },
        },
      };
      // Plan mit den neuen Pace-Zonen neu generieren, Startdatum erhalten.
      const startIso = s.plan?.weeks[0]?.workouts[0]?.date;
      const startDate = startIso ? new Date(`${startIso}T00:00:00`) : undefined;
      let plan = generatePlan(profile, { startDate });
      if (s.plan) plan = mergePreservingHistory(s.plan, plan);
      return { profile, plan };
    }),
  setStrengthEquipment: (equipment) =>
    set((s) => {
      if (!s.profile) return s;
      const strength = { sessionsPerWeek: s.profile.strength?.sessionsPerWeek ?? 2, equipment };
      return patchProfile(s, { strength });
    }),
  setOwnedEquipment: (ownedEquipment) =>
    set((s) => {
      if (!s.profile) return s;
      const strength = {
        sessionsPerWeek: s.profile.strength?.sessionsPerWeek ?? 2,
        equipment: equipmentFromOwnedItems(ownedEquipment),
        ownedEquipment,
      };
      return patchProfile(s, { strength });
    }),
  setStrengthSessions: (sessionsPerWeek) =>
    set((s) => {
      if (!s.profile) return s;
      const strength = {
        sessionsPerWeek: Math.max(0, Math.min(3, Math.round(sessionsPerWeek))),
        equipment: s.profile.strength?.equipment ?? 'bodyweight',
      };
      return patchProfile(s, { strength });
    }),
  setDaysPerWeek: (daysPerWeek) =>
    set((s) => {
      if (!s.profile || !s.plan) return s;
      const days = Math.max(3, Math.min(6, Math.round(daysPerWeek)));
      const profile: AthleteProfile = { ...s.profile, daysPerWeek: days };
      const startIso = s.plan.weeks[0]?.workouts[0]?.date;
      const startDate = startIso ? new Date(`${startIso}T00:00:00`) : undefined;
      const plan = mergePreservingHistory(s.plan, generatePlan(profile, { startDate }));
      return { profile, plan };
    }),
  setWeekStartDay: (weekStartDay) =>
    set((s) => {
      if (!s.profile || !s.plan) return s;
      const profile: AthleteProfile = { ...s.profile, weekStartDay };
      const startIso = s.plan.weeks[0]?.workouts[0]?.date;
      const startDate = startIso ? new Date(`${startIso}T00:00:00`) : undefined;
      const plan = mergePreservingHistory(s.plan, generatePlan(profile, { startDate }));
      return { profile, plan };
    }),
  setAvailableDays: (availableDays) =>
    set((s) => {
      if (!s.profile || !s.plan) return s;
      // Nie mehr Trainingstage verlangen, als verfügbare Tage gewählt sind.
      const daysPerWeek =
        availableDays && availableDays.length > 0
          ? Math.min(s.profile.daysPerWeek, availableDays.length)
          : s.profile.daysPerWeek;
      const profile: AthleteProfile = { ...s.profile, availableDays, daysPerWeek };
      const startIso = s.plan.weeks[0]?.workouts[0]?.date;
      const startDate = startIso ? new Date(`${startIso}T00:00:00`) : undefined;
      const plan = mergePreservingHistory(s.plan, generatePlan(profile, { startDate }));
      return { profile, plan };
    }),
  setWeightKg: (kg) => set((s) => patchProfile(s, { weightKg: kg })),
  hydrateFromSnapshot: (snap) =>
    set({
      profile: snap.profile,
      plan: repairWeekAnchorIfNeeded(snap.profile, snap.plan),
      activities: snap.activities ?? [],
      ...(snap.updatedAt ? { lastSyncedAt: snap.updatedAt } : {}),
    }),
  reset: () => set({ profile: null, plan: null, activities: [], lastSyncedAt: null, garminLastPullAt: null }),
    }),
    {
      name: 'paceforge-store',
      storage: createJSONStorage(() => createPersistStorage()),
      // Nur Daten persistieren (keine Aktionen).
      partialize: (s) => ({
        profile: s.profile,
        plan: s.plan,
        activities: s.activities,
        deviceId: s.deviceId,
        lastSyncedAt: s.lastSyncedAt,
        garminLastPullAt: s.garminLastPullAt,
        kidsChildCode: s.kidsChildCode,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const repairedPlan = repairWeekAnchorIfNeeded(state.profile, state.plan);
        if (repairedPlan !== state.plan) {
          useProfileStore.setState({ plan: repairedPlan });
        }
      },
    },
  ),
);
