export const HOLD_MS = 5000

export function createStatusController(element, { now = () => Date.now(), holdMs = HOLD_MS } = {}) {
  if (!element) throw new Error('createStatusController: element is required')
  let importantUntil = 0

  return {
    setStatus(text, color) {
      if (now() < importantUntil) return
      element.textContent = text
      element.style.color = color
    },
    setImportant(text, color) {
      importantUntil = now() + holdMs
      element.textContent = text
      element.style.color = color
    },
  }
}
