import {
  createContext,
  useContext,
} from "react";

export const MatterContext =
  createContext(null);

export function useMatter() {
  const context =
    useContext(MatterContext);

  if (!context) {
    throw new Error(
      "useMatter must be used inside MatterProvider"
    );
  }

  return context;
}