import type { Workout } from './workout';

export type TrainingMethod = 'daniels-vdot' | 'polarized-80-20';

export type ScheduledWorkoutStatus = 'planned' | 'completed' | 'skipped' | 'modified';

export interface ScheduledWorkout {
  date: string;                       // ISO
  dayOfWeek: number;                  // 0=So .. 6=Sa
  workout: Workout;
  status: ScheduledWorkoutStatus;
  completedActivityId?: string;
}

export type PlanPhase = 'base' | 'build' | 'peak' | 'taper' | 'maintenance';

export interface PlanWeek {
  index: number;                      // 0-basiert
  phase: PlanPhase;
  targetWeeklyDistanceMeters: number;
  workouts: ScheduledWorkout[];
}

export interface TrainingPlan {
  id: string;
  athleteId: string;
  createdAt: string;                  // ISO
  method: TrainingMethod;
  weeks: PlanWeek[];
  raceDate?: string;                  // ISO
}
