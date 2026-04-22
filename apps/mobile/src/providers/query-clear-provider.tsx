import React, { createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DevToolbar } from "../components/ui/dev-toolbar";

const QueryClearContext = createContext<
  { clearQueries: () => Promise<void> } | undefined
>(undefined);

export const useQueryClear = () => {
  const context = useContext(QueryClearContext);
  if (!context) {
    throw new Error("useQueryClear must be used within QueryClearProvider");
  }
  return context;
};

export const QueryClearProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();


  const clearQueries = async () => {
    queryClient.clear();
    await queryClient.invalidateQueries();
    queryClient.removeQueries();
  };

  return (
    <QueryClearContext.Provider value={{ clearQueries }}>
      {children}
      {/* {__DEV__ && <DevToolbar />} */}
    </QueryClearContext.Provider>
  );
};
