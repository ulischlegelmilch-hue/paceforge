import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { usePalette } from '@/ui/colors';

// Ersetzt die frühere flache Stack-Struktur (Home als Sammelbecken für fast
// alles) durch 4 gleichwichtige Bereiche - Standardmuster in Fitness-Apps
// (persistente Tab-Leiste statt langer Einzel-Scrollseite + Icon-only-Menü).
// headerShown:false ist Pflicht: jeder Tab-Screen rendert seinen eigenen
// Header selbst, sonst gäbe es einen doppelten Header.
export default function TabsLayout() {
  const p = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.subtext,
        tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Heute', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="plan"
        options={{ title: 'Plan', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="training-hub"
        options={{ title: 'Training', tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'Mehr', tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-outline" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
