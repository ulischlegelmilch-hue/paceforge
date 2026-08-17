import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { AthleteProfile, CompletedActivity, TrainingPlan } from '@paceforge/core';

// Lokale Sicherung als JSON-Datei – Fallback für den Fall, dass die Cloud (wie
// beim Garmin-Ausfall gesehen) mal nicht erreichbar ist. Der Nutzer speichert die
// Datei selbst, wo er möchte (Sharing-Menü: Drive, Mail, Dateien-App, ...).

export const BACKUP_FORMAT_VERSION = 1;

export interface BackupFile {
  formatVersion: number;
  exportedAt: string;
  profile: AthleteProfile | null;
  plan: TrainingPlan | null;
  activities: CompletedActivity[];
}

export async function exportBackupJson(
  profile: AthleteProfile | null,
  plan: TrainingPlan | null,
  activities: CompletedActivity[],
): Promise<{ fileUri: string }> {
  const backup: BackupFile = {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    plan,
    activities,
  };

  const file = new File(Paths.cache, 'paceforge-sicherung.json');
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'PaceForge-Sicherung speichern',
      UTI: 'public.json',
    });
  }
  return { fileUri: file.uri };
}

/** Lässt den Nutzer eine zuvor exportierte Sicherungsdatei auswählen und liest sie ein. */
export async function importBackupJson(): Promise<BackupFile | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  const text = await new File(picked.assets[0].uri).text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Datei ist kein gültiges JSON.');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('profile' in parsed) ||
    !('plan' in parsed) ||
    !('activities' in parsed)
  ) {
    throw new Error('Datei sieht nicht wie eine PaceForge-Sicherung aus.');
  }
  return parsed as BackupFile;
}
