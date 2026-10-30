import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Curve, CylinderGeometry, MathUtils, MeshStandardMaterial, SphereGeometry, TubeGeometry, Vector3 } from 'three'
import { RAIL_RADIUS, RAIL_Y, SLOT_ANGLE } from './railMath'

const HALF_SPAN = SLOT_ANGLE * 2.75 // a little past the last resting hanger
const TUBE_RADIUS = 0.012
const DROP_HEIGHT = 3 // ceiling rods run up out of frame

const arcPoint = (angle: number, target = new Vector3()): Vector3 =>
  target.set(RAIL_RADIUS * Math.sin(angle), 0, RAIL_RADIUS * (Math.cos(angle) - 1))

class ArcCurve extends Curve<Vector3> {
  constructor() {
    super() // Curve's own constructor is protected
  }

  getPoint(t: number, target = new Vector3()): Vector3 {
    return arcPoint((t * 2 - 1) * HALF_SPAN, target)
  }
}

/** The brass rail, hung from the ceiling at both ends so hangers can glide its full length. */
export function Rail({ focused }: { focused: boolean }) {
  const parts = useMemo(
    () => ({
      tube: new TubeGeometry(new ArcCurve(), 200, TUBE_RADIUS, 16, false),
      finial: new SphereGeometry(0.021, 24, 16),
      drop: new CylinderGeometry(0.0045, 0.0045, DROP_HEIGHT, 10),
      collar: new CylinderGeometry(0.011, 0.011, 0.035, 20),
      brass: new MeshStandardMaterial({ color: '#c2a06a', metalness: 1, roughness: 0.3, transparent: true }),
    }),
    [],
  )
  useEffect(() => () => Object.values(parts).forEach((part) => part.dispose()), [parts])

  const dim = useRef(0)
  useFrame((_, dt) => {
    dim.current = MathUtils.damp(dim.current, focused ? 1 : 0, 4, Math.min(dt, 1 / 30))
    parts.brass.opacity = 1 - 0.55 * dim.current
  })

  const ends = [-HALF_SPAN, HALF_SPAN]
  return (
    <group position={[0, RAIL_Y, 0]}>
      <mesh geometry={parts.tube} material={parts.brass} castShadow />
      {ends.map((angle) => (
        <mesh key={angle} geometry={parts.finial} material={parts.brass} position={arcPoint(angle)} castShadow />
      ))}
      {ends.map((angle) => (
        <group key={`drop${angle}`} position={arcPoint(angle * 0.96)}>
          <mesh geometry={parts.drop} material={parts.brass} position={[0, DROP_HEIGHT / 2, 0]} castShadow />
          <mesh geometry={parts.collar} material={parts.brass} position={[0, 0.012, 0]} />
        </group>
      ))}
    </group>
  )
}
