import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // three.js + R3F (~250 kB gzip) is one lazy chunk loaded after first paint, by design
  build: { chunkSizeWarningLimit: 1000 },
  // exFAT drives litter "._*" AppleDouble files next to every source file
  test: { environment: 'node', exclude: [...configDefaults.exclude, '**/._*'] },
})
