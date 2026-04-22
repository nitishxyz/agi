import { Stack } from "expo-router";
import { useUnistyles } from "react-native-unistyles";

export default function AppLayout() {
  const { theme } = useUnistyles();
  
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background.default } }}>
      <Stack.Screen name="tabs" />
    </Stack>
  );
}
