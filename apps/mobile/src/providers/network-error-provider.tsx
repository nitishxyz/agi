import React from "react";
import { useNetworkErrorHandler } from "@/utils/network-error-handler";

export const NetworkErrorProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // This will set up the toast handler for the network error handler
  useNetworkErrorHandler();

  return <>{children}</>;
};
