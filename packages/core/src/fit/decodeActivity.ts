import { Decoder, Stream } from '@garmin/fitsdk';
import type { ActivityLap, ActivitySource, CompletedActivity } from '../domain/activity';
import { gradeAdjustedDistanceSegments, type GradeSegment } from '../grade/index';

// FIT-Activity-Parser: eine vom Nutzer importierte FIT-Datei einer absolvierten
// Einheit -> CompletedActivity. Kennzahlen bevorzugt aus der Session-Message,
// sonst aus Laps/Records aggregiert. Der Decoder liefert bereits skalierte Werte
// (Distanz in m, Speed in m/s, Zeit in s, HR in bpm) und Zeitstempel als Date.

export interface DecodeActivityOptions {
  id?: string;
  source?: ActivitySource;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toISOString();
  return new Date(0).toISOString();
}

type RecordMesg = { distance?: unknown; altitude?: unknown; enhancedAltitude?: unknown };

function finite(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
function altOf(r: RecordMesg): number | undefined {
  return finite(r.enhancedAltitude) ?? finite(r.altitude);
}

/** Fenstergröße (~30 m) zum Glätten von GPS-Höhenrauschen vor der Steigungsrechnung. */
const SMOOTH_WINDOW_M = 30;

/**
 * Flach-äquivalente Distanz aus dem Höhenprofil der Records (bevorzugter per-
 * Segment-Ansatz laut Recherche). Steigung wird über ~30-m-Fenster gemittelt, um
 * GPS-Rauschen zu dämpfen; `gradeAdjustedDistanceSegments` klemmt die Steigung dann
 * auf ±45 % und deckelt den Bergab-Kredit. `undefined`, wenn keine Höhen vorliegen.
 */
function gradeAdjustedFromRecords(records: RecordMesg[]): number | undefined {
  const pts = records
    .map((r) => ({ d: finite(r.distance), a: altOf(r) }))
    .filter((p): p is { d: number; a: number } => p.d !== undefined && p.a !== undefined);
  if (pts.length < 2) return undefined;

  const segments: GradeSegment[] = [];
  let accDist = 0;
  let accAlt = 0;
  let lastD = pts[0]!.d;
  let lastA = pts[0]!.a;
  for (let i = 1; i < pts.length; i++) {
    const dd = pts[i]!.d - lastD;
    const da = pts[i]!.a - lastA;
    lastD = pts[i]!.d;
    lastA = pts[i]!.a;
    if (dd <= 0) continue; // Pause / kein Vortrieb
    accDist += dd;
    accAlt += da;
    if (accDist >= SMOOTH_WINDOW_M) {
      segments.push({ meters: accDist, grade: accAlt / accDist });
      accDist = 0;
      accAlt = 0;
    }
  }
  if (accDist > 0) segments.push({ meters: accDist, grade: accAlt / accDist });
  if (segments.length === 0) return undefined;
  return Math.round(gradeAdjustedDistanceSegments(segments));
}

export function decodeActivity(bytes: Uint8Array, options: DecodeActivityOptions = {}): CompletedActivity {
  const stream = Stream.fromByteArray(bytes);
  if (!Decoder.isFIT(stream)) throw new Error('Datei ist keine gültige FIT-Datei.');

  const { messages, errors } = new Decoder(stream).read();
  if (errors.length > 0) {
    throw new Error(`FIT-Datei fehlerhaft: ${errors[0]?.message ?? 'unbekannter Fehler'}`);
  }

  const session = (messages.sessionMesgs ?? [])[0];
  const laps = messages.lapMesgs ?? [];
  const records = messages.recordMesgs ?? [];

  let totalDistanceMeters = num(session?.totalDistance);
  let totalDurationSeconds = num(session?.totalTimerTime) || num(session?.totalElapsedTime);
  let startTime: unknown = session?.startTime;

  if (!totalDistanceMeters && laps.length > 0) {
    totalDistanceMeters = laps.reduce((s, l) => s + num(l.totalDistance), 0);
  }
  if (!totalDurationSeconds && laps.length > 0) {
    totalDurationSeconds = laps.reduce((s, l) => s + (num(l.totalTimerTime) || num(l.totalElapsedTime)), 0);
  }
  if (!totalDistanceMeters && records.length > 0) {
    totalDistanceMeters = num(records[records.length - 1]?.distance);
  }
  if (!startTime) startTime = laps[0]?.startTime ?? records[0]?.timestamp;

  if (!totalDistanceMeters || !totalDurationSeconds) {
    throw new Error('FIT-Datei enthält keine auswertbaren Lauf-Daten (Distanz/Zeit fehlen).');
  }

  const avgPaceMps = num(session?.avgSpeed) || totalDistanceMeters / totalDurationSeconds;
  const totalAscentMeters =
    num(session?.totalAscent) || laps.reduce((s, l) => s + num((l as { totalAscent?: number }).totalAscent), 0);
  const gradeAdjustedDistanceMeters = gradeAdjustedFromRecords(records as RecordMesg[]);

  const activityLaps: ActivityLap[] = laps.map((l) => {
    const d = num(l.totalDistance);
    const t = num(l.totalTimerTime) || num(l.totalElapsedTime);
    return {
      distanceMeters: d,
      durationSeconds: t,
      avgPaceMps: num(l.avgSpeed) || (t > 0 ? d / t : 0),
      avgHeartRate: typeof l.avgHeartRate === 'number' ? l.avgHeartRate : undefined,
    };
  });

  return {
    id: options.id ?? `activity-${Date.now()}`,
    source: options.source ?? 'fit-import',
    startTime: toIso(startTime),
    totalDistanceMeters: Math.round(totalDistanceMeters),
    totalDurationSeconds: Math.round(totalDurationSeconds),
    avgPaceMps,
    avgHeartRate: typeof session?.avgHeartRate === 'number' ? session.avgHeartRate : undefined,
    totalAscentMeters: totalAscentMeters > 0 ? Math.round(totalAscentMeters) : undefined,
    gradeAdjustedDistanceMeters,
    laps: activityLaps.length > 0 ? activityLaps : undefined,
  };
}
