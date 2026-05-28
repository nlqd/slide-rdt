import { MARKER_END, injectSlideContent } from './sync-client.js'

const TYPE_ATTR = 'type="application/yjs-state"'

function findYjsStateTag(html) {
  // Only scan the region after the slides end marker so user slide content
  // containing the literal type attribute string can't match.
  const searchFrom = html.indexOf(MARKER_END)
  if (searchFrom === -1) return null
  const typeIdx = html.indexOf(TYPE_ATTR, searchFrom)
  if (typeIdx === -1) return null
  const tagStart = html.lastIndexOf('<script', typeIdx)
  if (tagStart === -1 || tagStart < searchFrom) return null
  const tagEnd = html.indexOf('>', typeIdx + TYPE_ATTR.length)
  if (tagEnd === -1) return null
  const openTag = html.slice(tagStart, tagEnd + 1)
  if (!openTag.includes(TYPE_ATTR)) return null
  const closeStart = html.indexOf('</script>', tagEnd + 1)
  if (closeStart === -1) return null
  return { tagStart, tagEnd: tagEnd + 1, end: closeStart + '</script>'.length }
}

export function buildSaveableHtml(html, slideContent, b64State) {
  if (slideContent === null) return null
  const withSlides = injectSlideContent(html, '\n' + slideContent + '\n')
  if (withSlides === null) return null

  const tag = findYjsStateTag(withSlides)
  if (!tag) return null

  const openTag = withSlides.slice(tag.tagStart, tag.tagEnd)
  const dataStateRegex = /data-state="[^"]*"/
  let newOpenTag
  if (dataStateRegex.test(openTag)) {
    newOpenTag = openTag.replace(dataStateRegex, () => `data-state="${b64State}"`)
  } else {
    newOpenTag = openTag.slice(0, -1) + ` data-state="${b64State}">`
  }
  return withSlides.slice(0, tag.tagStart) + newOpenTag + withSlides.slice(tag.tagEnd)
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
