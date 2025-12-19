import { useCallback, useEffect, useRef, useState } from 'react'
import type { SchedulerApi, SchedulerSnapshot } from '../api/schedulerApi'

type UseSchedulerPollingArgs = {
  api: SchedulerApi
  rangeStart: string // YYYY-MM-DD
  rangeEnd: string // YYYY-MM-DD
  intervalMs?: number
}

export function useSchedulerPolling({ api, rangeStart, rangeEnd, intervalMs = 5000 }: UseSchedulerPollingArgs) {
  const [snapshot, setSnapshot] = useState<SchedulerSnapshot | null>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshToken, setRefreshToken] = useState(0)

  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(() => {
    setRefreshToken((v) => v + 1)
  }, [])

  useEffect(() => {
    let timer: number | undefined

    const tick = async () => {
      try {
        const next = await api.fetchSnapshot(rangeStart, rangeEnd)
        if (!mountedRef.current) return
        setSnapshot(next)
        setError('')
      } catch (e) {
        if (!mountedRef.current) return
        const message = e instanceof Error ? e.message : 'Failed to refresh appointments'
        setError(message)
      } finally {
        if (!mountedRef.current) return
        setLoading(false)
      }
    }

    void tick()
    timer = window.setInterval(tick, intervalMs)

    return () => {
      if (timer) window.clearInterval(timer)
    }
  }, [api, intervalMs, rangeEnd, rangeStart, refreshToken])

  return {
    snapshot,
    loading,
    error,
    refresh,
  }
}
