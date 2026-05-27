import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { fork } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createConnection } from 'net'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PEER_SCRIPT = resolve(__dirname, 'webrtc-peer.js')
const SIGNALING = 'wss://signaling.yjs.dev'

let hasWebrtc = false
let signalingReachable = false

before(async () => {
  try {
    await import('node-datachannel/polyfill')
    hasWebrtc = true
  } catch {
    hasWebrtc = false
  }

  signalingReachable = await new Promise((resolve) => {
    const url = new URL(SIGNALING)
    const sock = createConnection({ host: url.hostname, port: 443, timeout: 3000 })
    sock.on('connect', () => { sock.destroy(); resolve(true) })
    sock.on('error', () => resolve(false))
    sock.on('timeout', () => { sock.destroy(); resolve(false) })
  })
})

function spawnPeer(room, role) {
  return new Promise((resolve, reject) => {
    const child = fork(PEER_SCRIPT, [], {
      env: { ...process.env, ROOM: room, ROLE: role, SIGNALING },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    })
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error(`${role} peer timed out`))
    }, 15000)
    child.on('message', (msg) => {
      if (msg.type === 'log') return
      clearTimeout(timeout)
      child.kill()
      resolve(msg)
    })
    child.on('error', (err) => { clearTimeout(timeout); reject(err) })
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeout)
        reject(new Error(`${role} peer exited with code ${code}`))
      }
    })
  })
}

describe('webrtc: peer-to-peer sync via public signaling', { timeout: 30000 }, () => {
  it('syncs text between two peers in separate processes', async (t) => {
    if (!hasWebrtc) { t.skip('node-datachannel not installed'); return }
    if (!signalingReachable) { t.skip('signaling server unreachable'); return }

    const room = `test-webrtc-${Date.now()}`
    const [writer, reader] = await Promise.all([
      spawnPeer(room, 'writer'),
      spawnPeer(room, 'reader'),
    ])

    assert.equal(writer.text, 'hello from writer')
    assert.equal(reader.text, 'hello from writer',
      'reader should have received writer text via WebRTC')
  })
})
