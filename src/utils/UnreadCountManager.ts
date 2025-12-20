import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useDebounceFn } from '@vueuse/core'
import { sumBy } from 'es-toolkit'
import { NotificationTypeEnum } from '@/enums'
import type { SessionItem } from '@/services/types'
import { isMac } from '@/utils/PlatformConstants'

/**
 * 통합 읽지 않은 수 관리자
 */
export class UnreadCountManager {
  private pendingUpdates = new Set<string>()
  private readonly DEBOUNCE_DELAY = 60 // 디바운스 지연 시간
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
   * 읽지 않은 수 업데이트 요청
   * @param sessionId 선택적 세션 ID, 제공된 경우 특정 세션만 업데이트
   */
  public requestUpdate(sessionId?: string) {
    if (sessionId) {
      this.pendingUpdates.add(sessionId)
    } else {
      this.pendingUpdates.add('*') // '*'는 전체 업데이트를 나타냄
    }

    this.debouncedExecuteUpdate()
  }

  /**
   * 전역 읽지 않은 수 계산
   * @param sessionList 세션 목록
   * @param unReadMark 전역 읽지 않은 표시 객체
   * @param feedUnreadCount 피드(타임라인) 읽지 않은 수 (선택 사항)
   */
  public calculateTotal(
    sessionList: SessionItem[],
    unReadMark: { newFriendUnreadCount: number; newGroupUnreadCount: number; newMsgUnreadCount: number },
    feedUnreadCount?: number
  ) {
    // 총 읽지 않은 수 계산 (방해 금지 모드 세션 제외)
    const totalUnread = sumBy(sessionList, (session) => {
      if (session.muteNotification === NotificationTypeEnum.NOT_DISTURB) {
        return 0
      }
      return Math.max(0, session.unreadCount || 0)
    })

    // 전역 읽지 않은 수 업데이트
    unReadMark.newMsgUnreadCount = totalUnread

    // 시스템 배지 업데이트 (피드 읽지 않은 수 포함)
    this.updateSystemBadge(unReadMark, feedUnreadCount)
  }

  /**
   * 실제 업데이트 작업 수행
   */
  private executeUpdate() {
    if (this.updateCallback) {
      this.updateCallback()
    }
    this.pendingUpdates.clear()
  }

  /**
   * 시스템 배지 카운트 업데이트
   * @param unReadMark 전역 읽지 않은 표시 객체
   * @param feedUnreadCount 피드(타임라인) 읽지 않은 수 (선택 사항)
   */
  private async updateSystemBadge(
    unReadMark: {
      newFriendUnreadCount: number
      newGroupUnreadCount: number
      newMsgUnreadCount: number
    },
    feedUnreadCount?: number
  ): Promise<void> {
    // 모든 유형의 읽지 않은 총합 계산
    const messageUnread = Math.max(0, unReadMark.newMsgUnreadCount || 0)
    const friendUnread = Math.max(0, unReadMark.newFriendUnreadCount || 0)
    const groupUnread = Math.max(0, unReadMark.newGroupUnreadCount || 0)
    const feedUnread = Math.max(0, feedUnreadCount || 0)
    const badgeTotal = messageUnread + friendUnread + groupUnread + feedUnread

    // macOS에서 Dock 아이콘 배지 업데이트 (모든 유형의 읽지 않은 총합 표시)
    if (isMac()) {
      const count = badgeTotal > 0 ? badgeTotal : undefined
      // getByLabel을 사용하여 home 창을 가져옴, 창이 숨겨져 있어도 배지를 정상적으로 설정할 수 있음
      const homeWindow = await WebviewWindow.getByLabel('home')
      if (homeWindow) {
        await homeWindow.setBadgeCount(count)
      }
    }

    // 트레이 알림 표시 제어를 위한 tipVisible 상태 업데이트
    if (messageUnread > 0) {
      // 새 메시지가 있을 때 tipVisible을 true로 설정하여 트레이 깜빡임 유도
      this.setTipVisible?.(true)
    } else {
      // 읽지 않은 메시지가 없을 때 tipVisible을 false로 설정
      this.setTipVisible?.(false)
    }
  }

  /**
   * 시스템 배지 카운트 수동 새로고침
   * @param unReadMark 전역 읽지 않은 표시 객체
   * @param feedUnreadCount 피드(타임라인) 읽지 않은 수 (선택 사항)
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
   * @param callback tipVisible 상태를 설정하기 위한 콜백 함수
   */
  public setTipVisibleCallback(callback: (visible: boolean) => void) {
    this.setTipVisible = callback
  }

  /**
   * 관리자 소멸 및 리소스 정리
   */
  public destroy() {
    this.pendingUpdates.clear()
  }
}

// 싱글톤 인스턴스 생성
export const unreadCountManager = new UnreadCountManager()
