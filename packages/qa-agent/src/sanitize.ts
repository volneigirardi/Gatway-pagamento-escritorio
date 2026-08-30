interface SanitizeResult {
  readonly safe: boolean;
  readonly sanitized: string;
  readonly violations: readonly string[];
}

const secretPatterns: readonly RegExp[] = [
  /-----BEGIN [A-Z ]+?PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+?PRIVATE KEY-----/gu,
  /-----BEGIN [A-Z ]+?CERTIFICATE-----[\s\S]*?-----END [A-Z ]+?CERTIFICATE-----/gu,
  /\b[A-Za-z0-9_]*(?:api[_-]?key|apikey|secret[_-]?key|private[_-]?key|token|password|passwd|pwd)\s*[:=]\s*["']?[\w+/=-]{8,}["']?/giu,
  /\b(?:sk|pk)_[a-z0-9]{24,}\b/giu,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gu, // email as PII
];

const denialPatterns: readonly RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/gu, // SSN-like
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/gu, // CNPJ
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/gu, // CPF
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/gu, // PAN
];

export function sanitizeForMemory(input: string): SanitizeResult {
  let sanitized = input;
  const violations: string[] = [];

  for (const pattern of secretPatterns) {
    sanitized = sanitized.replace(pattern, () => {
      violations.push("redacted secret/PII pattern at input position");
      return "[REDACTED]";
    });
  }

  for (const pattern of denialPatterns) {
    const matches = sanitized.match(pattern);
    if (matches) {
      for (const match of matches) {
        violations.push(
          `denied PII/sensitive pattern: ${match.slice(0, 8)}...`,
        );
      }
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }
  }

  return {
    safe: violations.length === 0,
    sanitized,
    violations,
  };
}

export function assertSafeForMemory(input: string): string {
  const result = sanitizeForMemory(input);
  if (!result.safe) {
    throw new Error(
      `Unsafe content for QA memory: ${result.violations.join("; ")}`,
    );
  }
  return result.sanitized;
}
