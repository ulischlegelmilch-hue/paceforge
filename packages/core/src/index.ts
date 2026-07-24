// Öffentliche API des Kernpakets @paceforge/core.

// Domain-Typen
export * from './domain/athlete';
export * from './domain/workout';
export * from './domain/plan';
export * from './domain/activity';

// Delivery-Abstraktion
export * from './delivery/WorkoutDeliveryProvider';

// VDOT-Engine
export * from './vdot/formulas';
export * from './vdot/zones';
export * from './vdot/profile';

// Plan-Generierung
export * from './planner/workouts';
export * from './planner/generatePlan';

// Aktivitäts-Auswertung & Adaption (framework-agnostisch, kein FIT-SDK)
export * from './adaptation/adapt';

// Natürlichsprachliche Zieleingabe (regelbasiert)
export * from './nlp/parseGoal';

// Utilities
export * from './util/pace';
