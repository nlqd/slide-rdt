import diff from 'fast-diff'

export function applyExternalEdit(ytext, newContent) {
  const oldContent = ytext.toString()
  if (oldContent === newContent) return false

  const diffs = diff(oldContent, newContent)

  ytext.doc.transact(() => {
    let cursor = 0
    for (const [op, text] of diffs) {
      if (op === diff.EQUAL) {
        cursor += text.length
      } else if (op === diff.INSERT) {
        ytext.insert(cursor, text)
        cursor += text.length
      } else if (op === diff.DELETE) {
        ytext.delete(cursor, text.length)
      }
    }
  })

  return true
}
