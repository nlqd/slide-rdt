// File System Access API integration.
// Chrome/Edge only. Lets the deck write merged state back to the local
// file directly after the user grants one-time permission.

export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function'
}

export function createFileLink({ getHtml, onLink, onWrite, onError }) {
  let handle = null
  let writeQueued = false
  let writeInFlight = false

  async function pick() {
    try {
      // showSaveFilePicker returns a handle with write permission already
      // granted, so we don't need a separate requestPermission step (which
      // would fail because the user activation is consumed by the picker).
      // The user can navigate to and select their existing deck.html.
      const h = await window.showSaveFilePicker({
        suggestedName: 'deck.html',
        types: [{ description: 'HTML', accept: { 'text/html': ['.html'] } }],
      })
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
