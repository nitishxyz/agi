import { StyleSheet } from 'react-native-unistyles';
import { Box, Text } from '@/primitives';
import { useUser } from '@/hooks/use-user';
import { useCurrentWallet } from '@/hooks/use-current-wallet';
import BlurView from '../primitives/blur-view';
import DicebearAvatar from '../dicebear-avatar';
import { TouchableOpacity } from 'react-native';
import { useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';
import haptics from '@/components/utils/haptics';

const truncateAddress = (address: string | null): string => {
	if (!address) return '';
	return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export const HomeHeader = () => {
	const { data: user } = useUser();
	const { address } = useCurrentWallet();

	const handleAddressPress = useCallback(async () => {
		if (!address) return;

		try {
			haptics.lightImpact();
			await Clipboard.setStringAsync(address);
			haptics.successNotification();
		} catch (error) {
			console.error('Failed to copy address:', error);
			haptics.errorNotification();
		}
	}, [address]);

	return (
		<BlurView style={styles.blurView}>
			<Box center ml="sm">
				<DicebearAvatar seed={user?.id ?? address ?? ''} size={40} />
			</Box>
			<Box flex ml="xs">
				<Text weight="bold" mode="subtle">
					welcome!
				</Text>
				<TouchableOpacity onPress={handleAddressPress} activeOpacity={0.7}>
					<Box direction="row" alignItems="center" gap="xs">
						<Text weight="bold" size="md">
							{truncateAddress(address)}
						</Text>
					</Box>
				</TouchableOpacity>
			</Box>
		</BlurView>
	);
};

const styles = StyleSheet.create((theme, rt) => ({
	blurView: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		zIndex: 1000,
		paddingTop: rt.insets.top,
		flexDirection: 'row',
		gap: theme.spacing.sm,
		padding: theme.spacing.sm,
		alignItems: 'center',
	},
}));
