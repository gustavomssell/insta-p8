import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { requireSessionUser, unauthorized } from "@/lib/session"

/**
 * GET /api/content-pool — lista itens do pool de conteúdo do usuário
 * Query: userId
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    const sessionUserId = requireSessionUser(request, userId)
    if (!sessionUserId) return unauthorized()

    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      .from("content_pool")
      .select("*")
      .eq("user_id", Number(userId))
      .eq("is_active", true)
      .order("sequence_index", { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error("[Content Pool] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch content pool" }, { status: 500 })
  }
}

/**
 * POST /api/content-pool — adiciona item ao pool de conteúdo
 * Body: { userId, videoUrl, caption, coverUrl?, thumbnailUrl?, automationTemplate? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, videoUrl, caption, coverUrl, thumbnailUrl, automationTemplate } = body

    if (!userId || !videoUrl) {
      return NextResponse.json({ error: "Missing required fields: userId, videoUrl" }, { status: 400 })
    }

    const sessionUserId = requireSessionUser(request, userId)
    if (!sessionUserId) return unauthorized()

    const supabase = await getSupabaseServerClient()

    // Pegar próximo índice de sequência
    const { data: lastItem } = await supabase
      .from("content_pool")
      .select("sequence_index")
      .eq("user_id", Number(userId))
      .order("sequence_index", { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextIndex = lastItem ? (lastItem.sequence_index || 0) + 1 : 1

    const { data, error } = await supabase
      .from("content_pool")
      .insert({
        user_id: Number(userId),
        video_url: videoUrl,
        caption: caption || null,
        cover_url: coverUrl || null,
        thumbnail_url: thumbnailUrl || null,
        sequence_index: nextIndex,
        is_active: true,
        automation_template: automationTemplate || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("[Content Pool] POST error:", error)
    return NextResponse.json({ error: "Failed to add content to pool" }, { status: 500 })
  }
}

/**
 * PUT /api/content-pool — atualiza item do pool
 * Body: { userId, id, ...campos }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, id, ...updates } = body

    if (!userId || !id) {
      return NextResponse.json({ error: "Missing userId or id" }, { status: 400 })
    }
    const sessionUserId = requireSessionUser(request, userId)
    if (!sessionUserId) return unauthorized()

    const supabase = await getSupabaseServerClient()

    const { data, error } = await supabase
      .from("content_pool")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", Number(userId))
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error("[Content Pool] PUT error:", error)
    return NextResponse.json({ error: "Failed to update content" }, { status: 500 })
  }
}

/**
 * DELETE /api/content-pool — remove item do pool
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
      .from("content_pool")
      .delete()
      .eq("id", id)
      .eq("user_id", Number(userId))

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Content Pool] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete content" }, { status: 500 })
  }
}
