import React, { useState, useEffect } from "react";
import * as Updates from "expo-updates";
import { ActivityIndicator, View } from "react-native";
import { Box, Button } from "@/primitives";
import { Feather } from "@expo/vector-icons";
import { BodyLarge, Body } from "./typography";
import Modal from "./modal";

type UpdateDialogProps = {
  visible: boolean;
  onClose: () => void;
};

export const UpdateDialog = ({ visible, onClose }: UpdateDialogProps) => {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      checkForUpdate();
    }
  }, [visible]);

  const checkForUpdate = async () => {
    setChecking(true);
    setError(null);
    try {
      const update = await Updates.checkForUpdateAsync();
      setUpdateAvailable(update.isAvailable);
    } catch (err: any) {
      setError(`Error checking for updates: ${err.message}`);
    } finally {
      setChecking(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setError(null);
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (err: any) {
      setError(`Error installing update: ${err.message}`);
      setUpdating(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose}>
      <Modal.Content>
        <Box flex center>
          <Box
            p="lg"
            rounded="lg"
            background="base"
            border="thin"
            shadow="md"
            gap="md"
            style={{ maxWidth: 340, width: "100%" }}
          >
            <BodyLarge weight="bold" style={{ textAlign: "center" }}>
              App Updates
            </BodyLarge>

            {checking ? (
              <Box center gap="md" pb="md">
                <ActivityIndicator size="large" />
                <Body>Checking for updates...</Body>
              </Box>
            ) : updating ? (
              <Box center gap="md" pb="md">
                <ActivityIndicator size="large" />
                <Body>Installing update...</Body>
              </Box>
            ) : error ? (
              <Box gap="md">
                <Box
                  direction="row"
                  center
                  background="subtle"
                  p="md"
                  rounded="lg"
                  mode="error"
                >
                  <Feather name="alert-circle" size={20} />
                  <Body mode="error" style={{ marginLeft: 8 }}>
                    {error}
                  </Body>
                </Box>
                <Button mt="lg" onPress={checkForUpdate}>
                  <Button.Text>Try Again</Button.Text>
                </Button>
              </Box>
            ) : updateAvailable ? (
              <Box gap="md">
                <BodyLarge weight="medium" style={{ textAlign: "center" }}>
                  New version available!
                </BodyLarge>
                <Body style={{ textAlign: "center" }}>
                  A new version of the app is available. Update now to get the
                  latest features and bug fixes.
                </Body>
                <Button variant="outline" onPress={handleUpdate}>
                  <Button.Icon>
                    {(props) => <Feather name="download" {...props} />}
                  </Button.Icon>
                  <Button.Text>Install Update</Button.Text>
                </Button>
              </Box>
            ) : (
              <Box gap="md">
                <Box
                  direction="row"
                  center
                  background="subtle"
                  p="md"
                  rounded="lg"
                  mode="success"
                >
                  <Feather name="check-circle" size={20} />
                  <Body style={{ marginLeft: 8 }}>Your app is up to date!</Body>
                </Box>
                <Button mt="lg" variant="outline" onPress={checkForUpdate}>
                  <Button.Icon>
                    {(props) => <Feather name="refresh-cw" {...props} />}
                  </Button.Icon>
                  <Button.Text>Check Again</Button.Text>
                </Button>
              </Box>
            )}

            <Box mt="lg" center>
              <Button variant="ghost" onPress={onClose}>
                <Button.Text>Close</Button.Text>
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal.Content>
    </Modal>
  );
};

export default UpdateDialog;
