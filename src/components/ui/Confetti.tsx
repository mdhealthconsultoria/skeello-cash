const COLORS = ['#16a352', '#111111', '#22c565', '#f59e0b', '#ffffff']

export function Confetti({ show }: { show: boolean }) {
  if (!show) return null

  const pieces = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 360 + Math.random() * 15
    const distance = 60 + Math.random() * 50
    const dx = Math.cos((angle * Math.PI) / 180) * distance
    const dy = Math.sin((angle * Math.PI) / 180) * distance
    const color = COLORS[i % COLORS.length]
    const delay = Math.random() * 0.08
    return { dx, dy, color, delay, key: i }
  })

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      {pieces.map((p) => (
        <span
          key={p.key}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            backgroundColor: p.color,
            animation: `confetti-burst 0.9s ease-out ${p.delay}s forwards`,
            // @ts-expect-error -- custom properties consumed by the keyframes below
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-burst {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) rotate(280deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
