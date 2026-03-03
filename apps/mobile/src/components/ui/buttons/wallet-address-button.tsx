import { Box, Icon, ButtonText } from '@/primitives';
import { truncateAddress } from '@/utils/format';
import { Feather } from '@expo/vector-icons';
import { useState, useEffect, useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Animated, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { triggerHaptic } from '@/components/utils/haptics';

interface WalletAddressButtonProps {
	walletAddress?: string;
	onCopy?: () => void;
}

export const WalletAddressButton: React.FC<WalletAddressButtonProps> = ({
	walletAddress,
	onCopy,
}) => {
	const [copied, setCopied] = useState(false);
	const scale = new Animated.Value(1);
	const { theme } = useUnistyles();

	const truncatedWalletAddress = useMemo(() => {
		if (!walletAddress) return '';
		return truncateAddress(walletAddress);
	}, [walletAddress]);

	// Reset copied state after delay
	useEffect(() => {
		let timeout: ReturnType<typeof setTimeout>;

		if (copied) {
			timeout = setTimeout(() => {
				setCopied(false);
			}, 1500);
		}

		return () => {
			if (timeout) clearTimeout(timeout);
		};
	}, [copied]);

	const onPressIn = () => {
		Animated.spring(scale, {
			toValue: 0.97,
			useNativeDriver: true,
		}).start();
	};

	const onPressOut = () => {
		triggerHaptic('success');

		Animated.spring(scale, {
			toValue: 1,
			useNativeDriver: true,
		}).start();
	};

	const handleCopy = async () => {
		try {
			if (walletAddress) {
				await Clipboard.setStringAsync(walletAddress);
				setCopied(true);
				if (onCopy) onCopy();
			}
		} catch (error) {
			console.error('Failed to copy wallet address: ', error);
		}
	};

	const textColor = copied
		? theme.colors.success[500]
		: theme.colors.text.default;

	return (
		<Animated.View
			style={{ transform: [{ scale }], marginTop: theme.spacing.md }}
		>
			<Pressable
				onPress={handleCopy}
				onPressIn={onPressIn}
				onPressOut={onPressOut}
				style={({ pressed }) => [styles.container, pressed && styles.pressed]}
			>
				<Box direction="row" gap="sm" center>
					<ButtonText size="lg" color={textColor}>
						{truncatedWalletAddress}
					</ButtonText>
					<Icon
						icon={Feather}
						name={copied ? 'check' : 'copy'}
						size="lg"
						color={textColor}
					/>
				</Box>
			</Pressable>
		</Animated.View>
	);
};

const styles = StyleSheet.create(() => ({
	container: {
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 8,
	},
	pressed: {
		opacity: 0.9,
	},
}));
