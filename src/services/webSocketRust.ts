import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { error, info, warn } from '@tauri-apps/plugin-log'
import { useMitt } from '@/hooks/useMitt'
import { WsResponseMessageType } from '@/services/wsType'
import { useContactStore } from '@/stores/contacts'

/// WebSocket 연결 상태
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

/// 연결 상태 확인
export interface ConnectionHealth {
  isHealthy: boolean
  lastPongTime?: number
  consecutiveFailures: number
  roundTripTime?: number
}

/// WebSocket 이벤트
export interface WebSocketEvent {
  type: 'ConnectionStateChanged' | 'MessageReceived' | 'HeartbeatStatusChanged' | 'Error'
  state?: ConnectionState
  isReconnection?: boolean
  is_reconnection?: boolean
  message?: any
  health?: ConnectionHealth
  details?: Record<string, any>
}

/**
 * Rust WebSocket 클라이언트 래퍼
 * 기존 WebSocket Worker와 호환되는 인터페이스 제공
 */
/**
 * 리스너 관리자, AbortController와 유사
 */
class ListenerController {
  private listeners: Set<UnlistenFn> = new Set()
  private isAborted = false

  add(unlisten: UnlistenFn): void {
    if (this.isAborted) {
      // 이미 중단된 경우, 새로 추가된 리스너를 즉시 정리
      unlisten()
      return
    }
    this.listeners.add(unlisten)
  }

  async abort(): Promise<void> {
    if (this.isAborted) return

    this.isAborted = true
    const cleanupPromises: Promise<void>[] = []

    // 모든 정리 작업을 병렬로 실행
    for (const unlisten of this.listeners) {
      cleanupPromises.push(
        Promise.resolve()
          .then(() => unlisten())
          .catch((err) => {
            error(`[ListenerController] 리스너 정리 실패: ${err}`)
          })
      )
    }

    // 모든 정리가 완료될 때까지 대기 (차단 방지를 위한 타임아웃 설정)
    try {
      await Promise.race([
        Promise.all(cleanupPromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error('정리 시간 초과')), 5000))
      ])
    } catch (err) {
      warn(`[ListenerController] 일부 리스너 정리가 완료되지 않았을 수 있습니다: ${err}`)
    }

    this.listeners.clear()
    info(`[ListenerController] 모든 리스너가 정리되었습니다`)
  }

  get size(): number {
    return this.listeners.size
  }

  get aborted(): boolean {
    return this.isAborted
  }
}

class RustWebSocketClient {
  private listenerController: ListenerController = new ListenerController()

  constructor() {
    info('[RustWS] Rust WebSocket 클라이언트 초기화')
  }

  /**
   * WebSocket 연결 초기화
   */
  async initConnect(): Promise<void> {
    try {
      const clientId = localStorage.getItem('clientId')

      const params = {
        clientId: clientId || ''
      }

      info(`[RustWS] 연결 매개변수 초기화: ${JSON.stringify(params)}`)

      await invoke('ws_init_connection', { params })

      info('[RustWS] WebSocket 연결 초기화 성공')
    } catch (err) {
      error(`[RustWS] 연결 초기화 실패: ${err}`)
      throw err
    }
  }

  /**
   * 연결 끊기
   */
  async disconnect(): Promise<void> {
    try {
      await invoke('ws_disconnect')
      info('[RustWS] WebSocket 연결이 끊어졌습니다')
    } catch (err) {
      error(`[RustWS] 연결 끊기 실패: ${err}`)
    }
  }

  /**
   * 메시지 전송
   */
  async sendMessage(data: any): Promise<void> {
    try {
      await invoke('ws_send_message', {
        params: { data }
      })
    } catch (err: any) {
      error(`[RustWS] 메시지 전송 실패: ${err}`)
      throw err
    }
  }

  /**
   * 연결 상태 가져오기
   */
  async getState(): Promise<ConnectionState> {
    try {
      const state = await invoke<ConnectionState>('ws_get_state')
      return state
    } catch (err) {
      error(`[RustWS] 연결 상태 가져오기 실패: ${err}`)
      return ConnectionState.ERROR
    }
  }

  /**
   * 강제 재연결
   */
  async forceReconnect(): Promise<void> {
    try {
      await invoke('ws_force_reconnect')
      info('[RustWS] 강제 재연결 성공')
    } catch (err) {
      error(`[RustWS] 강제 재연결 실패: ${err}`)
      throw err
    }
  }

  /**
   * 연결 여부 확인
   */
  async isConnected(): Promise<boolean> {
    try {
      const connected = await invoke<boolean>('ws_is_connected')
      return connected
    } catch (err) {
      error(`[RustWS] 연결 상태 확인 실패: ${err}`)
      return false
    }
  }

  /**
   * 구성 업데이트
   */
  async updateConfig(config: {
    heartbeatInterval?: number
    heartbeatTimeout?: number
    maxReconnectAttempts?: number
    reconnectDelayMs?: number
  }): Promise<void> {
    try {
      await invoke('ws_update_config', {
        params: config
      })
      info('[RustWS] 구성 업데이트 성공')
    } catch (err) {
      error(`[RustWS] 구성 업데이트 실패: ${err}`)
      throw error
    }
  }

  /**
   * 이벤트 리스너 설정
   */
  // private async setupEventListener(): Promise<void> {
  //   try {
  //     info(`[RustWS] 开始设置事件监听器，当前业务监听器数量: ${this.listenerController.size}`)

  //     // 清理旧的监听器
  //     if (this.eventListener) {
  //       this.eventListener()
  //       info('[RustWS] 已清理主事件监听器')
  //     }

  //     // 高效清理所有业务监听器（并行 + 超时）
  //     const oldListenerCount = this.listenerController.size
  //     await this.listenerController.abort()
  //     this.listenerController = new ListenerController()
  //     info(`[RustWS] 已高效清理 ${oldListenerCount} 个业务监听器`)

  //     // 监听 WebSocket 事件
  //     this.eventListener = await listen<WebSocketEvent>('websocket-event', (event) => {
  //       this.handleWebSocketEvent(event.payload)
  //     })

  //     // 设置业务消息监听器
  //     await this.setupBusinessMessageListeners()

  //     info(`[RustWS] 事件监听器设置完成，新的业务监听器数量: ${this.listenerController.size}`)
  //   } catch (err) {
  //     error(`[RustWS] 设置事件监听器失败: ${err}`)
  //   }
  // }

  /**
   * 비즈니스 메시지 리스너 설정
   * Rust 측에서 전송된 특정 비즈니스 메시지 이벤트 수신
   */
  public async setupBusinessMessageListeners(): Promise<void> {
    const contactStore = useContactStore()
    this.listenerController.add(
      await listen('ws-login-success', (event: any) => {
        info('로그인 성공')
        useMitt.emit(WsResponseMessageType.LOGIN_SUCCESS, event.payload)
      })
    )

    // 메시지 관련 이벤트
    const listenerIndex = this.listenerController.size
    this.listenerController.add(
      await listen('ws-receive-message', (event: any) => {
        info(`[ws]메시지 수신[리스너${listenerIndex}]: ${JSON.stringify(event.payload)}`)
        // debugger
        useMitt.emit(WsResponseMessageType.RECEIVE_MESSAGE, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-msg-recall', (event: any) => {
        info('회수')
        useMitt.emit(WsResponseMessageType.MSG_RECALL, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-msg-mark-item', (event: any) => {
        info(`메시지 표시: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.MSG_MARK_ITEM, event.payload)
      })
    )

    // 사용자 상태 관련 이벤트
    this.listenerController.add(
      await listen('ws-online', (event: any) => {
        info(`온라인: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.ONLINE, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-offline', (event: any) => {
        info(`오프라인: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.OFFLINE, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-user-state-change', (event: any) => {
        info(`사용자 상태 변경: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.USER_STATE_CHANGE, event.payload)
      })
    )

    // 친구 관련 이벤트
    this.listenerController.add(
      await listen('ws-request-new-apply', (event: any) => {
        info('친구 신청')
        useMitt.emit(WsResponseMessageType.REQUEST_NEW_FRIEND, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-group-set-admin-success', (event: any) => {
        useMitt.emit(WsResponseMessageType.GROUP_SET_ADMIN_SUCCESS, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-request-notify-event', (event: any) => {
        info(`알림 이벤트: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.NOTIFY_EVENT, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-request-approval-friend', (event: any) => {
        info(`친구 신청 수락: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.REQUEST_APPROVAL_FRIEND, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-member-change', (event: any) => {
        useMitt.emit(WsResponseMessageType.WS_MEMBER_CHANGE, event.payload)
      })
    )

    // 방/그룹 채팅 관련 이벤트
    this.listenerController.add(
      await listen('ws-room-info-change', (event: any) => {
        info(`그룹 소유자가 그룹 채팅 정보 수정: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.ROOM_INFO_CHANGE, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-my-room-info-change', (event: any) => {
        info(`내가 그룹 내 정보 수정: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.MY_ROOM_INFO_CHANGE, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-room-group-notice-msg', (event: any) => {
        info(`그룹 공지 게시: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.ROOM_GROUP_NOTICE_MSG, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-room-edit-group-notice-msg', (event: any) => {
        info(`그룹 공지 편집: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.ROOM_EDIT_GROUP_NOTICE_MSG, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-room-dissolution', (event: any) => {
        info(`그룹 해체: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.ROOM_DISSOLUTION, event.payload)
      })
    )

    // 화상 통화 관련 이벤트
    this.listenerController.add(
      await listen('ws-video-call-request', (event: any) => {
        info(`통화 요청 수신: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.VideoCallRequest, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-call-accepted', (event: any) => {
        info(`통화 수락됨: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.CallAccepted, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-call-rejected', (event: any) => {
        info(`통화 거부됨: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.CallRejected, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-room-closed', (event: any) => {
        info(`방이 닫혔습니다: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.RoomClosed, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-webrtc-signal', (event: any) => {
        info(`시그널링 메시지 수신: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.WEBRTC_SIGNAL, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-join-video', (event: any) => {
        info(`사용자가 방에 입장했습니다: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.JoinVideo, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-leave-video', (event: any) => {
        info(`사용자가 방을 떠났습니다: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.LeaveVideo, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-dropped', (event: any) => {
        useMitt.emit(WsResponseMessageType.DROPPED, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-cancel', (event: any) => {
        info(`통화 취소됨: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.CANCEL, event.payload)
      })
    )

    // 시스템 관련 이벤트
    this.listenerController.add(
      await listen('ws-token-expired', (event: any) => {
        info('계정이 다른 기기에서 로그인되었습니다')
        useMitt.emit(WsResponseMessageType.TOKEN_EXPIRED, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-invalid-user', (event: any) => {
        info('유효하지 않은 사용자')
        useMitt.emit(WsResponseMessageType.INVALID_USER, event.payload)
      })
    )

    // 알 수 없는 메시지 유형
    this.listenerController.add(
      await listen('ws-unknown-message', (event: any) => {
        info(`처리되지 않은 유형의 메시지 수신: ${JSON.stringify(event.payload)}`)
      })
    )

    this.listenerController.add(
      await listen('ws-delete-friend', (event: any) => {
        info(`친구 삭제: ${JSON.stringify(event.payload)}`)
        contactStore.deleteContact(event.payload)
      })
    )

    // 모멘트 관련 이벤트
    this.listenerController.add(
      await listen('ws-feed-send-msg', (event: any) => {
        info(`모멘트 메시지 수신: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.FEED_SEND_MSG, event.payload)
      })
    )

    this.listenerController.add(
      await listen('ws-feed-notify', (event: any) => {
        info(`모멘트 알림 수신: ${JSON.stringify(event.payload)}`)
        useMitt.emit(WsResponseMessageType.FEED_NOTIFY, event.payload)
      })
    )
  }
}
info('RustWebSocketClient 생성')
// 创建全局实例
const rustWebSocketClient = new RustWebSocketClient()

// 使用 Tauri 原生事件监听窗口焦点变化（跨平台兼容）
// 防止重复设置窗口焦点监听器
// let isWindowListenerInitialized = false

// if (!isWindowListenerInitialized) {
//   isWindowListenerInitialized = true
//   ;(async () => {
//     try {
//       const currentWindow = getCurrentWebviewWindow()

//       // 监听窗口获得焦点事件
//       await currentWindow.listen('tauri://focus', () => {
//         info('[RustWS] 窗口获得焦点，设置应用状态为前台')
//         rustWebSocketClient.setAppBackgroundState(false)
//       })

//       // 监听窗口失去焦点事件
//       await currentWindow.listen('tauri://blur', () => {
//         info('[RustWS] 窗口失去焦点，设置应用状态为后台')
//         rustWebSocketClient.setAppBackgroundState(true)
//       })

//       info('[RustWS] 窗口焦点事件监听器已设置')
//     } catch (err) {
//       error(`[RustWS] 设置窗口焦点监听器失败: ${err}`)
//     }
//   })()
// }

export default rustWebSocketClient
