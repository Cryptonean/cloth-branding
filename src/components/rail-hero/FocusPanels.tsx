import { useEffect, useRef } from 'react'
import { clothNumber, type Cloth } from '../../data/cloths'

interface FocusPanelsProps {
  cloth: Cloth
  index: number
  count: number
  open: boolean
  onClose: () => void
}

/** The two panels either side of a lifted cloth: the weave up close, and what it becomes. */
export function FocusPanels({ cloth, index, count, open, onClose }: FocusPanelsProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  // keyboard users land on Close, and go back where they were afterwards
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus({ preventScroll: true })
    return () => previous?.focus({ preventScroll: true })
  }, [open])

  return (
    <div className="focus" data-open={open} inert={!open}>
      <article className="focus__panel focus__panel--left" aria-label={`${cloth.name}, close-up`}>
        <div key={cloth.id} className="focus__content">
          <p className="focus__eyebrow">
            No. {clothNumber(index)} <span>/ {clothNumber(count - 1)}</span>
          </p>
          <h2 className="focus__name">{cloth.name}</h2>
          <p className="focus__origin">{cloth.origin}</p>
          <figure className="focus__figure">
            <img
              src={cloth.images.macro}
              alt={`Thread-level close-up of ${cloth.name}`}
              width={800}
              height={1000}
              decoding="async"
            />
            <figcaption>
              <span className="focus__tag">Macro</span>
              {cloth.macroCaption}
            </figcaption>
          </figure>
        </div>
      </article>

      <article className="focus__panel focus__panel--right" aria-label={`${cloth.name}, finished look`}>
        <div key={cloth.id} className="focus__content">
          <figure className="focus__figure">
            <img
              src={cloth.images.look}
              alt={`${cloth.name}, ${cloth.lookCaption.toLowerCase()}`}
              width={800}
              height={1000}
              decoding="async"
            />
            <figcaption>
              <span className="focus__tag">The look</span>
              {cloth.lookCaption}
            </figcaption>
          </figure>
          <dl className="focus__specs">
            <div>
              <dt>Composition</dt>
              <dd>{cloth.composition}</dd>
            </div>
            <div>
              <dt>Weight</dt>
              <dd>
                {cloth.gsm} g/m² · {cloth.use}
              </dd>
            </div>
            <div>
              <dt>Width</dt>
              <dd>{cloth.width}</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>{cloth.price}</dd>
            </div>
          </dl>
          <a className="focus__cta" href={`#reserve-${cloth.id}`}>
            Reserve a length <span aria-hidden="true">→</span>
          </a>
        </div>
      </article>

      <button ref={closeRef} type="button" className="focus__close" onClick={onClose}>
        Back to the rail <kbd>Esc</kbd>
      </button>
    </div>
  )
}
