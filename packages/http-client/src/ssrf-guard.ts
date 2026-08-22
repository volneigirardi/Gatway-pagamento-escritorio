import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class SsrfBlockedError extends Error {
  constructor(
    public readonly reason: string,
    public readonly host: string,
  ) {
    super(`Blocked outbound request to "${host}": ${reason}`);
    this.name = "SsrfBlockedError";
  }
}

/** IPv4 ranges that must never be reached from server-initiated outbound calls. */
const BLOCKED_IPV4_RANGES: { base: number[]; bits: number; label: string }[] = [
  { base: [0, 0, 0, 0], bits: 8, label: "current network" },
  { base: [10, 0, 0, 0], bits: 8, label: "private (RFC1918)" },
  { base: [100, 64, 0, 0], bits: 10, label: "carrier-grade NAT" },
  { base: [127, 0, 0, 0], bits: 8, label: "loopback" },
  { base: [169, 254, 0, 0], bits: 16, label: "link-local / cloud metadata" },
  { base: [172, 16, 0, 0], bits: 12, label: "private (RFC1918)" },
  { base: [192, 0, 0, 0], bits: 24, label: "IETF protocol assignments" },
  { base: [192, 168, 0, 0], bits: 16, label: "private (RFC1918)" },
  { base: [198, 18, 0, 0], bits: 15, label: "benchmark testing" },
  { base: [224, 0, 0, 0], bits: 4, label: "multicast" },
  { base: [240, 0, 0, 0], bits: 4, label: "reserved" },
];

function ipv4ToInt(ip: string): number {
  return (
    ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
  );
}

function isBlockedIpv4(ip: string): string | null {
  const value = ipv4ToInt(ip);
  for (const range of BLOCKED_IPV4_RANGES) {
    const baseValue = ipv4ToInt(range.base.join("."));
    const mask = range.bits === 0 ? 0 : (~0 << (32 - range.bits)) >>> 0;
    if ((value & mask) === (baseValue & mask)) {
      return range.label;
    }
  }
  return null;
}

function isBlockedIpv6(ip: string): string | null {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return "loopback";
  if (normalized === "::") return "unspecified";
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe8"))
    return "link-local";
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return "unique local (RFC4193)";
  if (normalized.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 address; re-check the embedded IPv4 address.
    const mapped = normalized.replace("::ffff:", "");
    if (isIP(mapped) === 4) return isBlockedIpv4(mapped);
  }
  return null;
}

export interface SsrfGuardOptions {
  /** Additional hostnames that are always allowed even if they resolve privately (e.g. local dev). */
  allowedHosts?: string[];
}

/**
 * Resolves `url`'s hostname and throws `SsrfBlockedError` if it points to a
 * private, loopback, link-local, or cloud-metadata address. Must be called
 * for every outbound request built from tenant/webhook-supplied URLs —
 * DNS rebinding after this check is a residual risk; prefer pinning the
 * resolved IP for the actual connection when the HTTP client supports it.
 */
export async function assertPublicHttpUrl(
  url: string,
  options: SsrfGuardOptions = {},
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfBlockedError("invalid URL", url);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new SsrfBlockedError(
      `unsupported protocol "${parsed.protocol}"`,
      parsed.hostname,
    );
  }

  if (options.allowedHosts?.includes(parsed.hostname)) {
    return;
  }

  const directIpVersion = isIP(parsed.hostname);
  const addresses =
    directIpVersion !== 0
      ? [{ address: parsed.hostname, family: directIpVersion as 4 | 6 }]
      : await lookup(parsed.hostname, { all: true, verbatim: true });

  if (addresses.length === 0) {
    throw new SsrfBlockedError("could not resolve host", parsed.hostname);
  }

  for (const { address, family } of addresses) {
    const blockedReason =
      family === 4 ? isBlockedIpv4(address) : isBlockedIpv6(address);
    if (blockedReason) {
      throw new SsrfBlockedError(
        `resolves to ${blockedReason} address ${address}`,
        parsed.hostname,
      );
    }
  }
}
