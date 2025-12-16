import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { useDebounceFn } from '@vueuse/core'
import { sumBy } from 'es-toolkit'
import { NotificationTypeEnum } from '@/enums'
import type { SessionItem } from '@/services/types'
import { isMac } from '@/utils/PlatformConstants'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'

/**
 * 통합 미읽 카운트 관리자
 */
export class UnreadCountManager {
  private pendingUpdates = new Set<string>()
  private readonly DEBOUNCE_DELAY = 60 // 디바운스 지연
  private updateCallback: (() => void) | null = null
  private setTipVisible?: (visible: boolean) => void
  private debouncedExecuteUpdate: () => void

  constructor() {
    this.debouncedExecuteUpdate = useDebounceFn(() => {
      this.executeUpdate()
    }, this.DEBOUNCE_DELAY)
  }

  /**
   * 업데이트 콜백 함수 설정
   * @param callback 실제 업데이트가 필요할 때 호출되는 콜백 함수
   */
  public setUpdateCallback(callback: () => void) {
    this.updateCallback = callback
  }

  /**
   * 미읽 카운트 업데이트 요청
   * @param sessionId 선택적 세션 ID, 제공되면 특정 세션만 업데이트
   */
  public requestUpdate(sessionId?: string) {
    if (sessionId) {
      this.pendingUpdates.add(sessionId)
    } else {
      this.pendingUpdates.add('*') // '*'는 전역 업데이트를 나타냄
    }

    this.debouncedExecuteUpdate()
  }

  /**
   * 전역 미읽 카운트 계산
   * @param sessionList 세션 목록
   * @param unReadMark 전역 미읽 표시 객체
   * @param feedUnreadCount 피드 미읽 수 (선택적)
   */
  public calculateTotal(
    sessionList: SessionItem[],
    unReadMark: { newFriendUnreadCount: number; newGroupUnreadCount: number; newMsgUnreadCount: number },
    feedUnreadCount?: number
  ) {
    // 현재 창 레이블 확인
    const webviewWindowLabel = WebviewWindow.getCurrent()
    if (webviewWindowLabel.label !== 'home' && webviewWindowLabel.label !== 'mobile-home') {
      return
    }

    info('[UnreadCountManager] 전역 미읽 메시지 카운트 계산')

    // 총 미읽 수 계산
    const totalUnread = sumBy(sessionList, (session) => {
      if (session.muteNotification === NotificationTypeEnum.NOT_DISTURB) {
        return 0
      }
      return Math.max(0, session.unreadCount || 0)
    })

    // 전역 미읽 카운트 업데이트
    unReadMark.newMsgUnreadCount = totalUnread

    // 시스템 배지 업데이트 (피드 미읽 수 포함)
    this.updateSystemBadge(unReadMark, feedUnreadCount)
  }

  /**
   * 실제 업데이트 작업 실행
   */
  private executeUpdate() {
    if (this.updateCallback) {
      this.updateCallback()
    }
    this.pendingUpdates.clear()
  }

  /**
   * 시스템 배지 카운트 업데이트
   * @param unReadMark 전역 미읽 표시 객체
   * @param feedUnreadCount 피드 미읽 수 (선택적)
   */
  private async updateSystemBadge(
    unReadMark: {
      newFriendUnreadCount: number
      newGroupUnreadCount: number
      newMsgUnreadCount: number
    },
    feedUnreadCount?: number
  ): Promise<void> {
    const messageUnread = Math.max(0, unReadMark.newMsgUnreadCount || 0)
    const friendUnread = Math.max(0, unReadMark.newFriendUnreadCount || 0)
    const groupUnread = Math.max(0, unReadMark.newGroupUnreadCount || 0)
    const feedUnread = Math.max(0, feedUnreadCount || 0)
    const badgeTotal = messageUnread + friendUnread + groupUnread + feedUnread
    if (isMac()) {
      const count = badgeTotal > 0 ? badgeTotal : undefined
      await invokeWithErrorHandler('set_badge_count', { count })
    }

    // tipVisible 상태 업데이트, 트레이 알림 표시 제어에 사용
    if (messageUnread > 0) {
      // 새 메시지가 있을 때 tipVisible을 true로 설정하여 트레이 깜박임 트리거
      this.setTipVisible?.(true)
    } else {
      // 미읽 메시지가 없을 때 tipVisible을 false로 설정
      this.setTipVisible?.(false)
    }
  }

  /**
   * 수동으로 시스템 배지 카운트 새로고침
   * @param unReadMark 전역 미읽 표시 객체
   * @param feedUnreadCount 피드 미읽 수 (선택적)
   */
  public refreshBadge(
    unReadMark: {
      newFriendUnreadCount: number
      newGroupUnreadCount: number
      newMsgUnreadCount: number
    },
    feedUnreadCount?: number
  ) {
    this.updateSystemBadge(unReadMark, feedUnreadCount)
  }

  /**
   * tipVisible 콜백 함수 설정
   * @param callback 콜백 함수, tipVisible 상태 설정에 사용
   */
  public setTipVisibleCallback(callback: (visible: boolean) => void) {
    this.setTipVisible = callback
  }

  /**
   * 관리자 파괴, 리소스 정리
   */
  public destroy() {
    this.pendingUpdates.clear()
  }
}

// 싱글턴 인스턴스 생성
export const unreadCountManager = new UnreadCountManager()
