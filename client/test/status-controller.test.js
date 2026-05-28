import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createStatusController } from '../src/status-controller.js'

function makeElement() {
  return { textContent: '', style: { color: '' } }
}

describe('createStatusController', () => {
  it('setStatus writes text and color when no hold is active', () => {
    const el = makeElement()
    const ctrl = createStatusController(el)
    ctrl.setStatus('hello', '#000')
    assert.equal(el.textContent, 'hello')
    assert.equal(el.style.color, '#000')
  })

  it('setImportant writes text and color', () => {
    const el = makeElement()
    const ctrl = createStatusController(el)
    ctrl.setImportant('urgent', '#f00')
    assert.equal(el.textContent, 'urgent')
    assert.equal(el.style.color, '#f00')
  })

  it('setStatus is suppressed during hold after setImportant', () => {
    const el = makeElement()
    let t = 1000
    const ctrl = createStatusController(el, { now: () => t, holdMs: 5000 })

    ctrl.setImportant('error', '#f00')
    t = 2000
    ctrl.setStatus('synced', '#0f0')
    assert.equal(el.textContent, 'error', 'setStatus should be suppressed inside hold window')
    assert.equal(el.style.color, '#f00')
  })

  it('setStatus works again after hold expires', () => {
    const el = makeElement()
    let t = 1000
    const ctrl = createStatusController(el, { now: () => t, holdMs: 5000 })

    ctrl.setImportant('error', '#f00')
    t = 7000
    ctrl.setStatus('synced', '#0f0')
    assert.equal(el.textContent, 'synced')
    assert.equal(el.style.color, '#0f0')
  })

  it('setImportant overrides another setImportant and extends the hold', () => {
    const el = makeElement()
    let t = 1000
    const ctrl = createStatusController(el, { now: () => t, holdMs: 5000 })

    ctrl.setImportant('error', '#f00')
    t = 3000
    ctrl.setImportant('remote changes received', '#8b6914')
    assert.equal(el.textContent, 'remote changes received')

    t = 7000
    ctrl.setStatus('synced', '#0f0')
    assert.equal(el.textContent, 'remote changes received', 'extended hold should still be active')

    t = 8500
    ctrl.setStatus('synced', '#0f0')
    assert.equal(el.textContent, 'synced', 'extended hold expired by now')
  })

  it('handles consecutive setImportant calls with rolling hold', () => {
    const el = makeElement()
    let t = 1000
    const ctrl = createStatusController(el, { now: () => t, holdMs: 1000 })

    for (let i = 0; i < 5; i++) {
      ctrl.setImportant(`msg ${i}`, '#000')
      t += 500
    }
    assert.equal(el.textContent, 'msg 4')
  })

  it('releases hold at exactly the importantUntil boundary (strict less-than)', () => {
    const el = makeElement()
    let t = 1000
    const ctrl = createStatusController(el, { now: () => t, holdMs: 5000 })
    ctrl.setImportant('held', '#f00')

    t = 6000  // exactly importantUntil
    ctrl.setStatus('after', '#0f0')
    assert.equal(el.textContent, 'after', 'at boundary, hold has just released')
  })

  it('throws when element is null', () => {
    assert.throws(() => createStatusController(null), /element is required/)
  })
})
