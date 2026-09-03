import { BleManager, State, type Characteristic, type Device } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

import { BLE_ANNOUNCEMENT_CHARACTERISTIC_UUID, BLE_CHILD_CODE_CHARACTERISTIC_UUID, BLE_CHUNK_FINAL, BLE_SERVICE_UUID, base64ToBytes } from './ble';

// "Live mithören per Bluetooth" (Kernfunktion 4b): sucht Max' Handy per BLE in der
// Nähe (kein Internet nötig, im Unterschied zum Cloud-Polling in liveListenStore.ts -
// beide laufen unabhängig nebeneinander und speisen dieselbe Anzeige/Sprachausgabe),
// verbindet automatisch, verifiziert per childCode-Characteristic, dass es wirklich
// Max' Handy ist (nicht ein fremdes Gerät mit derselben App in Reichweite), und reicht
// jede vollständig zusammengesetzte Ansage über onEvent weiter.

let manager: BleManager | null = null;
function getManager(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
}

async function hasBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Number(Platform.Version) < 31) return true; // ACCESS_FINE_LOCATION vom Audioguide reicht für Scan auf älterem Android.
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
  return (
    result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
    result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
  );
}

/** Startet die Suche nach Max' Handy und ruft [onEvent] für jede empfangene Ansage
 *  auf. Gibt eine Stop-Funktion zurück. Best-effort wie das Cloud-Polling: fehlende
 *  Berechtigung, ausgeschaltetes Bluetooth oder Max außer Reichweite führen zu
 *  stillem Nichtstun statt Fehlermeldungen - die Cloud-Quelle läuft unbeeinflusst weiter. */
export function startBleListen(childCode: string, onEvent: (text: string) => void): () => void {
  if (Platform.OS === 'web') return () => {};

  const ble = getManager();
  let connectedDevice: Device | null = null;
  let stopped = false;
  let stateSubscription: { remove: () => void } | null = null;
  const chunkBuffers = new Map<string, Uint8Array[]>();

  function handleNotification(error: unknown, characteristic: Characteristic | null) {
    if (error || !characteristic?.value) return;
    const bytes = base64ToBytes(characteristic.value);
    if (bytes.length === 0) return;
    const isFinal = bytes[0] === BLE_CHUNK_FINAL;
    const payload = bytes.slice(1);
    const deviceId = characteristic.deviceID;
    const existing = chunkBuffers.get(deviceId) ?? [];
    existing.push(payload);
    if (!isFinal) {
      chunkBuffers.set(deviceId, existing);
      return;
    }
    chunkBuffers.delete(deviceId);
    const totalLength = existing.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of existing) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    const text = new TextDecoder('utf-8').decode(combined);
    if (text) onEvent(text);
  }

  function startScan() {
    if (stopped || connectedDevice) return;
    ble.startDeviceScan([BLE_SERVICE_UUID], null, (error, device) => {
      if (error || !device || stopped || connectedDevice) return;
      ble.stopDeviceScan();
      void connectAndSubscribe(device);
    });
  }

  async function connectAndSubscribe(device: Device) {
    try {
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      const codeCharacteristic = await connected.readCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_CHILD_CODE_CHARACTERISTIC_UUID,
      );
      const advertisedCode = codeCharacteristic.value
        ? new TextDecoder('utf-8').decode(base64ToBytes(codeCharacteristic.value))
        : null;
      if (advertisedCode !== childCode) {
        // Falsches Gerät (zufällig in Reichweite, andere Familie/App-Installation) -
        // nicht abonnieren, Verbindung trennen und weitersuchen.
        await connected.cancelConnection();
        if (!stopped) startScan();
        return;
      }
      connectedDevice = connected;
      connected.monitorCharacteristicForService(BLE_SERVICE_UUID, BLE_ANNOUNCEMENT_CHARACTERISTIC_UUID, handleNotification);
      connected.onDisconnected(() => {
        if (connectedDevice?.id === connected.id) connectedDevice = null;
        chunkBuffers.clear();
        if (!stopped) startScan();
      });
    } catch {
      if (!stopped) startScan();
    }
  }

  void (async () => {
    const granted = await hasBlePermissions();
    if (!granted || stopped) return;
    stateSubscription = ble.onStateChange((state) => {
      if (state === State.PoweredOn) startScan();
    }, true);
  })();

  return () => {
    stopped = true;
    stateSubscription?.remove();
    ble.stopDeviceScan();
    if (connectedDevice) void connectedDevice.cancelConnection();
    connectedDevice = null;
    chunkBuffers.clear();
  };
}
