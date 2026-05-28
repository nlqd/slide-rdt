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

  it('handles data-state before type attribute order', () => {
    const html = `<!-- SLIDES START -->\nold\n<!-- SLIDES END -->\n<script data-state="old" type="application/yjs-state"></script>`
    const result = buildSaveableHtml(html, 'new', 'xyz')
    assert.ok(result !== null, 'should not be null')
    assert.ok(result.includes('data-state="xyz"'))
    assert.ok(!result.includes('data-state="old"'))
  })

  it('returns null when slideContent is null', () => {
    const html = `<!-- SLIDES START -->\n<!-- SLIDES END -->\n<script type="application/yjs-state" data-state=""></script>`
    assert.equal(buildSaveableHtml(html, null, 'xyz'), null)
  })

  it('returns null when markers are missing', () => {
    const html = `<script type="application/yjs-state" data-state=""></script>`
    assert.equal(buildSaveableHtml(html, 'new', 'xyz'), null)
  })

  it('returns null when yjs-state script tag is missing', () => {
    const html = `<!-- SLIDES START -->\n<!-- SLIDES END -->\n<script>regular script</script>`
    assert.equal(buildSaveableHtml(html, 'new', 'xyz'), null)
  })

  it('replaces only the yjs-state tag, not other data-state attributes', () => {
    const html = `<!-- SLIDES START -->\n<section data-state="active">slide</section>\n<!-- SLIDES END -->\n<script type="application/yjs-state" data-state="old"></script>`
    const result = buildSaveableHtml(html, '<section data-state="active">slide</section>', 'xyz')
    assert.ok(result !== null)
    assert.ok(result.includes('data-state="active"'), 'preserves slide content data-state')
    assert.ok(result.includes('data-state="xyz"'), 'updates yjs-state data-state')
  })

  it('inserts data-state attribute when it is absent', () => {
    const html = `<!-- SLIDES START -->\n<!-- SLIDES END -->\n<script type="application/yjs-state"></script>`
    const result = buildSaveableHtml(html, '', 'newstate')
    assert.ok(result !== null)
    assert.ok(result.includes('data-state="newstate"'))
  })

  it('handles base64 state with + / = characters safely', () => {
    const html = `<!-- SLIDES START -->\n<!-- SLIDES END -->\n<script type="application/yjs-state" data-state=""></script>`
    const tricky = 'a+b/c==d'
    const result = buildSaveableHtml(html, '', tricky)
    assert.ok(result !== null)
    assert.ok(result.includes(`data-state="${tricky}"`))
  })

  it('returns null when type attribute string appears only in slide content (no real tag)', () => {
    const slideHtml = `<code>type="application/yjs-state"</code>`
    const html = `<!-- SLIDES START -->\n${slideHtml}\n<!-- SLIDES END -->\n<script>regular</script>`
    assert.equal(buildSaveableHtml(html, slideHtml, 'xyz'), null)
  })

  it('finds the real state tag even when type attr string appears in slide content', () => {
    const slideHtml = `<code>type="application/yjs-state"</code>`
    const html = `<!-- SLIDES START -->\n${slideHtml}\n<!-- SLIDES END -->\n<script type="application/yjs-state" data-state="old"></script>`
    const result = buildSaveableHtml(html, slideHtml, 'newstate')
    assert.ok(result !== null)
    assert.ok(result.includes('data-state="newstate"'))
    assert.ok(result.includes(`<code>type="application/yjs-state"</code>`), 'preserves slide content')
  })

  it('returns null when TYPE_ATTR appears only in a script body after the slides marker', () => {
    const bundleScript = `<script>const sel = 'script[type="application/yjs-state"]';</script>`
    const html = `<!-- SLIDES START -->\n<!-- SLIDES END -->\n${bundleScript}`
    assert.equal(buildSaveableHtml(html, '', 'xyz'), null)
  })

  it('finds the real state tag when a later script body also contains TYPE_ATTR string', () => {
    const bundleScript = `<script>const sel = 'script[type="application/yjs-state"]';</script>`
    const html = `<!-- SLIDES START -->\n<!-- SLIDES END -->\n<script type="application/yjs-state" data-state="old"></script>\n${bundleScript}`
    const result = buildSaveableHtml(html, '', 'newstate')
    assert.ok(result !== null)
    assert.ok(result.includes('data-state="newstate"'))
    assert.ok(result.includes(bundleScript), 'preserves bundle script')
  })
})
