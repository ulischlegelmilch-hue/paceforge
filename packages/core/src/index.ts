// Öffentliche API des Kernpakets @paceforge/core.

// Domain-Typen
export * from './domain/athlete';
export * from './domain/workout';
export * from './domain/plan';
export * from './domain/activity';
export * from './domain/event';

// Delivery-Abstraktion
export * from './delivery/WorkoutDeliveryProvider';
export * from './garmin/workoutMapper';

// VDOT-Engine
export * from './vdot/formulas';
export * from './vdot/zones';
export * from './vdot/profile';
export * from './vdot/predict';

// Plan-Generierung
export * from './planner/workouts';
export * from './planner/generatePlan';
export * from './planner/mergePlan';
export * from './planner/maintenance';
export * from './planner/schedule';
export * from './planner/windowAdjust';
export * from './planner/events';

// Aktivitäts-Auswertung & Adaption (framework-agnostisch, kein FIT-SDK)
export * from './adaptation/adapt';
export * from './adaptation/classifyFreeRun';
export * from './adaptation/weeklyAnalysis';
export * from './adaptation/returnToRunning';
export * from './adaptation/weekLightening';

// Natürlichsprachliche Zieleingabe (regelbasiert)
export * from './nlp/parseGoal';

// Kraft-Modul + Ernährungscoach (evidenzbasiert)
export * from './strength/index';
export * from './nutrition/index';

// Trainingsumfang-Bewertung / Coaching-Tipps
export * from './advice/index';
export * from './advice/detraining';
export * from './advice/terrain';
export * from './advice/coachComment';

// Kalender-Export (.ics)
export * from './calendar/ics';

// Wettkampf-Audioguide (Distanz-Framing, Verpflegungs-Zeitpunkte, Ansagen-Zeitplan)
export * from './raceguide/index';

// Höhenmeter → flaches Äquivalent (Minetti/Strava)
export * from './grade/index';

// Utilities
export * from './util/pace';
export * from './util/date';
