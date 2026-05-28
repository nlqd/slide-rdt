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

  const { setStatus, setImportant, forceStatus } = createStatusController(status)

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

  // Track per-provider state so a transient disconnect on one transport
  // doesn't override another that is still live. The aggregate is:
  // "synced" if any provider is connected, "disconnected" if all are down,
  // unchanged while still connecting.
  const providerStates = new Map()
  function updateAggregateStatus() {
    const states = Array.from(providerStates.values())
    if (states.length === 0) return
    if (states.some(s => s === 'connected')) {
      setStatus('synced', '#4a7c59')
    } else if (states.every(s => s === 'disconnected')) {
      forceStatus('disconnected', '#a0522d')
    }
  }

  // y-websocket emits status as { status: 'connected' | 'disconnected' } and
  // synced with no payload. y-webrtc emits status as { connected: boolean }
  // and synced as { synced: boolean }. Handle both shapes.
  for (const provider of syncHandle.providers) {
    if (!provider.on) continue
    providerStates.set(provider, 'connecting')
    provider.on('status', (event) => {
      const connected = event?.status === 'connected' || event?.connected === true
      const disconnected = event?.status === 'disconnected' || event?.connected === false
      if (connected) providerStates.set(provider, 'connected')
      else if (disconnected) providerStates.set(provider, 'disconnected')
      updateAggregateStatus()
    })
    provider.on('synced', (event) => {
      const isSynced = event === undefined || event === true || event?.synced === true
      providerStates.set(provider, isSynced ? 'connected' : 'disconnected')
      updateAggregateStatus()
    })
  }

  function showRemoteChanges() {
    setImportant('remote changes received', '#8b6914')
  }

  return { showRemoteChanges }
}
