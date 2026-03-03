import React from 'react';
import {
	BlurView as ExpoBlurView,
	type BlurTint,
	type BlurViewProps,
	type ExperimentalBlurMethod,
} from 'expo-blur';
import { useUnistyles } from 'react-native-unistyles';
import Color from 'color';
import type { StyleProp, ViewStyle } from 'react-native';

interface ThemedBlurViewProps extends Omit<BlurViewProps, 'tint'> {
	style?: StyleProp<ViewStyle>;
}

function BlurView({ style, ...props }: ThemedBlurViewProps) {
	const { theme, rt } = useUnistyles();
	const isDark = rt.themeName === 'dark';

	// Add a semi-transparent background that matches the theme for seamless blending
	const bgColor = isDark
		? Color(theme.colors.background.default).alpha(0.92).toString()
		: Color(theme.colors.background.default).alpha(0.5).toString();

	return (
		<ExpoBlurView
			tint={(isDark ? 'dark' : 'light') as BlurTint}
			experimentalBlurMethod={'dimezisBlurView' as ExperimentalBlurMethod}
			style={[{ backgroundColor: bgColor }, style]}
			{...props}
		/>
	);
}

export default BlurView;
