import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw, RotateCw, ZoomIn, Sun, Contrast, Move } from 'lucide-react'
import { Modal } from './Modal'

const VIEW = 288 // tamanho do quadro de edição na tela (px)
const OUT = 512 // tamanho final da foto (px)

type Src = File | string

/** Editor de foto: arrastar para posicionar, zoom, girar, brilho e contraste. Devolve um JPEG quadrado de 512px. */
export function PhotoEditor({
  source,
  onCancel,
  onDone,
}: {
  source: Src | null
  onCancel: () => void
  onDone: (file: File) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rot, setRot] = useState(0) // 0, 90, 180, 270
  const [bright, setBright] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [off, setOff] = useState({ x: 0, y: 0 })

  // carrega a imagem sempre que abrir com uma fonte nova
  useEffect(() => {
    if (!source) return
    setReady(false)
    setFailed(false)
    setZoom(1)
    setRot(0)
    setBright(100)
    setContrast(100)
    setOff({ x: 0, y: 0 })
    const url = typeof source === 'string' ? source : URL.createObjectURL(source)
    const img = new Image()
    if (typeof source === 'string') img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      setReady(true)
    }
    img.onerror = () => setFailed(true)
    img.src = url
    return () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url)
    }
  }, [source])

  const limits = useCallback(
    (z: number, r: number) => {
      const img = imgRef.current
      if (!img) return { mx: 0, my: 0, scale: 1 }
      const swap = r % 180 !== 0
      const w = swap ? img.naturalHeight : img.naturalWidth
      const h = swap ? img.naturalWidth : img.naturalHeight
      const scale = (VIEW / Math.min(w, h)) * z
      return { mx: Math.max(0, (w * scale - VIEW) / 2), my: Math.max(0, (h * scale - VIEW) / 2), scale }
    },
    []
  )

  const draw = useCallback(
    (canvas: HTMLCanvasElement, size: number) => {
      const img = imgRef.current
      if (!img) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const k = size / VIEW
      const { scale } = limits(zoom, rot)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.save()
      ctx.translate(size / 2 + off.x * k, size / 2 + off.y * k)
      ctx.rotate((rot * Math.PI) / 180)
      ctx.scale(scale * k, scale * k)
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
      ctx.restore()
    },
    [zoom, rot, off, limits]
  )

  useEffect(() => {
    if (ready && canvasRef.current) draw(canvasRef.current, VIEW)
  }, [ready, draw])

  function clamp(x: number, y: number, z = zoom, r = rot) {
    const { mx, my } = limits(z, r)
    return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) }
  }

  function changeZoom(z: number) {
    setZoom(z)
    setOff((o) => clamp(o.x, o.y, z, rot))
  }

  function rotate(delta: number) {
    const r = (rot + delta + 360) % 360
    setRot(r)
    setOff((o) => clamp(o.x, o.y, zoom, r))
  }

  function reset() {
    setZoom(1)
    setRot(0)
    setBright(100)
    setContrast(100)
    setOff({ x: 0, y: 0 })
  }

  function save() {
    const out = document.createElement('canvas')
    out.width = OUT
    out.height = OUT
    draw(out, OUT)
    const ctx = out.getContext('2d')
    if (!ctx) return
    // brilho e contraste "na mão" (o filtro do canvas não existe em todo Safari)
    if (bright !== 100 || contrast !== 100) {
      const data = ctx.getImageData(0, 0, OUT, OUT)
      const b = bright / 100
      const c = contrast / 100
      const px = data.data
      for (let i = 0; i < px.length; i += 4) {
        for (let j = 0; j < 3; j++) {
          const v = (px[i + j] * b - 128) * c + 128
          px[i + j] = v < 0 ? 0 : v > 255 ? 255 : v
        }
      }
      ctx.putImageData(data, 0, 0)
    }
    out.toBlob(
      (blob) => {
        if (blob) onDone(new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9
    )
  }

  return createPortal(
    <Modal open={!!source} onClose={onCancel} title="Ajustar foto">
      {failed ? (
        <p className="text-sm text-ink-500 mb-4">Não consegui abrir essa foto. Escolha outra imagem.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div
              className="relative rounded-2xl overflow-hidden bg-ink-100 dark:bg-ink-800 touch-none select-none"
              style={{ width: VIEW, height: VIEW, cursor: 'grab' }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
              }}
              onPointerMove={(e) => {
                const d = drag.current
                if (!d) return
                setOff(clamp(d.ox + e.clientX - d.x, d.oy + e.clientY - d.y))
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onWheel={(e) => changeZoom(Math.max(1, Math.min(4, zoom - e.deltaY * 0.002)))}
            >
              <canvas
                ref={canvasRef}
                width={VIEW}
                height={VIEW}
                style={{ width: VIEW, height: VIEW, filter: `brightness(${bright}%) contrast(${contrast}%)` }}
              />
              {/* círculo-guia: mostra como a foto aparece no perfil */}
              <div
                className="absolute inset-0 pointer-events-none rounded-full"
                style={{ boxShadow: '0 0 0 400px rgba(0,0,0,0.45)', border: '2px solid rgba(255,255,255,0.9)' }}
              />
              {!ready && <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-400">Carregando...</div>}
            </div>
          </div>

          <p className="text-xs text-ink-400 text-center flex items-center justify-center gap-1.5">
            <Move size={12} /> Arraste a foto para posicionar. A parte dentro do círculo é a que aparece.
          </p>

          <Slider icon={<ZoomIn size={15} />} label="Tamanho" value={zoom} min={1} max={4} step={0.01} onChange={changeZoom} />
          <Slider icon={<Sun size={15} />} label="Brilho" value={bright} min={50} max={150} step={1} onChange={setBright} />
          <Slider icon={<Contrast size={15} />} label="Contraste" value={contrast} min={50} max={150} step={1} onChange={setContrast} />

          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => rotate(-90)} className="btn-secondary py-2 text-xs">
              <RotateCcw size={14} /> Girar
            </button>
            <button type="button" onClick={() => rotate(90)} className="btn-secondary py-2 text-xs">
              <RotateCw size={14} /> Girar
            </button>
            <button type="button" onClick={reset} className="btn-secondary py-2 text-xs">
              Refazer
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-5">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2.5">
          Cancelar
        </button>
        {!failed && (
          <button type="button" onClick={save} disabled={!ready} className="btn-primary flex-1 py-2.5">
            Usar esta foto
          </button>
        )}
      </div>
    </Modal>,
    document.body
  )
}

function Slider({
  icon,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
      <span className="flex items-center gap-1.5 w-24 shrink-0">
        {icon} {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-brand-500"
      />
    </label>
  )
}
