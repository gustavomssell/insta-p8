import { createHmac, timingSafeEqual } from "crypto"
import { type NextRequest, NextResponse } from "next/server"

/**
 * Signed session cookie.
 *
 * The session value is `<base64url payload>.<base64url HMAC-SHA256>` so the
 * server can trust `userId` without a database round trip. An unsigned JSON
 * cookie (the old format) was forgeable by anyone.
 *
 * Secret resolution order: SESSION_SECRET -> INSTAGRAM_APP_SECRET ->
 * SUPABASE_SERVICE_ROLE_KEY. Set SESSION_SECRET explicitly in production.
 */
export const SESSION_COOKIE = "insta_session"

export interface SessionPayload {
  userId: string
  username: string
}

function getSecret(): string {
  const secret =
    process.env.SESSION_SECRET || process.env.INSTAGRAM_APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error(
      "Missing session secret: set SESSION_SECRET (recommended) or INSTAGRAM_APP_SECRET in the environment",
    )
  }
  return secret
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload, "utf8").digest("base64url")
}

export function encodeSession(session: SessionPayload): string {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function decodeSession(raw: string | null | undefined): SessionPayload | null {
  if (!raw) return null
  try {
    const separator = raw.lastIndexOf(".")
    if (separator <= 0) return null

    const payload = raw.slice(0, separator)
    const mac = raw.slice(separator + 1)
    const expected = sign(payload)

    const macBuf = Buffer.from(mac, "utf8")
    const expectedBuf = Buffer.from(expected, "utf8")
    if (macBuf.length !== expectedBuf.length || !timingSafeEqual(macBuf, expectedBuf)) return null

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SessionPayload>
    if (!parsed || typeof parsed.userId !== "string" || !parsed.userId) return null
    return {
      userId: parsed.userId,
      username: typeof parsed.username === "string" ? parsed.username : "",
    }
  } catch {
    // Any failure (bad signature, malformed payload, missing secret) means
    // "no session" — never a 500.
    return null
  }
}

export function getSession(request: NextRequest): SessionPayload | null {
  return decodeSession(request.cookies.get(SESSION_COOKIE)?.value)
}

export function getSessionUserId(request: NextRequest): string | null {
  return getSession(request)?.userId ?? null
}

/**
 * Returns the session userId only when it matches `requestedUserId`.
 * Use for routes that receive userId in the query string or body.
 */
export function requireSessionUser(
  request: NextRequest,
  requestedUserId: string | null | undefined,
): string | null {
  const sessionUserId = getSessionUserId(request)
  if (!sessionUserId || !requestedUserId || sessionUserId !== requestedUserId) return null
  return sessionUserId
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export function setSessionCookie(
  response: NextResponse,
  session: SessionPayload,
  maxAgeSeconds: number,
): void {
  response.cookies.set(SESSION_COOKIE, encodeSession(session), {
    path: "/",
    maxAge: maxAgeSeconds,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  })
}
