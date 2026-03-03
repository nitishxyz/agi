import type React from 'react';
import { useEffect, useRef, useMemo } from 'react';
import { Animated } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useTokenByMint } from '@/hooks/use-token-by-mint';
import { getTokenColors } from '@/utils/color-extraction';
import { Box } from './primitives';
import type { ViewStyle, StyleProp } from 'react-native';

export interface SendFlowGradientProps {
	children?: React.ReactNode;
	style?: StyleProp<ViewStyle>;
	opacity?: number;
	fallbackColor?: string;
	direction?: 'vertical' | 'horizontal' | 'diagonal';
	positions?: 'top' | 'bottom' | 'center' | 'full';
	disabled?: boolean;
	mint?: string;
}

const SendFlowGradient: React.FC<SendFlowGradientProps> = ({
	children,
	style,
	opacity = 0.7,
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

	// Get the primary color for gradient - single color, fading to transparent
	const primaryColor = useMemo((): string | null => {
		// First try database gradient colors
		if (token?.gradientPrimary) {
			return token.gradientPrimary;
		}

		// Fallback to symbol-based color palette
		if (token?.symbol) {
			const colors = getTokenColors(token.symbol);
			return colors.primaryColor;
		}

		return null;
	}, [token?.gradientPrimary, token?.symbol]);

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
		// Convert color to rgba with opacity
		const colorWithOpacity = (color: string, alpha: number): string => {
			// If already rgba, adjust alpha
			if (color.startsWith('rgba')) {
				return color.replace(/[\d.]+\)$/, `${alpha})`);
			}
			// Convert hex to rgba
			if (color.startsWith('#')) {
				const rgb = hexToRgb(color);
				return `rgba(${rgb}, ${alpha})`;
			}
			return color;
		};

		// Use primary color or fallback
		const baseColor = primaryColor || '#6366F1'; // Indigo fallback

		switch (positions) {
			case 'top':
				return [
					colorWithOpacity(baseColor, opacity),
					colorWithOpacity(baseColor, opacity * 0.5),
					colorWithOpacity(baseColor, opacity * 0.1),
					'transparent',
				];
			case 'bottom':
				return [
					'transparent',
					colorWithOpacity(baseColor, opacity * 0.1),
					colorWithOpacity(baseColor, opacity * 0.5),
					colorWithOpacity(baseColor, opacity),
				];
			case 'center':
				return [
					'transparent',
					colorWithOpacity(baseColor, opacity),
					colorWithOpacity(baseColor, opacity * 0.5),
					'transparent',
				];
			case 'full':
			default:
				return [
					colorWithOpacity(baseColor, opacity),
					colorWithOpacity(baseColor, opacity * 0.3),
				];
		}
	}, [primaryColor, positions, opacity]);

	// If disabled, just render children without gradient
	if (disabled) {
		return <Box style={style}>{children}</Box>;
	}

	return (
		<>
			<Animated.View
				style={[
					StyleSheet.absoluteFillObject,
					style,
					{ opacity: fadeAnim, marginTop: -2 },
				]}
				pointerEvents="none"
			>
				<LinearGradient
					colors={computedGradientColors as [string, string, ...string[]]}
					locations={positions === 'top' ? [0, 0.25, 0.6, 1.0] : undefined}
					{...gradientStartEnd}
					style={StyleSheet.absoluteFillObject}
				/>
			</Animated.View>
			{children}
		</>
	);
};

// Helper to convert hex to RGB string
function hexToRgb(hex: string): string {
	hex = hex.replace('#', '');
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);
	return `${r}, ${g}, ${b}`;
}

export default SendFlowGradient;
