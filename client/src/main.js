import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { WebrtcProvider } from 'y-webrtc'
import { applyExternalEdit } from './diff-bridge.js'
import {
  extractSlideContent,
  injectSlideContent,
  hydrateDoc,
  serializeState,
} from './sync-client.js'
import { initNav } from './nav.js'
import { initUI } from './ui.js'

const PLACEHOLDER_ROOM = 'REPLACE-ME-PICK-ANY-UNIQUE-STRING'

function showSetupBanner(message) {
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    all: initial; position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%); z-index: 2147483647;
    background: #faf8f4; color: #2c2c2c;
    border: 2px solid #8b5e3c; padding: 24px 32px;
    font: 16px/1.5 system-ui, sans-serif; max-width: 480px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15); border-radius: 8px;
  `
  overlay.innerHTML = `<strong style="font:inherit;">Setup needed</strong><br><br>${message}`
  document.body.appendChild(overlay)
}

document.addEventListener('DOMContentLoaded', () => {
  const serverUrl = document.querySelector('meta[name="collab-server"]')?.content
  const roomId = document.querySelector('meta[name="collab-room"]')?.content

  if (!roomId) {
    showSetupBanner('Set a value for <code>&lt;meta name="collab-room" content="..."&gt;</code> in this file. Any unique string works — a UUID, your project name, anything.')
    initNav()
    return
  }
  if (roomId === PLACEHOLDER_ROOM) {
    showSetupBanner('Change the <code>collab-room</code> meta tag from the placeholder to your own unique string before sharing. Any text works — a UUID, your deck name, anything. Until then, the deck will not connect to other peers.')
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

  const slidesContainer = document.getElementById('collab-slides')
  if (!slidesContainer) {
    console.warn('collab-slides: missing #collab-slides container')
    initNav()
    return
  }

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
  let nav = initNav()

  ytext.observe(() => {
    const remoteContent = ytext.toString()
    const containerHtml = slidesContainer.innerHTML
    const localContent = extractSlideContent(containerHtml)
    if (localContent !== null && localContent !== remoteContent) {
      const updated = injectSlideContent(containerHtml, '\n' + remoteContent + '\n')
      if (updated === null) return
      slidesContainer.innerHTML = updated
      nav.destroy()
      nav = initNav()
      if (ui) ui.showRemoteChanges()
    }
  })

  ui = initUI({ syncHandle, originalHtml })
})
