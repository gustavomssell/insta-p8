import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { requireSessionUser, unauthorized } from "@/lib/session"
import { getFreshAccessToken } from "@/lib/ig-token"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userId, recipientId, message, attachment } = body

        if (!userId || !recipientId || (!message && !attachment)) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }
        const sessionUserId = requireSessionUser(request, userId)
        if (!sessionUserId) return unauthorized()

        const supabase = await getSupabaseServerClient()

        // 1. Get User Access Token
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("id, access_token, token_expires_at, username, business_account_id")
            .eq("id", sessionUserId)
            .single()

        if (userError || !user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        const accessToken = await getFreshAccessToken(user, supabase)

        // 2. Prepare Payload for Instagram API
        const apiBody: any = { recipient: { id: recipientId } }

        if (message) {
            apiBody.message = { text: message }
        } else if (attachment) {
            apiBody.message = { attachment }
        }

        // 3. Send to Instagram
        const res = await fetch(
            `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(accessToken || "")}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(apiBody)
            }
        )

        const data = await res.json()

        if (data.error) {
            console.error("[Inbox Send] Instagram API Error:", data.error)
            return NextResponse.json({ error: data.error.message }, { status: 500 })
        }

        // 4. Log to Database (Outbound Message)
        // Find Conversation ID first
        const { data: conv } = await supabase
            .from("conversations")
            .select("id")
            .eq("user_id", userId)
            .eq("recipient_id", recipientId)
            .single()

        // If conversation doesn't exist (unlikely if replying, but possible if initiating), create it logic is tricky here 
        // without knowing username. Assuming it exists for now as this is usually a reply flow.

        if (conv) {
            await supabase.from("messages").insert({
                id: `mid_out_${Date.now()}_${Math.random()}`,
                conversation_id: conv.id,
                user_id: userId,
                sender_id: user.business_account_id,
                sender_username: user.username,
                content: message || "[Attachment]",
                is_from_instagram: false
            })

            // Update conversation timestamp
            await supabase
                .from("conversations")
                .update({ last_message_at: new Date().toISOString() })
                .eq("id", conv.id)
        }

        return NextResponse.json({ success: true, data })

    } catch (error) {
        console.error("[Inbox Send] Internal Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
