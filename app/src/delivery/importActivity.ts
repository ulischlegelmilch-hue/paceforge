import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { decodeActivity } from '@paceforge/core/fit';
import type { CompletedActivity } from '@paceforge/core';

// Lässt den Nutzer eine FIT-Datei einer absolvierten Einheit auswählen, liest die
// Bytes und parst sie zu einer CompletedActivity. Gegenstück zum FIT-Export.
export async function pickAndDecodeActivity(): Promise<CompletedActivity | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: '*/*', // .fit hat keinen verbreiteten MIME-Typ -> alle erlauben
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets || !res.assets[0]) return null;

  const asset = res.assets[0];
  const bytes = await new File(asset.uri).bytes();
  return decodeActivity(bytes, { id: `activity-${Date.now()}`, source: 'fit-import' });
}
