import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildSaveableHtml } from '../src/save.js'

describe('buildSaveableHtml', () => {
  it('replaces CRDT state blob in HTML', () => {
    const html = `<html><body>
<!-- SLIDES START -->
<section>slide</section>
<!-- SLIDES END -->
<script type="application/yjs-state" data-state="old-state"></script>
</body></html>`
    const result = buildSaveableHtml(html, '<section>updated</section>', 'new-b64-state')
    assert.ok(result.includes('data-state="new-b64-state"'))
    assert.ok(result.includes('<section>updated</section>'))
    assert.ok(!result.includes('old-state'))
    assert.ok(!result.includes('<section>slide</section>'))
  })

  it('preserves everything outside markers and state tag', () => {
    const html = `<html><head><meta name="collab-room" content="abc"></head><body>
<!-- SLIDES START -->
old
<!-- SLIDES END -->
<script type="application/yjs-state" data-state="old"></script>
<script>/* sync bundle */</script>
</body></html>`
    const result = buildSaveableHtml(html, 'new', 'xyz')
    assert.ok(result.includes('collab-room'))
    assert.ok(result.includes('/* sync bundle */'))
  })
})
