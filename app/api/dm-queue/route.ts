import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { requireSessionUser, unauthorized } from "@/lib/session"

/**
 * GET /api/dm-queue — lista itens da fila de DM pendentes/processados
 * Query: userId, status (opcional), limit (opcional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const status = searchParams.get("status")
    const limit = Number(searchParams.get("limit") || "50")

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    const sessionUserId = requireSessionUser(request, userId)
    if (!sessionUserId) return unauthorized()

    const supabase = await getSupabaseServerClient()

    let query = supabase
      .from("dm_queue")
      .select("*")
      .eq("user_id", String(userId))
      .order("send_at", { ascending: true })

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    const { data, error } = await query.limit(limit)
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error("[DM Queue] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch queue" }, { status: 500 })
  }
}

/**
 * POST /api/dm-queue — enfileira um novo envio de DM
 * Body: { userId, recipientId, message, sendAt? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, recipientId, message, sendAt } = body

    if (!userId || !recipientId || !message) {
      return NextResponse.json({ error: "Missing required fields: userId, recipientId, message" }, { status: 400 })
    }

    const sessionUserId = requireSessionUser(request, userId)
    if (!sessionUserId) return unauthorized()

    const supabase = await getSupabaseServerClient()

    // Pegar access_token do usuário
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, access_token")
      .eq("id", sessionUserId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const scheduledAt = sendAt
      ? new Date(sendAt).toISOString()
      : new Date(Date.now() + 5000).toISOString() // default: daqui a 5s

    const { data, error } = await supabase
      .from("dm_queue")
      .insert({
        user_id: String(userId),
        recipient_id: String(recipientId),
        access_token: user.access_token,
        message,
        send_at: scheduledAt,
        status: "pending",
        attempts: 0,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, item: data }, { status: 201 })
  } catch (error) {
    console.error("[DM Queue] POST error:", error)
    return NextResponse.json({ error: "Failed to enqueue DM" }, { status: 500 })
  }
}

/**
 * DELETE /api/dm-queue — cancela um item da fila
 * Query: id
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
      .from("dm_queue")
      .delete()
      .eq("id", id)
      .eq("user_id", String(userId))
      .eq("status", "pending") // só cancela se ainda não foi enviado

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[DM Queue] DELETE error:", error)
    return NextResponse.json({ error: "Failed to cancel queue item" }, { status: 500 })
  }
}
