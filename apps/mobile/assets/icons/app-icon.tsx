import Svg, { Path, type SvgProps } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

type AppIconProps = {
	width?: number;
	height?: number;
} & SvgProps;

function AppIcon(props: AppIconProps) {
	const { width = 50, height = 50, ...rest } = props;
	const { theme } = useUnistyles();

	return (
		<Svg
			width={width}
			height={height}
			viewBox="0 0 50 50"
			fill="none"
			{...rest}
		>
			<Path
				d="M25 5L45 15V35L25 45L5 35V15L25 5Z"
				fill={theme.colors.brand[500]}
			/>
			<Path
				d="M25 12L38 19V31L25 38L12 31V19L25 12Z"
				fill={theme.colors.background.default}
			/>
		</Svg>
	);
}

export default AppIcon;
