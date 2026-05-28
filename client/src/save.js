import { MARKER_END, injectSlideContent } from './sync-client.js'

const TYPE_ATTR = 'type="application/yjs-state"'

// Find the close `>` of an opening tag, properly skipping `>` inside quoted attribute values.
function findOpenTagClose(html, tagStart) {
  let inQuote = null
  for (let i = tagStart + 1; i < html.length; i++) {
    const c = html[i]
    if (inQuote) {
      if (c === inQuote) inQuote = null
    } else if (c === '"' || c === "'") {
      inQuote = c
    } else if (c === '>') {
      return i
    } else if (c === '<') {
      return -1
    }
  }
  return -1
}

function findYjsStateTag(html) {
  const searchFrom = html.indexOf(MARKER_END)
  if (searchFrom === -1) return null
  let scanFrom = searchFrom
  while (true) {
    const tagStart = html.indexOf('<script', scanFrom)
    if (tagStart === -1) return null
    const tagEnd = findOpenTagClose(html, tagStart)
    if (tagEnd === -1) {
      scanFrom = tagStart + 1
      continue
    }
    const openTag = html.slice(tagStart, tagEnd + 1)
    if (openTag.includes(TYPE_ATTR)) {
      const closeStart = html.indexOf('</script>', tagEnd + 1)
      if (closeStart === -1) return null
      return { tagStart, tagEnd: tagEnd + 1, end: closeStart + '</script>'.length }
    }
    scanFrom = tagEnd + 1
  }
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
