import { useEffect, useRef, type RefObject } from 'react'
import type { LoupePoint } from './railMath'

export type CursorMode = 'idle' | 'dragging' | 'view' | 'feel' | 'close'

const LABELS: Record<CursorMode, string> = { idle: 'Drag', dragging: '', view: 'View', feel: '', close: 'Close' }
const FOLLOW = 0.22 // share of the remaining distance covered each frame
// The pick glass shows the cloth's own scan at about four times its size on screen.
const LOUPE = { radius: 75, width: 1024 * 0.85, height: 2048 * 0.85 }

interface CursorProps {
  mode: CursorMode
  area: RefObject<HTMLElement | null>
  loupe: LoupePoint
  /** The lifted cloth's scan, seen through the pick glass. */
  loupeImage: string
}

/**
 * A glass lens that trails the mouse over the stage and says what a click will do.
 * Over a lifted cloth it becomes a tailor's pick glass, magnifying the weave beneath it.
 */
export function Cursor({ mode, area, loupe, loupeImage }: CursorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const glass = useRef<HTMLSpanElement>(null)
  const modeNow = useRef(mode)
  modeNow.current = mode

  useEffect(() => {
    const el = ref.current
    const zone = area.current
    if (!el || !zone || !matchMedia('(pointer: fine)').matches) return
    let x = 0
    let y = 0
    let cx = 0
    let cy = 0
    let frame = 0
    const move = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
    }
    const show = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || el.dataset.visible === 'true') return
      cx = x = e.clientX
      cy = y = e.clientY
      el.dataset.visible = 'true'
    }
    const hide = () => {
      el.dataset.visible = 'false'
    }
    const tick = () => {
      cx += (x - cx) * FOLLOW
      cy += (y - cy) * FOLLOW
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`
      if (modeNow.current === 'feel' && glass.current) {
        const left = LOUPE.radius - loupe.u * LOUPE.width
        const top = LOUPE.radius - (1 - loupe.v) * LOUPE.height
        glass.current.style.backgroundPosition = `${left}px ${top}px`
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    window.addEventListener('pointermove', move)
    zone.addEventListener('pointerenter', show)
    zone.addEventListener('pointermove', show) // the page may load under a resting mouse
    zone.addEventListener('pointerleave', hide)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move)
      zone.removeEventListener('pointerenter', show)
      zone.removeEventListener('pointermove', show)
      zone.removeEventListener('pointerleave', hide)
    }
  }, [area, loupe])

  return (
    <div ref={ref} className="cursor" data-mode={mode} aria-hidden="true">
      <span className="cursor__lens">
        <span className="cursor__label">{LABELS[mode]}</span>
      </span>
      <span
        ref={glass}
        className="cursor__loupe"
        style={{ backgroundImage: `url(${loupeImage})`, backgroundSize: `${LOUPE.width}px ${LOUPE.height}px` }}
      />
    </div>
  )
}
