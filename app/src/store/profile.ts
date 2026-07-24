import { create } from 'zustand';
import {
  generatePlan,
  vdotFromFitness,
  type AthleteProfile,
  type FitnessInput,
  type Goal,
  type TrainingPlan,
} from '@paceforge/core';

// In-Memory-Store für Profil + generierten Trainingsplan (MVP). Persistenz via
// expo-sqlite ist als Folgeschritt vorgesehen. Profil-Erstellung + Plan-Generierung
// liegen vollständig in @paceforge/core und sind dort unit-getestet.

interface CreateProfileInput {
  goal: Goal;
  fitness: FitnessInput;
  daysPerWeek: number;
  longRunDay?: number;
}

interface ProfileState {
  profile: AthleteProfile | null;
  plan: TrainingPlan | null;
  createProfile: (input: CreateProfileInput) => AthleteProfile;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  plan: null,
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
    set({ profile, plan });
    return profile;
  },
  reset: () => set({ profile: null, plan: null }),
}));
