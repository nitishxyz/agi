import type React from 'react';
import { StyleSheet, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Box } from '@/components/ui/primitives/box';
import { Text } from '@/components/ui/primitives/text';
import { Icon } from '@/components/ui/primitives/icon';
import BlurView from '@/components/ui/primitives/blur-view';

type PageHeaderVariant = 'transparent' | 'blur' | 'solid';

type PageHeaderProps = {
	title: string;
	onBack?: () => void;
	onClose?: () => void;
	rightElement?: React.ReactNode;
	variant?: PageHeaderVariant;
	backIcon?: 'arrow-back' | 'close' | 'chevron-back';
};

export function PageHeader({
	title,
	onBack,
	onClose,
	rightElement,
	variant = 'transparent',
	backIcon = 'arrow-back',
}: PageHeaderProps) {
	const handlePress = onClose || onBack;
	const iconName = onClose ? 'close' : backIcon;

	const content = (
		<Box
			direction="row"
			alignItems="center"
			justifyContent="space-between"
			px="sm"
			py="sm"
			style={variant === 'solid' ? styles.solidBg : undefined}
		>
			{handlePress ? (
				<Pressable onPress={handlePress} style={styles.headerButton}>
					<Icon
						icon={Ionicons}
						name={iconName}
						size={22}
						color="rgba(255,255,255,0.8)"
					/>
				</Pressable>
			) : (
				<View style={{ width: 40 }} />
			)}
			<Text size="md" weight="bold" style={{ letterSpacing: 0.5 }}>
				{title}
			</Text>
			{rightElement || <View style={{ width: 40 }} />}
		</Box>
	);

	if (variant === 'blur') {
		return (
			<BlurView intensity={40} style={styles.blurContainer}>
				{content}
			</BlurView>
		);
	}

	return content;
}

type PageHeaderWithBackProps = {
	title: string;
	onBack: () => void;
	rightElement?: React.ReactNode;
};

export function PageHeaderWithBack({
	title,
	onBack,
	rightElement,
}: PageHeaderWithBackProps) {
	return (
		<Box
			direction="row"
			alignItems="center"
			justifyContent="space-between"
			px="lg"
			py="sm"
		>
			<Pressable onPress={onBack} hitSlop={8}>
				<Icon icon={Ionicons} name="arrow-back" size={24} color="#fff" />
			</Pressable>
			<Text size="xl" weight="heavy" style={{ letterSpacing: 0.5 }}>
				{title}
			</Text>
			{rightElement || <View style={{ width: 40 }} />}
		</Box>
	);
}

const styles = StyleSheet.create({
	headerButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(255,255,255,0.05)',
	},
	blurContainer: {
		overflow: 'hidden',
	},
	solidBg: {
		backgroundColor: 'rgba(0,0,0,0.8)',
	},
});
