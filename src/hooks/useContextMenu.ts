import type { Ref } from 'vue'

/**
 * 우클릭 메뉴의 상태 관리
 * @param ContextMenuRef 우클릭 메뉴 컨테이너
 * @param isNull 전달된 컨테이너가 비어 있는지 여부
 */

export const useContextMenu = (ContextMenuRef: Ref, isNull?: Ref<boolean>) => {
  const showMenu = ref(false)
  const x = ref(0)
  const y = ref(0)

  // 스크롤의 기본 동작 방지
  const preventDefault = (e: Event) => e.preventDefault()

  // 텍스트 선택 기본 동작 방지
  const preventTextSelection = (e: Event) => e.preventDefault()

  // 텍스트 선택 비활성화
  const disableTextSelection = () => {
    // 현재 선택 지우기
    window.getSelection()?.removeAllRanges()
    // 선택 방지 이벤트 추가
    document.body.classList.add('no-select')
    window.addEventListener('selectstart', preventTextSelection)
  }

  // 텍스트 선택 활성화
  const enableTextSelection = () => {
    document.body.classList.remove('no-select')
    window.removeEventListener('selectstart', preventTextSelection)
  }

  /**! n-virtual-list 사용 시 우클릭 메뉴가 나타나도 스크롤이 가능한 문제 해결 */
  const handleVirtualListScroll = (isBan: boolean) => {
    const scrollbar_main = document.querySelector('#image-chat-main') as HTMLElement
    const scrollbar_sidebar = document.querySelector('#image-chat-sidebar') as HTMLElement

    scrollbar_main && (scrollbar_main.style.pointerEvents = isBan ? 'none' : '')
    scrollbar_sidebar && (scrollbar_sidebar.style.pointerEvents = isBan ? 'none' : '')
  }

  const isSelectionInsideContext = () => {
    const selection = window.getSelection()
    if (!selection?.anchorNode || !selection?.focusNode) return false

    const contextEl = ContextMenuRef.value as HTMLElement | null
    if (!contextEl) return false

    const resolveElement = (node: Node | null) => {
      if (!node) return null
      return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
    }

    const anchorElement = resolveElement(selection.anchorNode)
    const focusElement = resolveElement(selection.focusNode)
    if (!anchorElement || !focusElement) return false

    return contextEl.contains(anchorElement) && contextEl.contains(focusElement)
  }

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isNull?.value) return

    // 현재 우클릭 대상이 기존 텍스트 선택을 포함하는 경우 사용자의 선택을 유지하여 복사/번역에 영향을 주지 않도록 함
    if (!isSelectionInsideContext()) {
      // 메뉴를 표시하기 전에 선택 항목 지우기
      disableTextSelection()
    }

    handleVirtualListScroll(true)
    showMenu.value = true
    x.value = e.clientX
    y.value = e.clientY
    window.addEventListener('wheel', preventDefault, { passive: false }) // 마우스 휠을 사용한 페이지 스크롤 금지
  }

  const closeMenu = (event: any) => {
    /** 클릭한 요소가 .context-menu 클래스가 아닌 경우에만 메뉴 닫기 */
    if (!event.target.matches('.context-menu, .context-menu *')) {
      handleVirtualListScroll(false)
      showMenu.value = false
      enableTextSelection() // 텍스트 선택 기능 복원
    }
    window.removeEventListener('wheel', preventDefault) // 휠 스크롤 금지 해제
  }

  // showMenu 상태 변경 감지
  watch(
    () => showMenu.value,
    (newValue) => {
      if (!newValue) {
        // 메뉴가 닫힐 때 텍스트 선택 기능 복원
        enableTextSelection()
      }
    }
  )

  onMounted(() => {
    // 전역 스타일 추가
    if (!document.querySelector('#no-select-style')) {
      const style = document.createElement('style')
      style.id = 'no-select-style'
      style.textContent = `.no-select {
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
      }`
      document.head.appendChild(style)
    }

    const div = ContextMenuRef.value
    // 여기서는 div의 우클릭만 감지합니다. 다른 요소의 우클릭을 감지해야 하는 경우 다른 요소에서 감지해야 합니다.
    div.addEventListener('contextmenu', handleContextMenu)
    // window의 우클릭을 감지해야 합니다. 그렇지 않으면 우클릭이 div의 우클릭 이벤트를 트리거하여 메뉴가 닫히지 않고 기본 우클릭 메뉴가 차단됩니다.
    window.addEventListener(
      'contextmenu',
      (e) => {
        e.preventDefault()
        e.stopPropagation()
      },
      false
    )
    window.addEventListener('click', closeMenu, true)
    window.addEventListener('contextmenu', closeMenu, true)
  })

  onUnmounted(() => {
    const div = ContextMenuRef.value
    div?.removeEventListener('contextmenu', handleContextMenu)
    window.removeEventListener('contextmenu', preventDefault)
    window.removeEventListener('wheel', preventDefault)
    window.removeEventListener('selectstart', preventTextSelection)
    window.removeEventListener('click', closeMenu, true)
    window.removeEventListener('contextmenu', closeMenu, true)

    // 선택 기능 복원 확인
    enableTextSelection()

    // 스타일 제거
    const style = document.querySelector('#no-select-style')
    if (style) style.remove()
  })

  return {
    showMenu,
    x,
    y
  }
}
