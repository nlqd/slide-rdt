import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('built deck provider configuration', () => {
  it('includes y-webrtc in the bundle', () => {
    const deck = readFileSync(resolve(__dirname, '../../dist/deck.html'), 'utf-8')
    assert.ok(deck.includes('signaling.yjs.dev'), 'should reference the public signaling server')
    assert.ok(deck.includes('webrtc'), 'should include webrtc provider code')
  })

  it('sets collab-room meta tag with a UUID', () => {
    const deck = readFileSync(resolve(__dirname, '../../dist/deck.html'), 'utf-8')
    const match = deck.match(/collab-room.*content="([^"]+)"/)
    assert.ok(match, 'should have collab-room meta tag')
    assert.match(match[1], /^[0-9a-f-]{36}$/, 'room ID should be a UUID')
  })

  it('leaves collab-server empty when built without server arg', () => {
    const deck = readFileSync(resolve(__dirname, '../../dist/deck.html'), 'utf-8')
    const match = deck.match(/collab-server.*content="([^"]*)"/)
    assert.ok(match, 'should have collab-server meta tag')
    assert.equal(match[1], '', 'server URL should be empty for zero-config build')
  })

  it('has slide markers and yjs-state container', () => {
    const deck = readFileSync(resolve(__dirname, '../../dist/deck.html'), 'utf-8')
    assert.ok(deck.includes('<!-- SLIDES START -->'))
    assert.ok(deck.includes('<!-- SLIDES END -->'))
    assert.ok(deck.includes('application/yjs-state'))
  })

  it('uses collab- prefixed IDs (not old generic names)', () => {
    const deck = readFileSync(resolve(__dirname, '../../dist/deck.html'), 'utf-8')
    assert.ok(deck.includes('id="collab-slides"'))
    assert.ok(deck.includes('id="collab-counter"'))
    assert.ok(!deck.match(/id="slides"/))
    assert.ok(!deck.match(/id="slide-counter"/))
    assert.ok(!deck.match(/id="sync-banner"/))
  })
})
