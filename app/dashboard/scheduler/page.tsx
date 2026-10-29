"use client"

import { useEffect, useState } from "react"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import { Button } from "@/components/ui/button"
import { Loader2, Clock, Play, RefreshCw, Save, Zap, Timer, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

interface SchedulerConfig {
  user_id: number
  interval_minutes: number
  start_time: string
  end_time: string
  last_run_at: string | null
  next_run_at: string | null
  current_sequence_index: number
  is_running: boolean
  updated_at: string
}

export default function SchedulerPage() {
  const { userId, isLoading } = useInstagramSession()
  const [config, setConfig] = useState<SchedulerConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!userId) return
    fetchConfig()
  }, [userId])

  async function fetchConfig() {
    setLoading(true)
    try {
      const res = await fetch(`/api/scheduler?userId=${userId}`)
      const data = await res.json()
      setConfig(data ?? null)
    } catch (e) {
      console.error("Failed to fetch scheduler config", e)
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig() {
    if (!config || !userId) return
    setSaving(true)
    try {
      const res = await fetch("/api/scheduler", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, userId }),
      })
      const data = await res.json()
      if (data.interval_minutes !== undefined) setConfig(data)
    } catch (e) {
      console.error("Failed to save scheduler config", e)
    } finally {
      setSaving(false)
    }
  }

  async function toggleRunning() {
    if (!config || !userId) return
    setSaving(true)
    try {
      const res = await fetch("/api/scheduler", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, userId, is_running: !config.is_running }),
      })
      const data = await res.json()
      if (data.is_running !== undefined) setConfig(data)
    } catch (e) {
      console.error("Failed to toggle scheduler", e)
    } finally {
      setSaving(false)
    }
  }

  async function runNow() {
    if (!userId) return
    setRunning(true)
    try {
      const res = await fetch("/api/scheduler/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (data.processed !== undefined) {
        alert(`Scheduler ran: ${data.processed} item(s) queued.`)
        fetchConfig()
      }
    } catch (e) {
      console.error("Failed to run scheduler", e)
    } finally {
      setRunning(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
  }
  if (!userId) return <p className="p-8 text-sm text-muted-foreground">Connect your Instagram account.</p>

  const initialConfig: SchedulerConfig = {
    user_id: Number(userId),
    interval_minutes: 240,
    start_time: "09:00:00",
    end_time: "21:00:00",
    last_run_at: null,
    next_run_at: null,
    current_sequence_index: 1,
    is_running: false,
    updated_at: new Date().toISOString(),
  }

  const cfg = config ?? initialConfig

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Content Scheduler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automatically publish items from your content pool as Reels/Posts on a recurring interval.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={runNow}
            disabled={running}
            className="flex items-center gap-2"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Running…" : "Run Now"}
          </Button>
          <Button onClick={() => fetchConfig()} variant="outline" size="sm" className="hidden md:flex">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Scheduler status</h2>
              <Button
                onClick={toggleRunning}
                disabled={saving}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${cfg.is_running ? "bg-green-500 text-white hover:bg-green-600" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
              >
                {cfg.is_running ? "Running" : "Paused"}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Interval (minutes)</label>
                  <input
                    type="number"
                    value={cfg.interval_minutes}
                    onChange={(e) => setConfig({ ...cfg, interval_minutes: Math.max(15, Number(e.target.value) || 15) })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Next run</label>
                  <p className="text-xs font-mono text-muted-foreground">
                    {cfg.next_run_at ? new Date(cfg.next_run_at).toLocaleString() : "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Start time</label>
                  <input
                    type="time"
                    value={cfg.start_time}
                    onChange={(e) => setConfig({ ...cfg, start_time: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">End time</label>
                  <input
                    type="time"
                    value={cfg.end_time}
                    onChange={(e) => setConfig({ ...cfg, end_time: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {cfg.last_run_at && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Last run: <span className="font-mono">{new Date(cfg.last_run_at).toLocaleString()}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-border flex items-center gap-2">
              <Button onClick={saveConfig} disabled={saving} className="flex items-center gap-2">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save configuration
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">How it works</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <Zap className="w-3 h-3 shrink-0" />
                <span>Add videos to your <strong>Content Pool</strong>.</span>
              </li>
              <li className="flex gap-2">
                <Timer className="w-3 h-3 shrink-0" />
                <span>Set the interval (e.g., every 240 min = 4 hours).</span>
              </li>
              <li className="flex gap-2">
                <Activity className="w-3 h-3 shrink-0" />
                <span>The scheduler publishes the next pool item as a Reel/Post automatically.</span>
              </li>
              <li className="flex gap-2">
                <Play className="w-3 h-3 shrink-0" />
                <span>Use <strong>Run Now</strong> to publish immediately, or keep the scheduler running.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 text-xs">
            <Clock className="w-4 h-4" />
            <div className="flex-1">
              <p className="text-foreground font-medium">Not yet in production</p>
              <p className="text-muted-foreground">Auto-publish requires a background cron. For now, use <strong>Run Now</strong> or call <code className="font-mono">POST /api/scheduler/run</code> on a schedule.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
