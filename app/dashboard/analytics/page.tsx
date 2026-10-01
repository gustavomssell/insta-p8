"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ArrowUpRight, BarChart3, Loader2, MessageSquare, Reply, Users, Workflow } from "lucide-react"
import { useInstagramSession } from "@/hooks/use-instagram-session"

interface TimeseriesPoint {
  date: string
  sent: number
  received: number
  newConversations: number
}

interface AnalyticsPayload {
  metrics: { totalAutomations: number; activeTriggers: number; audienceReached: number; messagesSent: number }
  timeseries?: TimeseriesPoint[]
  window?: {
    days: number
    sent: number
    received: number
    newConversations: number
    replyRatio: number | null
  }
}

export default function AnalyticsPage() {
  const { userId, isLoading: sessionLoading } = useInstagramSession()
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetch(`/api/dashboard/stats?userId=${userId}`)
      .then(response => response.json())
      .then(payload => { if (payload && !payload.error) setData(payload) })
      .catch(error => console.error("Failed to load analytics", error))
      .finally(() => setLoading(false))
  }, [userId])

  if (sessionLoading || loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
  }

  const summary = data?.window
  const points = (data?.timeseries || []).map(point => ({
    ...point,
    label: new Date(`${point.date}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" }),
  }))
  const hasData = Boolean(summary && summary.sent + summary.received > 0)

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10">
      <header className="border-b border-border pb-7">
        <p className="text-sm text-muted-foreground">Performance</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">Insights</h1>
        <p className="mt-2 text-sm text-muted-foreground">Understand how people engage with your automated conversations.</p>
      </header>

      <section className="grid border-b border-border sm:grid-cols-2 lg:grid-cols-4" aria-label="Window summary">
        <Metric label="Messages sent" value={summary?.sent ?? 0} icon={MessageSquare} />
        <Metric label="Messages received" value={summary?.received ?? 0} icon={ArrowUpRight} />
        <Metric label="New conversations" value={summary?.newConversations ?? 0} icon={Users} />
        <Metric
          label="Reply ratio"
          value={summary?.replyRatio == null ? "—" : `${summary.replyRatio}%`}
          icon={Reply}
          hint="sent ÷ received"
        />
      </section>

      <section className="mt-7 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Performance over time</h2>
            <p className="mt-1 text-xs text-muted-foreground">Messages exchanged and new conversations per day</p>
          </div>
          <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">Last {summary?.days ?? 30} days</span>
        </div>

        {hasData ? (
          <div className="px-3 py-5 sm:px-5">
            <div className="mb-4 flex items-center gap-4 px-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: "var(--primary)" }} />Sent</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: "var(--muted-foreground)" }} />Received</span>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fillReceived" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    cursor={{ stroke: "var(--border)" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                  />
                  <Area type="monotone" dataKey="sent" stroke="var(--primary)" strokeWidth={2} fill="url(#fillSent)" />
                  <Area type="monotone" dataKey="received" stroke="var(--muted-foreground)" strokeWidth={2} fill="url(#fillReceived)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-secondary"><BarChart3 className="size-5 text-muted-foreground" /></span>
            <h3 className="mt-4 text-sm font-medium">Insights are getting ready</h3>
            <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">Once your workflows begin sending messages, performance and audience trends will show here.</p>
            <Link href="/dashboard/automations" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold">Review workflows<ArrowUpRight className="size-3.5" /></Link>
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Active triggers" value={data?.metrics.activeTriggers ?? 0} icon={Workflow} />
        <StatTile label="Workflows" value={data?.metrics.totalAutomations ?? 0} icon={BarChart3} />
        <StatTile label="People reached" value={data?.metrics.audienceReached ?? 0} icon={Users} />
      </section>
    </div>
  )
}

function Metric({ label, value, icon: Icon, hint }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; hint?: string }) {
  return (
    <div className="border-border py-6 sm:border-r sm:px-6 first:pl-0 last:border-r-0">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function StatTile({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-secondary"><Icon className="size-4 text-muted-foreground" /></span>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}
