import { create } from 'zustand';
import {
  vdotFromFitness,
  type AthleteProfile,
  type FitnessInput,
  type Goal,
} from '@paceforge/core';

// In-Memory-Profilstore (MVP). Persistenz via expo-sqlite ist als Folgeschritt
// vorgesehen; die Erstellung des AthleteProfile inkl. VDOT-Ableitung liegt aber
// schon vollständig in @paceforge/core und ist damit unit-getestet.

interface CreateProfileInput {
  goal: Goal;
  fitness: FitnessInput;
  daysPerWeek: number;
  longRunDay?: number;
}

interface ProfileState {
  profile: AthleteProfile | null;
  createProfile: (input: CreateProfileInput) => AthleteProfile;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
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
    set({ profile });
    return profile;
  },
  reset: () => set({ profile: null }),
}));
