import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RailHero } from './components/rail-hero/RailHero'
import './styles/tokens.css'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <main>
      <RailHero />
    </main>
  </StrictMode>,
)
