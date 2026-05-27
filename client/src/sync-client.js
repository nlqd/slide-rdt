import * as Y from 'yjs'

const MARKER_START = '<!-- SLIDES START -->'
const MARKER_END = '<!-- SLIDES END -->'

export function extractSlideContent(html) {
  const startIdx = html.indexOf(MARKER_START)
  const endIdx = html.indexOf(MARKER_END)
  if (startIdx === -1 || endIdx === -1) return null
  return html.slice(startIdx + MARKER_START.length, endIdx)
}

export function injectSlideContent(html, newContent) {
  const startIdx = html.indexOf(MARKER_START)
  const endIdx = html.indexOf(MARKER_END)
  return html.slice(0, startIdx + MARKER_START.length) +
    newContent +
    html.slice(endIdx)
}

export function serializeState(doc) {
  const update = Y.encodeStateAsUpdate(doc)
  const binary = String.fromCharCode(...update)
  return btoa(binary)
}

export function hydrateDoc(doc, b64State) {
  if (!b64State) return
  const binary = atob(b64State)
  const update = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    update[i] = binary.charCodeAt(i)
  }
  Y.applyUpdate(doc, update)
}
