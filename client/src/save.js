import { injectSlideContent } from './sync-client.js'

export function buildSaveableHtml(html, slideContent, b64State) {
  let result = injectSlideContent(html, '\n' + slideContent + '\n')
  result = result.replace(
    /(<script type="application\/yjs-state" data-state=")[^"]*(")/,
    `$1${b64State}$2`
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
  URL.revokeObjectURL(url)
}
