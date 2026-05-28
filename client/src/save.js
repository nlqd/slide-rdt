import { injectSlideContent } from './sync-client.js'

export function buildSaveableHtml(html, slideContent, b64State) {
  if (slideContent === null) return null
  let result = injectSlideContent(html, '\n' + slideContent + '\n')
  result = result.replace(
    /(type="application\/yjs-state" data-state=")[^"]*(")/,
    (_, prefix, suffix) => `${prefix}${b64State}${suffix}`
  )
  return result
}

export function triggerDownload(html, filename = 'deck.html') {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
