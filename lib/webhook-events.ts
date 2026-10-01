/**
 * Persistent audit log for webhook deliveries.
 *
 * Writes to public.webhook_events so "why didn't the bot reply?" is answerable
 * after Vercel's ~1 hour of log retention is gone. Inserts are queued and
 * flushed together right before the webhook responds — fire-and-forget would be
 * dropped when the serverless function freezes after the response.
 */

type EventsClient = Awaited<ReturnType<typeof import("@/lib/supabase-server").getSupabaseServerClient>>

export type EventSink = Array<PromiseLike<unknown>>

export function trackWebhookEvent(
  supabase: EventsClient,
  sink: EventSink,
  eventType: string,
  userId: string | number | null | undefined,
  data: Record<string, unknown>,
): void {
  try {
    const payload = {
      event_type: eventType,
      user_id: userId ?? null,
      data: JSON.parse(JSON.stringify(data)) as Record<string, unknown>,
    }
    sink.push(supabase.from("webhook_events").insert(payload))
  } catch (error) {
    console.warn("[webhook-events] failed to queue", eventType, error)
  }
}

export async function flushWebhookEvents(sink: EventSink): Promise<void> {
  if (sink.length === 0) return
  const results = await Promise.allSettled(sink.map((pending) => Promise.resolve(pending)))
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[webhook-events] insert failed:", result.reason)
    }
  }
}
