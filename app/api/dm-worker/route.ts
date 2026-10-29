import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { requireSessionUser, unauthorized } from "@/lib/session"

/**
 * POST /api/dm-worker — processa a fila de DMs pendentes.
 *
 * Disponível apenas em desenvolvimento como endpoint manual; em produção
 * deve ser chamado por um cron job (Vercel Cron / Supabase pg_cron).
 *
 * Body: { userId?, limit? } — se userId omitido, processa todos os usuários.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    // Em produção, exige um header secreto para evitar execução não autorizada
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${process.env.DM_WORKER_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const body = await request.json()
    const { userId, limit = 50 } = body

    const supabase = await getSupabaseServerClient()
    const now = new Date().toISOString()

    // Buscar itens pendentes cujo send_at já passou
    let query = supabase
      .from("dm_queue")
      .select("*")
      .eq("status", "pending")
      .lte("send_at", now)
      .order("send_at", { ascending: true })
      .limit(limit)

    if (userId) {
      const sessionUserId = requireSessionUser(request, userId)
      if (!sessionUserId) return unauthorized()
      query = query.eq("user_id", String(userId))
    }

    const { data: items, error: fetchError } = await query
    if (fetchError) throw fetchError
    if (!items?.length) {
      return NextResponse.json({ processed: 0 })
    }

    const results: any[] = []

    for (const item of items) {
      // Incrementar tentativas
      const newAttempts = (item.attempts || 0) + 1

      try {
        const res = await fetch(
          `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(item.access_token || "")}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { id: item.recipient_id },
              message: { text: item.message },
            }),
          }
        )

        const data = await res.json().catch(() => ({}))

        if (!res.ok || data.error) {
          throw new Error(data.error?.message || `HTTP ${res.status}`)
        }

        // Sucesso
        await supabase
          .from("dm_queue")
          .update({ status: "sent", attempts: newAttempts, updated_at: now })
          .eq("id", item.id)

        results.push({ id: item.id, recipient_id: item.recipient_id, status: "sent" })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        const maxAttempts = 3

        if (newAttempts >= maxAttempts) {
          // Esgotou tentativas — marcar como falhado
          await supabase
            .from("dm_queue")
            .update({ status: "failed", attempts: newAttempts, error_message: errorMessage, updated_at: now })
            .eq("id", item.id)
          results.push({ id: item.id, recipient_id: item.recipient_id, status: "failed", error: errorMessage })
        } else {
          // Reagendar com backoff exponencial: 1min, 5min, 30min
          const backoffMinutes = Math.pow(5, newAttempts - 1)
          const nextSend = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString()
          await supabase
            .from("dm_queue")
            .update({ status: "pending", attempts: newAttempts, send_at: nextSend, error_message: errorMessage, updated_at: now })
            .eq("id", item.id)
          results.push({ id: item.id, recipient_id: item.recipient_id, status: "retry", next_send: nextSend })
        }
      }
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    console.error("[DM Worker] error:", error)
    return NextResponse.json({ error: "DM worker failed" }, { status: 500 })
  }
}
