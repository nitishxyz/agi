import { Box, Text } from '@/primitives';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface OtpInputProps {
	length?: number;
	value: string;
	onChangeText: (text: string) => void;
	onComplete?: (code: string) => void;
	autoFocus?: boolean;
}

const OtpInput: React.FC<OtpInputProps> = ({
	length = 6,
	value,
	onChangeText,
	onComplete,
	autoFocus = false,
}) => {
	const inputRef = useRef<TextInput>(null);
	const [isFocused, setIsFocused] = useState(false);

	// Delay autoFocus to allow screen transition animations to complete
	// This ensures the input is ready to receive SMS autofill suggestions
	useEffect(() => {
		if (autoFocus) {
			const timer = setTimeout(() => {
				inputRef.current?.focus();
			}, 400);
			return () => clearTimeout(timer);
		}
	}, [autoFocus]);

	useEffect(() => {
		if (value.length === length && onComplete) {
			onComplete(value);
		}
	}, [value, length, onComplete]);

	const handlePress = () => {
		inputRef.current?.focus();
	};

	const handleChangeText = (text: string) => {
		// Only allow numbers and limit to specified length
		const cleanText = text.replace(/[^0-9]/g, '').slice(0, length);
		onChangeText(cleanText);
	};

	const renderDigits = () => {
		const digits = [];
		for (let i = 0; i < length; i++) {
			const digit = value[i] || '';
			const isActive = i === value.length;
			const isFilled = i < value.length;

			digits.push(
				<Box
					key={i}
					style={[
						styles.digitContainer,
						isFilled && styles.digitContainerFilled,
						isActive && isFocused && styles.digitContainerActive,
					]}
				>
					<Text
						size="mega"
						weight="semibold"
						style={[styles.digitText, isFilled && styles.digitTextFilled]}
					>
						{digit}
					</Text>
				</Box>,
			);
		}
		return digits;
	};

	return (
		<Pressable onPress={handlePress}>
			<Box direction="row" gap="sm" justifyContent="center">
				{renderDigits()}
			</Box>

			{/* Hidden input for handling keyboard input */}
			<TextInput
				ref={inputRef}
				value={value}
				onChangeText={handleChangeText}
				onFocus={() => setIsFocused(true)}
				onBlur={() => setIsFocused(false)}
				keyboardType="number-pad"
				maxLength={length}
				style={styles.hiddenInput}
				textContentType="oneTimeCode"
				autoComplete="sms-otp"
				caretHidden
			/>
		</Pressable>
	);
};

const styles = StyleSheet.create((theme) => ({
	digitContainer: {
		width: 48,
		height: 56,
		borderRadius: theme.radius.md,
		borderWidth: 1.5,
		borderColor: theme.colors.border.default,
		backgroundColor: theme.colors.background.subtle,
		justifyContent: 'center',
		alignItems: 'center',
	},
	digitContainerFilled: {
		borderColor: theme.colors.brand[100],
		backgroundColor: theme.colors.brand[50],
	},
	digitContainerActive: {
		borderColor: theme.colors.brand[500],
		// backgroundColor: theme.colors.brand[50],
	},
	digitText: {
		color: theme.colors.brand[500],
	},
	digitTextFilled: {
		color: theme.colors.brand[600],
	},
	hiddenInput: {
		position: 'absolute',
		opacity: 0,
		width: '100%',
		height: 56,
		top: 0,
		left: 0,
	},
}));

export default OtpInput;
