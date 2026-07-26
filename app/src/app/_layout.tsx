import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

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
      </Stack>
    </>
  );
}
