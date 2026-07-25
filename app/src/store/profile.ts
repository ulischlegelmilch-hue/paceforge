import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  applyAdaptation as applyAdaptationCore,
  generatePlan,
  vdotFromFitness,
  vdotFromRace,
  type AdaptationResult,
  type AthleteProfile,
  type CompletedActivity,
  type FitnessInput,
  type Goal,
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
}

interface SnapshotInput {
  profile: AthleteProfile | null;
  plan: TrainingPlan | null;
  activities: CompletedActivity[];
}

interface ProfileState {
  profile: AthleteProfile | null;
  plan: TrainingPlan | null;
  activities: CompletedActivity[];
  /** Stabile Geräte-ID als Sync-Schlüssel (einmalig erzeugt, persistiert). */
  deviceId: string;
  createProfile: (input: CreateProfileInput) => AthleteProfile;
  addActivity: (activity: CompletedActivity) => void;
  applyAdaptation: (result: AdaptationResult) => void;
  /** Fitness aus einer neuen Bestzeit/Testleistung neu berechnen (VDOT + Plan). */
  updateFitnessFromRace: (input: { distanceMeters: number; timeSeconds: number }) => void;
  setStrengthEquipment: (equipment: 'gym' | 'bodyweight') => void;
  setStrengthEnabled: (enabled: boolean) => void;
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
  createProfile: ({ goal, fitness, daysPerWeek, longRunDay }) => {
    const profile: AthleteProfile = {
      id: `athlete-${Date.now()}`,
      createdAt: new Date().toISOString(),
      goal,
      fitness,
      currentVdot: Math.round(vdotFromFitness(fitness) * 10) / 10,
      daysPerWeek,
      longRunDay,
      units: 'metric',
      strength: { enabled: true, equipment: 'bodyweight' },
    };
    const plan = generatePlan(profile);
    set({ profile, plan, activities: [] });
    return profile;
  },
  addActivity: (activity) => set((s) => ({ activities: [...s.activities, activity] })),
  applyAdaptation: (result) =>
    set((s) => {
      if (!s.profile || !s.plan) return s;
      return applyAdaptationCore(s.profile, s.plan, result);
    }),
  updateFitnessFromRace: ({ distanceMeters, timeSeconds }) =>
    set((s) => {
      if (!s.profile) return s;
      const currentVdot = Math.round(vdotFromRace(distanceMeters, timeSeconds) * 10) / 10;
      const profile: AthleteProfile = {
        ...s.profile,
        currentVdot,
        fitness: { ...s.profile.fitness, recentRace: { distanceMeters, timeSeconds } },
      };
      // Plan mit den neuen Pace-Zonen neu generieren, Startdatum erhalten.
      const startIso = s.plan?.weeks[0]?.workouts[0]?.date;
      const startDate = startIso ? new Date(`${startIso}T00:00:00`) : undefined;
      const plan = generatePlan(profile, { startDate });
      return { profile, plan };
    }),
  setStrengthEquipment: (equipment) =>
    set((s) => {
      if (!s.profile) return s;
      const strength = { enabled: s.profile.strength?.enabled ?? true, equipment };
      return patchProfile(s, { strength });
    }),
  setStrengthEnabled: (enabled) =>
    set((s) => {
      if (!s.profile) return s;
      const strength = { enabled, equipment: s.profile.strength?.equipment ?? 'bodyweight' };
      return patchProfile(s, { strength });
    }),
  setWeightKg: (kg) => set((s) => patchProfile(s, { weightKg: kg })),
  hydrateFromSnapshot: (snap) =>
    set({ profile: snap.profile, plan: snap.plan, activities: snap.activities ?? [] }),
  reset: () => set({ profile: null, plan: null, activities: [] }),
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
      }),
    },
  ),
);
