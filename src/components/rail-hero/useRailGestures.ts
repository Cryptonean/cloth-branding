import { useEffect, useRef, type RefObject } from 'react'
import { settleTarget, type Motion } from './railMath'

export const DRAG_SLOP = 6 // px before a press becomes a drag
const ITEM_WIDTH = 0.17 // share of the stage width that moves the rail one cloth
const ITEM_WIDTH_PHONE = 0.5 // on a phone one cloth fills the frame, so a swipe is wider
const PHONE_WIDTH = 768
const WHEEL_GAIN = 0.6
const WHEEL_SETTLE_MS = 140
const STALE_FLING_MS = 80 // a hand that stopped before letting go carries no momentum
const LINE_HEIGHT_PX = 16

export interface RailGestureHandlers {
  onSettle: (target: number) => void
  onDragChange: (dragging: boolean) => void
  onLeave: () => void
}

/** Drag, flick and horizontal trackpad swipes move the rail; `motion` is shared with the 3D loop. */
export function useRailGestures(
  stageRef: RefObject<HTMLElement | null>,
  motion: Motion,
  handlers: RailGestureHandlers,
): void {
  const latest = useRef(handlers)
  latest.current = handlers

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let lastX = 0
    let lastT = 0
    let velocity = 0
    let isDrag = false
    let wheelTimer = 0
    const itemWidth = () => Math.max(1, stage.clientWidth * (stage.clientWidth < PHONE_WIDTH ? ITEM_WIDTH_PHONE : ITEM_WIDTH))

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      motion.dragging = true
      motion.moved = 0
      lastX = e.clientX
      lastT = e.timeStamp
      velocity = 0
      isDrag = false
    }
    const move = (e: PointerEvent) => {
      if (!motion.dragging) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      motion.moved += Math.abs(dx)
      if (motion.moved <= DRAG_SLOP) return
      if (!isDrag) {
        isDrag = true
        latest.current.onDragChange(true)
      }
      const delta = -dx / itemWidth()
      motion.offset += delta
      const dt = Math.max(1, e.timeStamp - lastT) / 1000
      lastT = e.timeStamp
      velocity = velocity * 0.75 + (delta / dt) * 0.25
    }
    const up = (e: PointerEvent) => {
      if (!motion.dragging) return
      motion.dragging = false
      if (!isDrag) return
      isDrag = false
      const fling = e.timeStamp - lastT > STALE_FLING_MS ? 0 : velocity
      latest.current.onSettle(settleTarget(motion.offset, fling))
      latest.current.onDragChange(false)
    }
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return // vertical scroll still scrolls the page
      e.preventDefault()
      const px = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaX * LINE_HEIGHT_PX : e.deltaX
      motion.wheeling = true
      motion.offset += (px / itemWidth()) * WHEEL_GAIN
      window.clearTimeout(wheelTimer)
      wheelTimer = window.setTimeout(() => {
        motion.wheeling = false
        latest.current.onSettle(Math.round(motion.offset))
      }, WHEEL_SETTLE_MS)
    }
    const enter = () => {
      motion.inside = true
    }
    const leave = () => {
      motion.inside = false
      latest.current.onLeave()
    }

    stage.addEventListener('pointerdown', down)
    stage.addEventListener('pointerenter', enter)
    // a page that loads under a resting mouse never gets pointerenter
    stage.addEventListener('pointermove', enter)
    stage.addEventListener('pointerleave', leave)
    stage.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.clearTimeout(wheelTimer)
      stage.removeEventListener('pointerdown', down)
      stage.removeEventListener('pointerenter', enter)
      stage.removeEventListener('pointermove', enter)
      stage.removeEventListener('pointerleave', leave)
      stage.removeEventListener('wheel', wheel)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [stageRef, motion])
}

/** ← / → browse the rail (or swap the cloth in focus), Esc puts it back. */
export function useRailKeys(step: (direction: number) => void, close: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [role="slider"], [contenteditable="true"]')) return
      if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'Escape') close()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, close])
}
