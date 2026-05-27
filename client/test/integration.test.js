import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { applyExternalEdit } from '../src/diff-bridge.js'
import { serializeState, hydrateDoc } from '../src/sync-client.js'
import { buildSaveableHtml } from '../src/save.js'
import { spawn } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SERVER_PORT = 14444

function waitForSync(provider, timeout = 3000) {
  return new Promise((resolve, reject) => {
    if (provider.synced) return resolve()
    const timer = setTimeout(() => reject(new Error('sync timeout')), timeout)
    provider.once('synced', () => { clearTimeout(timer); resolve() })
  })
}

function waitForConvergence(doc1, doc2, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('convergence timeout')), timeout)
    const check = () => {
      const t1 = doc1.getText('content').toString()
      const t2 = doc2.getText('content').toString()
      if (t1 === t2 && t1.length > 0) {
        clearTimeout(timer)
        doc1.off('update', check)
        doc2.off('update', check)
        resolve()
      }
    }
    doc1.on('update', check)
    doc2.on('update', check)
    check()
  })
}

describe('integration: two peers sync via server', { timeout: 15000 }, () => {
  let serverProcess

  before(async () => {
    serverProcess = spawn('node', ['index.js'], {
      cwd: resolve(__dirname, '../../server'),
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: 'pipe',
      detached: true,
    })
    await new Promise(r => setTimeout(r, 1500))
  })

  after(() => {
    if (serverProcess) {
      process.kill(-serverProcess.pid, 'SIGKILL')
      serverProcess.unref()
      serverProcess = null
    }
  })

  it('syncs initial state from peer 1 to peer 2', async () => {
    const roomId = `test-init-${Date.now()}`
    const slides = '<section>Hello</section>'

    const doc1 = new Y.Doc()
    doc1.getText('content').insert(0, slides)

    const doc2 = new Y.Doc()

    const ws1 = new WebsocketProvider(`ws://localhost:${SERVER_PORT}`, roomId, doc1)
    const ws2 = new WebsocketProvider(`ws://localhost:${SERVER_PORT}`, roomId, doc2)

    await waitForSync(ws2)
    await waitForConvergence(doc1, doc2)

    assert.equal(doc2.getText('content').toString(), slides)

    ws1.disconnect()
    ws2.disconnect()
  })

  it('merges concurrent offline edits (the real use case)', async () => {
    const roomId = `test-offline-${Date.now()}`
    const slides = '<section>Slide A</section>\n<section>Slide B</section>'

    // Phase 1: establish shared initial state
    const doc1 = new Y.Doc()
    doc1.getText('content').insert(0, slides)
    const ws1 = new WebsocketProvider(`ws://localhost:${SERVER_PORT}`, roomId, doc1)
    await waitForSync(ws1)

    const doc2 = new Y.Doc()
    const ws2 = new WebsocketProvider(`ws://localhost:${SERVER_PORT}`, roomId, doc2)
    await waitForSync(ws2)
    assert.equal(doc2.getText('content').toString(), slides)

    // Save the CRDT state (simulates the embedded base64 blob in the HTML file)
    const savedState = serializeState(doc1)

    // Phase 2: both peers disconnect (simulates closing browser / editing file offline)
    ws1.disconnect()
    ws2.disconnect()

    // Phase 3: both peers edit their local files independently
    // Each peer creates a fresh Y.Doc from the saved state (simulates opening the HTML file)
    const peer1Doc = new Y.Doc()
    hydrateDoc(peer1Doc, savedState)
    applyExternalEdit(peer1Doc.getText('content'),
      '<section>Slide A EDITED</section>\n<section>Slide B</section>')

    const peer2Doc = new Y.Doc()
    hydrateDoc(peer2Doc, savedState)
    applyExternalEdit(peer2Doc.getText('content'),
      '<section>Slide A</section>\n<section>Slide B EDITED</section>')

    // Phase 4: both peers reconnect (simulates opening file in browser to sync)
    const peer1Ws = new WebsocketProvider(`ws://localhost:${SERVER_PORT}`, roomId, peer1Doc)
    const peer2Ws = new WebsocketProvider(`ws://localhost:${SERVER_PORT}`, roomId, peer2Doc)

    await waitForConvergence(peer1Doc, peer2Doc)

    const result1 = peer1Doc.getText('content').toString()
    const result2 = peer2Doc.getText('content').toString()
    assert.equal(result1, result2, 'both peers should converge')
    assert.ok(result1.includes('Slide A EDITED'), 'should contain peer 1 edit')
    assert.ok(result1.includes('Slide B EDITED'), 'should contain peer 2 edit')

    peer1Ws.disconnect()
    peer2Ws.disconnect()
  })

  it('late joiner receives all prior edits', async () => {
    const roomId = `test-late-${Date.now()}`

    // Peer 1 creates content and syncs to server
    const doc1 = new Y.Doc()
    doc1.getText('content').insert(0, 'original content')
    const ws1 = new WebsocketProvider(`ws://localhost:${SERVER_PORT}`, roomId, doc1)
    await waitForSync(ws1)

    applyExternalEdit(doc1.getText('content'), 'edited content with more stuff')
    await new Promise(r => setTimeout(r, 300))
    ws1.disconnect()

    // Peer 2 joins later with an empty doc
    const doc2 = new Y.Doc()
    const ws2 = new WebsocketProvider(`ws://localhost:${SERVER_PORT}`, roomId, doc2)
    await waitForSync(ws2)

    assert.equal(doc2.getText('content').toString(), 'edited content with more stuff')
    ws2.disconnect()
  })

  it('state serialization round-trips through save/hydrate cycle', async () => {
    const roomId = `test-roundtrip-${Date.now()}`

    const doc = new Y.Doc()
    doc.getText('content').insert(0, 'slide content here')
    const ws = new WebsocketProvider(`ws://localhost:${SERVER_PORT}`, roomId, doc)
    await waitForSync(ws)

    applyExternalEdit(doc.getText('content'), 'slide content here\nplus new slide')
    const b64 = serializeState(doc)
    ws.disconnect()

    // Simulate the buildSaveableHtml → file save → file reopen cycle
    const fakeHtml = `<!-- SLIDES START -->\nold\n<!-- SLIDES END -->\n<script type="application/yjs-state" data-state="old-state"></script>`
    const savedHtml = buildSaveableHtml(fakeHtml, 'slide content here\nplus new slide', b64)
    assert.ok(savedHtml.includes(`data-state="${b64}"`))

    // Rehydrate from saved state
    const doc2 = new Y.Doc()
    hydrateDoc(doc2, b64)
    assert.equal(doc2.getText('content').toString(), 'slide content here\nplus new slide')
  })

  it('handles three-way merge across sequential sync sessions', async () => {
    const roomId = `test-3way-${Date.now()}`
    const initial = '<h1>Title</h1>\n<p>Body A</p>\n<p>Body B</p>'

    // Establish initial state
    const origin = new Y.Doc()
    origin.getText('content').insert(0, initial)
    const wsOrigin = new WebsocketProvider(`ws://localhost:${SERVER_PORT}`, roomId, origin)
    await waitForSync(wsOrigin)
    const baseState = serializeState(origin)
    wsOrigin.disconnect()

    // Peer 1 edits title offline
    const peer1 = new Y.Doc()
    hydrateDoc(peer1, baseState)
    applyExternalEdit(peer1.getText('content'), '<h1>New Title</h1>\n<p>Body A</p>\n<p>Body B</p>')

    // Peer 1 syncs
    const ws1 = new WebsocketProvider(`ws://localhost:${SERVER_PORT}`, roomId, peer1)
    await waitForSync(ws1)
    await new Promise(r => setTimeout(r, 300))
    ws1.disconnect()

    // Peer 2 edits body B offline (from original base state, hasn't seen peer 1's edit)
    const peer2 = new Y.Doc()
    hydrateDoc(peer2, baseState)
    applyExternalEdit(peer2.getText('content'), '<h1>Title</h1>\n<p>Body A</p>\n<p>Body B revised</p>')

    // Peer 2 syncs — should merge with peer 1's title change
    const ws2 = new WebsocketProvider(`ws://localhost:${SERVER_PORT}`, roomId, peer2)
    await waitForSync(ws2)
    await new Promise(r => setTimeout(r, 500))

    const result = peer2.getText('content').toString()
    assert.ok(result.includes('New Title'), 'should have peer 1 title edit')
    assert.ok(result.includes('Body B revised'), 'should have peer 2 body edit')

    ws2.disconnect()
  })
})
