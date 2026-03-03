import { Box, Text } from "@/components/ui/primitives";

export default function SpendTab() {
  return (
    <Box flex center background="default">
      <Text size="xl" weight="bold">Spend</Text>
      <Text size="md" mode="subtle">Your spending</Text>
    </Box>
  );
}
