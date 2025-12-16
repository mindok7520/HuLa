import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { StoresEnum } from '@/enums'

/**
 * 피드 알림 항목
 */
export interface FeedNotificationItem {
  id: string // 고유 ID
  type: 'like' | 'comment' // 알림 유형: 좋아요 또는 댓글
  feedId: string // 피드 ID
  feedContent: string // 피드 내용
  operatorUid: string // 작업자 UID
  operatorName: string // 작업자 이름
  operatorAvatar: string // 작업자 프로필 사진
  commentContent?: string // 댓글 내용 (댓글 유형만)
  createTime: number // 생성 시간
  isRead: boolean // 읽음 여부
}

interface NotificationStats {
  unreadCount: number
  totalCount: number
}

/**
 * 피드 알림 Store
 * 피드의 좋아요 및 댓글 알림 관리
 */
export const useFeedNotificationStore = defineStore(StoresEnum.FEED_NOTIFICATION, () => {
  // 알림 목록
  const notifications = ref<FeedNotificationItem[]>([])

  // 알림 통계
  const notificationStats = reactive<NotificationStats>({
    unreadCount: 0, // 읽지 않은 알림 수
    totalCount: 0 // 총 알림 수
  })

  /**
   * 알림 추가
   */
  const addNotification = (notification: FeedNotificationItem) => {
    // 동일한 알림이 이미 존재하는지 확인 (중복 방지)
    const exists = notifications.value.some(
      (n) =>
        n.feedId === notification.feedId &&
        n.operatorUid === notification.operatorUid &&
        n.type === notification.type &&
        Math.abs(n.createTime - notification.createTime) < 1000 // 1초 이내의 중복 알림은 동일한 것으로 간주
    )

    if (!exists) {
      notifications.value.unshift(notification)
      notificationStats.totalCount++

      if (!notification.isRead) {
        notificationStats.unreadCount++
      }
    }
  }

  /**
   * 알림을 읽음으로 표시
   */
  const markAsRead = (notificationId: string) => {
    const notification = notifications.value.find((n) => n.id === notificationId)
    if (notification && !notification.isRead) {
      notification.isRead = true
      notificationStats.unreadCount = Math.max(0, notificationStats.unreadCount - 1)
    }
  }

  /**
   * 모든 알림을 읽음으로 표시
   */
  const markAllAsRead = () => {
    notifications.value.forEach((n) => {
      n.isRead = true
    })
    notificationStats.unreadCount = 0
  }

  /**
   * 알림 삭제
   */
  const deleteNotification = (notificationId: string) => {
    const index = notifications.value.findIndex((n) => n.id === notificationId)
    if (index > -1) {
      const notification = notifications.value[index]
      if (!notification.isRead) {
        notificationStats.unreadCount = Math.max(0, notificationStats.unreadCount - 1)
      }
      notifications.value.splice(index, 1)
      notificationStats.totalCount = Math.max(0, notificationStats.totalCount - 1)
    }
  }

  /**
   * 모든 알림 비우기
   */
  const clearAllNotifications = () => {
    notifications.value = []
    notificationStats.unreadCount = 0
    notificationStats.totalCount = 0
  }

  return {
    notifications,
    notificationStats,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications
  }
})
