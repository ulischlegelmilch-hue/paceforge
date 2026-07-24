import { create } from 'zustand';
import {
  applyVdotAdaptation,
  generatePlan,
  vdotFromFitness,
  type AdaptationResult,
  type AthleteProfile,
  type CompletedActivity,
  type FitnessInput,
  type Goal,
  type TrainingPlan,
} from '@paceforge/core';

// In-Memory-Store für Profil, generierten Trainingsplan und importierte Aktivitäten
// (MVP). Persistenz via expo-sqlite ist als Folgeschritt vorgesehen. Profil-Erstellung,
// Plan-Generierung und Adaption liegen vollständig in @paceforge/core (unit-getestet).

interface CreateProfileInput {
  goal: Goal;
  fitness: FitnessInput;
  daysPerWeek: number;
  longRunDay?: number;
}

interface ProfileState {
  profile: AthleteProfile | null;
  plan: TrainingPlan | null;
  activities: CompletedActivity[];
  createProfile: (input: CreateProfileInput) => AthleteProfile;
  addActivity: (activity: CompletedActivity) => void;
  applyAdaptation: (result: AdaptationResult) => void;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  plan: null,
  activities: [],
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
    };
    const plan = generatePlan(profile);
    set({ profile, plan, activities: [] });
    return profile;
  },
  addActivity: (activity) => set((s) => ({ activities: [...s.activities, activity] })),
  applyAdaptation: (result) =>
    set((s) => {
      if (!s.profile) return s;
      const profile = applyVdotAdaptation(s.profile, result);
      const plan = generatePlan(profile);
      return { profile, plan };
    }),
  reset: () => set({ profile: null, plan: null, activities: [] }),
}));
