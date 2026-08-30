import { useEffect, useSyncExternalStore } from "react";
import { authClient, type AuthState } from "./auth.js";

export function useAuth(): AuthState {
  const state = useSyncExternalStore(
    (listener) => authClient.subscribe(listener),
    () => authClient.getSnapshot(),
    () => authClient.getSnapshot(),
  );
  useEffect(() => {
    void authClient.initialize();
  }, []);
  return state;
}
