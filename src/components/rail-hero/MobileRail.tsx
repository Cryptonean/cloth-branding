import { clothNumber, type Cloth } from '../../data/cloths'

interface MobileRailProps {
  cloths: Cloth[]
}

/** Phones get the rail as a swipeable strip of cloth lengths: no WebGL, no physics. */
export function MobileRail({ cloths }: MobileRailProps) {
  return (
    <div className="mobile-rail">
      <ul className="mobile-rail__list" aria-label="The rail">
        {cloths.map((cloth, i) => (
          <li key={cloth.id} className="mobile-rail__card">
            <span className="mobile-rail__hanger" aria-hidden="true" />
            <img
              src={cloth.images.texture}
              alt={`${cloth.name}, ${cloth.composition}`}
              width={1024}
              height={2048}
              loading={i < 2 ? 'eager' : 'lazy'}
              decoding="async"
            />
            <p className="mobile-rail__count">No. {clothNumber(i)}</p>
            <h2 className="mobile-rail__name">{cloth.name}</h2>
            <p className="mobile-rail__meta">{cloth.origin}</p>
            <p className="mobile-rail__meta">{cloth.price}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
