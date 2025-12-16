<template>
  <div v-if="showPopup" class="fixed inset-0 z-50 flex items-start justify-end">
    <!-- 배경 마스크 -->
    <div class="fixed inset-0 bg-black/20" @click="closePopup"></div>

    <!-- 팝업 내용 -->
    <div class="relative w-80 h-screen bg-white shadow-lg flex flex-col">
      <!-- 헤더 -->
      <div class="flex items-center justify-between p-16px border-b border-#e5e5e5">
        <h3 class="text-16px font-600">피드 알림</h3>
        <div class="flex items-center gap-8px">
          <n-button
            v-if="feednotificationStore.notificationStats.unreadCount > 0"
            text
            type="primary"
            size="small"
            @click="markAllAsRead">
            모두 읽음
          </n-button>
          <n-button text type="error" size="small" @click="closePopup">닫기</n-button>
        </div>
      </div>

      <!-- 알림 목록 -->
      <div class="flex-1 overflow-y-auto">
        <div
          v-if="feednotificationStore.notifications.length === 0"
          class="flex items-center justify-center h-full text-#999">
          알림 없음
        </div>

        <div
          v-for="notification in feednotificationStore.notifications"
          :key="notification.id"
          class="border-b border-#f0f0f0 p-12px hover:bg-#f9f9f9 cursor-pointer transition-colors"
          @click="handleNotificationClick(notification)">
          <!-- 알림 항목 -->
          <div class="flex gap-12px">
            <!-- 아바타 -->
            <n-avatar :size="40" round :src="AvatarUtils.getAvatarUrl(notification.operatorAvatar)" />

            <!-- 내용 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-4px">
                <span class="text-13px font-500 text-#333">{{ notification.operatorName }}</span>
                <span v-if="!notification.isRead" class="w-8px h-8px rounded-full bg-#ff6b6b"></span>
              </div>

              <!-- 알림 유형 및 내용 -->
              <div class="text-12px text-#666 mb-4px">
                <span v-if="notification.type === 'like'" class="text-#ff6b6b">👍 회원님의 피드를 좋아합니다</span>
                <span v-else class="text-#666">💬 회원님의 피드에 댓글을 남겼습니다</span>
              </div>

              <!-- 피드 내용 미리보기 -->
              <div class="text-12px text-#999 mb-4px line-clamp-2">{{ notification.feedContent }}</div>

              <!-- 댓글 내용 (댓글 유형만 해당) -->
              <div
                v-if="notification.type === 'comment' && notification.commentContent"
                class="text-12px text-#666 bg-#f5f5f5 p-8px rounded mb-4px">
                {{ notification.commentContent }}
              </div>

              <!-- 시간 -->
              <div class="text-11px text-#ccc">{{ formatTime(notification.createTime) }}</div>
            </div>

            <!-- 삭제 버튼 -->
            <n-button text type="error" size="small" @click.stop="deleteNotification(notification.id)">삭제</n-button>
          </div>
        </div>
      </div>

      <!-- 하단 작업 -->
      <div v-if="feednotificationStore.notifications.length > 0" class="border-t border-#e5e5e5 p-12px flex gap-8px">
        <n-button type="error" text block size="small" @click="clearAllNotifications">모든 알림 지우기</n-button>
      </div>
    </div>
  </div>

  <!-- 댓글 상세 팝업 -->
  <n-modal
    v-model:show="showCommentModal"
    preset="dialog"
    title="댓글 상세"
    positive-text="닫기"
    :show-icon="false"
    @positive-click="showCommentModal = false">
    <div v-if="selectedNotification" class="space-y-16px">
      <!-- 피드 내용 -->
      <div class="p-12px bg-#f5f5f5 rounded-8px">
        <div class="text-12px text-#999 mb-4px">피드 내용</div>
        <div class="text-13px text-#666">{{ selectedNotification.feedContent }}</div>
      </div>

      <!-- 댓글 작성자 정보 -->
      <div class="flex items-center gap-12px">
        <n-avatar :size="40" round :src="AvatarUtils.getAvatarUrl(selectedNotification.operatorAvatar)" />
        <div class="flex-1">
          <div class="text-13px font-500 text-#333">{{ selectedNotification.operatorName }}</div>
          <div class="text-12px text-#999">{{ formatTime(selectedNotification.createTime) }}</div>
        </div>
      </div>

      <!-- 댓글 내용 -->
      <div
        v-if="selectedNotification.type === 'comment'"
        class="p-12px bg-#f9f9f9 rounded-8px border-l-4 border-#13987F">
        <div class="text-13px text-#666">{{ selectedNotification.commentContent }}</div>
      </div>

      <!-- 좋아요 힌트 -->
      <div v-else class="p-12px bg-#fff3cd rounded-8px border-l-4 border-#ffc107">
        <div class="text-13px text-#666">👍 회원님의 피드를 좋아합니다</div>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { useFeedNotificationStore } from '@/stores/feedNotification'
import { AvatarUtils } from '@/utils/AvatarUtils'

const feednotificationStore = useFeedNotificationStore()
const showPopup = ref(false)
const showCommentModal = ref(false)
const selectedNotification = ref<any>(null)

// 알림 목록 변경 감지
watch(
  () => feednotificationStore.notifications.length,
  (newLength) => {
    console.log('알림 목록 변경됨, 현재 알림 수:', newLength)
  }
)

/**
 * 팝업 열기
 */
const openPopup = () => {
  console.log('🔔 알림 팝업 열기, 현재 알림 수:', feednotificationStore.notifications.length)
  console.log('🔔 알림 목록:', feednotificationStore.notifications)
  showPopup.value = true
}

/**
 * 팝업 닫기
 */
const closePopup = () => {
  showPopup.value = false
}

/**
 * 알림 클릭 처리
 */
const handleNotificationClick = (notification: any) => {
  feednotificationStore.markAsRead(notification.id)
  selectedNotification.value = notification
  showCommentModal.value = true
}

/**
 * 모두 읽음으로 표시
 */
const markAllAsRead = () => {
  feednotificationStore.markAllAsRead()
}

/**
 * 알림 삭제
 */
const deleteNotification = (notificationId: string) => {
  feednotificationStore.deleteNotification(notificationId)
}

/**
 * 모든 알림 지우기
 */
const clearAllNotifications = () => {
  if (confirm('모든 알림을 지우시겠습니까?')) {
    feednotificationStore.clearAllNotifications()
  }
}

/**
 * 시간 포맷팅
 */
const formatTime = (timestamp: number) => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  if (days < 7) return `${days}일 전`

  const date = new Date(timestamp)
  return date.toLocaleDateString()
}

// 부모 컴포넌트에 메서드 노출
defineExpose({
  openPopup,
  closePopup
})
</script>

<style scoped lang="scss">
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
