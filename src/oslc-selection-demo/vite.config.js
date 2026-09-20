import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const packageVersion = JSON.parse(
  readFileSync(new URL('../oslc-selection-webcomponent/package.json', import.meta.url), 'utf8')
).version

const shortCommitSha = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'
const buildVersion = process.env.VITE_BUILD_VERSION ?? (
  packageVersion === '999.9.9'
    ? `${packageVersion}+${shortCommitSha}`
    : `v${packageVersion}`
)

export default defineConfig({
  base: './',
  define: {
    __OSLC_BUILD_VERSION__: JSON.stringify(buildVersion)
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 8080,
    open: true
  },
  optimizeDeps: {
    include: ['@oslc/oslc-selection-webcomponent']
  }
})
