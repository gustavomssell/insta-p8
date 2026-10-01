/**
 * Instagram long-lived token refresh.
 *
 * Long-lived tokens live 60 days and the app never prompted a re-login when
 * they died (token_expires_at was written but never read). This helper
 * refreshes a token when it is inside the refresh window and persists the new
 * value so every caller keeps working.
 *
 * Refresh endpoint (Meta): GET https://graph.instagram.com/refresh_access_token
 *   ?grant_type=ig_refresh_token&access_token=<long-lived-token>
 *
 * Notes:
 * - Refresh only succeeds while the current token is still valid; tokens that
 *   have already expired require a full re-login. We refresh early (7 days
 *   before expiry) to stay well inside the valid window.
 * - Refreshes are de-duplicated per user per instance so concurrent requests
 *   do not race and invalidate each other's token.
 */

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // refresh when < 7 days remain
const REFRESH_TIMEOUT_MS = 10000

export interface TokenRow {
  id: string | number
  access_token?: string | null
  token_expires_at?: string | null
}

/** Any Supabase client returned by lib/supabase-server. */
export type TokenClient = Awaited<ReturnType<typeof import("@/lib/supabase-server").getSupabaseServerClient>>

const inFlight = new Map<string, Promise<string | null>>()
// After a failed refresh, do not hammer the endpoint on every webhook — the
// failure is usually permanent (expired/revoked token) and each attempt costs
// a network round trip inside the reply path.
const REFRESH_FAILURE_BACKOFF_MS = 60 * 60 * 1000
const lastFailureAt = new Map<string, number>()

function needsRefresh(user: TokenRow): boolean {
  const token = user.access_token
  if (!token || token.startsWith("TEST_")) return false
  const expiresAt = user.token_expires_at ? Date.parse(user.token_expires_at) : Number.NaN
  if (!Number.isFinite(expiresAt)) return true
  return expiresAt - Date.now() < REFRESH_WINDOW_MS
}

function markFailure(userId: string | number) {
  lastFailureAt.set(String(userId), Date.now())
}

async function refreshOnce(user: TokenRow, supabase: TokenClient): Promise<string | null> {
  const current = user.access_token
  if (!current) return null

  try {
    const url =
      "https://graph.instagram.com/refresh_access_token" +
      `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS) })
    const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: unknown }

    if (!res.ok || !data.access_token) {
      // Not refreshable (expired, revoked, invalid). Keep serving the current
      // token: it may still be valid, and the caller surfaces error 190 to the
      // user if it is not.
      console.warn("[ig-token] refresh failed for user", user.id, JSON.stringify(data).slice(0, 200))
      markFailure(user.id)
      return current
    }

    const expiresIn = typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : 5184000
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    const { error } = await supabase
      .from("users")
      .update({ access_token: data.access_token, token_expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq("id", user.id)
    if (error) {
      console.warn("[ig-token] failed to persist refreshed token for user", user.id, error)
    } else {
      console.log(`[ig-token] refreshed access token for user ${user.id} (expires ${expiresAt})`)
    }
    lastFailureAt.delete(String(user.id))
    return data.access_token
  } catch (error) {
    console.warn("[ig-token] refresh error for user", user.id, error)
    markFailure(user.id)
    return current
  }
}

/**
 * Returns a valid access token for the given user row, refreshing and
 * persisting it when close to expiry. Falls back to the current token when
 * the refresh call fails.
 */
export async function getFreshAccessToken(user: TokenRow, supabase: TokenClient): Promise<string | null> {
  if (!user?.access_token) return null
  if (!needsRefresh(user)) return user.access_token

  const key = String(user.id)
  const failedAt = lastFailureAt.get(key)
  if (failedAt && Date.now() - failedAt < REFRESH_FAILURE_BACKOFF_MS) return user.access_token

  const pending = inFlight.get(key)
  if (pending) return pending

  const task = refreshOnce(user, supabase).finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, task)
  return task
}
