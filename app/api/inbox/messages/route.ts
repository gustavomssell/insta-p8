import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { getSessionUserId, notFound, unauthorized } from "@/lib/session"

export async function GET(request: NextRequest) {
    try {
        const conversationId = request.nextUrl.searchParams.get("conversationId")
        if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 })
        const sessionUserId = getSessionUserId(request)
        if (!sessionUserId) return unauthorized()

        const supabase = await getSupabaseServerClient()

        // The conversation must belong to the session user
        const { data: conversation } = await supabase
            .from("conversations")
            .select("user_id")
            .eq("id", conversationId)
            .maybeSingle()
        if (!conversation || String(conversation.user_id) !== sessionUserId) return notFound()

        // Fetch messages for this conversation
        const { data: messages, error } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true })

        if (error) throw error

        return NextResponse.json(messages)
    } catch (error) {
        console.error("[Inbox] Messages GET error:", error)
        return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }
}
