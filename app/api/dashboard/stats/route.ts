import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { requireSessionUser, unauthorized } from "@/lib/session"

export async function GET(request: NextRequest) {
    try {
        const userId = request.nextUrl.searchParams.get("userId")
        if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
        const sessionUserId = requireSessionUser(request, userId)
        if (!sessionUserId) return unauthorized()

        const supabase = await getSupabaseServerClient()

        // 1. Total Automations
        const automationsQuery = supabase
            .from("automations")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)

        // 2. Active Triggers
        const activeQuery = supabase
            .from("automations")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("is_active", true)

        // 3. Audience Reached (Total Conversations)
        const audienceQuery = supabase
            .from("conversations")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)

        // 4. Messages Sent (where is_from_instagram is false, implying bot/system sent it)
        const sentQuery = supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("is_from_instagram", false)

        // 5. Recent Activity (Last 5 messages sent by bot)
        const recentQuery = supabase
            .from("messages")
            .select("id, content, created_at, sender_username, conversation_id, recipient:conversations(recipient_username)")
            .eq("user_id", userId)
            .eq("is_from_instagram", false)
            .order("created_at", { ascending: false })
            .limit(5)

        const results = await Promise.all([automationsQuery, activeQuery, audienceQuery, sentQuery, recentQuery])
        const failed = results.find(result => result.error)
        if (failed?.error) throw failed.error
        const [
            { count: automationsCount },
            { count: activeTriggersCount },
            { count: audienceCount },
            { count: messagesSentCount },
            { data: recentMessages },
        ] = results

        // ---- 30-day timeseries (analytics page) ----
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const [messagesWindow, conversationsWindow] = await Promise.all([
            supabase
                .from("messages")
                .select("created_at, is_from_instagram")
                .eq("user_id", sessionUserId)
                .gte("created_at", since)
                .order("created_at", { ascending: true })
                .limit(5000),
            supabase
                .from("conversations")
                .select("created_at")
                .eq("user_id", sessionUserId)
                .gte("created_at", since)
                .order("created_at", { ascending: true })
                .limit(2000),
        ])
        if (messagesWindow.error) throw messagesWindow.error
        if (conversationsWindow.error) throw conversationsWindow.error

        const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10)
        const seriesByDay = new Map<string, { date: string; sent: number; received: number; newConversations: number }>()
        for (let i = 29; i >= 0; i--) {
            const key = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            seriesByDay.set(key, { date: key, sent: 0, received: 0, newConversations: 0 })
        }
        for (const message of messagesWindow.data || []) {
            const bucket = seriesByDay.get(dayKey(message.created_at))
            if (!bucket) continue
            if (message.is_from_instagram) bucket.received++
            else bucket.sent++
        }
        for (const conversation of conversationsWindow.data || []) {
            const bucket = seriesByDay.get(dayKey(conversation.created_at))
            if (bucket) bucket.newConversations++
        }
        const timeseries = [...seriesByDay.values()]
        const windowReceived = timeseries.reduce((total, day) => total + day.received, 0)
        const windowSent = timeseries.reduce((total, day) => total + day.sent, 0)

        return NextResponse.json({
            metrics: {
                totalAutomations: automationsCount || 0,
                activeTriggers: activeTriggersCount || 0,
                audienceReached: audienceCount || 0,
                messagesSent: messagesSentCount || 0,
            },
            recentActivity: recentMessages || [],
            timeseries,
            window: {
                days: 30,
                sent: windowSent,
                received: windowReceived,
                newConversations: timeseries.reduce((total, day) => total + day.newConversations, 0),
                replyRatio: windowReceived > 0 ? Math.round((windowSent / windowReceived) * 100) : null,
            },
        })
    } catch (error) {
        console.error("[v0] Dashboard Stats error:", error)
        return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
    }
}
