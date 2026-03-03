import { Box } from "@/primitives";
import { useMemo } from "react";
// import { LineGraph } from "react-native-graph";

type BalanceChartProps = {
  balance: number;
  height?: number;
  color?: string;
  animated?: boolean;
};

export const BalanceChart = ({
  balance,
  height = 80,
  color = "#3873e1",
  animated = false,
}: BalanceChartProps) => {
  // Generate random data points for the graph
  const graphData = useMemo(() => {
    const data = [];
    const baseValue = balance * 0.8; // Start around 80% of balance
    const maxVariation = balance * 0.4; // Allow 40% variation

    // Generate 20 data points
    for (let i = 0; i < 20; i++) {
      const variation = (Math.random() - 0.5) * maxVariation;
      const value = Math.max(0, baseValue + variation);
      data.push({
        date: new Date(Date.now() - (19 - i) * 60000), // 1 minute intervals
        value: value,
      });
    }
    return data;
  }, [balance]);

  return (
    <Box style={{ height, width: "100%" }}>
      {/*<LineGraph
        points={graphData}
        animated={animated}
        color={color}
        enableFadeInMask
        style={{ flex: 1 }}
      />*/}
    </Box>
  );
};
