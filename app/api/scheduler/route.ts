import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { requireSessionUser, unauthorized } from "@/lib/session"

/**
 * GET /api/scheduler — configuração do agendador para o usuário
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
      .from("scheduler_config")
      .select("*")
      .eq("user_id", Number(userId))
      .maybeSingle()

    if (error) throw error
    return NextResponse.json(data ?? null)
  } catch (error) {
    console.error("[Scheduler] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch scheduler config" }, { status: 500 })
  }
}

/**
 * PUT /api/scheduler — cria ou atualiza a configuração do agendador
 * Body: { userId, intervalMinutes, startTime, endTime, isRunning }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, intervalMinutes, startTime, endTime, isRunning } = body

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    const sessionUserId = requireSessionUser(request, userId)
    if (!sessionUserId) return unauthorized()

    const supabase = await getSupabaseServerClient()

    const now = new Date().toISOString()
    const upsert: any = {
      user_id: Number(userId),
      interval_minutes: intervalMinutes ?? 240,
      start_time: startTime ?? "09:00:00",
      end_time: endTime ?? "21:00:00",
      updated_at: now,
    }
    if (typeof isRunning === "boolean") upsert.is_running = isRunning

    const { data, error } = await supabase
      .from("scheduler_config")
      .upsert(upsert, { onConflict: "user_id" })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error("[Scheduler] PUT error:", error)
    return NextResponse.json({ error: "Failed to save scheduler config" }, { status: 500 })
  }
}

/**
 * POST /api/scheduler/run — executa uma rodada do agendador manualmente
 * (chamado por cron ou pelo frontend em dev). Publica o próximo item do
 * content_pool como Reel/Post para cada usuário com scheduler ativo.
 * Body: { userId? } — se omitido, roda para todos os usuários com scheduler ativo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    const supabase = await getSupabaseServerClient()

    // Buscar configs ativas
    let query = supabase
      .from("scheduler_config")
      .select("*")
      .eq("is_running", true)
      .lte("next_run_at", new Date().toISOString())

    if (userId) {
      const sessionUserId = requireSessionUser(request, userId)
      if (!sessionUserId) return unauthorized()
      query = query.eq("user_id", Number(userId))
    }

    const { data: configs, error: cfgError } = await query
    if (cfgError) throw cfgError
    if (!configs?.length) return NextResponse.json({ processed: 0 })

    const results: any[] = []

    for (const config of configs) {
      // Buscar próximo item do content_pool desse usuário
      const { data: poolItems, error: poolError } = await supabase
        .from("content_pool")
        .select("*")
        .eq("user_id", config.user_id)
        .eq("is_active", true)
        .gte("sequence_index", config.current_sequence_index || 1)
        .order("sequence_index", { ascending: true })
        .limit(1)

      if (poolError) {
        results.push({ user_id: config.user_id, error: poolError.message })
        continue
      }
      if (!poolItems?.length) {
        results.push({ user_id: config.user_id, error: "No active content in pool" })
        continue
      }

      const item = poolItems[0]

      // Criar registro de reels_posts pendente
      const { data: reel, error: reelError } = await supabase
        .from("reels_posts")
        .insert({
          user_id: config.user_id,
          content_pool_id: item.id,
          video_url: item.video_url,
          caption: item.caption || "",
          status: "PENDING",
        })
        .select()
        .single()

      if (reelError) {
        results.push({ user_id: config.user_id, error: reelError.message })
        continue
      }

      // Avançar sequência e atualizar próxima execução
      const nextSeq = (config.current_sequence_index || 1) + 1
      const nextRun = new Date(Date.now() + config.interval_minutes * 60 * 1000).toISOString()

      await supabase
        .from("scheduler_config")
        .update({
          current_sequence_index: nextSeq,
          last_run_at: new Date().toISOString(),
          next_run_at: nextRun,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", config.user_id)

      results.push({ user_id: config.user_id, reelId: reel.id, status: "PENDING" })
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    console.error("[Scheduler] run error:", error)
    return NextResponse.json({ error: "Scheduler run failed" }, { status: 500 })
  }
}
