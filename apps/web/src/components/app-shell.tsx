import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactElement, type ReactNode } from "react";
import {
  Avatar,
  AvatarFallback,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  cn,
} from "@saas/ui-web";
import { authClient } from "../lib/auth.js";
import { useAuth } from "../lib/use-auth.js";
import { Logo } from "./logo.js";

interface NavigationItem {
  label: string;
  to: string;
  icon: LucideIcon;
  permission: string;
}

const platformNavigation: NavigationItem[] = [
  {
    label: "Visão geral",
    to: "/platform",
    icon: LayoutDashboard,
    permission: "platform:dashboard:read",
  },
  {
    label: "Planos",
    to: "/platform/plans",
    icon: Package,
    permission: "platform:plans:read",
  },
  {
    label: "Empresas",
    to: "/platform/companies",
    icon: Building2,
    permission: "platform:tenants:read",
  },
  {
    label: "Assinaturas",
    to: "/platform/subscriptions",
    icon: WalletCards,
    permission: "platform:billing:read",
  },
  {
    label: "Faturas",
    to: "/platform/invoices",
    icon: ReceiptText,
    permission: "platform:billing:read",
  },
  {
    label: "Pagamentos",
    to: "/platform/payments",
    icon: CreditCard,
    permission: "platform:billing:read",
  },
  {
    label: "Auditoria",
    to: "/platform/audit",
    icon: ScrollText,
    permission: "platform:audit:read",
  },
  {
    label: "Configurações",
    to: "/platform/settings",
    icon: Settings,
    permission: "platform:settings:read",
  },
];

const tenantNavigation: NavigationItem[] = [
  {
    label: "Visão geral",
    to: "/app",
    icon: LayoutDashboard,
    permission: "company:read",
  },
  {
    label: "Empresa",
    to: "/app/settings",
    icon: Building2,
    permission: "company:read",
  },
  {
    label: "Assinatura",
    to: "/app/subscription",
    icon: ReceiptText,
    permission: "subscription:read",
  },
  {
    label: "Segurança",
    to: "/app/security",
    icon: ShieldCheck,
    permission: "security:read",
  },
];

interface AppShellProps {
  realm: "platform" | "tenant";
  children: ReactNode;
}

export function AppShell({ realm, children }: AppShellProps): ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() =>
    typeof document === "undefined"
      ? false
      : document.documentElement.classList.contains("dark"),
  );
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  if (auth.status !== "authenticated") return <></>;
  const user = auth.session.user;
  const navigation = (
    realm === "platform" ? platformNavigation : tenantNavigation
  ).filter((item) => user.permissions.includes(item.permission));
  const initials = user.email.slice(0, 2).toUpperCase();

  const toggleTheme = (): void => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem("blupo.theme", next ? "dark" : "light");
    } catch (error) {
      void error;
    }
    setDark(next);
  };

  const logout = async (): Promise<void> => {
    await authClient.logout();
    queryClient.clear();
    await navigate({ to: "/login", replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-16 items-center justify-between px-5">
        <Link
          to={realm === "platform" ? "/platform" : "/app"}
          aria-label="Blupo - início"
        >
          <Logo className="w-28" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Fechar menu"
          onClick={() => {
            setMobileOpen(false);
          }}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
      <Separator />
      <nav
        className="flex-1 space-y-1 overflow-y-auto p-3"
        aria-label="Navegação principal"
      >
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => {
                setMobileOpen(false);
              }}
              activeOptions={{
                exact: item.to === "/platform" || item.to === "/app",
              }}
              activeProps={{
                className:
                  "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-200",
                "aria-current": "page",
              }}
              inactiveProps={{
                className: "text-text-muted hover:bg-surface hover:text-text",
              }}
              className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <p className="px-3 text-xs font-medium uppercase tracking-wide text-text-muted">
          {realm === "platform" ? "Administração Blupo" : "Minha empresa"}
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
      <div className="min-h-screen bg-surface text-text">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border lg:block">
          {sidebar}
        </aside>
        <DialogContent
          showCloseButton={false}
          className="left-0 top-0 block h-dvh w-72 max-w-none translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 p-0 lg:hidden"
        >
          <DialogTitle className="sr-only">Menu principal</DialogTitle>
          {sidebar}
        </DialogContent>
        <div className="lg:pl-64">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
                aria-pressed={dark}
                onClick={toggleTheme}
              >
                {dark ? (
                  <Sun className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-10 gap-2 px-2"
                    aria-label={`Menu da conta de ${user.email}`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-44 truncate text-sm sm:inline">
                      {user.email}
                    </span>
                    <ChevronDown
                      className="h-4 w-4 text-text-muted"
                      aria-hidden="true"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <span className="block truncate">{user.email}</span>
                    <span className="font-normal text-text-muted">
                      {realm === "platform"
                        ? "Conta da plataforma"
                        : "Conta da empresa"}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void logout()}>
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main
            id="main"
            tabIndex={-1}
            className={cn("mx-auto w-full max-w-screen-2xl p-4 sm:p-6 lg:p-8")}
          >
            {children}
          </main>
        </div>
      </div>
    </Dialog>
  );
}
