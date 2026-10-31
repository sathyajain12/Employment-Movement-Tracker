import { useEffect, useState } from 'react'

// Current time in ms, refreshed on an interval, for live "minutes away" counters.
export function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
