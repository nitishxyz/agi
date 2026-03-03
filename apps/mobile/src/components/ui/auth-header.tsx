import React from "react";
import { Box, Text } from "@/primitives";

interface AuthHeaderProps {
  title: string;
  subtitle: string;
}

const AuthHeader = ({ title, subtitle }: AuthHeaderProps) => {
  return (
    <Box style={{ marginBottom: 32 }}>
      <Text size="xxl" weight="bold" style={{ marginBottom: 8 }}>
        {title}
      </Text>
      
      <Text size="md" mode="subtle" style={{ lineHeight: 22 }}>
        {subtitle}
      </Text>
    </Box>
  );
};

export default AuthHeader;