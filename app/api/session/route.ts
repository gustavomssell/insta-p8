import { type NextRequest, NextResponse } from "next/server"
import { getSession, SESSION_COOKIE, unauthorized } from "@/lib/session"

/**
 * GET /api/session — returns the identity from the signed session cookie.
 * The client uses this instead of trusting localStorage.
 */
export async function GET(request: NextRequest) {
  const session = getSession(request)
  if (!session) return unauthorized()
  return NextResponse.json({ userId: session.userId, username: session.username })
}

/**
 * DELETE /api/session — clears the httpOnly session cookie.
 * (httpOnly cookies cannot be cleared from client-side JavaScript.)
 */
export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  })
  return response
}
