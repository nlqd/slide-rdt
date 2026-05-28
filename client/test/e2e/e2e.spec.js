import { test, expect } from '@playwright/test'
import { startRelay, startStatic, buildDeck, editSlides, copyDeck, readDeck } from './helpers.js'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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
      const el = document.getElementById('collab-status')
      if (!el) return false
      const text = el.textContent
      return text === 'synced' || text === 'remote changes received'
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
    <h2>Peer A Added This</h2>
  </section>`)

  const peerBPath = resolve(tmpDir, 'deck-peerB.html')
  copyDeck(deckPath, peerBPath)

  const pageA = await browser.newPage()
  await pageA.goto(`${staticServer.url}/deck-peerA.html`)
  await waitForSync(pageA)

  const pageAContent = await pageA.content()
  expect(pageAContent).toContain('Peer A Added This')

  const pageB = await browser.newPage()
  await pageB.goto(`${staticServer.url}/deck-peerB.html`)
  await waitForSync(pageB)

  await pageB.waitForFunction(
    () => document.body.innerHTML.includes('Peer A Added This'),
    { timeout: 5000 }
  )
  const pageBContent = await pageB.content()
  expect(pageBContent).toContain('Peer A Added This')

  // Trigger save and capture the generated HTML via the Blob URL
  const savedHtml = await pageB.evaluate(() => {
    return new Promise(resolve => {
      const origCreateObjectURL = URL.createObjectURL
      URL.createObjectURL = (blob) => {
        blob.text().then(text => resolve(text))
        return origCreateObjectURL(blob)
      }
      document.querySelector('#collab-banner button').click()
    })
  })
  expect(savedHtml).toContain('Peer A Added This')
  expect(savedHtml).toContain('Your Title Here')
  expect(savedHtml).not.toMatch(/data-state=""/)

  const savedServePath = resolve(tmpDir, 'deck-reopened.html')
  writeFileSync(savedServePath, savedHtml)
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

  const peerAPath = resolve(tmpDir, 'concurrent-A.html')
  copyDeck(deckPath, peerAPath)
  editSlides(peerAPath, `  <section class="slide">
    <h2>From Peer A</h2>
  </section>`)

  const peerBPath = resolve(tmpDir, 'concurrent-B.html')
  copyDeck(deckPath, peerBPath)
  let bHtml = readDeck(peerBPath)
  bHtml = bHtml.replace('Your Title Here', 'Title Changed By Peer B')
  writeFileSync(peerBPath, bHtml)

  const pageA = await browser.newPage()
  await pageA.goto(`${staticServer.url}/concurrent-A.html`)
  await waitForSync(pageA)

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

  const peerAPath = resolve(tmpDir, 'roundtrip-A.html')
  copyDeck(deckPath, peerAPath)
  editSlides(peerAPath, `  <section class="slide">
    <h2>Round Trip Edit</h2>
  </section>`)

  const pageA = await browser.newPage()
  await pageA.goto(`${staticServer.url}/roundtrip-A.html`)
  await waitForSync(pageA)

  const savedHtml = await pageA.evaluate(() => {
    return new Promise(resolve => {
      const origCreateObjectURL = URL.createObjectURL
      URL.createObjectURL = (blob) => {
        blob.text().then(text => resolve(text))
        return origCreateObjectURL(blob)
      }
      document.querySelector('#collab-banner button').click()
    })
  })
  await pageA.close()

  const savedPath = resolve(tmpDir, 'roundtrip-saved.html')
  writeFileSync(savedPath, savedHtml)

  const secondEditPath = resolve(tmpDir, 'roundtrip-second.html')
  copyDeck(savedPath, secondEditPath)
  editSlides(secondEditPath, `  <section class="slide">
    <h2>Second Session Edit</h2>
  </section>`)

  const pageD = await browser.newPage()
  await pageD.goto(`${staticServer.url}/roundtrip-second.html`)
  await waitForSync(pageD)

  const content = await pageD.content()
  expect(content).toContain('Round Trip Edit')
  expect(content).toContain('Second Session Edit')

  const matches = content.match(/Round Trip Edit/g)
  expect(matches).toHaveLength(1)

  await pageD.close()
})
