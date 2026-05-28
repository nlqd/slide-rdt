export function initNav() {
  const slides = () => document.querySelectorAll('.slide')
  let current = 0

  function goTo(index) {
    const all = slides()
    if (index < 0 || index >= all.length) return
    current = index
    all[current].scrollIntoView({ behavior: 'smooth' })
    updateCounter(current, all.length)
  }

  function updateCounter(idx, total) {
    const el = document.getElementById('collab-counter')
    if (el) el.textContent = `${idx + 1} / ${total}`
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const all = Array.from(slides())
        current = all.indexOf(entry.target)
        updateCounter(current, all.length)
      }
    }
  }, { threshold: 0.6 })

  for (const slide of slides()) observer.observe(slide)

  function onKeydown(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault()
      goTo(current + 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      goTo(current - 1)
    }
  }

  document.addEventListener('keydown', onKeydown)
  updateCounter(0, slides().length)

  return {
    goTo,
    destroy: () => {
      observer.disconnect()
      document.removeEventListener('keydown', onKeydown)
    },
  }
}
