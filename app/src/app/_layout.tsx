import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { startAutoBackup } from '@/sync/autoBackup';
import { startAutoPullGarmin } from '@/sync/autoPullGarmin';
import { startDailyReminders } from '@/notifications/dailyReminder';

startAutoBackup();
startAutoPullGarmin();
startDailyReminders();

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="plan" />
        <Stack.Screen name="workout" />
        <Stack.Screen name="activities" />
        <Stack.Screen name="recalibrate" />
        <Stack.Screen name="strength" />
        <Stack.Screen name="nutrition" />
        <Stack.Screen name="training" />
        <Stack.Screen name="about" />
        <Stack.Screen name="more" />
        <Stack.Screen name="glossary" />
      </Stack>
    </>
  );
}
