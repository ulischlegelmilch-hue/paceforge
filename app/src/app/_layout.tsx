import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { startAutoBackup } from '@/sync/autoBackup';
import { startAutoPullGarmin } from '@/sync/autoPullGarmin';
import { startDailyReminders } from '@/notifications/dailyReminder';
import { startWeeklyReview } from '@/notifications/weeklyReview';

startAutoBackup();
startAutoPullGarmin();
startDailyReminders();
startWeeklyReview();

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // Tap auf die Sonntags-Wochenrückblick-Benachrichtigung öffnet direkt den
  // Screen (siehe data.screen in weeklyReview.ts) statt nur die App zu öffnen.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      if (screen === 'weekly-review') router.push('/weekly-review');
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="plan" />
        <Stack.Screen name="workout" />
        <Stack.Screen name="activities" />
        <Stack.Screen name="activity-detail" />
        <Stack.Screen name="weekly-review" />
        <Stack.Screen name="recalibrate" />
        <Stack.Screen name="strength" />
        <Stack.Screen name="nutrition" />
        <Stack.Screen name="training" />
        <Stack.Screen name="about" />
        <Stack.Screen name="more" />
        <Stack.Screen name="glossary" />
        <Stack.Screen name="add-event" />
        <Stack.Screen name="max" />
      </Stack>
    </>
  );
}
