import React, { useState } from 'react';
import { ScrollView, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Box } from './box';
import { Text } from './text';
import PopupModal from '@/components/ui/popup-modal';
import { US_STATES, type USState } from '@/constants/us-states';
import { triggerHaptic } from '@/components/utils/haptics';

interface StatePickerProps {
	value: string;
	onChange: (stateCode: string) => void;
	label?: string;
	placeholder?: string;
	disabled?: boolean;
	onSelectComplete?: () => void;
}

export function StatePicker({
	value,
	onChange,
	label = 'state',
	placeholder = 'Select state',
	disabled = false,
	onSelectComplete,
}: StatePickerProps) {
	const { theme } = useUnistyles();
	const [showPicker, setShowPicker] = useState(false);

	const selectedState = US_STATES.find((s) => s.code === value);

	const handleSelect = (state: USState) => {
		triggerHaptic('selection');
		onChange(state.code);
		setShowPicker(false);
		onSelectComplete?.();
	};

	return (
		<>
			<Pressable onPress={() => !disabled && setShowPicker(true)}>
				<View
					style={[
						styles.container,
						{
							borderColor: theme.colors.border.default,
							backgroundColor: disabled
								? theme.colors.background.subtle
								: theme.colors.background.default,
							opacity: disabled ? 0.5 : 1,
						},
					]}
				>
					<Text
						size="xs"
						weight="medium"
						style={[styles.label, { color: theme.colors.text.subtle }]}
					>
						{label}
					</Text>
					<View style={styles.inputRow}>
						<Text
							size="lg"
							weight="medium"
							style={{ flex: 1, fontFamily: theme.typography.family.mono }}
							mode={selectedState ? undefined : 'subtle'}
						>
							{selectedState ? selectedState.name : placeholder}
						</Text>
						<Feather
							name="chevron-down"
							size={20}
							color={theme.colors.text.subtle}
						/>
					</View>
				</View>
			</Pressable>

			{showPicker && (
				<PopupModal title="select state" onClose={() => setShowPicker(false)}>
					<ScrollView
						style={{ maxHeight: 400 }}
						showsVerticalScrollIndicator={false}
					>
						<Box gap="xs">
							{US_STATES.map((state) => (
								<Pressable key={state.code} onPress={() => handleSelect(state)}>
									<Box
										direction="row"
										alignItems="center"
										justifyContent="space-between"
										py="md"
										px="sm"
										rounded="md"
										style={{
											backgroundColor:
												value === state.code
													? `${theme.colors.brand.base}15`
													: 'transparent',
										}}
									>
										<Text
											size="md"
											weight={value === state.code ? 'semibold' : 'regular'}
										>
											{state.name}
										</Text>
										{value === state.code && (
											<Feather
												name="check"
												size={20}
												color={theme.colors.brand.base}
											/>
										)}
									</Box>
								</Pressable>
							))}
						</Box>
					</ScrollView>
				</PopupModal>
			)}
		</>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: {
		borderWidth: 1,
		borderRadius: theme.radius.lg,
		borderCurve: 'continuous',
		paddingHorizontal: theme.spacing.sm,
		paddingTop: theme.spacing.xs,
		paddingBottom: theme.spacing.sm,
	},
	label: {
		marginBottom: 2,
	},
	inputRow: {
		flexDirection: 'row',
		alignItems: 'center',
		minHeight: 32,
	},
}));
