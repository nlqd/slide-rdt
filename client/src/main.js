import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { WebrtcProvider } from 'y-webrtc'
import { applyExternalEdit } from './diff-bridge.js'
import {
  extractSlideContent,
  hydrateDoc,
  serializeState,
} from './sync-client.js'
import { initNav } from './nav.js'
import { initUI } from './ui.js'

document.addEventListener('DOMContentLoaded', () => {
  const serverUrl = document.querySelector('meta[name="collab-server"]')?.content
  const roomId = document.querySelector('meta[name="collab-room"]')?.content

  if (!roomId) {
    console.warn('collab-slides: missing room ID in meta tags')
    initNav()
    return
  }

  const stateElement = document.querySelector('script[type="application/yjs-state"]')
  const originalHtml = '<!DOCTYPE html>\n<html lang="en">' +
    document.documentElement.innerHTML + '</html>'

  const doc = new Y.Doc()
  const ytext = doc.getText('content')

  const existingState = stateElement?.getAttribute('data-state') || null
  hydrateDoc(doc, existingState)

  const slidesContainer = document.getElementById('slides')
  const currentContent = extractSlideContent(slidesContainer.innerHTML)
  if (currentContent !== null) {
    applyExternalEdit(ytext, currentContent)
  }

  const providers = []

  const webrtc = new WebrtcProvider(roomId, doc, {
    signaling: ['wss://signaling.yjs.dev'],
  })
  providers.push(webrtc)

  if (serverUrl) {
    const ws = new WebsocketProvider(serverUrl, roomId, doc)
    providers.push(ws)
  }

  const syncHandle = {
    doc,
    ytext,
    provider: providers[0],
    providers,
    getSerializedState: () => serializeState(doc),
    disconnect: () => providers.forEach(p => p.disconnect()),
  }

  let ui

  const MARKER_START = '<!-- SLIDES START -->'
  const MARKER_END = '<!-- SLIDES END -->'

  ytext.observe(() => {
    const remoteContent = ytext.toString()
    const containerHtml = slidesContainer.innerHTML
    const localContent = extractSlideContent(containerHtml)
    if (localContent !== null && localContent !== remoteContent) {
      const startIdx = containerHtml.indexOf(MARKER_START)
      const endIdx = containerHtml.indexOf(MARKER_END)
      slidesContainer.innerHTML =
        containerHtml.slice(0, startIdx + MARKER_START.length) +
        '\n' + remoteContent + '\n' +
        containerHtml.slice(endIdx)
      initNav()
      if (ui) ui.showRemoteChanges()
    }
  })

  initNav()
  ui = initUI({ syncHandle, originalHtml })
})
