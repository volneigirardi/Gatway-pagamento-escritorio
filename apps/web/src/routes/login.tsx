import { Navigate, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type SubmitEventHandler,
} from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Label,
} from "@saas/ui-web";
import type { AuthStep } from "@saas/contracts";
import { Logo } from "../components/logo.js";
import { authClient } from "../lib/auth.js";
import { ApiError } from "../lib/http.js";
import { useAuth } from "../lib/use-auth.js";

/**
 * Clean, centered login screen for Blupo.
 *
 * Follows the shadcn/ui + professional design token direction (ADR-013):
 * - centered card on a neutral background;
 * - minimal chrome, no heavy shadows or gradients (except the logo placeholder);
 * - form fields from the shared design system;
 * - clear error state and keyboard accessibility.
 *
 * The flow supports both identity realms, initial password rotation, TOTP
 * enrollment and verification, and one-time recovery codes.
 */
type PendingStep = Exclude<AuthStep, { status: "authenticated" }>;

function messageFor(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  }
  if (error instanceof ApiError && error.status >= 500) {
    return "O serviço está temporariamente indisponível. Tente novamente.";
  }
  return "Não foi possível validar os dados informados. Revise e tente novamente.";
}

export default function LoginPage(): ReactElement {
  const auth = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<PendingStep | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{
    challengeToken: string;
    uri: string;
    secret: string;
  } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const setupStarted = useRef<string | null>(null);

  const continueToApp = async (): Promise<void> => {
    const current = authClient.getSnapshot();
    if (current.status !== "authenticated") return;
    await navigate({
      to: current.session.user.realm === "platform" ? "/platform" : "/app",
      replace: true,
    });
  };

  const handleStep = async (result: AuthStep): Promise<void> => {
    setError(null);
    if (result.status === "authenticated") {
      await continueToApp();
      return;
    }
    setStep(result);
  };

  useEffect(() => {
    if (
      step?.status !== "mfa_setup_required" ||
      setupStarted.current === step.challengeToken
    ) {
      return;
    }
    setupStarted.current = step.challengeToken;
    setIsLoading(true);
    authClient
      .setupMfa(step.challengeToken)
      .then(setMfaSetup)
      .catch((setupError: unknown) => {
        setError(messageFor(setupError));
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [step]);

  if (
    auth.status === "authenticated" &&
    step === null &&
    recoveryCodes.length === 0
  ) {
    return (
      <Navigate
        to={auth.session.user.realm === "platform" ? "/platform" : "/app"}
        replace
      />
    );
  }

  const submitCredentials: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    void (async () => {
      setError(null);
      setIsLoading(true);
      try {
        await handleStep(await authClient.login(email, password));
      } catch (loginError) {
        setError(messageFor(loginError));
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const submitPassword: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (step?.status !== "password_change_required") return;
    if (newPassword !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    const challengeToken = step.challengeToken;
    void (async () => {
      setError(null);
      setIsLoading(true);
      try {
        await handleStep(
          await authClient.changePassword(challengeToken, newPassword),
        );
        setNewPassword("");
        setConfirmation("");
      } catch (passwordError) {
        setError(messageFor(passwordError));
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const submitMfa: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const activeStep = step;
    const setup = mfaSetup;
    void (async () => {
      setError(null);
      setIsLoading(true);
      try {
        if (activeStep?.status === "mfa_required") {
          if (useRecovery) {
            await authClient.verifyRecoveryCode(
              activeStep.challengeToken,
              recoveryCode,
            );
          } else {
            await authClient.verifyMfa(activeStep.challengeToken, code);
          }
          await continueToApp();
        } else if (activeStep?.status === "mfa_setup_required" && setup) {
          const codes = await authClient.confirmMfa(setup.challengeToken, code);
          setRecoveryCodes(codes);
        }
      } catch (mfaError) {
        setError(messageFor(mfaError));
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const copyRecoveryCodes = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    } catch {
      setError("Não foi possível copiar. Salve os códigos manualmente.");
    }
  };

  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center bg-surface px-4 py-10"
      tabIndex={-1}
    >
      <section
        className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-10"
        aria-labelledby="login-title"
      >
        <div className="flex flex-col items-center space-y-3 text-center">
          <Logo className="mb-1 w-40" />
          <h1
            id="login-title"
            className="text-2xl font-semibold tracking-tight text-text sm:text-3xl"
          >
            {recoveryCodes.length > 0
              ? "Guarde seus códigos"
              : step?.status === "password_change_required"
                ? "Crie uma nova senha"
                : step?.status === "mfa_setup_required"
                  ? "Proteja sua conta"
                  : step?.status === "mfa_required"
                    ? "Confirme sua identidade"
                    : "Entrar"}
          </h1>
          <p className="text-sm text-text-muted">
            {step === null
              ? "Use suas credenciais para acessar o ambiente correto."
              : recoveryCodes.length > 0
                ? "Cada código pode ser utilizado uma única vez."
                : "Conclua esta etapa de segurança para continuar."}
          </p>
        </div>

        {error ? (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Não foi possível continuar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {step === null && recoveryCodes.length === 0 ? (
          <form onSubmit={submitCredentials} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="voce@empresa.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
                required
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />{" "}
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        ) : null}

        {step?.status === "password_change_required" ? (
          <form onSubmit={submitPassword} className="mt-8 space-y-5">
            <Alert>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Senha temporária</AlertTitle>
              <AlertDescription>
                Use pelo menos 12 caracteres e evite senhas comuns.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                }}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-confirmation">
                Confirmar nova senha
              </Label>
              <Input
                id="password-confirmation"
                type="password"
                autoComplete="new-password"
                minLength={12}
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                }}
                required
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </form>
        ) : null}

        {step?.status === "mfa_setup_required" && recoveryCodes.length === 0 ? (
          <form onSubmit={submitMfa} className="mt-8 space-y-5">
            {mfaSetup ? (
              <>
                <Alert variant="success">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <AlertTitle>Autenticador TOTP</AlertTitle>
                  <AlertDescription>
                    Adicione a chave abaixo no seu aplicativo autenticador.
                  </AlertDescription>
                </Alert>
                <div className="rounded-lg border border-border bg-surface p-4 text-center">
                  <span className="text-xs text-text-muted">
                    Chave de configuração
                  </span>
                  <code className="mt-2 block break-all font-mono text-base font-semibold tracking-wider text-text">
                    {mfaSetup.secret}
                  </code>
                </div>
                <details className="text-xs text-text-muted">
                  <summary className="cursor-pointer">
                    Exibir URI para configuração manual
                  </summary>
                  <code className="mt-2 block break-all rounded-md bg-surface p-3">
                    {mfaSetup.uri}
                  </code>
                </details>
                <div className="space-y-2">
                  <Label htmlFor="setup-code">Código de 6 dígitos</Label>
                  <Input
                    id="setup-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value.replace(/\D/gu, ""));
                    }}
                    required
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Verificando..." : "Ativar autenticação"}
                </Button>
              </>
            ) : isLoading ? (
              <div
                className="flex items-center justify-center gap-2 py-8 text-sm text-text-muted"
                role="status"
              >
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />{" "}
                Preparando autenticação...
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setupStarted.current = null;
                  setStep({ ...step });
                }}
              >
                Tentar preparar novamente
              </Button>
            )}
          </form>
        ) : null}

        {step?.status === "mfa_required" ? (
          <form onSubmit={submitMfa} className="mt-8 space-y-5">
            {useRecovery ? (
              <div className="space-y-2">
                <Label htmlFor="recovery-code">Código de recuperação</Label>
                <Input
                  id="recovery-code"
                  autoComplete="one-time-code"
                  placeholder="XXXX-XXXX-XXXX"
                  value={recoveryCode}
                  onChange={(event) => {
                    setRecoveryCode(event.target.value.toUpperCase());
                  }}
                  required
                  autoFocus
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/gu, ""));
                  }}
                  required
                  autoFocus
                />
              </div>
            )}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Verificando..." : "Verificar"}
            </Button>
            <Button
              type="button"
              variant="link"
              className="w-full"
              onClick={() => {
                setUseRecovery((current) => !current);
              }}
            >
              {useRecovery
                ? "Usar aplicativo autenticador"
                : "Usar código de recuperação"}
            </Button>
          </form>
        ) : null}

        {recoveryCodes.length > 0 ? (
          <div className="mt-8 space-y-5">
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
              {recoveryCodes.map((recovery) => (
                <code
                  key={recovery}
                  className="rounded bg-background px-3 py-2 text-center font-mono text-sm"
                >
                  {recovery}
                </code>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void copyRecoveryCodes()}
            >
              <Copy className="h-4 w-4" aria-hidden="true" /> Copiar códigos
            </Button>
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => void continueToApp()}
            >
              <Check className="h-4 w-4" aria-hidden="true" /> Já guardei os
              códigos
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
