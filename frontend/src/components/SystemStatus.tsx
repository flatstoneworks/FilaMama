import { useState, useEffect } from 'react'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@flatstoneworks/ui'
import { cn } from '@/lib/utils'

interface SystemInfo {
  hostname: string
  deviceType: string
  osName: string
  cpuName: string
  diskTotalGb: number | null
  diskUsedGb: number | null
  rootPath: string
}

interface SystemStatusData {
  cpuPercent: number
  memoryPercent: number
  memoryUsedGb: number
  memoryTotalGb: number
  diskPercent: number | null
  diskUsedGb: number | null
  diskTotalGb: number | null
  diskAvailableGb: number | null
  thumbCacheMb: number
  transcodeCacheMb: number
}

// ─── Metric Bar ─────────────────────────────────────────────────────────────

function MetricBar({ label, detail, value, thresholds }: {
  label: string
  detail?: string | null
  value: number
  thresholds: { warn: number; crit: number }
}) {
  const clamped = Math.min(100, Math.max(0, value))
  const tier = clamped >= thresholds.crit ? 'crit' : clamped >= thresholds.warn ? 'warn' : 'ok'
  const barColor = tier === 'crit' ? 'bg-red-500' : tier === 'warn' ? 'bg-amber-500' : 'bg-primary'
  const textColor = tier === 'crit' ? 'text-red-500' : tier === 'warn' ? 'text-amber-500' : 'text-muted-foreground'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {detail && (
          <span className="text-xs font-medium text-foreground truncate max-w-[160px]">{detail}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-500 rounded-full', barColor)}
            style={{ width: `${clamped}%` }}
          />
        </div>
        <span className={cn('text-[11px] font-semibold tabular-nums w-8 text-right', textColor)}>
          {Math.round(clamped)}%
        </span>
      </div>
    </div>
  )
}

// ─── Activity Ring ──────────────────────────────────────────────────────────

const RING_SIZE = 36
const RING_STROKE = 1
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function getActivityColor(value: number): string {
  if (value >= 85) return 'hsl(0, 84%, 60%)'    // red
  if (value >= 60) return 'hsl(38, 92%, 50%)'   // amber
  return 'hsl(142, 71%, 45%)'                    // green
}

// ─── SystemStatus ───────────────────────────────────────────────────────────

export function SystemStatus() {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [status, setStatus] = useState<SystemStatusData | null>(null)
  const [infoError, setInfoError] = useState(false)

  // Fetch static info once
  useEffect(() => {
    let cancelled = false
    const fetchInfo = async () => {
      try {
        const resp = await fetch('/api/system/info')
        if (!resp.ok) throw new Error()
        if (!cancelled) {
          setInfo(await resp.json())
          setInfoError(false)
        }
      } catch {
        if (!cancelled) setInfoError(true)
      }
    }
    fetchInfo()
    const interval = setInterval(fetchInfo, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Poll real-time status
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const resp = await fetch('/api/system/status')
        if (!resp.ok) throw new Error()
        if (!cancelled) setStatus(await resp.json())
      } catch {
        // silent
      }
    }
    poll()
    const interval = setInterval(poll, 10_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const isOnline = !!info && !infoError
  const cpuPercent = status?.cpuPercent ?? 0
  const diskPercent = status?.diskPercent ?? 0

  const initials = isOnline && info?.hostname
    ? info.hostname.slice(0, 2).toUpperCase()
    : '?'

  // Activity based on CPU
  const activity = Math.min(100, Math.max(0, cpuPercent))
  const ringOffset = RING_CIRCUMFERENCE - (activity / 100) * RING_CIRCUMFERENCE

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          className={cn(
            'relative flex items-center justify-center cursor-default',
            !isOnline && 'opacity-50'
          )}
          style={{ width: RING_SIZE, height: RING_SIZE }}
        >
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="absolute inset-0 -rotate-90"
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={RING_STROKE}
              className="text-muted-foreground/10"
            />
            {isOnline && (
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                fill="none"
                stroke={getActivityColor(activity)}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
              />
            )}
          </svg>
          <div className={cn(
            'h-[28px] w-[28px] rounded-full flex items-center justify-center',
            'bg-gradient-to-br from-primary/20 to-primary/10'
          )}>
            <span className={cn(
              'text-[10px] font-semibold',
              isOnline ? 'text-primary' : 'text-muted-foreground'
            )}>
              {initials}
            </span>
          </div>
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="end" className="w-80">
        {isOnline ? (
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">{info.hostname}</h4>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {info.deviceType}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="text-[11px] text-green-500 font-medium">Online</span>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Resource metrics */}
            <div className="space-y-2.5">
              <MetricBar
                label="CPU"
                detail={info.cpuName}
                value={cpuPercent}
                thresholds={{ warn: 60, crit: 85 }}
              />
              <MetricBar
                label="Memory"
                detail={status ? `${status.memoryUsedGb} / ${status.memoryTotalGb} GB` : null}
                value={status?.memoryPercent ?? 0}
                thresholds={{ warn: 60, crit: 85 }}
              />
              <MetricBar
                label="Disk"
                detail={status?.diskUsedGb != null && status?.diskTotalGb != null
                  ? `${status.diskUsedGb} / ${status.diskTotalGb} GB`
                  : null}
                value={diskPercent}
                thresholds={{ warn: 70, crit: 90 }}
              />
            </div>

            <div className="h-px bg-border" />

            {/* FilaMama-specific: cache info + system details */}
            <div className="space-y-1.5 text-xs">
              {status && (status.thumbCacheMb > 0 || status.transcodeCacheMb > 0) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cache</span>
                  <span className="font-medium text-foreground">
                    {[
                      status.thumbCacheMb > 0 ? `Thumbs ${status.thumbCacheMb} MB` : null,
                      status.transcodeCacheMb > 0 ? `Video ${status.transcodeCacheMb} MB` : null,
                    ].filter(Boolean).join(' / ')}
                  </span>
                </div>
              )}
              {status?.diskAvailableGb != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-medium text-foreground">{status.diskAvailableGb} GB free</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">OS</span>
                <span className="font-medium text-foreground">{info.osName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Root</span>
                <span className="font-medium text-foreground truncate max-w-[180px]">{info.rootPath}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Device</h4>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span className="text-[11px] text-red-500 font-medium">Offline</span>
              </div>
            </div>
            <div className="h-px bg-border" />
            <p className="text-xs text-muted-foreground">
              Cannot reach the backend server.
            </p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
