import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CLOTHS, clothNumber } from '../../data/cloths'
import { Cursor, type CursorMode } from './Cursor'
import { FocusPanels } from './FocusPanels'
import { lightLabel, roomVars, sampleLight, timeOfDay, type LightState } from './lightRig'
import { mod, ringDelta, type LoupePoint, type Motion } from './railMath'
import { SunDial } from './SunDial'
import { DRAG_SLOP, useRailGestures, useRailKeys } from './useRailGestures'

// three.js and the cloth simulation load in their own chunk, after first paint
const RailScene = lazy(() => import('./RailScene'))

const INTRO_OFFSET = 1.2 // the rail glides into place as the room loads

interface ShowroomProps {
  reducedMotion: boolean
}

function cursorModeFor(dragging: boolean, hovered: number | null, focused: boolean, active: number): CursorMode {
  if (dragging) return 'dragging'
  if (hovered !== null) return focused && hovered === active ? 'feel' : 'view'
  return focused ? 'close' : 'idle'
}

/** The interactive rail: 3D stage, controls, focus panels and cursor. */
export function Showroom({ reducedMotion }: ShowroomProps) {
  const count = CLOTHS.length
  const stageRef = useRef<HTMLDivElement>(null)
  const [motion] = useState<Motion>(() => ({
    offset: reducedMotion ? 0 : INTRO_OFFSET,
    dragging: false,
    wheeling: false,
    inside: false,
    moved: 0,
  }))
  const [target, setTarget] = useState(0)
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [ready, setReady] = useState(false)
  const [touched, setTouched] = useState(false)
  const [daylight, setDaylight] = useState(() => timeOfDay(new Date()))
  const [byClock, setByClock] = useState(true)
  const [loupe] = useState<LoupePoint>(() => ({ u: 0.5, v: 0.5 }))

  const active = mod(target, count)
  const cloth = CLOTHS[active]

  const step = useCallback((direction: number) => {
    setTarget((t) => t + direction)
    setTouched(true)
  }, [])
  const select = useCallback(
    (index: number) => {
      setTarget((t) => t + ringDelta(mod(t, count), index, count))
      setFocused(true)
      setTouched(true)
    },
    [count],
  )
  const close = useCallback(() => setFocused(false), [])
  const handleBackground = useCallback(() => {
    if (motion.moved <= DRAG_SLOP) setFocused(false)
  }, [motion])
  const handleReady = useCallback(() => setReady(true), [])
  const changeLight = useCallback((value: number) => {
    setDaylight(value)
    setByClock(false)
  }, [])

  // the room's walls and type follow the light; the 3D scene repaints them as it eases
  const paint = useCallback((light: LightState) => {
    const room = stageRef.current?.closest<HTMLElement>('.rail-hero')
    if (!room) return
    for (const [name, value] of Object.entries(roomVars(light))) room.style.setProperty(name, value)
  }, [])
  // first paint before three.js arrives, so an evening visit never flashes daylight
  useLayoutEffect(() => {
    const room = stageRef.current?.closest<HTMLElement>('.rail-hero')
    const vars = roomVars(sampleLight(timeOfDay(new Date())))
    if (room) for (const [name, value] of Object.entries(vars)) room.style.setProperty(name, value)
    return () => {
      if (room) for (const name of Object.keys(vars)) room.style.removeProperty(name)
    }
  }, [])
  const clockNote = useMemo(
    () =>
      byClock
        ? `Your time, ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date())}`
        : null,
    [byClock],
  )

  useRailGestures(stageRef, motion, {
    onSettle: (next) => {
      setTarget(next)
      setTouched(true)
    },
    onDragChange: setDragging,
    onLeave: () => setHovered(null),
  })
  useRailKeys(step, close)

  // warm the focus-view images once the room is up, so opening one never waits
  useEffect(() => {
    if (!ready) return
    for (const { images } of CLOTHS) {
      for (const src of [images.macro, images.look]) new Image().src = src
    }
  }, [ready])

  return (
    <>
      <div ref={stageRef} className="rail-hero__stage" data-ready={ready} data-focused={focused} data-dragging={dragging}>
        <Suspense fallback={null}>
          <RailScene
            cloths={CLOTHS}
            target={target}
            focused={focused}
            motion={motion}
            reducedMotion={reducedMotion}
            timeOfDay={daylight}
            loupe={loupe}
            onSelect={select}
            onHover={setHovered}
            onBackground={handleBackground}
            onReady={handleReady}
            onPaint={paint}
          />
        </Suspense>
      </div>

      <div className="rail-hero__bar" data-focused={focused}>
        <p className="rail-hero__now" aria-live="polite">
          <span className="rail-hero__count">
            No. {clothNumber(active)} <span>/ {clothNumber(count - 1)}</span>
          </span>
          <span key={cloth.id} className="rail-hero__name">
            {cloth.name}
          </span>
          <span className="rail-hero__origin">{cloth.origin}</span>
        </p>
        <div className="rail-hero__center">
          <p className="rail-hero__hint" data-hidden={touched}>
            Drag to browse <span aria-hidden="true">·</span> Click a cloth to feel it
          </p>
          <SunDial value={daylight} label={lightLabel(daylight)} note={clockNote} onChange={changeLight} />
        </div>
        <div className="rail-hero__actions">
          <button type="button" className="rail-hero__arrow" onClick={() => step(-1)} aria-label="Previous cloth">
            <Arrow flip />
          </button>
          <button type="button" className="rail-hero__arrow" onClick={() => step(1)} aria-label="Next cloth">
            <Arrow />
          </button>
          <button type="button" className="rail-hero__explore" onClick={() => select(active)}>
            Explore <span key={cloth.id}>{cloth.name}</span>
          </button>
        </div>
      </div>

      <FocusPanels cloth={cloth} index={active} count={count} open={focused} onClose={close} />
      <Cursor
        mode={cursorModeFor(dragging, hovered, focused, active)}
        area={stageRef}
        loupe={loupe}
        loupeImage={cloth.images.texture}
      />
    </>
  )
}

function Arrow({ flip = false }: { flip?: boolean }) {
  return (
    <svg className={flip ? 'icon icon--flip' : 'icon'} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M2 9h13M10.5 4.5 15 9l-4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
