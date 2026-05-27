import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { applyExternalEdit } from './diff-bridge.js'
import {
  extractSlideContent,
  injectSlideContent,
  hydrateDoc,
  serializeState,
} from './sync-client.js'
import { initNav } from './nav.js'
import { initUI } from './ui.js'

document.addEventListener('DOMContentLoaded', () => {
  const serverUrl = document.querySelector('meta[name="collab-server"]')?.content
  const roomId = document.querySelector('meta[name="collab-room"]')?.content

  if (!serverUrl || !roomId) {
    console.warn('collab-slides: missing server URL or room ID in meta tags')
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

  const currentContent = extractSlideContent(document.body.innerHTML)
  if (currentContent !== null) {
    applyExternalEdit(ytext, currentContent)
  }

  const provider = new WebsocketProvider(serverUrl, roomId, doc)

  const syncHandle = {
    doc,
    ytext,
    provider,
    getSerializedState: () => serializeState(doc),
    disconnect: () => provider.disconnect(),
  }

  let ui

  ytext.observe(() => {
    const remoteContent = ytext.toString()
    const localContent = extractSlideContent(document.body.innerHTML)
    if (localContent !== null && localContent !== remoteContent) {
      const bodyHtml = document.body.innerHTML
      document.body.innerHTML = injectSlideContent(bodyHtml, '\n' + remoteContent + '\n')
      initNav()
      if (ui) ui.showRemoteChanges()
    }
  })

  initNav()
  ui = initUI({ syncHandle, originalHtml })
})
