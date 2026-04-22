import { Modal as RNModal, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { createContext, useContext } from "react";
import BlurView from "./primitives/blur-view";

type ModalContextType = {
  visible: boolean;
  onClose?: () => void;
};

const ModalContext = createContext<ModalContextType>({
  visible: false,
});

type ModalRenderProps = {
  visible: boolean;
  onClose?: () => void;
};

type ModalContentProps = {
  children: React.ReactNode | ((props: ModalRenderProps) => React.ReactNode);
  style?: StyleProp<ViewStyle>;
};

type ModalProps = {
  children: React.ReactNode;
  visible: boolean;
  onClose?: () => void;
  animationType?: "fade" | "slide" | "none";
  transparent?: boolean;
  presentationStyle?: "pageSheet" | "formSheet" | "fullScreen";
};

const Modal = ({
  children,
  visible,
  onClose,
  animationType = "fade",
  transparent = true,
  presentationStyle,
}: ModalProps) => {
  const contextValue = {
    visible,
    onClose,
  };

  return (
    <ModalContext.Provider value={contextValue}>
      <RNModal
        visible={visible}
        onRequestClose={onClose}
        onDismiss={onClose}
        presentationStyle={presentationStyle}
        animationType={animationType}
        transparent={transparent}
      >
        <BlurView intensity={50} style={styles.blur}>
          {children}
        </BlurView>
      </RNModal>
    </ModalContext.Provider>
  );
};

const ModalContent = ({ children, style }: ModalContentProps) => {
  const context = useContext(ModalContext);

  return (
    <View style={[styles.content, style]}>
      {typeof children === "function" ? children(context) : children}
    </View>
  );
};

Modal.Content = ModalContent;

export default Modal;

const styles = StyleSheet.create((theme, rt) => ({
  blur: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
    flex: 1,
  },
}));
