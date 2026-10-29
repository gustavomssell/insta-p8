"use client"

import { useEffect, useState } from "react"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Play, Video, Plus, Trash2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface PoolItem {
  id: string
  user_id: number
  video_url: string
  caption: string | null
  cover_url: string | null
  thumbnail_url: string | null
  sequence_index: number
  is_active: boolean
  created_at: string
}

export default function ContentPoolPage() {
  const { userId, isLoading } = useInstagramSession()
  const [items, setItems] = useState<PoolItem[]>([])
  const [newUrl, setNewUrl] = useState("")
  const [newCaption, setNewCaption] = useState("")
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!userId) return
    fetchItems()
  }, [userId])

  async function fetchItems() {
    setLoading(true)
    try {
      const res = await fetch(`/api/content-pool?userId=${userId}`)
      const data = await res.json()
      if (Array.isArray(data)) setItems(data)
    } catch (e) {
      console.error("Failed to fetch content pool", e)
    } finally {
      setLoading(false)
    }
  }

  async function addItem() {
    if (!newUrl.trim() || !userId) return
    setAdding(true)
    try {
      const res = await fetch("/api/content-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, videoUrl: newUrl.trim(), caption: newCaption.trim() || null }),
      })
      const data = await res.json()
      if (data.id) {
        setNewUrl("")
        setNewCaption("")
        fetchItems()
      }
    } catch (e) {
      console.error("Failed to add content", e)
    } finally {
      setAdding(false)
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm("Remove this item from the content pool?")) return
    if (!userId) return
    try {
      await fetch(`/api/content-pool?id=${id}&userId=${userId}`, { method: "DELETE" })
      fetchItems()
    } catch (e) {
      console.error("Failed to remove content", e)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
  }
  if (!userId) return <p className="p-8 text-sm text-muted-foreground">Connect your Instagram account.</p>

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Content Pool</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Videos queued for automatic publishing via the Content Scheduler.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Add video to pool</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">Video URL</label>
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com/video.mp4"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">Caption (optional)</label>
            <Textarea
              value={newCaption}
              onChange={(e) => setNewCaption(e.target.value)}
              placeholder="Caption for the Reel…"
              rows={2}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button
            onClick={addItem}
            disabled={adding || !newUrl.trim()}
            className="flex items-center gap-2"
          >
            {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Add to pool
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-muted p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pool items</h2>
          <span className="ml-2 text-xs font-mono text-muted-foreground">{items.length} items</span>
        </div>

        <div className="divide-y divide-border">
          {items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Video className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No videos in the pool yet. Add one above.</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="p-4 flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center">
                  <Video className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.video_url}</p>
                  {item.caption && (
                    <p className="text-xs text-muted-foreground truncate">{item.caption}</p>
                  )}
                  <p className="text-xs font-mono text-muted-foreground mt-1">
                    Sequence #{item.sequence_index} • {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeItem(item.id)}
                  className="ml-2 px-2 py-1.5 text-xs"
                  title="Remove from pool"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
