import type { Ref } from 'vue'

/**! 이것은 임시적으로 n-scrollbar 내에서 n-virtual-list와 n-popover를 함께 사용할 때 기본 스크롤바가 나타나는 문제를 해결하기 위한 방법임 */
export const usePopover = (selectKey: Ref<string>, id: string) => {
  /**! 당분간 이 방법들을 사용하여 popover 표시 시 스크롤 동작을 차단함 */
  // 스크롤 기본 동작 차단
  const preventDefault = (e: Event) => e.preventDefault()

  // 스크롤 동작 활성화
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
        // popover 표시 시 스크롤 비활성화
        scrollbar.style.pointerEvents = 'none'
        window.addEventListener('wheel', preventDefault, { passive: false })
      } else {
        // popover 닫을 때 스크롤 복원
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
    enableScroll() // 컴포넌트 마운트 해제 시 스크롤 복원 보장
  })

  return {
    handlePopoverUpdate,
    enableScroll
  }
}
