import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyExternalEdit } from '../src/diff-bridge.js'
import * as Y from 'yjs'

describe('applyExternalEdit', () => {
  it('detects no change', () => {
    const doc = new Y.Doc()
    const ytext = doc.getText('content')
    ytext.insert(0, 'hello world')
    const changed = applyExternalEdit(ytext, 'hello world')
    assert.equal(changed, false)
    assert.equal(ytext.toString(), 'hello world')
  })

  it('detects appended text', () => {
    const doc = new Y.Doc()
    const ytext = doc.getText('content')
    ytext.insert(0, 'slide 1')
    const changed = applyExternalEdit(ytext, 'slide 1\nslide 2')
    assert.equal(changed, true)
    assert.equal(ytext.toString(), 'slide 1\nslide 2')
  })

  it('detects deleted text', () => {
    const doc = new Y.Doc()
    const ytext = doc.getText('content')
    ytext.insert(0, 'aaa\nbbb\nccc')
    const changed = applyExternalEdit(ytext, 'aaa\nccc')
    assert.equal(changed, true)
    assert.equal(ytext.toString(), 'aaa\nccc')
  })

  it('detects replaced text', () => {
    const doc = new Y.Doc()
    const ytext = doc.getText('content')
    ytext.insert(0, 'hello world')
    const changed = applyExternalEdit(ytext, 'hello CRDT')
    assert.equal(changed, true)
    assert.equal(ytext.toString(), 'hello CRDT')
  })

  it('handles empty initial state', () => {
    const doc = new Y.Doc()
    const ytext = doc.getText('content')
    const changed = applyExternalEdit(ytext, 'new content')
    assert.equal(changed, true)
    assert.equal(ytext.toString(), 'new content')
  })

  it('merges concurrent edits from two peers', () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()
    const yt1 = doc1.getText('content')
    const yt2 = doc2.getText('content')

    yt1.insert(0, '<section>AAA</section>\n<section>BBB</section>')
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))

    applyExternalEdit(yt1, '<section>AAA-edited</section>\n<section>BBB</section>')
    applyExternalEdit(yt2, '<section>AAA</section>\n<section>BBB-edited</section>')

    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2))
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))

    assert.equal(yt1.toString(), yt2.toString())
    const merged = yt1.toString()
    assert.ok(merged.includes('AAA-edited'), 'should contain peer 1 edit')
    assert.ok(merged.includes('BBB-edited'), 'should contain peer 2 edit')
  })
})
