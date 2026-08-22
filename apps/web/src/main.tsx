import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
  Link,
} from "@tanstack/react-router";

import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const Home = lazy(() => import("./routes/home.js"));
const About = lazy(() => import("./routes/about.js"));

const rootRoute = createRootRoute({
  component: function RootComponent() {
    return (
      <div className="min-h-screen bg-background text-text">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to main content
        </a>
        <header className="border-b border-border p-4">
          <nav className="flex gap-4" aria-label="Main navigation">
            <Link to="/" className="[&.active]:font-bold">
              Home
            </Link>
            <Link to="/about" className="[&.active]:font-bold">
              About
            </Link>
          </nav>
        </header>
        <main id="main" className="p-4" tabIndex={-1}>
          <Suspense
            fallback={
              <div className="p-4" aria-live="polite">
                Loading...
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    );
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
});
const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: About,
});

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute]);
const router = createRouter({ routeTree, context: { queryClient } });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
