import { invoke } from '@tauri-apps/api/core'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { UserAttentionType, primaryMonitor, type Monitor } from '@tauri-apps/api/window'
import { info } from '@tauri-apps/plugin-log'
import { assign } from 'es-toolkit/compat'
import { CallTypeEnum, EventEnum, RoomTypeEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global'
import { isCompatibility, isDesktop, isMac, isWindows, isWindows10 } from '@/utils/PlatformConstants'

/** 호환 가능한 시스템인지 판단 */
const isCompatibilityMode = computed(() => isCompatibility())
const WINDOW_SAFE_PADDING = 32
const MIN_LOGICAL_WIDTH = 320
const MIN_LOGICAL_HEIGHT = 200

const clampSizeToMonitor = (width: number, height: number, monitor?: Monitor | null) => {
  if (!monitor) {
    return { width, height }
  }

  const scaleFactor = monitor.scaleFactor ?? 1
  const maxLogicalWidth = Math.max(MIN_LOGICAL_WIDTH, monitor.size.width / scaleFactor - WINDOW_SAFE_PADDING)
  const maxLogicalHeight = Math.max(MIN_LOGICAL_HEIGHT, monitor.size.height / scaleFactor - WINDOW_SAFE_PADDING)

  return {
    width: Math.min(width, Math.floor(maxLogicalWidth)),
    height: Math.min(height, Math.floor(maxLogicalHeight))
  }
}

// Mac에서 상위 창의 비활성 상태를 시뮬레이션하기 위한 투명 오버레이
const MAC_MODAL_OVERLAY_ID = 'mac-modal-overlay'
// 현재 모달 창을 연 레이블을 기록하여 마지막 창이 닫힐 때 오버레이를 제거하기 위함
const activeMacModalLabels = new Set<string>()

// 오버레이 DOM 생성 또는 재사용
const ensureMacOverlayElement = () => {
  if (typeof document === 'undefined') return
  if (document.getElementById(MAC_MODAL_OVERLAY_ID)) return
  const overlay = document.createElement('div')
  overlay.id = MAC_MODAL_OVERLAY_ID
  assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '9999',
    backgroundColor: 'transparent',
    pointerEvents: 'auto',
    width: '100vw',
    height: '100vh',
    userSelect: 'none',
    cursor: 'not-allowed'
  })
  const mountPoint = document.body ?? document.documentElement
  mountPoint?.appendChild(overlay)
}

// 오버레이 제거
const removeMacOverlayElement = () => {
  if (typeof document === 'undefined') return
  document.getElementById(MAC_MODAL_OVERLAY_ID)?.remove()
}

// 현재 창 기록 및 오버레이 표시
const attachMacModalOverlay = (label: string) => {
  if (!isMac()) return
  activeMacModalLabels.add(label)
  ensureMacOverlayElement()
}

// 현재 창의 오버레이 기록 해제, 다른 창이 없으면 오버레이 제거
const detachMacModalOverlay = (label: string) => {
  if (!isMac()) return
  activeMacModalLabels.delete(label)
  if (activeMacModalLabels.size === 0) {
    removeMacOverlayElement()
  }
}

export const useWindow = () => {
  const globalStore = useGlobalStore()
  /**
   * 창 생성
   * @param title 창 제목
   * @param label 창 레이블
   * @param width 창 너비
   * @param height 창 높이
   * @param wantCloseWindow 생성 후 닫을 창
   * @param resizable 창 크기 조절 가능 여부
   * @param minW 창 최소 너비
   * @param minH 창 최소 높이
   * @param transparent 투명 여부
   * @param visible 표시 여부
   * @param queryParams URL 쿼리 매개변수
   * */
  const createWebviewWindow = async (
    title: string,
    label: string,
    width: number,
    height: number,
    wantCloseWindow?: string,
    resizable = false,
    minW = 330,
    minH = 495,
    transparent?: boolean,
    visible = false,
    queryParams?: Record<string, string | number | boolean>
  ) => {
    // 모바일은 창 관리를 지원하지 않으므로 빈 객체 반환
    if (!isDesktop()) {
      return null
    }
    const originalLabel = label
    const isMultiMsgWindow = originalLabel.includes(EventEnum.MULTI_MSG)

    const checkLabel = () => {
      /** 독립 창을 여는 경우 레이블에서 고정 레이블 이름을 잘라냄 */
      if (label.includes(EventEnum.ALONE)) {
        return label.replace(/\d/g, '')
      } else {
        return label
      }
    }

    // multiMsg 유형의 창의 경우, 창 식별을 위해 원래 레이블을 유지하지만 URL 라우팅은 /multiMsg를 가리킴
    label = isMultiMsgWindow ? originalLabel : checkLabel()

    // 쿼리 매개변수를 포함한 URL 구성
    let url = isMultiMsgWindow ? `/${EventEnum.MULTI_MSG}` : `/${label.split('--')[0]}`

    if (queryParams && Object.keys(queryParams).length > 0) {
      const searchParams = new URLSearchParams()
      Object.entries(queryParams).forEach(([key, value]) => {
        searchParams.append(key, String(value))
      })
      url += `?${searchParams.toString()}`
    }

    const monitor = await primaryMonitor()
    const clampedSize = clampSizeToMonitor(width, height, monitor)
    const clampedMinWidth = Math.min(minW, clampedSize.width)
    const clampedMinHeight = Math.min(minH, clampedSize.height)

    const webview = new WebviewWindow(label, {
      title: title,
      url: url,
      fullscreen: false,
      resizable: resizable,
      center: true,
      width: clampedSize.width,
      height: clampedSize.height,
      minHeight: clampedMinHeight,
      minWidth: clampedMinWidth,
      skipTaskbar: false,
      decorations: !isCompatibilityMode.value,
      transparent: transparent || isCompatibilityMode.value,
      titleBarStyle: 'overlay', // mac 오버레이 제목 표시줄
      hiddenTitle: true, // mac 제목 표시줄 숨김
      visible: visible,
      ...(isWindows10() ? { shadow: false } : {})
    })

    await webview.once('tauri://created', async () => {
      if (wantCloseWindow) {
        const win = await WebviewWindow.getByLabel(wantCloseWindow)
        win?.close()
      }
    })

    await webview.once('tauri://error', async () => {
      info('창 생성 실패')
      // TODO 여기서 오류 처리를 사용하여 창이 이미 생성되었는지 확인, 처음에 WebviewWindow.getByLabel을 사용하여 조회하면 새로 고침 시 문제가 발생할 수 있음 (nyh -> 2024-03-06 23:54:17)
      await checkWinExist(label)
    })

    return webview
  }

  /**
   * 지정된 레이블의 창으로 페이로드(payload) 전송, 창 간 통신에 사용.
   *
   * @param windowLabel - 페이로드를 보낼 창 레이블, 보통 창 생성 시 지정된 label.
   * @param payload - 보낼 JSON 데이터 객체, 필드 내용 제한 없음.
   * @returns Rust 백엔드 명령 완료를 나타내는 Promise 반환.
   */
  const sendWindowPayload = async (windowLabel: string, payload: any) => {
    // 모바일은 창 관리 지원 안 함
    if (!isDesktop()) {
      return Promise.resolve()
    }
    console.log('새 창의 페이로드:', payload)
    return invoke<void>('push_window_payload', {
      label: windowLabel,
      // 이 payload는 json이면 전송 가능, 필드 제한 없음
      payload
    })
  }

  /**
   * 지정된 창의 현재 페이로드(payload) 가져오기, 창 초기화 시 전달된 데이터 가져오는 데 사용.
   *
   * @param windowLabel - 페이로드를 가져올 창 레이블.
   * @returns 제네릭 T로 확인되는 Promise 반환, 창에 저장된 payload 데이터.
   * 제네릭을 통해 반환 구조 유형 지정 가능.
   *
   * @example
   * interface MyPayload {
   *   userId: string;
   *   token: string;
   * }
   *
   * const payload = await getWindowPayload<MyPayload>('my-window')
   */
  const getWindowPayload = async <T>(windowLabel: string, once: boolean = true) => {
    // 모바일은 창 관리 지원 안 함
    if (!isDesktop()) {
      return Promise.resolve({} as T)
    }
    return await invoke<T>('get_window_payload', { label: windowLabel, once })
  }

  /**
   * 지정된 창의 페이로드 업데이트 이벤트 리스너 등록. 해당 창의 payload가 업데이트될 때 콜백 트리거.
   *
   * @param this - 선택적 바인딩 컨텍스트 객체, 내부적으로 `Function.prototype.call` 사용.
   * @param windowLabel - 창 레이블, `${label}:update` 이벤트 이름 구성에 사용.
   * @param callback - payload 업데이트 시 호출할 함수, 콜백 매개변수는 `TauriEvent<T>`.
   * @returns `UnlistenFn`(함수)으로 확인되는 Promise 반환, 호출 시 리스너 등록 취소.
   *
   * @example
   * const unlisten = await getWindowPayloadListener<MyPayload>('my-window', (event) => {
   *   console.log('페이로드 업데이트 수신:', event.payload)
   * })
   *
   * // 필요 시 수동으로 리스너 취소
   * unlisten()
   */
  // async function getWindowPayloadListener<T>(this: any, windowLabel: string, callback: (event: any) => void) {
  //   const listenLabel = `${windowLabel}:update`

  //   return addListener(
  //     listen<T>(listenLabel, (event) => {
  //       callback.call(this, event)
  //     })
  //   )
  // }

  /**
   * 모달 자식 창 생성
   * @param title 창 제목
   * @param label 창 식별자
   * @param width 창 너비
   * @param height 창 높이
   * @param parent 부모 창
   * @param payload 자식 창에 전달할 데이터
   * @returns 생성된 창 인스턴스 또는 기존 창 인스턴스
   */
  const createModalWindow = async (
    title: string,
    label: string,
    width: number,
    height: number,
    parent: string,
    payload?: Record<string, any>,
    options?: {
      minWidth?: number
      minHeight?: number
    }
  ) => {
    // 모바일은 창 관리 지원 안 함
    if (!isDesktop()) {
      return null
    }
    // 창이 이미 존재하는지 확인
    const existingWindow = await WebviewWindow.getByLabel(label)
    const parentWindow = parent ? await WebviewWindow.getByLabel(parent) : null

    if (existingWindow) {
      if (isMac()) {
        attachMacModalOverlay(label)
      }
      // 창이 이미 존재하면 기존 창에 포커스를 맞추고 깜박임 효과
      existingWindow.requestUserAttention(UserAttentionType.Critical)
      return existingWindow
    }

    // 새 창 생성
    const monitor = await primaryMonitor()
    const clampedSize = clampSizeToMonitor(width, height, monitor)
    const clampedMinWidth = Math.min(options?.minWidth ?? 500, clampedSize.width)
    const clampedMinHeight = Math.min(options?.minHeight ?? 500, clampedSize.height)

    const modalWindow = new WebviewWindow(label, {
      url: `/${label}`,
      title: title,
      width: clampedSize.width,
      height: clampedSize.height,
      resizable: false,
      center: true,
      minWidth: clampedMinWidth,
      minHeight: clampedMinHeight,
      focus: true,
      minimizable: false,
      parent: parentWindow ? parentWindow : parent,
      decorations: !isCompatibilityMode.value,
      transparent: isCompatibilityMode.value,
      titleBarStyle: 'overlay', // mac 오버레이 제목 표시줄
      hiddenTitle: true, // mac 제목 표시줄 숨김
      visible: false,
      ...(isWindows10() ? { shadow: false } : {})
    })

    // 창 생성 완료 이벤트 수신
    modalWindow.once('tauri://created', async () => {
      if (isWindows()) {
        // 부모 창 비활성화, 모달 창 효과 시뮬레이션
        await parentWindow?.setEnabled(false)
      }

      // payload가 있으면 자식 창으로 전송
      if (payload) {
        await sendWindowPayload(label, payload)
      }

      // 창을 포커스로 설정
      await modalWindow.setFocus()

      if (isMac()) {
        try {
          await invoke('set_window_movable', {
            windowLabel: label,
            movable: false
          })
        } catch (error) {
          console.error('자식 창 이동 불가 설정 실패:', error)
        }
        attachMacModalOverlay(label)
      }
    })

    // 오류 이벤트 수신
    modalWindow.once('tauri://error', async (e) => {
      console.error(`${title} 창 생성 실패:`, e)
      window.$message?.error(`${title} 창 생성 실패`)
      await parentWindow?.setEnabled(true)
    })

    void modalWindow.once('tauri://destroyed', async () => {
      if (isMac()) {
        detachMacModalOverlay(label)
      }
      if (isWindows()) {
        try {
          await parentWindow?.setEnabled(true)
        } catch (error) {
          console.error('부모 창 다시 활성화 실패:', error)
        }
      }
    })

    return modalWindow
  }

  /**
   * 창 크기 조정
   * @param label 창 이름
   * @param width 창 너비
   * @param height 창 높이
   * */
  const resizeWindow = async (label: string, width: number, height: number) => {
    // 모바일은 창 관리 지원 안 함
    if (!isDesktop()) {
      return Promise.resolve()
    }
    const webview = await WebviewWindow.getByLabel(label)
    const monitor = await primaryMonitor()
    const clampedSize = clampSizeToMonitor(width, height, monitor)
    // 새로운 크기 객체 생성
    const newSize = new LogicalSize(clampedSize.width, clampedSize.height)
    // 창의 setSize 메서드를 호출하여 크기 조정
    await webview?.setSize(newSize).catch((error) => {
      console.error('창 크기 조정 실패:', error)
    })
  }

  /**
   * 창 존재 여부 확인
   * @param L 창 레이블
   */
  const checkWinExist = async (L: string) => {
    // 모바일은 창 관리 지원 안 함
    if (!isDesktop()) {
      return Promise.resolve()
    }
    const isExistsWinds = await WebviewWindow.getByLabel(L)
    if (isExistsWinds) {
      nextTick().then(async () => {
        // 창이 이미 존재하면 먼저 최소화되었는지 확인
        const minimized = await isExistsWinds.isMinimized()
        // 숨겨져 있는지 확인
        const hidden = await isExistsWinds.isVisible()
        if (!hidden) {
          await isExistsWinds.show()
        }
        if (minimized) {
          // 최소화된 경우 창 복원
          await isExistsWinds.unminimize()
        }
        // 창이 이미 존재하면 포커스를 주어 맨 앞에 표시
        await isExistsWinds.setFocus()
      })
    }
  }

  /**
   * 창 크기 조정 가능 여부 설정
   * @param label 창 이름
   * @param resizable 크기 조정 가능 여부
   */
  const setResizable = async (label: string, resizable: boolean) => {
    // 모바일은 창 관리 지원 안 함
    if (!isDesktop()) {
      return Promise.resolve()
    }
    const webview = await WebviewWindow.getByLabel(label)
    if (webview) {
      await webview.setResizable(resizable).catch((error) => {
        console.error('창 크기 조정 가능 설정 실패:', error)
      })
    }
  }

  const startRtcCall = async (callType: CallTypeEnum) => {
    try {
      const currentSession = globalStore.currentSession
      if (!currentSession) {
        window.$message?.warning?.('현재 세션이 준비되지 않았습니다')
        return
      }
      // 그룹 채팅인지 확인, 그룹 채팅이면 건너뜀
      if (currentSession.type === RoomTypeEnum.GROUP) {
        window.$message.warning('그룹 채팅은 음성/영상 통화를 지원하지 않습니다')
        return
      }

      // 현재 방 친구의 ID 가져오기 (1:1 채팅 시 detailId를 remoteUid로 사용)
      const remoteUid = currentSession.detailId
      if (!remoteUid) {
        window.$message.error('상대방 사용자 정보를 가져올 수 없습니다')
        return
      }
      await createRtcCallWindow(false, remoteUid, globalStore.currentSessionRoomId, callType)
    } catch (error) {
      console.error('영상 통화 창 생성 실패:', error)
    }
  }

  const createRtcCallWindow = async (
    isIncoming: boolean,
    remoteUserId: string,
    roomId: string,
    callType: CallTypeEnum
  ) => {
    // 수신 여부에 따라 창 크기 결정
    const windowConfig = isIncoming
      ? { width: 360, height: 90, minWidth: 360, minHeight: 90 } // 수신 알림 크기
      : callType === CallTypeEnum.VIDEO
        ? { width: 850, height: 580, minWidth: 850, minHeight: 580 } // 영상 통화 크기
        : { width: 500, height: 650, minWidth: 500, minHeight: 650 } // 음성 통화 크기

    const type = callType === CallTypeEnum.VIDEO ? '영상 통화' : '음성 통화'
    await createWebviewWindow(
      type, // 창 제목
      'rtcCall', // 창 레이블
      windowConfig.width, // 너비
      windowConfig.height, // 높이
      undefined, // 다른 창 닫을 필요 없음
      true, // 크기 조정 가능
      windowConfig.minWidth, // 최소 너비
      windowConfig.minHeight, // 최소 높이
      false, // 불투명
      false, // 창 표시 (초기에는 숨김)
      {
        remoteUserId,
        roomId: roomId,
        callType,
        isIncoming
      }
    )
  }

  return {
    createWebviewWindow,
    createModalWindow,
    resizeWindow,
    checkWinExist,
    setResizable,
    sendWindowPayload,
    getWindowPayload,
    startRtcCall,
    createRtcCallWindow
  }
}
