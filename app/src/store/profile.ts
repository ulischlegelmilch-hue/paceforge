import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  applyAdaptation as applyAdaptationCore,
  equipmentFromOwnedItems,
  generatePlan,
  gradeAdjustedDistance,
  mergePreservingHistory,
  vdotFromFitness,
  vdotFromRace,
  type AdaptationResult,
  type AthleteProfile,
  type CompletedActivity,
  type EquipmentItem,
  type FitnessInput,
  type Goal,
  type ScheduledWorkoutStatus,
  type TrainingPlan,
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
  createProfile: (input: CreateProfileInput) => AthleteProfile;
  addActivity: (activity: CompletedActivity) => void;
  /** Wie addActivity, aber für mehrere auf einmal - überspringt bereits vorhandene IDs (z. B. Doppel-Abruf von Garmin). */
  addActivities: (activities: CompletedActivity[]) => void;
  /** Setzt den Status einer geplanten Einheit (z. B. manuell "erledigt" ohne FIT-Import, oder "skipped"). */
  setWorkoutStatus: (weekIndex: number, dayOfWeek: number, status: ScheduledWorkoutStatus) => void;
  /** Tauscht die Inhalte zweier Tage DERSELBEN Woche (Datum/Wochentag jedes Slots bleiben fix). */
  moveWorkout: (weekIndex: number, fromDayOfWeek: number, toDayOfWeek: number) => void;
  applyAdaptation: (result: AdaptationResult) => void;
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

function makeDeviceId(): string {
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
  profile: null,
  plan: null,
  activities: [],
  deviceId: makeDeviceId(),
  lastSyncedAt: null,
  setLastSyncedAt: (at) => set({ lastSyncedAt: at }),
  garminLastPullAt: null,
  setGarminLastPullAt: (at) => set({ garminLastPullAt: at }),
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
  addActivity: (activity) => set((s) => ({ activities: [...s.activities, activity] })),
  addActivities: (newActivities) =>
    set((s) => {
      const existingIds = new Set(s.activities.map((a) => a.id));
      const fresh = newActivities.filter((a) => !existingIds.has(a.id));
      return fresh.length > 0 ? { activities: [...s.activities, ...fresh] } : s;
    }),
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
      plan: snap.plan,
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
      }),
    },
  ),
);
