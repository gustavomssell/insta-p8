import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { requireSessionUser, unauthorized } from "@/lib/session"
import { getFreshAccessToken } from "@/lib/ig-token"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    const sessionUserId = requireSessionUser(request, userId)
    if (!sessionUserId) return unauthorized()

    const supabase = await getSupabaseServerClient()

    // 1. Get Access Token
    const { data: user } = await supabase
      .from("users")
      .select("id, access_token, token_expires_at")
      .eq("id", sessionUserId)
      .single()

    if (!user?.access_token) {
      return NextResponse.json({ error: "Instagram not connected" }, { status: 401 })
    }

    const accessToken = await getFreshAccessToken(user, supabase)

    // 2. Fetch Media (Smart Method: /me/media)
    // The token is sent in the query string because that is how the Graph API
    // accepts auth, but it must never be logged.
    const url = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=24&access_token=${encodeURIComponent(accessToken || "")}`

    console.log("[v0] Fetching media list for user", sessionUserId)

    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()

    if (data.error) {
      console.error("[v0] Instagram Media Error:", data.error)
      // Agar Token Invalid hai, to user ko Logout karne bolenge frontend pe
      if (data.error.code === 190) {
         return NextResponse.json({ error: "Session Expired. Please Logout & Login." }, { status: 401 })
      }
      return NextResponse.json({ error: data.error.message }, { status: 500 })
    }

    // Normalize: pick thumbnail_url for videos, media_url for images.
    // Skips items with neither URL so we never return the broken `image_url: null` shape.
    const normalized = (data.data || [])
      .map((m: any) => ({
        ...m,
        image_url: m.thumbnail_url || m.media_url || null,
      }))
      .filter((m: any) => typeof m.image_url === "string" && m.image_url.length > 0)

    return NextResponse.json({ data: normalized })
  } catch (error) {
    console.error("[v0] Server Error:", error)
    return NextResponse.json({ error: "Server Error" }, { status: 500 })
  }
}
