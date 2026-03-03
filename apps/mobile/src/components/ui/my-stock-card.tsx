import { Box, Icon, Text, BlurGradientBox } from "@/primitives";
import { AntDesign } from "@expo/vector-icons";
import { Image } from "react-native";
import { HoldingData } from "@/components/ui/holding-card";
import { BalanceChart } from "@/components/ui/balance-chart";

type MyStockCardProps = {
  item: HoldingData & { chartColor?: string };
  width: number;
};

export const MyStockCard = ({ item, width }: MyStockCardProps) => (
  <BlurGradientBox rounded="xl" style={{ width }}>
    <Box pt="md" pb="md">
      <Box direction="row" alignItems="center" gap="md" pl="md" pr="md">
        <Box flex>
          <Text size="lg" weight="bold">
            {item.tokenSymbol}
          </Text>
          <Text size="sm" mode="subtle" numberOfLines={1}>
            {item.tokenName}
          </Text>
        </Box>

        {item.image ? (
          <Box
            rounded="md"
            background="base"
            center
            style={{
              width: 40,
              height: 40,
              shadowColor: "#fff",
              shadowOffset: {
                width: 0,
                height: 0,
              },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              overflow: "hidden",
            }}
          >
            <Image
              source={{ uri: item.image }}
              style={{ width: 40, height: 40 }}
              resizeMode="cover"
            />
          </Box>
        ) : (
          <Text size="md" weight="bold">
            {item.tokenSymbol}
          </Text>
        )}
      </Box>

      {/* Value */}
      <Box
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mb="sm"
        mt="sm"
        pl="md"
        pr="md"
      >
        <Box>
          <Box direction="row" alignItems="flex-end">
            <Text size="mega" weight="medium">
              ${Math.floor(item.currentValue)}
            </Text>
            <Text size="xxl" weight="medium" mode="subtle">
              .{(item.currentValue % 1).toFixed(2).slice(2)}
            </Text>
          </Box>
          <Box direction="row" alignItems="center" gap="xs">
            {item.isPositive ? (
              <Icon icon={AntDesign} name="arrowup" size={12} mode="success" />
            ) : (
              <Icon icon={AntDesign} name="arrowdown" size={12} mode="error" />
            )}
            <Text
              size="sm"
              weight="semibold"
              mode={item.isPositive ? "success" : "error"}
            >
              {item.pnlPercentage.toFixed(2)}%
            </Text>
          </Box>
        </Box>
      </Box>
      {/* Chart */}
      <BalanceChart
        balance={item.currentValue}
        height={40}
        color={item?.isPositive ? "#14F195" : "#FF453A"}
        animated
      />
    </Box>
  </BlurGradientBox>
);
