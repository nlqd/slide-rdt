import { spawn, execSync } from 'child_process'
import { createServer } from 'http'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../../..')
const CLIENT_DIR = resolve(PROJECT_ROOT, 'client')
const SERVER_DIR = resolve(PROJECT_ROOT, 'server')

export function startRelay(port) {
  const proc = spawn('node', ['index.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(port) },
    stdio: 'pipe',
    detached: true,
  })
  return {
    kill: () => { try { process.kill(-proc.pid, 'SIGKILL') } catch {} },
  }
}

export function startStatic(dir, port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
  }
  const server = createServer((req, res) => {
    const filePath = resolve(dir, req.url === '/' ? 'index.html' : req.url.slice(1))
    try {
      const content = readFileSync(filePath)
      const ext = extname(filePath)
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' })
      res.end(content)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  })
  server.listen(port)
  return {
    url: `http://localhost:${port}`,
    kill: () => server.close(),
  }
}

export function buildDeck(serverUrl, outputPath) {
  execSync(`node build.js ${serverUrl} ${outputPath}`, { cwd: CLIENT_DIR })
  return outputPath
}

export function editSlides(htmlPath, newSlideHtml) {
  let html = readFileSync(htmlPath, 'utf-8')
  html = html.replace('<!-- SLIDES END -->', newSlideHtml + '\n<!-- SLIDES END -->')
  writeFileSync(htmlPath, html)
  return htmlPath
}

export function copyDeck(srcPath, destPath) {
  writeFileSync(destPath, readFileSync(srcPath, 'utf-8'))
  return destPath
}

export function readDeck(htmlPath) {
  return readFileSync(htmlPath, 'utf-8')
}
