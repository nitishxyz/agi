import { Box, Text } from "@/components/ui/primitives";

export default function HistoryTab() {
  return (
    <Box flex center background="default">
      <Text size="xl" weight="bold">History</Text>
      <Text size="md" mode="subtle">Transaction history</Text>
    </Box>
  );
}
