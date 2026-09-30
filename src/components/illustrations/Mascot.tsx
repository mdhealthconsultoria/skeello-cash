// Símbolo do Skeello Cash: uma moeda, fórmula clássica e limpa —
// círculo + anel + "$" centralizado. Sem tentar forçar um bicho em formas soltas.

export function MascotSvg({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="46" fill="#16a352" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="#0a0a0a" strokeWidth="4" className="dark:stroke-white" />
      <circle cx="50" cy="50" r="37" fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="2" />
      <text
        x="50"
        y="66"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="46"
        fontWeight="700"
        fill="white"
        textAnchor="middle"
      >
        $
      </text>
      {/* brilho */}
      <path d="M22,30 a30,30 0 0 1 20,-14" stroke="white" strokeOpacity="0.45" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  )
}
