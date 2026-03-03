import React, { useEffect, useRef } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import type { DimensionValue } from 'react-native';
import Animated, {
	useAnimatedStyle,
	withRepeat,
	withTiming,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/primitives/text';
import { Icon } from '@/components/ui/primitives/icon';
import GorhomPopupSheet, {
	type GorhomPopupSheetRef,
} from '@/components/ui/gorhom-popup-sheet';

export type TradeConfirmationType = 'buy-yes' | 'buy-no' | 'sell' | 'claim';

type TradeConfirmationModalProps = {
	visible: boolean;
	type: TradeConfirmationType;
	title: string;
	subtitle?: string;
	shares?: number;
	cost?: number;
	payout?: number;
	error?: string | null;
	isLoading?: boolean;
	isFetchingQuote?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
	onRetry?: () => void;
};

function SkeletonBox({
	width,
	height,
}: {
	width: DimensionValue;
	height: number;
}) {
	const animatedStyle = useAnimatedStyle(() => ({
		opacity: withRepeat(withTiming(0.4, { duration: 800 }), -1, true),
	}));

	return (
		<Animated.View
			style={[
				{
					width,
					height,
					borderRadius: 6,
					backgroundColor: 'rgba(255, 255, 255, 0.15)',
				},
				animatedStyle,
			]}
		/>
	);
}

function getTypeConfig(type: TradeConfirmationType) {
	switch (type) {
		case 'buy-yes':
			return {
				icon: 'checkmark' as const,
				label: 'BUY YES',
				color: '#00FF66',
				bgColor: 'rgba(0, 255, 102, 0.12)',
				borderColor: 'rgba(0, 255, 102, 0.25)',
				confirmText: 'Confirm YES',
			};
		case 'buy-no':
			return {
				icon: 'close' as const,
				label: 'BUY NO',
				color: '#FF4444',
				bgColor: 'rgba(255, 68, 68, 0.12)',
				borderColor: 'rgba(255, 68, 68, 0.25)',
				confirmText: 'Confirm NO',
			};
		case 'sell':
			return {
				icon: 'arrow-down' as const,
				label: 'SELL',
				color: '#FF4444',
				bgColor: 'rgba(255, 68, 68, 0.12)',
				borderColor: 'rgba(255, 68, 68, 0.25)',
				confirmText: 'Confirm Sell',
			};
		case 'claim':
			return {
				icon: 'gift' as const,
				label: 'CLAIM',
				color: '#00FF66',
				bgColor: 'rgba(0, 255, 102, 0.12)',
				borderColor: 'rgba(0, 255, 102, 0.25)',
				confirmText: 'Confirm Claim',
			};
	}
}

export function TradeConfirmationModal({
	visible,
	type,
	title,
	subtitle,
	shares,
	cost,
	payout,
	error,
	isLoading,
	isFetchingQuote,
	onConfirm,
	onCancel,
	onRetry,
}: TradeConfirmationModalProps) {
	const { theme } = useUnistyles();
	const sheetRef = useRef<GorhomPopupSheetRef>(null);

	const config = getTypeConfig(type);
	const isBuy = type === 'buy-yes' || type === 'buy-no';
	const isSell = type === 'sell';
	const isClaim = type === 'claim';

	const hasQuoteData =
		shares !== undefined && cost !== undefined && payout !== undefined;
	const hasError = !!error && !isFetchingQuote && !hasQuoteData;
	const canRetry = hasError && typeof onRetry === 'function';
	const isDisabled =
		isLoading || isFetchingQuote || (!hasQuoteData && !canRetry);

	useEffect(() => {
		if (visible) {
			sheetRef.current?.present();
		} else {
			sheetRef.current?.dismiss();
		}
	}, [visible]);

	return (
		<GorhomPopupSheet ref={sheetRef} onDismiss={onCancel} disableCloseButton>
			<View style={styles.header}>
				<View
					style={[
						styles.iconCircle,
						{
							backgroundColor: config.bgColor,
							borderColor: config.borderColor,
						},
					]}
				>
					<Icon
						icon={Ionicons}
						name={config.icon}
						size={28}
						color={config.color}
					/>
				</View>
				<Text weight="heavy" size="xl" style={styles.headerLabel}>
					{config.label}
				</Text>
			</View>

			<Text weight="bold" size="lg" style={styles.title} numberOfLines={2}>
				{title}
			</Text>

			{subtitle && (
				<Text mode="subtle" size="sm" style={styles.subtitle} numberOfLines={1}>
					{subtitle}
				</Text>
			)}

			<View style={styles.detailsContainer}>
				<View style={styles.detailRow}>
					<Text mode="subtle" size="sm">
						Shares
					</Text>
					{isFetchingQuote ? (
						<SkeletonBox width={60} height={21} />
					) : (
						<Text weight="bold" size="md">
							{shares != null ? shares.toFixed(2) : '—'}
						</Text>
					)}
				</View>

				{isBuy && (
					<>
						<View style={styles.detailRow}>
							<Text mode="subtle" size="sm">
								You Pay
							</Text>
							{isFetchingQuote ? (
								<SkeletonBox width={70} height={21} />
							) : (
								<Text weight="bold" size="md">
									{cost != null ? `$${cost.toFixed(2)}` : '—'}
								</Text>
							)}
						</View>

						<View style={styles.detailRow}>
							<Text mode="subtle" size="sm">
								You Get (if wins)
							</Text>
							{isFetchingQuote ? (
								<SkeletonBox width={70} height={21} />
							) : (
								<Text weight="bold" size="md" style={{ color: config.color }}>
									{payout != null ? `$${payout.toFixed(2)}` : '—'}
								</Text>
							)}
						</View>
					</>
				)}

				{isSell && (
					<View style={styles.detailRow}>
						<Text mode="subtle" size="sm">
							You Receive
						</Text>
						{isFetchingQuote ? (
							<SkeletonBox width={70} height={21} />
						) : (
							<Text weight="bold" size="md" style={{ color: config.color }}>
								{payout != null ? `$${payout.toFixed(2)}` : '—'}
							</Text>
						)}
					</View>
				)}

				{isClaim && (
					<View style={styles.detailRow}>
						<Text mode="subtle" size="sm">
							You Receive
						</Text>
						{isFetchingQuote ? (
							<SkeletonBox width={70} height={21} />
						) : (
							<Text weight="bold" size="md" style={{ color: config.color }}>
								{payout != null ? `$${payout.toFixed(2)}` : '—'}
							</Text>
						)}
					</View>
				)}
			</View>

			{hasError ? (
				<View style={styles.errorBox}>
					<Text size="sm" style={styles.errorText}>
						{error}
					</Text>
				</View>
			) : null}

			<View style={styles.buttons}>
				<Pressable
					onPress={onCancel}
					disabled={isDisabled}
					style={[
						styles.button,
						styles.cancelButton,
						isDisabled && styles.buttonDisabled,
					]}
				>
					<Text weight="bold" mode="subtle">
						Cancel
					</Text>
				</Pressable>

				<Pressable
					onPress={canRetry ? onRetry : onConfirm}
					disabled={isDisabled}
					style={[
						styles.button,
						styles.confirmButton,
						{
							backgroundColor: config.bgColor,
							borderColor: config.borderColor,
						},
						isDisabled && styles.buttonDisabled,
					]}
				>
					{isLoading ? (
						<ActivityIndicator size="small" color={config.color} />
					) : (
						<Text weight="bold" style={{ color: config.color }}>
							{canRetry ? 'Retry quote' : config.confirmText}
						</Text>
					)}
				</Pressable>
			</View>
		</GorhomPopupSheet>
	);
}

const styles = StyleSheet.create((theme) => ({
	header: {
		alignItems: 'center',
		gap: 12,
		marginBottom: 16,
	},
	iconCircle: {
		width: 56,
		height: 56,
		borderRadius: 28,
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center',
	},
	headerLabel: {
		letterSpacing: 1,
	},
	title: {
		textAlign: 'center',
		marginBottom: 4,
	},
	subtitle: {
		textAlign: 'center',
		marginBottom: 16,
	},
	detailsContainer: {
		backgroundColor: theme.colors.background.subtle,
		borderRadius: theme.radius.lg,
		padding: theme.spacing.md,
		gap: 10,
		marginBottom: 20,
	},
	errorBox: {
		paddingHorizontal: theme.spacing.md,
		paddingBottom: theme.spacing.sm,
		marginTop: -8,
		marginBottom: 12,
	},
	errorText: {
		textAlign: 'center',
		color: theme.colors.text.subtle,
	},
	detailRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	buttons: {
		flexDirection: 'row',
		gap: 12,
	},
	button: {
		flex: 1,
		height: 48,
		borderRadius: theme.radius.lg,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
	},
	cancelButton: {
		backgroundColor: theme.colors.background.subtle,
		borderColor: theme.colors.border.subtle,
	},
	confirmButton: {
		borderWidth: 1.5,
	},
	buttonDisabled: {
		opacity: 0.5,
	},
}));
