import { Navigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useAuth } from "../lib/use-auth.js";

interface ProtectedRealmProps {
  realm: "platform" | "tenant";
  children: ReactNode;
}

export function ProtectedRealm({
  realm,
  children,
}: ProtectedRealmProps): ReactElement {
  const auth = useAuth();
  if (auth.status === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-surface"
        role="status"
      >
        <LoaderCircle
          className="h-6 w-6 animate-spin text-primary-600"
          aria-hidden="true"
        />
        <span className="sr-only">Carregando sessão</span>
      </div>
    );
  }
  if (auth.status === "anonymous") return <Navigate to="/login" replace />;
  if (auth.session.user.realm !== realm) {
    return (
      <Navigate
        to={auth.session.user.realm === "platform" ? "/platform" : "/app"}
        replace
      />
    );
  }
  return <>{children}</>;
}
