import { CopyTextField } from "@/components/molecules/copy-text-field";
import { useSonner } from "@/hooks/use-sonner";
import { BlurGradientBox, Box, Button, Icon, Text } from "@/primitives";
import { formatBalanceDisplay } from "@/utils/format";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Dimensions, TouchableOpacity } from "react-native";

export type RouteCardProps = {
  id: string;
  name: string;
  balance: number;
  icon: keyof typeof Feather.glyphMap;
  color: "blue" | "green" | "purple" | "orange" | "pink" | "indigo";
  onPress?: () => void;
};

const colorGradients = {
  blue: ["#3B82F6", "#1D4ED8"] as const,
  green: ["#10B981", "#059669"] as const,
  purple: ["#8B5CF6", "#7C3AED"] as const,
  orange: ["#F59E0B", "#D97706"] as const,
  pink: ["#EC4899", "#DB2777"] as const,
  indigo: ["#6366F1", "#4F46E5"] as const,
};

export const RouteCard = ({
  id,
  name,
  balance,
  icon,
  color,
  onPress,
}: RouteCardProps) => {
  const formattedBalance = formatBalanceDisplay(balance, 2);
  const sonner = useSonner();

  // Calculate card width based on screen width minus padding
  const screenWidth = Dimensions.get("window").width;
  const horizontalPadding = 26; // 16px on each side
  const cardWidth = screenWidth - horizontalPadding;

  // Route link using stage-specific pay URL
  routeInfo?: SwapRouteInfo;
}) {
  const { styles } = useUnistyles(stylesheet);
  const payUrl = process.env.EXPO_PUBLIC_PAY_URL || "https://stackforge.xyz";

  const handleShare = () => {
    // Navigate to the route share route
    router.push(`/route/${id}/share`);
  };

  const handleCreateInvoice = () => {
    // Placeholder for creating invoice
    sonner.info("Create invoice feature coming soon!");
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <BlurGradientBox rounded="xl" style={{ width: cardWidth }}>
        {/* Card Content */}
        <Box p="md" gap="sm">
          {/* Header with icon and info */}
          <Box direction="row" alignItems="center" gap="md" mb="sm">
            <Box
              rounded="full"
              center
              style={{ width: 46, height: 46, overflow: "hidden" }}
            >
              <LinearGradient
                colors={colorGradients[color]}
                style={{
                  width: 46,
                  height: 46,
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 25,
                }}
              >
                <Icon icon={Feather} name={icon} size={22} color="white" />
              </LinearGradient>
            </Box>

            <Box flex>
              <Text size="xl" weight="bold" numberOfLines={2}>
                {name}
              </Text>
              <Text size="lg" weight="bold" mode="subtle">
                ${formattedBalance.integer}.{formattedBalance.decimal}
              </Text>
            </Box>
          </Box>

          {/* Route Link Container */}
          <CopyTextField
            text={routeLink}
             successMessage="Copied route link"
            errorMessage="Failed to copy link"
            size="sm"
          />
        </Box>

        {/* Footer with action buttons */}
        <Box direction="row" gap="sm" pl="md" pr="md" pb="md">
          <Box flex>
            <Button
              mode="subtle"
              size="md"
              rounded="full"
              onPress={handleShare}
              style={{ width: "100%" }}
            >
              <Button.Icon style={{ marginRight: 5 }}>
                {(props) => <Icon {...props} icon={Feather} name="share" />}
              </Button.Icon>
              <Button.Text weight="bold">Share</Button.Text>
            </Button>
          </Box>

          <Box flex>
            <Button
              size="md"
              rounded="full"
              onPress={handleCreateInvoice}
              style={{ width: "100%" }}
            >
              <Button.Icon style={{ marginRight: 5 }}>
                {(props) => <Icon {...props} icon={Feather} name="plus" />}
              </Button.Icon>
              <Button.Text weight="bold">Invoice</Button.Text>
            </Button>
          </Box>
        </Box>
      </BlurGradientBox>
    </TouchableOpacity>
  );
};
