import { buildSaveableHtml, triggerDownload } from './save.js'
import { extractSlideContent } from './sync-client.js'
import { createStatusController } from './status-controller.js'

export function initUI({ syncHandle, originalHtml }) {
  const banner = document.createElement('div')
  banner.id = 'sync-banner'
  banner.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 9999;
    display: flex; gap: 8px; align-items: center;
    font-family: system-ui; font-size: 14px;
  `
  document.body.appendChild(banner)

  const status = document.createElement('span')
  status.id = 'sync-status'
  status.textContent = 'connecting...'
  banner.appendChild(status)

  const { setStatus, setImportant } = createStatusController(status)

  const saveBtn = document.createElement('button')
  saveBtn.textContent = 'Save'
  saveBtn.style.cssText = `
    padding: 6px 16px; border: 1px solid #888; border-radius: 4px;
    background: #f5f0e8; cursor: pointer; font-size: 14px;
  `
  saveBtn.addEventListener('click', () => {
    const html = document.documentElement.outerHTML
    const slideContent = extractSlideContent(html)
    if (slideContent === null) {
      setImportant('save failed: slide markers missing', '#a0522d')
      return
    }
    const state = syncHandle.getSerializedState()
    const result = buildSaveableHtml(originalHtml, slideContent, state)
    if (result === null) {
      setImportant('save failed: cannot rebuild HTML', '#a0522d')
      return
    }
    triggerDownload(result)
  })
  banner.appendChild(saveBtn)

  // y-websocket emits status as { status: 'connected' | 'disconnected' } and
  // synced with no payload. y-webrtc emits status as { connected: boolean }
  // and synced as { synced: boolean }. Handle both shapes.
  for (const provider of syncHandle.providers) {
    if (!provider.on) continue
    provider.on('status', (event) => {
      const connected = event?.status === 'connected' || event?.connected === true
      const disconnected = event?.status === 'disconnected' || event?.connected === false
      if (connected) setStatus('synced', '#4a7c59')
      else if (disconnected) setStatus('disconnected', '#a0522d')
    })
    provider.on('synced', (event) => {
      const isSynced = event === undefined || event === true || event?.synced === true
      if (isSynced) setStatus('synced', '#4a7c59')
    })
  }

  function showRemoteChanges() {
    setImportant('remote changes received', '#8b6914')
  }

  return { showRemoteChanges }
}
