import { useEffect, useRef, useState } from 'react'
import { formatCurrency } from '../../lib/format'

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export function AnimatedNumber({ value, duration = 700 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    const start = performance.now()

    if (frameRef.current) cancelAnimationFrame(frameRef.current)

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(progress)
      setDisplay(from + (to - from) * eased)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return <>{formatCurrency(display)}</>
}
