import * as esbuild from 'esbuild'
import { readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PLACEHOLDER_ROOM = 'REPLACE-ME-PICK-ANY-UNIQUE-STRING'

const args = process.argv.slice(2)
const usePlaceholder = args.includes('--placeholder')
const positional = args.filter(a => !a.startsWith('--'))
const serverUrl = positional[0] || ''
const outputFile = positional[1] || resolve(__dirname, '../dist/deck.html')

const result = await esbuild.build({
  entryPoints: [resolve(__dirname, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
})

// Escape HTML-significant sequences so the parser doesn't misinterpret
// JS string content as tags/comments when embedded in <script>.
const bundledJs = result.outputFiles[0].text
  .replaceAll('<!--', '\\x3c!--')
  .replaceAll('<script', '\\x3cscript')
  .replaceAll('</script', '\\x3c/script')
  .replaceAll('<!DOCTYPE', '\\x3c!DOCTYPE')
const template = readFileSync(resolve(__dirname, '../template/deck.html'), 'utf-8')
const roomId = usePlaceholder ? PLACEHOLDER_ROOM : randomUUID()

const html = template
  .replace('{{SERVER_URL}}', () => serverUrl)
  .replace('{{ROOM_ID}}', () => roomId)
  .replace('{{SYNC_BUNDLE}}', () => bundledJs)

writeFileSync(outputFile, html)
console.log(`Built: ${outputFile}`)
console.log(`Room: ${roomId}${usePlaceholder ? ' (placeholder — user must change)' : ''}`)
console.log(`Server: ${serverUrl || '(none — WebRTC only)'}`)
console.log(`Size: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`)
