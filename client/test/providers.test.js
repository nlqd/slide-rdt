import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = resolve(__dirname, '..')
const TMP_DIR = resolve(__dirname, `.tmp-providers-${Date.now()}`)
const DECK_PATH = resolve(TMP_DIR, 'deck.html')

let deck

before(() => {
  mkdirSync(TMP_DIR, { recursive: true })
  execFileSync('node', ['build.js', '', DECK_PATH], { cwd: CLIENT_DIR })
  deck = readFileSync(DECK_PATH, 'utf-8')
})

after(() => {
  try { rmSync(TMP_DIR, { recursive: true, force: true }) } catch {}
})

describe('built deck provider configuration', () => {
  it('includes y-webrtc in the bundle (opt-in via collab-signaling meta tag)', () => {
    assert.ok(deck.includes('webrtc'), 'should include webrtc provider code')
    assert.ok(deck.includes('collab-signaling'), 'should reference the signaling meta tag name')
  })

  it('has empty signaling meta tag by default', () => {
    const match = deck.match(/collab-signaling.*content="([^"]*)"/)
    assert.ok(match, 'should have collab-signaling meta tag')
    assert.equal(match[1], '', 'signaling URL should be empty by default')
  })

  it('sets collab-room meta tag with a UUID', () => {
    const match = deck.match(/collab-room.*content="([^"]+)"/)
    assert.ok(match, 'should have collab-room meta tag')
    assert.match(match[1], /^[0-9a-f-]{36}$/, 'room ID should be a UUID')
  })

  it('leaves collab-server empty when built without server arg', () => {
    const match = deck.match(/collab-server.*content="([^"]*)"/)
    assert.ok(match, 'should have collab-server meta tag')
    assert.equal(match[1], '', 'server URL should be empty for zero-config build')
  })

  it('has slide markers and yjs-state container', () => {
    assert.ok(deck.includes('<!-- SLIDES START -->'))
    assert.ok(deck.includes('<!-- SLIDES END -->'))
    assert.ok(deck.includes('application/yjs-state'))
  })

  it('uses collab- prefixed IDs (not old generic names)', () => {
    assert.ok(deck.includes('id="collab-slides"'))
    assert.ok(deck.includes('id="collab-counter"'))
    assert.ok(!deck.match(/id="slides"/))
    assert.ok(!deck.match(/id="slide-counter"/))
    assert.ok(!deck.match(/id="sync-banner"/))
  })

  it('--placeholder mode produces a deck with placeholder room ID', () => {
    const placeholderPath = resolve(TMP_DIR, 'deck-placeholder.html')
    execFileSync('node', ['build.js', '--placeholder', '', placeholderPath], { cwd: CLIENT_DIR })
    const placeholderDeck = readFileSync(placeholderPath, 'utf-8')
    assert.ok(placeholderDeck.includes('REPLACE-ME-PICK-ANY-UNIQUE-STRING'))
  })
})
