import { RootProvider } from '@/providers/root-provider';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useUnistyles } from 'react-native-unistyles';

SplashScreen.preventAutoHideAsync();

function AppStack() {
	const { theme } = useUnistyles();

	return (
		<Stack
			screenOptions={{
				headerShown: false,
				contentStyle: { backgroundColor: theme.colors.background.default },
			}}
		>
			<Stack.Screen name="index" />
			<Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
			<Stack.Screen name="tutorial" options={{ gestureEnabled: false }} />
			<Stack.Screen name="(app)" options={{ gestureEnabled: false }} />
		</Stack>
	);
}

function RootLayout() {
	useEffect(() => {
		SplashScreen.hideAsync();
	}, []);

	return (
		<RootProvider>
			<AppStack />
		</RootProvider>
	);
}

export default RootLayout;
