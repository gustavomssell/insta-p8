"use client"

import { useEffect, useState } from "react"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import { Button } from "@/components/ui/button"
import { Loader2, Mail, Clock, Trash2, RefreshCw, Play, Pause, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface QueueItem {
  id: string
  user_id: string
  recipient_id: string
  message: string
  send_at: string
  status: "pending" | "sent" | "failed" | "retry"
  attempts: number
  error_message?: string | null
  created_at: string
}

export default function DMQueuePage() {
  const { userId, isLoading } = useInstagramSession()
  const [items, setItems] = useState<QueueItem[]>([])
  const [statusFilter, setStatusFilter] = useState("pending")
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!userId) return
    fetchItems()
  }, [userId, statusFilter])

  async function fetchItems() {
    setLoading(true)
    try {
      const res = await fetch(`/api/dm-queue?userId=${userId}&status=${statusFilter}&limit=100`)
      const data = await res.json()
      if (Array.isArray(data)) setItems(data)
    } catch (e) {
      console.error("Failed to fetch DM queue", e)
    } finally {
      setLoading(false)
    }
  }

  async function processQueue() {
    setProcessing(true)
    try {
      const res = await fetch("/api/dm-worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, limit: 50 }),
      })
      const data = await res.json()
      if (data.processed && data.processed > 0) {
        fetchItems()
      }
    } catch (e) {
      console.error("Failed to process queue", e)
    } finally {
      setProcessing(false)
    }
  }

  async function cancelItem(id: string) {
    if (!window.confirm("Cancel this queued message?")) return
    try {
      await fetch(`/api/dm-queue?id=${id}&userId=${userId}`, { method: "DELETE" })
      fetchItems()
    } catch (e) {
      console.error("Failed to cancel", e)
    }
  }

  const statusColor: Record<string, string> = {
    pending: "bg-secondary text-secondary-foreground",
    sent: "bg-green-500/10 text-green-400 border border-green-500/30",
    failed: "bg-destructive/10 text-destructive border border-destructive/30",
    retry: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30",
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
  }
  if (!userId) return <p className="p-8 text-sm text-muted-foreground">Connect your Instagram account.</p>

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">DM Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scheduled and pending direct messages. Failed items are retried with exponential backoff.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={processQueue}
            disabled={processing || items.filter(i => i.status === "pending").length === 0}
            className="flex items-center gap-2"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {processing ? "Processing…" : "Process Queue"}
          </Button>
          <Button onClick={() => fetchItems()} variant="outline" size="sm" className="hidden md:flex">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {["pending", "sent", "failed", "retry"].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className="text-xs px-3 py-1.5"
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} <span className="opacity-60">{items.filter(i => i.status === s).length}</span>
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-xs font-medium text-muted-foreground">
                <th className="p-3">Recipient</th>
                <th className="p-3">Message</th>
                <th className="p-3">Send at</th>
                <th className="p-3">Status</th>
                <th className="p-3">Attempts</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No {statusFilter} items.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-3 font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                      {item.recipient_id}
                    </td>
                    <td className="p-3 truncate max-w-[200px]">{item.message}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {new Date(item.send_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-mono ${statusColor[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs">{item.attempts}</td>
                    <td className="p-3 text-right">
                      {item.status === "pending" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => cancelItem(item.id)}
                          className="p-1.5"
                          title="Cancel"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                      {item.status === "failed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelItem(item.id)}
                          className="p-1.5"
                          title="Remove failed item"
                        >
                          <XCircle className="w-3 h-3" />
                        </Button>
                      )}
                      {item.error_message && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5 text-muted-foreground hover:text-destructive"
                          title={item.error_message}
                        >
                          <Mail className="w-3 h-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
