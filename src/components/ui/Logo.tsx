import { MascotSvg } from '../illustrations/Mascot'

export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
      <MascotSvg className="w-full h-full" />
    </span>
  )
}
