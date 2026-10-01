/**
 * Validation for per-user AI provider base URLs (SSRF hardening).
 *
 * `ai_base_url` is stored per user and the server fetches it with the user's
 * API key in the Authorization header. An unvalidated URL means anyone can
 * point the server at an internal host (cloud metadata, intranet) and/or
 * exfiltrate the API key to an attacker-controlled endpoint.
 *
 * Limitations: this is hostname/IP-literal based. It does not resolve DNS, so
 * a public hostname with a DNS record pointing at an internal IP (DNS
 * rebinding) would still pass. Keep it as defense in depth, not a guarantee.
 */

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost"]
const BLOCKED_HOSTS = ["localhost", "metadata.google.internal", "metadata.goog"]

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "")
}

function isPrivateIpv4(host: string): boolean {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) return false
  const octets = match.slice(1, 5).map(Number)
  if (octets.some((o) => o > 255)) return true // malformed, treat as unsafe
  const [a, b] = octets
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64.0.0/10
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    a >= 224 // multicast + reserved
  )
}

function isBlockedHost(rawHost: string): boolean {
  const host = normalizeHost(rawHost)
  if (!host) return true
  if (BLOCKED_HOSTS.includes(host)) return true
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true
  // Disguised IPv4: decimal (2130706433), octal (017700000001), hex (0x7f000001)
  if (/^(0[0-7]+|\d+|0x[0-9a-f]+)$/i.test(host)) return true
  if (host.includes(":")) {
    // IPv6 literals
    if (host === "::" || host === "::1") return true
    if (/^f[cd]/.test(host)) return true // unique local fc00::/7
    if (/^fe[89ab]/.test(host)) return true // link-local fe80::/10
    if (/^::ffff:/.test(host)) return true // IPv4-mapped
    return false
  }
  if (isPrivateIpv4(host)) return true
  return false
}

/**
 * Validates a user-supplied OpenAI-compatible base URL.
 * Returns the normalized base URL (no trailing slash) or null when unsafe.
 */
export function validateAiBaseUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  const allowHttp = process.env.NODE_ENV !== "production"
  if (parsed.protocol !== "https:" && !(allowHttp && parsed.protocol === "http:")) return null
  if (parsed.username || parsed.password) return null // credentials in URL leak via logs
  if (isBlockedHost(parsed.hostname)) return null

  return trimmed.replace(/\/+$/, "")
}

/**
 * Same rules, but rejects (returns null) instead of silently falling back —
 * used at write time so bad URLs never reach the database.
 */
export function isSafeAiBaseUrl(raw: string | null | undefined): boolean {
  return validateAiBaseUrl(raw) !== null
}
