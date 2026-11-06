import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
    // The version shown in the app comes from package.json, so a release bump updates it too.
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    plugins: [react()]
  }
})
