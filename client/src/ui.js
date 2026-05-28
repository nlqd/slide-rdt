import { buildSaveableHtml, triggerDownload } from './save.js'
import { extractSlideContent } from './sync-client.js'

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

  let importantUntil = 0
  const HOLD_MS = 5000

  function setStatus(text, color) {
    if (Date.now() < importantUntil) return
    status.textContent = text
    status.style.color = color
  }

  function setImportant(text, color) {
    importantUntil = Date.now() + HOLD_MS
    status.textContent = text
    status.style.color = color
  }

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

  for (const provider of syncHandle.providers) {
    if (provider.on) {
      provider.on('status', ({ status: s }) => {
        if (s === 'connected') setStatus('synced', '#4a7c59')
      })
    }
    if (provider.once) {
      provider.once('synced', () => setStatus('synced', '#4a7c59'))
    }
  }

  function showRemoteChanges() {
    setImportant('remote changes received', '#8b6914')
  }

  return { showRemoteChanges }
}
