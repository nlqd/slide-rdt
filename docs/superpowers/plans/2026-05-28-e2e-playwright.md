# E2E Playwright Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End-to-end Playwright tests that verify the full collaboration cycle in a real browser: file edit → browser open → CRDT sync → save → reopen.

**Architecture:** Playwright opens two browser pages against a static HTTP server serving the deck HTML files. A y-websocket relay runs on a separate port. The build script generates decks pointed at the local relay. Tests manipulate files on disk (simulating text-editor edits), open them in browser pages, wait for sync status, trigger Save, intercept the download, and verify the output file's content and CRDT state.

**Tech Stack:** Playwright (Chromium), Node built-in http (static file server), existing y-websocket relay server

---

## File Structure

```
collab-slides/
├── client/
│   ├── test/
│   │   └── e2e/
│   │       ├── e2e.spec.js        — Playwright test file (3 tests)
│   │       └── helpers.js         — start/stop servers, build decks, file manipulation
│   └── playwright.config.js       — Playwright config
```

---

## Task 1: Install Playwright and Configure

**Files:**
- Modify: `collab-slides/client/package.json` (devDependency)
- Create: `collab-slides/client/playwright.config.js`

- [ ] **Step 1: Install Playwright**

```bash
cd collab-slides/client
npm install --save-dev @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create playwright.config.js**

```javascript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    browserName: 'chromium',
    headless: true,
  },
})
```

- [ ] **Step 3: Verify Playwright runs**

```bash
cd collab-slides/client
npx playwright test --list
```

Expected: 0 tests found (no test files yet), no errors.

- [ ] **Step 4: Commit**

```bash
git add client/package.json client/package-lock.json client/playwright.config.js
git commit -m "chore: add Playwright for E2E testing"
```

---

## Task 2: E2E Test Helpers (servers + file manipulation)

**Files:**
- Create: `collab-slides/client/test/e2e/helpers.js`

- [ ] **Step 1: Write helpers.js**

This module provides:
- `startRelay(port)` — spawns the y-websocket relay server, returns a kill function
- `startStatic(dir, port)` — serves a directory over HTTP, returns URL + kill function
- `buildDeck(serverUrl, outputPath)` — runs the build script, returns the path
- `editSlides(htmlPath, newSlideHtml)` — reads deck, inserts a slide before the END marker, writes back

```javascript
import { spawn, execSync } from 'child_process'
import { createServer } from 'http'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
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
```

- [ ] **Step 2: Commit**

```bash
git add client/test/e2e/helpers.js
git commit -m "feat: E2E test helpers for server management and file manipulation"
```

---

## Task 3: E2E Test — Full Collaboration Cycle

This is the core test. It verifies the complete user journey.

**Files:**
- Create: `collab-slides/client/test/e2e/e2e.spec.js`

- [ ] **Step 1: Write the test file**

```javascript
import { test, expect } from '@playwright/test'
import { startRelay, startStatic, buildDeck, editSlides, copyDeck, readDeck } from './helpers.js'
import { mkdirSync, rmSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RELAY_PORT = 15555
const STATIC_PORT = 15556

let relay, staticServer, tmpDir

test.beforeAll(async () => {
  tmpDir = resolve(__dirname, `../../../.tmp-e2e-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })

  relay = startRelay(RELAY_PORT)
  await new Promise(r => setTimeout(r, 1500))
})

test.afterAll(async () => {
  relay.kill()
  try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
})

test.beforeEach(async () => {
  if (staticServer) staticServer.kill()
  staticServer = startStatic(tmpDir, STATIC_PORT)
})

test.afterEach(async () => {
  if (staticServer) { staticServer.kill(); staticServer = null }
})

function waitForSync(page) {
  return page.waitForFunction(
    () => {
      const el = document.getElementById('sync-status')
      return el && el.textContent === 'synced'
    },
    { timeout: 10000 }
  )
}

test('full cycle: edit file, open in browser, peer syncs, save works', async ({ browser }) => {
  const deckPath = resolve(tmpDir, 'deck-original.html')
  buildDeck(`ws://localhost:${RELAY_PORT}`, deckPath)

  const peerAPath = resolve(tmpDir, 'deck-peerA.html')
  copyDeck(deckPath, peerAPath)
  editSlides(peerAPath, `  <section class="slide">
    <div class="slide-inner">
      <h2>Peer A Added This</h2>
    </div>
  </section>`)

  const peerBPath = resolve(tmpDir, 'deck-peerB.html')
  copyDeck(deckPath, peerBPath)

  // Peer A opens modified file
  const pageA = await browser.newPage()
  await pageA.goto(`${staticServer.url}/deck-peerA.html`)
  await waitForSync(pageA)

  const pageAContent = await pageA.content()
  expect(pageAContent).toContain('Peer A Added This')

  // Peer B opens original file — should receive Peer A's edit via sync
  const pageB = await browser.newPage()
  await pageB.goto(`${staticServer.url}/deck-peerB.html`)
  await waitForSync(pageB)

  await pageB.waitForFunction(
    () => document.body.innerHTML.includes('Peer A Added This'),
    { timeout: 5000 }
  )
  const pageBContent = await pageB.content()
  expect(pageBContent).toContain('Peer A Added This')

  // Peer B clicks Save — intercept the download
  const [download] = await Promise.all([
    pageB.waitForEvent('download'),
    pageB.click('#sync-banner button'),
  ])
  const savedPath = resolve(tmpDir, 'deck-saved.html')
  await download.saveAs(savedPath)

  const savedHtml = readDeck(savedPath)
  expect(savedHtml).toContain('Peer A Added This')
  expect(savedHtml).toContain('Your Title Here')
  expect(savedHtml).not.toMatch(/data-state=""/)

  // Reopen saved file — verify it still works
  const savedServePath = resolve(tmpDir, 'deck-reopened.html')
  copyDeck(savedPath, savedServePath)
  const pageC = await browser.newPage()
  await pageC.goto(`${staticServer.url}/deck-reopened.html`)
  await waitForSync(pageC)
  const pageCContent = await pageC.content()
  expect(pageCContent).toContain('Peer A Added This')

  await pageA.close()
  await pageB.close()
  await pageC.close()
})

test('concurrent edits from both peers merge', async ({ browser }) => {
  const deckPath = resolve(tmpDir, 'deck-concurrent.html')
  buildDeck(`ws://localhost:${RELAY_PORT}`, deckPath)

  // Peer A adds slide at the end
  const peerAPath = resolve(tmpDir, 'concurrent-A.html')
  copyDeck(deckPath, peerAPath)
  editSlides(peerAPath, `  <section class="slide">
    <div class="slide-inner">
      <h2>From Peer A</h2>
    </div>
  </section>`)

  // Peer B modifies the title slide (edit existing content)
  const peerBPath = resolve(tmpDir, 'concurrent-B.html')
  copyDeck(deckPath, peerBPath)
  let bHtml = readDeck(peerBPath)
  bHtml = bHtml.replace('Your Title Here', 'Title Changed By Peer B')
  const { writeFileSync } = await import('fs')
  writeFileSync(peerBPath, bHtml)

  // Peer A opens first, syncs to server
  const pageA = await browser.newPage()
  await pageA.goto(`${staticServer.url}/concurrent-A.html`)
  await waitForSync(pageA)

  // Peer B opens, syncs — should merge both edits
  const pageB = await browser.newPage()
  await pageB.goto(`${staticServer.url}/concurrent-B.html`)
  await waitForSync(pageB)

  await pageB.waitForFunction(
    () => document.body.innerHTML.includes('From Peer A'),
    { timeout: 5000 }
  )

  const mergedContent = await pageB.content()
  expect(mergedContent).toContain('From Peer A')
  expect(mergedContent).toContain('Title Changed By Peer B')

  // Peer A should also have Peer B's title change
  await pageA.waitForFunction(
    () => document.body.innerHTML.includes('Title Changed By Peer B'),
    { timeout: 5000 }
  )

  await pageA.close()
  await pageB.close()
})

test('saved file preserves CRDT state for future sync', async ({ browser }) => {
  const deckPath = resolve(tmpDir, 'deck-roundtrip.html')
  buildDeck(`ws://localhost:${RELAY_PORT}`, deckPath)

  // Peer A edits and opens
  const peerAPath = resolve(tmpDir, 'roundtrip-A.html')
  copyDeck(deckPath, peerAPath)
  editSlides(peerAPath, `  <section class="slide">
    <div class="slide-inner">
      <h2>Round Trip Edit</h2>
    </div>
  </section>`)

  const pageA = await browser.newPage()
  await pageA.goto(`${staticServer.url}/roundtrip-A.html`)
  await waitForSync(pageA)

  // Save the file
  const [download] = await Promise.all([
    pageA.waitForEvent('download'),
    pageA.click('#sync-banner button'),
  ])
  const savedPath = resolve(tmpDir, 'roundtrip-saved.html')
  await download.saveAs(savedPath)
  await pageA.close()

  // Edit the saved file further (simulating a second editing session)
  const secondEditPath = resolve(tmpDir, 'roundtrip-second.html')
  copyDeck(savedPath, secondEditPath)
  editSlides(secondEditPath, `  <section class="slide">
    <div class="slide-inner">
      <h2>Second Session Edit</h2>
    </div>
  </section>`)

  // Open the second-edit file — it should push only the new diff, not duplicate the old edit
  const pageD = await browser.newPage()
  await pageD.goto(`${staticServer.url}/roundtrip-second.html`)
  await waitForSync(pageD)

  const content = await pageD.content()
  expect(content).toContain('Round Trip Edit')
  expect(content).toContain('Second Session Edit')

  // Verify no duplicate: "Round Trip Edit" should appear exactly once
  const matches = content.match(/Round Trip Edit/g)
  expect(matches).toHaveLength(1)

  await pageD.close()
})
```

- [ ] **Step 2: Run the tests**

```bash
cd collab-slides/client
npx playwright test
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add client/test/e2e/e2e.spec.js
git commit -m "test: E2E Playwright tests for full collaboration cycle"
```

---

## Task 4: Add npm scripts and update README

**Files:**
- Modify: `collab-slides/client/package.json`
- Modify: `collab-slides/README.md`

- [ ] **Step 1: Add test scripts to package.json**

Add to `"scripts"`:

```json
{
  "test": "node --test --test-force-exit test/diff-bridge.test.js test/sync-client.test.js test/save.test.js test/providers.test.js test/integration.test.js test/webrtc.test.js",
  "test:e2e": "npx playwright test",
  "test:all": "npm test && npm run test:e2e"
}
```

- [ ] **Step 2: Update README tests section**

Replace the Tests section with:

```
## Tests

Unit and integration tests (Node.js, no browser):

    cd client
    npm test

End-to-end tests (Playwright, real browser):

    cd client
    npm run test:e2e

The E2E tests spin up a relay server and a static file server, build deck files, open them in Chromium, and verify the full collaboration cycle: file edit, browser sync, save, and reopen.
```

- [ ] **Step 3: Run all tests**

```bash
cd collab-slides/client
npm run test:all
```

Expected: all unit/integration tests pass, all E2E tests pass.

- [ ] **Step 4: Commit and push**

```bash
git add client/package.json README.md
git commit -m "chore: add npm test scripts and update README for E2E tests"
git push
```
