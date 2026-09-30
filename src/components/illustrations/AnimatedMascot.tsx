import { motion } from 'framer-motion'
import { MascotSvg } from './Mascot'

/** Moeda animada: flutua suavemente com um halo verde pulsando por trás. */
export function AnimatedMascot({ size = 160, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-0 rounded-full bg-brand-500/25"
        animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0, 0.35] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="relative w-[78%] h-[78%]"
        animate={{ y: [0, -8, 0], rotate: [-4, 4, -4] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <MascotSvg className="w-full h-full drop-shadow-lg" />
      </motion.div>
    </div>
  )
}
