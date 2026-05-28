// File System Access API integration.
// Chrome/Edge only. Lets the deck write merged state back to the local
// file directly after the user grants one-time permission.

export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'
}

export function createFileLink({ getHtml, onLink, onWrite, onError }) {
  let handle = null
  let writeQueued = false
  let writeInFlight = false

  async function pick() {
    try {
      const [h] = await window.showOpenFilePicker({
        types: [{ description: 'HTML', accept: { 'text/html': ['.html'] } }],
      })
      const perm = await h.requestPermission({ mode: 'readwrite' })
      if (perm !== 'granted') throw new Error('write permission denied')
      handle = h
      onLink?.(h.name)
      await writeNow()
    } catch (err) {
      if (err.name === 'AbortError') return
      onError?.(err.message || String(err))
    }
  }

  async function writeNow() {
    if (!handle) return
    if (writeInFlight) { writeQueued = true; return }
    writeInFlight = true
    try {
      const html = getHtml()
      if (html === null) return
      const writable = await handle.createWritable()
      await writable.write(html)
      await writable.close()
      onWrite?.()
    } catch (err) {
      onError?.(err.message || String(err))
    } finally {
      writeInFlight = false
      if (writeQueued) { writeQueued = false; writeNow() }
    }
  }

  let debounceTimer = null
  function scheduleWrite(delayMs = 400) {
    if (!handle) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(writeNow, delayMs)
  }

  return {
    pick,
    scheduleWrite,
    isLinked: () => handle !== null,
    fileName: () => handle?.name || null,
  }
}
