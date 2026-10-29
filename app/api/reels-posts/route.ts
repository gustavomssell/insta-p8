import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { requireSessionUser, unauthorized } from "@/lib/session"

/**
 * GET /api/reels-posts — lista posts/reels agendados do usuário
 * Query: userId, status (opcional)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    const status = request.nextUrl.searchParams.get("status")
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    const sessionUserId = requireSessionUser(request, userId)
    if (!sessionUserId) return unauthorized()

    const supabase = await getSupabaseServerClient()
    let query = supabase
      .from("reels_posts")
      .select("*, content_pool:content_pool_id(video_url, caption, sequence_index)")
      .eq("user_id", Number(userId))
      .order("created_at", { ascending: false })

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error("[Reels Posts] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch reels posts" }, { status: 500 })
  }
}

/**
 * DELETE /api/reels-posts — remove um post agendado
 * Query: id, userId
 */
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id")
    const userId = request.nextUrl.searchParams.get("userId")
    if (!id || !userId) {
      return NextResponse.json({ error: "Missing id or userId" }, { status: 400 })
    }
    const sessionUserId = requireSessionUser(request, userId)
    if (!sessionUserId) return unauthorized()

    const supabase = await getSupabaseServerClient()
    const { error } = await supabase
      .from("reels_posts")
      .delete()
      .eq("id", id)
      .eq("user_id", Number(userId))

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Reels Posts] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 })
  }
}
