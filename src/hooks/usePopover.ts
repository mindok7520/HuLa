import type { Ref } from 'vue'

/**! n-scrollbar 내에서 n-virtual-list와 n-popover를 함께 사용할 때 스크롤 시 기본 스크롤바가 나타나는 문제를 해결하기 위한 임시 방법 */
export const usePopover = (selectKey: Ref<string>, id: string) => {
  /**! popover가 표시될 때 스크롤 동작을 방지하기 위해 임시로 이 방법들을 사용 */
  // 스크롤 기본 동작 방지
  const preventDefault = (e: Event) => e.preventDefault()

  // 스크롤 동작 복원
  const enableScroll = () => {
    const scrollbar = document.querySelector(`#${id}`) as HTMLElement
    if (!scrollbar) return
    scrollbar.style.pointerEvents = ''
    window.removeEventListener('wheel', preventDefault)
  }

  const close = (event: any) => {
    if (!event.target.matches('.n-popover, .n-popover *')) {
      enableScroll()
    }
  }

  const handlePopoverUpdate = (key: string, show?: boolean) => {
    const scrollbar = document.querySelector(`#${id}`) as HTMLElement
    if (!scrollbar) return

    if (selectKey.value === key) {
      if (show) {
        // popover 표시 시 스크롤 방지
        scrollbar.style.pointerEvents = 'none'
        window.addEventListener('wheel', preventDefault, { passive: false })
      } else {
        // popover 닫힐 때 스크롤 복원
        enableScroll()
      }
      return true
    }
  }

  onMounted(() => {
    window.addEventListener('click', close, true)
  })

  onUnmounted(() => {
    window.removeEventListener('click', close, true)
    enableScroll() // 컴포넌트 언마운트 시 스크롤 복원 보장
  })

  return {
    handlePopoverUpdate,
    enableScroll
  }
}
