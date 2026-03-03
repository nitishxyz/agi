import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Image, type ImageProps } from 'expo-image';
import {
	View,
	StyleSheet,
	Text,
	type ViewStyle,
	type StyleProp,
	type ImageStyle,
	type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TokenImageProps extends Omit<ImageProps, 'source' | 'style'> {
	uri?: string | null;
	fallback?: React.ReactNode;
	fallbackText?: string;
	fallbackTextStyle?: StyleProp<TextStyle>;
	maxRetries?: number;
	retryDelay?: number; // Initial retry delay in ms
	style?: StyleProp<ImageStyle>;
	placeholderStyle?: StyleProp<ViewStyle>;
}

export function TokenImage({
	uri,
	fallback,
	fallbackText,
	fallbackTextStyle,
	maxRetries = 3,
	retryDelay = 1000,
	style,
	placeholderStyle,
	...props
}: TokenImageProps) {
	const [retryCount, setRetryCount] = useState(0);
	const [hasError, setHasError] = useState(false);
	const [key, setKey] = useState(0); // Used to force re-render/retry
	const [isLoading, setIsLoading] = useState(true);

	// Reset state when URI changes
	useEffect(() => {
		setRetryCount(0);
		setHasError(false);
		setKey(0);
		setIsLoading(true);
	}, [uri]);

	const handleError = useCallback(() => {
		if (retryCount < maxRetries) {
			const timeout = Math.min(retryDelay * 2 ** retryCount, 10000); // Exponential backoff capped at 10s

			const timer = setTimeout(() => {
				setRetryCount((prev) => prev + 1);
				setKey((prev) => prev + 1); // Force re-mount of Image component
			}, timeout);

			return () => clearTimeout(timer);
		} else {
			setHasError(true);
			setIsLoading(false);
		}
	}, [retryCount, maxRetries, retryDelay]);

	const handleLoad = useCallback(() => {
		setIsLoading(false);
		setHasError(false);
	}, []);

	if (!uri || (hasError && !fallback && !fallbackText)) {
		// If no URI or error without explicit fallback, use default fallback behavior or render empty
		if (fallback) return <>{fallback}</>;

		// Default fallback if text provided
		if (fallbackText) {
			return (
				<View
					style={[
						styles.center,
						styles.fallbackBg,
						style as any,
						placeholderStyle,
					]}
				>
					<Text style={[styles.fallbackText, fallbackTextStyle]}>
						{fallbackText.slice(0, 1).toUpperCase()}
					</Text>
				</View>
			);
		}

		// Default fallback generic icon
		return (
			<View
				style={[
					styles.center,
					styles.fallbackBg,
					style as any,
					placeholderStyle,
				]}
			>
				<Ionicons
					name="image-outline"
					size={16}
					color="rgba(255,255,255,0.3)"
				/>
			</View>
		);
	}

	if (hasError && fallback) {
		return <>{fallback}</>;
	}

	if (hasError && fallbackText) {
		return (
			<View
				style={[
					styles.center,
					styles.fallbackBg,
					style as any,
					placeholderStyle,
				]}
			>
				<Text style={[styles.fallbackText, fallbackTextStyle]}>
					{fallbackText.slice(0, 1).toUpperCase()}
				</Text>
			</View>
		);
	}

	return (
		<View style={[styles.imageContainer, style as any]}>
			<Image
				key={`${uri}-${key}`} // Changing key forces re-mount
				source={uri}
				style={styles.image}
				onError={handleError}
				onLoad={handleLoad}
				contentFit="cover"
				transition={200}
				cachePolicy="disk" // Explicitly use disk cache
				{...props}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	center: {
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
	},
	fallbackBg: {
		backgroundColor: 'rgba(255,255,255,0.1)',
	},
	fallbackText: {
		color: '#fff',
		fontWeight: 'bold',
		fontSize: 12,
	},
	imageContainer: {
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center',
	},
	// Scale image slightly larger to crop out any internal padding in token images
	image: {
		width: '115%',
		height: '115%',
	},
});
