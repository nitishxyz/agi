import type React from 'react';
import {
	useCallback,
	useMemo,
	useRef,
	forwardRef,
	useImperativeHandle,
} from 'react';
import { Pressable } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import {
	StyleSheet,
	StyleSheet as UnistyleStyleSheet,
} from 'react-native-unistyles';
import { useTheme } from '@/providers/theme-context';
import { BlurView } from 'expo-blur';
import Animated, {
	useAnimatedStyle,
	interpolate,
	Extrapolation,
} from 'react-native-reanimated';
import {
	BottomSheetModal,
	BottomSheetView,
	type BottomSheetBackdropProps,
	useBottomSheetSpringConfigs,
} from '@gorhom/bottom-sheet';
import { Box, Text, Button, Icon } from '@/primitives';
import { Feather } from '@expo/vector-icons';

export type ConfirmationAction = {
	label: string;
	onPress?: () => void | Promise<void>;
	style?: 'default' | 'cancel' | 'destructive';
	loading?: boolean;
};

type ConfirmationSheetProps = {
	title: string;
	message?: string;
	icon?: keyof typeof Feather.glyphMap;
	iconColor?: 'default' | 'warning' | 'error' | 'success';
	actions?: ConfirmationAction[];
	onDismiss?: () => void;
};

export type ConfirmationSheetRef = {
	present: () => void;
	dismiss: () => void;
};

// Custom Blur Backdrop Component
const CustomBackdrop = ({
	animatedIndex,
	style,
	onPress,
}: BottomSheetBackdropProps & { onPress?: () => void }) => {
	const { currentTheme } = useTheme();
	const colorScheme = currentTheme;

	const containerAnimatedStyle = useAnimatedStyle(() => ({
		opacity: interpolate(
			animatedIndex.value,
			[-1, 0],
			[0, 1],
			Extrapolation.CLAMP,
		),
	}));

	const containerStyle = useMemo(
		() => [style, containerAnimatedStyle],
		[style, containerAnimatedStyle],
	);

	return (
		<Animated.View style={containerStyle}>
			<Pressable onPress={onPress} style={StyleSheet.absoluteFillObject}>
				<BlurView
					intensity={50}
					tint={colorScheme === 'dark' ? 'dark' : 'light'}
					style={{ flex: 1 }}
				/>
			</Pressable>
		</Animated.View>
	);
};

const iconColors = {
	default: '#9CA3AF',
	warning: '#F59E0B',
	error: '#EF4444',
	success: '#22C55E',
};

const ConfirmationSheet = forwardRef<
	ConfirmationSheetRef,
	ConfirmationSheetProps
>(
	(
		{ title, message, icon, iconColor = 'default', actions = [], onDismiss },
		ref,
	) => {
		const bottomSheetModalRef = useRef<BottomSheetModal>(null);

		const animationConfigs = useBottomSheetSpringConfigs({
			damping: 30,
			overshootClamping: false,
			stiffness: 400,
			mass: 1,
		});

		const present = useCallback(() => {
			bottomSheetModalRef.current?.present();
		}, []);

		const dismiss = useCallback(() => {
			bottomSheetModalRef.current?.dismiss();
		}, []);

		useImperativeHandle(
			ref,
			() => ({
				present,
				dismiss,
			}),
			[present, dismiss],
		);

		const handleSheetChanges = useCallback((_index: number) => {
			// Sheet state changed
		}, []);

		const renderContainerComponent = useCallback(
			(props: { children?: React.ReactNode }) => (
				<FullWindowOverlay>{props.children}</FullWindowOverlay>
			),
			[],
		);

		const handleActionPress = useCallback(
			async (action: ConfirmationAction) => {
				dismiss();
				if (action.onPress) {
					await action.onPress();
				}
			},
			[dismiss],
		);

		// Default actions if none provided
		const resolvedActions =
			actions.length > 0
				? actions
				: [
						{ label: 'Cancel', style: 'cancel' as const },
						{ label: 'Confirm', style: 'default' as const },
					];

		// Sort actions: cancel first, then others
		const sortedActions = [...resolvedActions].sort((a, b) => {
			if (a.style === 'cancel') return -1;
			if (b.style === 'cancel') return 1;
			return 0;
		});

		const getButtonMode = (style?: string) => {
			switch (style) {
				case 'destructive':
					return 'error';
				case 'cancel':
					return 'subtle';
				default:
					return undefined;
			}
		};

		const getButtonVariant = (style?: string) => {
			switch (style) {
				case 'cancel':
					return 'outline';
				default:
					return undefined;
			}
		};

		return (
			<BottomSheetModal
				ref={bottomSheetModalRef}
				onChange={handleSheetChanges}
				enableDynamicSizing={true}
				backdropComponent={(props) => (
					<CustomBackdrop {...props} onPress={dismiss} />
				)}
				backgroundStyle={styles.backgroundStyle}
				style={styles.sheetStyle}
				handleStyle={styles.handleStyle}
				handleIndicatorStyle={styles.handleIndicatorStyle}
				enablePanDownToClose={true}
				onDismiss={onDismiss}
				animationConfigs={animationConfigs}
				animateOnMount={true}
				containerComponent={renderContainerComponent}
			>
				<BottomSheetView
					style={[styles.contentContainer, { backgroundColor: 'transparent' }]}
				>
					<Box
						m="md"
						p="lg"
						shadow="lg"
						background="base"
						style={styles.container}
						border="thin"
					>
						{/* Icon */}
						{icon && (
							<Box center mb="md">
								<Box
									center
									style={[
										styles.iconContainer,
										{ backgroundColor: `${iconColors[iconColor]}20` },
									]}
								>
									<Icon
										icon={Feather}
										name={icon}
										size={28}
										color={iconColors[iconColor]}
									/>
								</Box>
							</Box>
						)}

						{/* Title */}
						<Box center mb="sm">
							<Text size="xl" weight="bold" style={styles.title}>
								{title}
							</Text>
						</Box>

						{/* Message */}
						{message && (
							<Box center mb="lg" px="sm">
								<Text size="md" mode="subtle" style={styles.message}>
									{message}
								</Text>
							</Box>
						)}

						{/* Actions */}
						<Box gap="sm" mt="md">
							{sortedActions.length === 2 ? (
								// Two buttons side by side
								<Box direction="row" gap="sm">
									{sortedActions.map((action, index) => (
										<Box key={index} flex center>
											<Button
												size="lg"
												rounded="full"
												variant={getButtonVariant(action.style)}
												mode={getButtonMode(action.style)}
												onPress={() => handleActionPress(action)}
												loading={action.loading}
												style={{ paddingHorizontal: 44 }}
											>
												<Button.Text weight="semibold">
													{action.label}
												</Button.Text>
											</Button>
										</Box>
									))}
								</Box>
							) : (
								// Stack buttons vertically
								sortedActions.map((action, index) => (
									<Button
										key={index}
										size="lg"
										rounded="full"
										variant={getButtonVariant(action.style)}
										mode={getButtonMode(action.style)}
										onPress={() => handleActionPress(action)}
										loading={action.loading}
									>
										<Button.Text weight="semibold">{action.label}</Button.Text>
									</Button>
								))
							)}
						</Box>
					</Box>
				</BottomSheetView>
			</BottomSheetModal>
		);
	},
);

ConfirmationSheet.displayName = 'ConfirmationSheet';

export default ConfirmationSheet;

const styles = UnistyleStyleSheet.create((theme, rt) => ({
	sheetStyle: {
		backgroundColor: 'rgba(0, 0, 0, 0)',
		shadowColor: 'transparent',
		shadowOpacity: 0,
		elevation: 0,
	},
	backgroundStyle: {
		backgroundColor: 'rgba(0, 0, 0, 0)',
	},
	handleStyle: {
		backgroundColor: 'rgba(0, 0, 0, 0)',
		height: 0,
		opacity: 0,
	},
	handleIndicatorStyle: {
		backgroundColor: 'rgba(0, 0, 0, 0)',
		width: 0,
		height: 0,
		opacity: 0,
	},
	contentContainer: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0)',
		paddingTop: theme.spacing.lg,
		paddingBottom: rt.insets.bottom,
	},
	container: {
		alignSelf: 'stretch',
		borderRadius: theme.radius.tera,
		paddingTop: theme.spacing.xl,
		paddingBottom: theme.spacing.lg,
		marginBottom: 0,
	},
	iconContainer: {
		width: 64,
		height: 64,
		borderRadius: 32,
	},
	title: {
		textAlign: 'center',
	},
	message: {
		textAlign: 'center',
		lineHeight: 22,
	},
}));
