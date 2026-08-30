import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { StrictMode, Suspense, lazy, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./components/app-shell.js";
import { ProtectedRealm } from "./components/protected-realm.js";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const Home = lazy(() => import("./routes/home.js"));
const Login = lazy(() => import("./routes/login.js"));
const PlatformDashboard = lazy(() => import("./routes/platform-dashboard.js"));
const PlatformPlans = lazy(() => import("./routes/platform-plans.js"));
const PlatformCompanies = lazy(() => import("./routes/platform-companies.js"));
const PlatformSubscriptions = lazy(
  () => import("./routes/platform-subscriptions.js"),
);
const PlatformInvoices = lazy(() => import("./routes/platform-invoices.js"));
const PlatformPayments = lazy(() => import("./routes/platform-payments.js"));
const PlatformAudit = lazy(() => import("./routes/platform-audit.js"));
const PlatformSettings = lazy(() => import("./routes/platform-settings.js"));
const TenantDashboard = lazy(() => import("./routes/tenant-dashboard.js"));
const TenantSettings = lazy(() => import("./routes/tenant-settings.js"));
const TenantSubscription = lazy(
  () => import("./routes/tenant-subscription.js"),
);
const TenantSecurity = lazy(() => import("./routes/tenant-security.js"));

function Loading(): ReactElement {
  return (
    <div
      className="flex min-h-64 items-center justify-center gap-2 text-sm text-text-muted"
      role="status"
      aria-live="polite"
    >
      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
      Carregando...
    </div>
  );
}

const rootRoute = createRootRoute({
  component: function RootComponent() {
    return (
      <>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
        >
          Pular para o conteúdo principal
        </a>
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </>
    );
  },
  notFoundComponent: () => (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface p-6 text-center"
      tabIndex={-1}
    >
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-sm text-text-muted">
        O endereço informado não existe.
      </p>
      <Link
        to="/"
        className="text-sm font-medium text-primary-600 hover:underline"
      >
        Voltar ao início
      </Link>
    </main>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
});
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: Login,
});

const platformRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/platform",
  component: () => (
    <ProtectedRealm realm="platform">
      <AppShell realm="platform">
        <Outlet />
      </AppShell>
    </ProtectedRealm>
  ),
});
const platformIndexRoute = createRoute({
  getParentRoute: () => platformRoute,
  path: "/",
  component: PlatformDashboard,
});
const platformPlansRoute = createRoute({
  getParentRoute: () => platformRoute,
  path: "/plans",
  component: PlatformPlans,
});
const platformCompaniesRoute = createRoute({
  getParentRoute: () => platformRoute,
  path: "/companies",
  component: PlatformCompanies,
});
const platformSubscriptionsRoute = createRoute({
  getParentRoute: () => platformRoute,
  path: "/subscriptions",
  component: PlatformSubscriptions,
});
const platformInvoicesRoute = createRoute({
  getParentRoute: () => platformRoute,
  path: "/invoices",
  component: PlatformInvoices,
});
const platformPaymentsRoute = createRoute({
  getParentRoute: () => platformRoute,
  path: "/payments",
  component: PlatformPayments,
});
const platformAuditRoute = createRoute({
  getParentRoute: () => platformRoute,
  path: "/audit",
  component: PlatformAudit,
});
const platformSettingsRoute = createRoute({
  getParentRoute: () => platformRoute,
  path: "/settings",
  component: PlatformSettings,
});

const tenantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  component: () => (
    <ProtectedRealm realm="tenant">
      <AppShell realm="tenant">
        <Outlet />
      </AppShell>
    </ProtectedRealm>
  ),
});
const tenantIndexRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/",
  component: TenantDashboard,
});
const tenantSettingsRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/settings",
  component: TenantSettings,
});
const tenantSubscriptionRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/subscription",
  component: TenantSubscription,
});
const tenantSecurityRoute = createRoute({
  getParentRoute: () => tenantRoute,
  path: "/security",
  component: TenantSecurity,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  platformRoute.addChildren([
    platformIndexRoute,
    platformPlansRoute,
    platformCompaniesRoute,
    platformSubscriptionsRoute,
    platformInvoicesRoute,
    platformPaymentsRoute,
    platformAuditRoute,
    platformSettingsRoute,
  ]),
  tenantRoute.addChildren([
    tenantIndexRoute,
    tenantSettingsRoute,
    tenantSubscriptionRoute,
    tenantSecurityRoute,
  ]),
]);
const router = createRouter({ routeTree, context: { queryClient } });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function prefersDarkTheme(): boolean {
  try {
    const preferredTheme = window.localStorage.getItem("blupo.theme");
    return (
      preferredTheme === "dark" ||
      (preferredTheme === null &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  } catch {
    return false;
  }
}

document.documentElement.classList.toggle("dark", prefersDarkTheme());

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
