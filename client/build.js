import * as esbuild from 'esbuild'
import { readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const serverUrl = process.argv[2] || ''
const outputFile = process.argv[3] || resolve(__dirname, '../dist/deck.html')

const result = await esbuild.build({
  entryPoints: [resolve(__dirname, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
})

// Escape HTML-significant sequences so the HTML parser doesn't misinterpret
// JS string content as HTML comments or tags when embedded in <script>.
const bundledJs = result.outputFiles[0].text
  .replaceAll('<!--', '\\x3c!--')
  .replaceAll('<script', '\\x3cscript')
  .replaceAll('</script', '\\x3c/script')
const template = readFileSync(resolve(__dirname, '../template/deck.html'), 'utf-8')
const roomId = randomUUID()

const html = template
  .replace('{{SERVER_URL}}', serverUrl)
  .replace('{{ROOM_ID}}', roomId)
  .replace('{{SYNC_BUNDLE}}', () => bundledJs)

writeFileSync(outputFile, html)
console.log(`Built: ${outputFile}`)
console.log(`Room: ${roomId}`)
console.log(`Server: ${serverUrl || '(none — WebRTC only)'}`)
console.log(`Size: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`)
