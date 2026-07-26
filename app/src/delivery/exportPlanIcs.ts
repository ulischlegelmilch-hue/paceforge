import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { planToIcs, type StrengthEquipment, type TrainingPlan } from '@paceforge/core';

// Exportiert den Trainingsplan als .ics und öffnet das System-Teilen-Menü, damit
// der Nutzer ihn in Google/Apple/Outlook-Kalender importieren kann.
export async function exportPlanIcs(
  plan: TrainingPlan,
  strength?: { equipment: StrengthEquipment; sessionsPerWeek: number },
): Promise<{ fileUri: string; events: number }> {
  const ics = planToIcs(plan, strength ? { strength } : {});
  const events = (ics.match(/BEGIN:VEVENT/g) ?? []).length;

  const file = new File(Paths.cache, 'paceforge-trainingsplan.ics');
  if (file.exists) file.delete();
  file.create();
  file.write(ics);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/calendar',
      dialogTitle: 'Trainingsplan als Kalender exportieren',
      UTI: 'public.calendar-event',
    });
  }
  return { fileUri: file.uri, events };
}
