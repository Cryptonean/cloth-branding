export type Weave = 'brushed' | 'twill' | 'herringbone' | 'plain' | 'satin'

export interface Cloth {
  id: string
  name: string
  origin: string
  composition: string
  /** Weight in g/m². Also sets how heavily the cloth swings and drapes on the rail. */
  gsm: number
  use: string
  width: string
  price: string
  macroCaption: string
  lookCaption: string
  weave: Weave
  finish: { roughness: number; sheen: number; anisotropy?: number }
  images: { texture: string; macro: string; look: string }
}

// Swap real photography in by replacing these files; the paths stay the same.
const imagesFor = (id: string): Cloth['images'] => {
  const dir = `${import.meta.env.BASE_URL}assets/fabrics/${id}`
  return { texture: `${dir}/texture.webp`, macro: `${dir}/macro.webp`, look: `${dir}/look.webp` }
}

export const clothNumber = (index: number): string => String(index + 1).padStart(2, '0')

// Rail order. Index 0 starts in the centre; the rest wrap around it.
export const CLOTHS: Cloth[] = [
  {
    id: 'vicuna',
    name: 'Vicuña',
    origin: 'Andes, Peru · 12.5 µm',
    composition: '100% vicuña, midnight',
    gsm: 330,
    use: 'Coating',
    width: '150 cm',
    price: '₹4,20,000 / m',
    macroCaption: 'Finer than cashmere, shorn from wild vicuñas only once every few years.',
    lookCaption: 'Tailored as a knee-length overcoat.',
    weave: 'brushed',
    finish: { roughness: 0.92, sheen: 0.85 },
    images: imagesFor('vicuna'),
  },
  {
    id: 'cervelt',
    name: 'Cervelt',
    origin: 'New Zealand · red deer down',
    composition: '100% cervelt, sage',
    gsm: 270,
    use: 'Jacketing',
    width: '150 cm',
    price: '₹2,10,000 / m',
    macroCaption: 'The winter down of red deer, combed by hand during the brief spring moult.',
    lookCaption: 'Tailored as a single-breasted jacket.',
    weave: 'twill',
    finish: { roughness: 0.86, sheen: 0.55 },
    images: imagesFor('cervelt'),
  },
  {
    id: 'qiviut',
    name: 'Qiviut',
    origin: 'Arctic Alaska · musk-ox down',
    composition: '100% qiviut, oxblood',
    gsm: 210,
    use: 'Stole cloth',
    width: '70 cm',
    price: '₹1,45,000 / m',
    macroCaption: 'Gathered as the musk ox sheds its winter underwool, and famously warmer than sheep’s wool.',
    lookCaption: 'Woven as a fringed stole.',
    weave: 'herringbone',
    finish: { roughness: 0.9, sheen: 0.7 },
    images: imagesFor('qiviut'),
  },
  {
    id: 'lotus',
    name: 'Lotus Silk',
    origin: 'Inle Lake, Myanmar · handwoven',
    composition: '100% lotus stem fibre',
    gsm: 160,
    use: 'Shirting',
    width: '90 cm',
    price: '₹96,000 / m',
    macroCaption: 'Drawn by hand from lotus stems, thousands of them for a single scarf.',
    lookCaption: 'Cut as a relaxed shirt.',
    weave: 'plain',
    finish: { roughness: 0.94, sheen: 0.18 },
    images: imagesFor('lotus'),
  },
  {
    id: 'muga',
    name: 'Muga Silk',
    origin: 'Assam, India · wild silk',
    composition: '100% muga silk, undyed',
    gsm: 90,
    use: 'Dress weight',
    width: '112 cm',
    price: '₹28,000 / m',
    macroCaption: 'A wild silk whose natural golden lustre deepens with every wash.',
    lookCaption: 'Bias-cut into a slip dress.',
    weave: 'satin',
    finish: { roughness: 0.34, sheen: 0.3, anisotropy: 0.7 },
    images: imagesFor('muga'),
  },
]
