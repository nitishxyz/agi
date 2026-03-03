import type React from 'react';
import { useEffect, useRef, useMemo } from 'react';
import { Animated } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useTokenByMint } from '@/hooks/use-token-by-mint';

import { Box } from './primitives';
import type { ViewStyle, StyleProp } from 'react-native';

export interface GradientColors {
	primary: string;
	secondary: string;
	accent?: string;
}

export interface ImageGradientProps {
	children?: React.ReactNode;
	style?: StyleProp<ViewStyle>;
	opacity?: number;
	fallbackColor?: string;
	direction?: 'vertical' | 'horizontal' | 'diagonal';
	positions?: 'top' | 'bottom' | 'center' | 'full';
	disabled?: boolean;
	mint?: string;
}

const ImageGradient: React.FC<ImageGradientProps> = ({
	children,
	style,
	opacity = 0.7,
	fallbackColor = '#6366f1',
	direction = 'vertical',
	positions = 'top',
	disabled = false,
	mint,
}) => {
	const fadeAnim = useRef(new Animated.Value(0)).current;
	const animationRef = useRef<Animated.CompositeAnimation | null>(null);

	// Get token data from route parameters or mint prop
	const { coin } = useLocalSearchParams();
	const targetMint = mint || (coin as string);

	// Get token data from local database
	const { data: token, isLoading } = useTokenByMint(targetMint);

	// Use cached gradient colors from token if available
	const gradientColors = useMemo((): GradientColors | null => {
		if (!token?.gradientPrimary) return null;
		return {
			primary: token.gradientPrimary,
			secondary: token.gradientSecondary || token.gradientPrimary,
			accent: token.gradientAccent || undefined,
		};
	}, [token?.gradientPrimary, token?.gradientSecondary, token?.gradientAccent]);

	// Reset animation whenever component mounts or targetMint changes
	useEffect(() => {
		if (!disabled && targetMint) {
			if (animationRef.current) {
				animationRef.current.stop();
			}
			fadeAnim.setValue(0);
		}
	}, [targetMint, disabled, fadeAnim]);

	// Animate in when ready
	useEffect(() => {
		if (!isLoading && !disabled) {
			if (animationRef.current) {
				animationRef.current.stop();
			}

			const timer = setTimeout(() => {
				animationRef.current = Animated.timing(fadeAnim, {
					toValue: 1,
					duration: 800,
					useNativeDriver: true,
				});
				animationRef.current.start();
			}, 100);

			return () => {
				clearTimeout(timer);
				if (animationRef.current) {
					animationRef.current.stop();
				}
			};
		}
	}, [isLoading, disabled, fadeAnim]);

	// Clean up animation on unmount
	useEffect(() => {
		return () => {
			if (animationRef.current) {
				animationRef.current.stop();
			}
		};
	}, []);

	const gradientStartEnd = useMemo(() => {
		switch (direction) {
			case 'horizontal':
				return { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
			case 'diagonal':
				return { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
			case 'vertical':
			default:
				return { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } };
		}
	}, [direction]);

	const computedGradientColors = useMemo((): string[] => {
		if (!gradientColors) {
			// Use fallback colors when no gradient is available
			const fallbackPrimary = `rgba(99, 102, 241, ${opacity})`;
			const fallbackSecondary = `rgba(99, 102, 241, ${opacity * 0.5})`;

			switch (positions) {
				case 'top':
					return [
						fallbackPrimary,
						fallbackSecondary,
						'transparent',
						'transparent',
					];
				case 'bottom':
					return [
						'transparent',
						'transparent',
						fallbackSecondary,
						fallbackPrimary,
					];
				case 'center':
					return [
						'transparent',
						fallbackPrimary,
						fallbackSecondary,
						'transparent',
					];
				case 'full':
				default:
					return [fallbackPrimary, fallbackSecondary];
			}
		}

		switch (positions) {
			case 'top':
				return [
					gradientColors.primary,
					gradientColors.secondary || gradientColors.primary,
					gradientColors.accent || 'rgba(0,0,0,0.05)',
					'transparent',
				];
			case 'bottom':
				return [
					'transparent',
					'transparent',
					gradientColors.secondary || gradientColors.primary,
					gradientColors.primary,
				];
			case 'center':
				return [
					'transparent',
					gradientColors.primary,
					gradientColors.secondary || gradientColors.primary,
					'transparent',
				];
			case 'full':
			default:
				return [
					gradientColors.primary,
					gradientColors.secondary || gradientColors.primary,
				];
		}
	}, [gradientColors, positions, opacity]);

	// If disabled, just render children without gradient
	if (disabled) {
		return <Box style={style}>{children}</Box>;
	}

	return (
		<>
			<Animated.View
				style={[StyleSheet.absoluteFillObject, style, { opacity: fadeAnim }]}
				pointerEvents="none"
			>
				<LinearGradient
					colors={
						computedGradientColors.length >= 2
							? (computedGradientColors as [string, string, ...string[]])
							: ([
									computedGradientColors[0] || 'transparent',
									computedGradientColors[0] || 'transparent',
								] as [string, string])
					}
					locations={positions === 'top' ? [0, 0.25, 0.6, 1.0] : undefined}
					{...gradientStartEnd}
					style={StyleSheet.absoluteFillObject}
				/>
			</Animated.View>
			{children}
		</>
	);
};

export default ImageGradient;
