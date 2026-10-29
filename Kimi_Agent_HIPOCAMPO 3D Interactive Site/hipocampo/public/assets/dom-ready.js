(() => {
  const pending = new Set()
  let observer = null

  const stopObserving = () => {
    observer?.disconnect()
    observer = null
  }

  const flush = () => {
    pending.forEach((initialize) => {
      try {
        if (initialize()) pending.delete(initialize)
      } catch (error) {
        pending.delete(initialize)
        window.setTimeout(() => { throw error }, 0)
      }
    })

    if (pending.size === 0) stopObserving()
  }

  window.__hipocampoWhenReady = (initialize) => {
    if (typeof initialize !== 'function') return () => {}
    pending.add(initialize)
    if (!observer) {
      observer = new MutationObserver(flush)
      observer.observe(document.documentElement, { childList: true, subtree: true })
    }
    return () => {
      pending.delete(initialize)
      if (pending.size === 0) stopObserving()
    }
  }

  window.addEventListener('pagehide', () => {
    pending.clear()
    stopObserving()
  }, { once: true })
})()
