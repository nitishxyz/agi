import { Box, Button, Icon, Text } from "../primitives";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export const Header = ({ title }: { title: string }) => {
  return (
    <Box direction="row" gap="sm" p="sm" center>
      <Button variant="ghost" size="sm" onPress={() => router.back()}>
        <Icon icon={Ionicons} name="chevron-back" size={24} />
      </Button>
      <Box center>
        <Text size="mega" weight="bold">
          {title}
        </Text>
      </Box>
      <Box flex />
    </Box>
  );
};
