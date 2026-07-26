import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

function sitesWorker(): Plugin {
  return {
    name: 'butterfly-farm-sites-worker',
    apply: 'build',
    async buildStart() {
      await rm(resolve('dist'), { recursive: true, force: true })
    },
    async closeBundle() {
      const serverDir = resolve('dist/server')
      await mkdir(serverDir, { recursive: true })
      await writeFile(
        resolve(serverDir, 'index.js'),
        `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    if (response.status !== 404) return response

    const url = new URL(request.url)
    url.pathname = '/index.html'
    return env.ASSETS.fetch(new Request(url, request))
  },
}
`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), sitesWorker(), cloudflare()],
  build: {
    outDir: 'dist/client',
  },
})