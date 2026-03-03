import React, { useState, useCallback } from 'react';
import { Modal as RNModal, Pressable, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import Animated, {
	useAnimatedStyle,
	withSpring,
	useSharedValue,
	runOnJS,
	withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Box, Text, Icon, Button } from '@/primitives';
import { useTheme } from '@/providers/theme-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type WebViewModalProps = {
	visible: boolean;
	url: string;
	title?: string;
	onClose: () => void;
	onNavigationStateChange?: (url: string) => void;
	doneButtonText?: string;
};

const WebViewModal = ({
	visible,
	url,
	title,
	onClose,
	onNavigationStateChange,
	doneButtonText,
}: WebViewModalProps) => {
	const { theme } = useUnistyles();
	const { currentTheme } = useTheme();
	const insets = useSafeAreaInsets();
	const [isLoading, setIsLoading] = useState(true);

	const translateY = useSharedValue(1000);
	const backdropOpacity = useSharedValue(0);

	useEffect(() => {
		if (visible) {
			backdropOpacity.value = withTiming(1, { duration: 200 });
			translateY.value = withSpring(0, {
				damping: 30,
				stiffness: 400,
				mass: 1,
			});
		}
	}, [visible]);

	const handleClose = useCallback(() => {
		const exitDuration = 300;

		backdropOpacity.value = withTiming(0, { duration: exitDuration });
		translateY.value = withTiming(
			1000,
			{ duration: exitDuration },
			(finished) => {
				if (finished) {
					runOnJS(onClose)();
				}
			},
		);
	}, [onClose]);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }],
	}));

	const backdropAnimatedStyle = useAnimatedStyle(() => ({
		opacity: backdropOpacity.value,
	}));

	if (!visible) return null;

	return (
		<RNModal
			visible={visible}
			onRequestClose={handleClose}
			animationType="none"
			transparent={true}
			statusBarTranslucent
		>
			{/* Backdrop */}
			<Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
				<BlurView
					intensity={50}
					tint={currentTheme === 'dark' ? 'dark' : 'light'}
					style={StyleSheet.absoluteFillObject}
				>
					<Pressable
						style={StyleSheet.absoluteFillObject}
						onPress={handleClose}
					/>
				</BlurView>
			</Animated.View>

			{/* Content */}
			<Animated.View
				style={[
					styles.container,
					animatedStyle,
					{
						paddingTop: insets.top,
						paddingBottom: insets.bottom,
						backgroundColor: theme.colors.background.default,
					},
				]}
			>
				{/* Header */}
				<Box
					direction="row"
					alignItems="center"
					px="md"
					py="sm"
					style={{
						borderBottomWidth: 1,
						borderBottomColor: theme.colors.border.subtle,
					}}
				>
					<Button
						size="auto"
						variant="ghost"
						mode="subtle"
						rounded="full"
						onPress={handleClose}
						style={{ width: 36, height: 36 }}
					>
						<Button.Icon>
							{(props) => <Icon {...props} icon={Feather} name="x" size={20} />}
						</Button.Icon>
					</Button>

					<Box flex center>
						<Text size="md" weight="semibold" numberOfLines={1}>
							{title || 'Terms of Service'}
						</Text>
					</Box>

					{doneButtonText ? (
						<Button size="sm" rounded="full" onPress={handleClose}>
							<Button.Text weight="bold">{doneButtonText}</Button.Text>
						</Button>
					) : (
						<Box style={{ width: 36 }} />
					)}
				</Box>

				{/* Loading indicator */}
				{isLoading && (
					<Box
						center
						style={{
							position: 'absolute',
							top: insets.top + 60,
							left: 0,
							right: 0,
							bottom: 0,
							zIndex: 10,
						}}
					>
						<ActivityIndicator size="large" color={theme.colors.brand.base} />
						<Text size="sm" mode="subtle" style={{ marginTop: 12 }}>
							Loading...
						</Text>
					</Box>
				)}

				{/* WebView */}
				<WebView
					source={{ uri: url }}
					style={styles.webview}
					onLoadStart={() => setIsLoading(true)}
					onLoadEnd={() => setIsLoading(false)}
					onNavigationStateChange={(navState) => {
						onNavigationStateChange?.(navState.url);
					}}
					startInLoadingState={false}
					javaScriptEnabled={true}
					domStorageEnabled={true}
					sharedCookiesEnabled={true}
					thirdPartyCookiesEnabled={true}
				/>
			</Animated.View>
		</RNModal>
	);
};

export default WebViewModal;

const styles = StyleSheet.create((theme) => ({
	backdrop: {
		...StyleSheet.absoluteFillObject,
	},
	container: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	webview: {
		flex: 1,
		backgroundColor: theme.colors.background.default,
	},
}));
