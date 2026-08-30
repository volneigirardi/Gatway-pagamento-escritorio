import type { ReactElement } from "react";

interface LogoProps {
  className?: string;
}

/**
 * Blupo brand logo.
 *
 * The transparent logo asset is stored in
 * `apps/web/public/logo-transparent.png`. Width is constrained to keep the mark
 * readable on the login card while preserving the original aspect ratio.
 */
export function Logo({ className }: LogoProps): ReactElement {
  return (
    <img
      src="/logo-transparent.png"
      alt="Blupo"
      className={`h-auto max-w-[280px] object-contain ${className ?? ""}`}
      width={280}
      height={96}
      loading="eager"
      decoding="async"
    />
  );
}
