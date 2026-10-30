import { Component, useState, type ReactNode } from 'react'
import { CLOTHS } from '../../data/cloths'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { MobileRail } from './MobileRail'
import { Showroom } from './Showroom'
import './rail-hero.css'

function supportsWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(gl)
  } catch {
    return false
  }
}

interface StageBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

/** If WebGL or the scene fails at runtime, the hero degrades to the static rail instead of vanishing. */
class StageBoundary extends Component<StageBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    console.error('Rail stage failed; showing the static rail instead.', error)
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function RailHero() {
  const isNarrow = useMediaQuery('(max-width: 767px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [hasWebGL] = useState(supportsWebGL2)

  return (
    <section className="rail-hero" aria-labelledby="hero-heading">
      <div className="rail-hero__wall" aria-hidden="true" />
      <div className="rail-hero__window" aria-hidden="true">
        <span />
      </div>
      <div className="rail-hero__floor" aria-hidden="true" />

      <header className="rail-hero__header">
        <a className="rail-hero__brand" href="/">
          Filare
        </a>
        <nav aria-label="Main navigation">
          <ul className="rail-hero__menu">
            <li>
              <a href="#cloths">Cloths</a>
            </li>
            <li>
              <a href="#provenance">Provenance</a>
            </li>
            <li>
              <a href="#atelier">Atelier</a>
            </li>
          </ul>
        </nav>
        <a className="rail-hero__swatches" href="#swatches">
          Swatches <span>(0)</span>
        </a>
      </header>

      <h1 id="hero-heading" className="rail-hero__headline">
        Rare <em>by</em> nature.
      </h1>
      <p className="rail-hero__lede">
        <span className="rail-hero__eyebrow">The rail · Autumn 2026</span>
        Five of the rarest natural fibres on earth. Woven by hand, sold by the metre.
      </p>

      {isNarrow || !hasWebGL ? (
        <MobileRail cloths={CLOTHS} />
      ) : (
        <StageBoundary fallback={<MobileRail cloths={CLOTHS} />}>
          <Showroom reducedMotion={reducedMotion} />
        </StageBoundary>
      )}
      <div className="rail-hero__shafts" aria-hidden="true" />
      <div className="rail-hero__vignette" aria-hidden="true" />
      <div className="rail-hero__grain" aria-hidden="true" />
    </section>
  )
}
