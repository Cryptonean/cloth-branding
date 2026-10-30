# Filare — the rail

An interactive hero for a house selling rare natural cloth by the metre. Five cloth lengths hang on
walnut clip hangers from a curved brass rail. Each one is a real cloth simulation:

- **Hover**: the pointer is a soft hand. It presses into the cloth, and faster strokes make bigger ripples.
- **Drag / flick / trackpad swipe**: the hangers glide along the rail, swing on their hooks and loop
  round from one end to the other.
- **Click**: the cloth is lifted off the rail to the centre. Its weave close-up appears on the left and
  the garment it becomes on the right. ← → swaps cloths, Esc puts it back.

How each cloth moves comes from its real weight (`gsm`). Muga silk at 90 g/m² floats, vicuña coating
at 330 g/m² swings slowly.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # cloth physics + rail maths
npm run build      # type-check + production build into dist/
```

## Swapping in real photography

Everything a cloth needs is in [src/data/cloths.ts](src/data/cloths.ts): copy, price, weight, weave and
finish. Its images live in `public/assets/fabrics/<id>/`. Replace the files and keep the names:

| File           | What it is                                         | Size        |
| -------------- | -------------------------------------------------- | ----------- |
| `texture.webp` | Flat, evenly lit scan of the cloth, selvedge left  | 1024 × 2048 |
| `macro.webp`   | Close-up of the weave                              | 800 × 1000  |
| `look.webp`    | The finished garment                               | 800 × 1000  |

The current files are placeholders drawn by `npm run assets`
([scripts/generate-placeholders.mjs](scripts/generate-placeholders.mjs)). Brand name, prices and copy
are placeholders too.

`weave` (`brushed | twill | herringbone | plain | satin`) adds a matching thread relief that catches
the light, and `finish` sets roughness, sheen and (for silk) anisotropic lustre.

## Layout

```
src/components/rail-hero/
  RailHero.tsx        section shell: wall, header, headline; picks 3D or the phone strip
  Showroom.tsx        interactive state: rail position, focus, hover, controls
  RailScene.tsx       R3F canvas (lazy chunk): camera, lights, rail spring, shadow wall
  RoomLight.tsx       sun through a window, after-dark lamp, sunlit back wall, dust motes
  lightRig.ts         morning → golden hour → dusk → lamplight keys, visitor's clock (tested)
  SunDial.tsx         the time-of-day dial
  HangerItem.tsx      one hanger + its simulated cloth, lift-off and pendulum swing
  cloth.ts            Verlet cloth solver (tested)
  railMath.ts         ring wrapping, rail arc, fling settling (tested)
  weaveNormal.ts      generated weave normal maps
  FocusPanels.tsx     the two panels beside a lifted cloth
  Cursor.tsx          "Drag / View / Feel / Close" lens
  MobileRail.tsx      phones: a swipeable strip, no WebGL
  useRailGestures.ts  drag, flick, wheel and keys
```

## Light

A low, warm sun comes in through a three-light window to the left. It's a spotlight with a window
cookie, so mullion light falls across the cloths and slides over their folds as they swing. A cool,
neutral skylight fills the shade. The back wall is a light catcher: it glows only where direct sun
lands, so the window patch and the cloths' shadows come from that one light. Dust motes drift in the
beam and scatter from the cursor. To move the sun, change `SUN_POSITION` / `SUN_TARGET` in
[Sunlight.tsx](src/components/rail-hero/Sunlight.tsx). Keep the target between the rail and the focus
position so a lifted cloth stays in the light.

## Decisions

- Desktop-first. Below 768 px (or without WebGL2) visitors get a static swipe strip and three.js is
  never downloaded. If the 3D stage throws at runtime, an error boundary swaps in the same strip.
- First-load JS is ~74 kB gzip. three.js + R3F (~250 kB gzip) load afterwards in their own chunk.
- `prefers-reduced-motion` turns off the wind, the drifting window light and the intro glide, and
  makes the lift near-instant.
- `public/_headers` carries a strict CSP and security headers (Netlify / Cloudflare Pages format).
