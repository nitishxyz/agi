import { Tabs } from 'expo-router';
import BottomTabs from '@/components/molecules/navigation/bottom-tabs-new';

export default function TabsLayout() {
	return (
		<Tabs
			screenOptions={{ headerShown: false }}
			tabBar={(props) => <BottomTabs {...props} />}
		>
			<Tabs.Screen name="home" />
			<Tabs.Screen name="spend" />
			<Tabs.Screen name="history" />
		</Tabs>
	);
}
