import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import {
  extractSlideContent,
  injectSlideContent,
  hydrateDoc,
  serializeState,
} from '../src/sync-client.js'

describe('extractSlideContent', () => {
  it('extracts content between markers', () => {
    const html = `<body>
<!-- SLIDES START -->
<section class="slide">Hello</section>
<!-- SLIDES END -->
<script>sync code</script></body>`
    const content = extractSlideContent(html)
    assert.equal(content.trim(), '<section class="slide">Hello</section>')
  })

  it('returns null if markers missing', () => {
    assert.equal(extractSlideContent('<body>no markers</body>'), null)
  })
})

describe('injectSlideContent', () => {
  it('replaces content between markers', () => {
    const html = `before\n<!-- SLIDES START -->\nold\n<!-- SLIDES END -->\nafter`
    const result = injectSlideContent(html, 'new')
    assert.ok(result.includes('new'))
    assert.ok(!result.includes('old'))
    assert.ok(result.includes('before'))
    assert.ok(result.includes('after'))
  })
})

describe('hydrateDoc / serializeState round-trip', () => {
  it('serializes and hydrates Y.Doc state', () => {
    const doc = new Y.Doc()
    doc.getText('content').insert(0, 'test content')
    const b64 = serializeState(doc)

    const doc2 = new Y.Doc()
    hydrateDoc(doc2, b64)
    assert.equal(doc2.getText('content').toString(), 'test content')
  })

  it('handles null/empty state gracefully', () => {
    const doc = new Y.Doc()
    hydrateDoc(doc, null)
    hydrateDoc(doc, '')
    assert.equal(doc.getText('content').toString(), '')
  })
})
