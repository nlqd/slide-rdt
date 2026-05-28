import { injectSlideContent } from './sync-client.js'

const STATE_TAG_REGEX = /<script\b[^>]*\btype="application\/yjs-state"[^>]*>[\s\S]*?<\/script>/i
const DATA_STATE_ATTR_REGEX = /data-state="[^"]*"/

export function buildSaveableHtml(html, slideContent, b64State) {
  if (slideContent === null) return null
  const withSlides = injectSlideContent(html, '\n' + slideContent + '\n')
  if (withSlides === null) return null

  const tagMatch = withSlides.match(STATE_TAG_REGEX)
  if (!tagMatch) return null

  const oldTag = tagMatch[0]
  let newTag
  if (DATA_STATE_ATTR_REGEX.test(oldTag)) {
    newTag = oldTag.replace(DATA_STATE_ATTR_REGEX, () => `data-state="${b64State}"`)
  } else {
    newTag = oldTag.replace(/<script\b([^>]*)>/, (_, attrs) => `<script${attrs} data-state="${b64State}">`)
  }
  return withSlides.replace(oldTag, () => newTag)
}

export function triggerDownload(html, filename = 'deck.html') {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
