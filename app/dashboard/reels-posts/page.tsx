"use client"

import { useEffect, useState } from "react"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import { Button } from "@/components/ui/button"
import { Loader2, Video, RefreshCw, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReelPost {
  id: string
  user_id: number
  content_pool_id: string | null
  video_url: string
  caption: string | null
  ig_container_id: string | null
  ig_media_id: string | null
  status: "PENDING" | "PUBLISHED" | "FAILED"
  error_message: string | null
  published_at: string | null
  created_at: string
  content_pool?: { video_url: string | null; caption: string | null; sequence_index: number | null } | null
}

export default function ReelsPostsPage() {
  const { userId, isLoading } = useInstagramSession()
  const [items, setItems] = useState<ReelPost[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchItems()
  }, [userId, statusFilter])

  async function fetchItems() {
    setLoading(true)
    try {
      const res = await fetch(`/api/reels-posts?userId=${userId}&status=${statusFilter}`)
      const data = await res.json()
      if (Array.isArray(data)) setItems(data)
    } catch (e) {
      console.error("Failed to fetch reels posts", e)
    } finally {
      setLoading(false)
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm("Remove this scheduled post?")) return
    if (!userId) return
    try {
      await fetch(`/api/reels-posts?id=${id}&userId=${userId}`, { method: "DELETE" })
      fetchItems()
    } catch (e) {
      console.error("Failed to remove post", e)
    }
  }

  const statusColor: Record<string, string> = {
    PENDING: "bg-secondary text-secondary-foreground",
    PUBLISHED: "bg-green-500/10 text-green-400 border border-green-500/30",
    FAILED: "bg-destructive/10 text-destructive border border-destructive/30",
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
  }
  if (!userId) return <p className="p-8 text-sm text-muted-foreground">Connect your Instagram account.</p>

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scheduled Posts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reels and posts created by the Content Scheduler.
          </p>
        </div>
        <Button onClick={() => fetchItems()} variant="outline" size="sm" className="hidden md:flex">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        {["all", "PENDING", "PUBLISHED", "FAILED"].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className="text-xs px-3 py-1.5"
          >
            {s === "all" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()} <span className="opacity-60">{items.filter(i => i.status === s || s === "all").length}</span>
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-xs font-medium text-muted-foreground">
                <th className="p-3">Video</th>
                <th className="p-3">Caption</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No posts match the current filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-3 font-mono text-xs text-muted-foreground truncate max-w-[150px]">
                      {item.video_url}
                    </td>
                    <td className="p-3 truncate max-w-[200px]">{item.caption || "—"}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-mono ${statusColor[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-3 text-right">
                      {item.status === "PENDING" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="p-1.5"
                          title="Remove"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                      {item.error_message && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5 text-muted-foreground hover:text-destructive"
                          title={item.error_message}
                        >
                          <Video className="w-3 h-3" />
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
