import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { LIGHT_KEYS } from './lightRig'

interface SunDialProps {
  /** 0 morning … 1 lamplight */
  value: number
  label: string
  /** Shown while the light still follows the visitor's clock. */
  note: string | null
  onChange: (value: number) => void
}

// The sun's path across the dial, in the SVG's 160 × 40 viewBox.
const ARC = { left: 10, right: 150, base: 31, rise: 22 }
const VIEW_WIDTH = 160
const STEP = 0.05

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t))
const pointOn = (t: number) => ({
  x: ARC.left + (ARC.right - ARC.left) * t,
  y: ARC.base - 4 * ARC.rise * t * (1 - t),
})
const PATH = `M ${ARC.left} ${ARC.base} Q ${(ARC.left + ARC.right) / 2} ${ARC.base - 2 * ARC.rise} ${ARC.right} ${ARC.base}`

/** Drag the sun across the sky; the whole room relights to that hour. */
export function SunDial({ value, label, note, onChange }: SunDialProps) {
  const track = useRef<HTMLDivElement>(null)

  const fromPointer = (clientX: number) => {
    const box = track.current?.getBoundingClientRect()
    if (!box) return
    const left = box.left + (ARC.left / VIEW_WIDTH) * box.width
    const width = ((ARC.right - ARC.left) / VIEW_WIDTH) * box.width
    onChange(clamp01((clientX - left) / width))
  }
  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    fromPointer(e.clientX)
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientX)
  }
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const next: Record<string, number> = {
      ArrowLeft: value - STEP,
      ArrowDown: value - STEP,
      ArrowRight: value + STEP,
      ArrowUp: value + STEP,
      PageDown: value - 0.25,
      PageUp: value + 0.25,
      Home: 0,
      End: 1,
    }
    if (!(e.key in next)) return
    e.preventDefault()
    onChange(clamp01(next[e.key]))
  }

  const sun = pointOn(value)
  return (
    <div className="sundial">
      <div
        ref={track}
        className="sundial__track"
        role="slider"
        tabIndex={0}
        aria-label="Time of day"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={label}
        onPointerDown={down}
        onPointerMove={move}
        onKeyDown={key}
      >
        <svg viewBox={`0 0 ${VIEW_WIDTH} 40`} aria-hidden="true">
          <line className="sundial__horizon" x1="2" x2={VIEW_WIDTH - 2} y1={ARC.base} y2={ARC.base} />
          <path className="sundial__path" d={PATH} />
          {LIGHT_KEYS.map((key) => {
            const p = pointOn(key.at)
            return <circle key={key.label} className="sundial__tick" cx={p.x} cy={p.y} r="1.6" />
          })}
          <g className="sundial__sun" data-night={value > 0.9} transform={`translate(${sun.x} ${sun.y})`}>
            <circle className="sundial__halo" r="9" />
            <circle className="sundial__disc" r="4.6" />
          </g>
        </svg>
      </div>
      <p className="sundial__caption">
        <span>{label}</span>
        {note && <span className="sundial__note">{note}</span>}
      </p>
    </div>
  )
}
