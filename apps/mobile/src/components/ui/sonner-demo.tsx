import { Button } from "@/components/ui/primitives";
import { useSonner } from "@/hooks/use-sonner";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export const SonnerDemo: React.FC = () => {
  const sonner = useSonner();

  const handleSuccess = () => {
    sonner.success("Transaction Successful");
  };

  const handleError = () => {
    sonner.error("Transaction Failed");
  };

  const handleInfo = () => {
    sonner.info("New Feature Available");
  };

  const handleWarning = () => {
    sonner.warning("High Gas Fees");
  };

  const handleLoading = () => {
    const id = sonner.loading("Processing Transaction...");

    // Simulate a transaction
    setTimeout(() => {
      sonner.transaction.success(id, "Transaction Completed");
    }, 3000);
  };

  const handleTransactionFlow = () => {
    const transactionId = sonner.transaction.start();

    // Simulate transaction processing
    setTimeout(() => {
      // Randomly succeed or fail
      if (Math.random() > 0.5) {
        sonner.transaction.success(transactionId, "Payment Sent");
      } else {
        sonner.transaction.error(transactionId, "Transaction Failed");
      }
    }, 2500);
  };

  const handleCustom = () => {
    sonner.show({
      type: "info",
      title: "Custom Sonner with Star Icon",
      icon: {
        component: Ionicons,
        name: "star",
        size: 18,
      },
      duration: 5000,
      onPress: () => {
        console.log("Custom sonner pressed!");
      },
    });
  };

  return (
    <View style={styles.container}>
      <Button onPress={handleSuccess} style={styles.button}>
        <Button.Text>Show Success</Button.Text>
      </Button>
      <Button onPress={handleError} style={styles.button}>
        <Button.Text>Show Error</Button.Text>
      </Button>
      <Button onPress={handleInfo} style={styles.button}>
        <Button.Text>Show Info</Button.Text>
      </Button>
      <Button onPress={handleWarning} style={styles.button}>
        <Button.Text>Show Warning</Button.Text>
      </Button>
      <Button onPress={handleLoading} style={styles.button}>
        <Button.Text>Show Loading</Button.Text>
      </Button>
      <Button onPress={handleTransactionFlow} style={styles.button}>
        <Button.Text>Transaction Flow</Button.Text>
      </Button>
      <Button onPress={handleCustom} style={styles.button}>
        <Button.Text>Custom Sonner</Button.Text>
      </Button>
      <Button onPress={sonner.clear} style={styles.button}>
        <Button.Text>Clear All</Button.Text>
      </Button>
    </View>
  );
};

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    padding: 20,
    gap: 12,
  },
  button: {
    marginBottom: 8,
  },
}));
