import { onBeforeUnmount } from 'vue'

type VisibilityTask = () => void | Promise<void>

type ObserverEntry = {
  task: VisibilityTask
  once: boolean
}

const isClient = typeof window !== 'undefined'
const isIntersectionObserverSupported = isClient && 'IntersectionObserver' in window

/**
 * IntersectionObserver를 가볍게 캡슐화하여 요소가 보일 때 작업을 트리거하기 쉽게 함
 * @param options IntersectionObserver 구성
 */
export const useIntersectionTaskQueue = (options?: IntersectionObserverInit) => {
  let observer: IntersectionObserver | null = null
  const entryTaskMap = new Map<Element, ObserverEntry>()

  const ensureObserver = () => {
    if (!isIntersectionObserverSupported) {
      return null
    }
    if (observer) {
      return observer
    }
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return
        }
        const target = entry.target as Element
        const meta = entryTaskMap.get(target)
        if (!meta) {
          return
        }
        void meta.task()
        if (meta.once !== false) {
          observer?.unobserve(target)
          entryTaskMap.delete(target)
        }
      })
    }, options)
    return observer
  }

  const observe = (el: Element | null, task: VisibilityTask, once = true) => {
    if (!el) {
      return
    }
    const inst = ensureObserver()
    if (!inst) {
      void task()
      return
    }
    entryTaskMap.set(el, { task, once })
    inst.observe(el)
  }

  const unobserve = (el: Element | null) => {
    if (!el) {
      return
    }
    observer?.unobserve(el)
    entryTaskMap.delete(el)
  }

  const disconnect = () => {
    observer?.disconnect()
    observer = null
    entryTaskMap.clear()
  }

  onBeforeUnmount(() => {
    disconnect()
  })

  return {
    observe,
    unobserve,
    disconnect
  }
}
