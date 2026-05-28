import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createFileLink, isFileSystemAccessSupported } from '../src/file-sync.js'

describe('isFileSystemAccessSupported', () => {
  it('returns false in node (no window)', () => {
    assert.equal(isFileSystemAccessSupported(), false)
  })
})

function makeFakeHandle({ name = 'deck.html', writeOk = true } = {}) {
  const writes = []
  return {
    name,
    createWritable: async () => ({
      write: async (data) => {
        if (!writeOk) throw new Error('write failed')
        writes.push(data)
      },
      close: async () => {},
    }),
    _writes: writes,
  }
}

function makeFakeWindow(handle, { abortOnPick = false } = {}) {
  return {
    showSaveFilePicker: async () => {
      if (abortOnPick) {
        const err = new Error('user aborted')
        err.name = 'AbortError'
        throw err
      }
      return handle
    },
  }
}

describe('createFileLink', () => {
  it('starts unlinked', () => {
    const link = createFileLink({ getHtml: () => '<html></html>' })
    assert.equal(link.isLinked(), false)
    assert.equal(link.fileName(), null)
  })

  it('pick links the file and writes immediately', async () => {
    const orig = global.window
    const handle = makeFakeHandle({ name: 'deck.html' })
    global.window = makeFakeWindow(handle)
    const linkEvents = []
    const writeEvents = []
    const link = createFileLink({
      getHtml: () => '<html>x</html>',
      onLink: (n) => linkEvents.push(n),
      onWrite: () => writeEvents.push(true),
    })
    await link.pick()
    assert.equal(link.isLinked(), true)
    assert.equal(link.fileName(), 'deck.html')
    assert.deepEqual(linkEvents, ['deck.html'])
    assert.deepEqual(handle._writes, ['<html>x</html>'])
    assert.equal(writeEvents.length, 1)
    global.window = orig
  })

  it('user abort does not call onError', async () => {
    const orig = global.window
    global.window = makeFakeWindow(null, { abortOnPick: true })
    const errors = []
    const link = createFileLink({
      getHtml: () => '<html></html>',
      onError: (e) => errors.push(e),
    })
    await link.pick()
    assert.equal(link.isLinked(), false)
    assert.equal(errors.length, 0)
    global.window = orig
  })

  it('scheduleWrite is a no-op when not linked', () => {
    const link = createFileLink({ getHtml: () => '<html></html>' })
    link.scheduleWrite()
    assert.equal(link.isLinked(), false)
  })

  it('getHtml returning null skips the write cleanly', async () => {
    const orig = global.window
    const handle = makeFakeHandle()
    global.window = makeFakeWindow(handle)
    let returnNull = false
    const link = createFileLink({
      getHtml: () => returnNull ? null : '<html>x</html>',
    })
    await link.pick()
    // initial write happens during pick
    assert.equal(handle._writes.length, 1)
    returnNull = true
    // schedule another write that resolves to null
    link.scheduleWrite(0)
    await new Promise(r => setTimeout(r, 50))
    assert.equal(handle._writes.length, 1, 'null result must not produce a write')
    global.window = orig
  })
})
