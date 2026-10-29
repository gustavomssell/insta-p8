import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

/**
 * POST /api/webhook/test — simula um webhook do Instagram localmente.
 * Disponível apenas em desenvolvimento (NODE_ENV !== "production").
 *
 * Body: { entry?: any, secret?: string }
 *
 * Útil para testar o fluxo de automação sem depender do Instagram real.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { entry, secret } = body

    if (!entry) {
      return NextResponse.json({ error: "Missing 'entry' in body" }, { status: 400 })
    }

    const rawBody = JSON.stringify({ entry })
    const signingSecret = secret || process.env.INSTAGRAM_APP_SECRET || "test-secret"
    const signature = "sha256=" + crypto.createHmac("sha256", signingSecret).update(rawBody, "utf8").digest("hex")

    // Encaminha para o webhook real com a assinatura simulada
    const webhookUrl = new URL("/api/instagram/webhook", request.url).toString()
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: rawBody,
    })

    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error("[Webhook Test] error:", error)
    return NextResponse.json({ error: "Webhook test failed" }, { status: 500 })
  }
}
