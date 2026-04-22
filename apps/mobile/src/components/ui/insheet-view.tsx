import { StyleSheet } from "react-native-unistyles";
import { Box, type BoxProps } from "./primitives";
import { ModalHeader } from "./headers/modal-header";

const InSheetView = ({
  children,
  title,
  backEnabled,
  ...boxProps
}: {
  children: React.ReactNode;
  title: string;
  backEnabled?: boolean;
} & BoxProps) => {
  return (
    <Box flex safeAreaBottom {...boxProps}>
      <ModalHeader title={title} backEnabled={backEnabled} />
      <Box style={styles.container}>{children}</Box>
    </Box>
  );
};

export default InSheetView;

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    height: rt.screen.height - rt.insets.top - rt.insets.bottom - 80,
  },
}));
