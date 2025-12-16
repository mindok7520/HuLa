<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white"
        style="border-bottom: 1px solid; border-color: #dfdfdf"
        :hidden-right="true"
        room-name="공지 상세" />
    </template>

    <template #container>
      <div
        class="bg-[url('@/assets/mobile/chat-home/background.webp')] bg-cover bg-center flex flex-col overflow-auto h-full">
        <div class="flex flex-col flex-1 gap-15px py-15px px-20px">
          <div v-if="loading" class="flex justify-center items-center h-200px">
            <n-spin size="large" />
          </div>

          <div v-else-if="announcement" class="bg-white flex flex-col shadow p-10px gap-15px text-14px rounded-15px">
            <!-- 공지 헤더 정보 -->
            <div
              style="border-bottom: 1px solid; border-color: #ebebeb"
              class="grid grid-cols-[2.2rem_1fr_4rem] items-start px-2 py-3 gap-1">
              <!-- 프로필 사진 -->
              <div class="self-center h-38px">
                <n-badge>
                  <n-avatar :size="40" :src="publisherAvatar" :fallback-src="getFallbackAvatar()" round />
                </n-badge>
              </div>

              <!-- 작성자 정보 -->
              <div class="truncate pl-4 flex gap-10px flex-col">
                <div class="text-14px leading-tight font-bold flex-1 truncate text-#333">
                  {{ publisherName }}
                </div>
                <div class="text-12px text-#333">
                  {{ formatTimestamp(announcement.createTime) }}
                </div>
              </div>

              <!-- 읽음 통계 -->
              <div class="justify-self-end self-center text-12px text-right flex gap-1 items-center">
                <span class="text-#13987F">{{ announcement.readCount || 0 }}명 읽음</span>
              </div>
            </div>

            <!-- 공지 내용 -->
            <div class="announcement-content whitespace-pre-wrap break-words text-14px leading-6 text-#333">
              {{ announcement.content }}
            </div>

            <!-- 편집 버튼 (관리자/그룹 소유자만 표시) -->
            <div v-if="canEdit" class="flex justify-center mb-10px">
              <div
                @click="goToNoticeEdit"
                style="
                  background: linear-gradient(145deg, #7eb7ac, #6fb0a4, #5fa89c);
                  border-radius: 30px;
                  padding: 10px 30px;
                  color: white;
                  font-weight: 500;
                  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                  text-align: center;
                  display: inline-block;
                  cursor: pointer;
                ">
                공지 편집
              </div>
            </div>
          </div>

          <div v-else class="flex justify-center items-center h-200px text-#909090">공지가 존재하지 않거나 삭제되었습니다</div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useGroupStore } from '@/stores/group'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { getAnnouncementDetail } from '@/utils/ImRequestUtils'

defineOptions({
  name: 'mobileChatNoticeDetail'
})

const route = useRoute()
const router = useRouter()
const groupStore = useGroupStore()
const globalStore = useGlobalStore()
const userStore = useUserStore()

const announcement = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// 작성자 정보 가져오기
const publisherName = computed(() => {
  if (!announcement.value) return '알 수 없는 사용자'
  const userInfo = groupStore.getUserInfo(announcement.value.uid)
  return userInfo?.name || userInfo?.myName || '알 수 없는 사용자'
})

const publisherAvatar = computed(() => {
  if (!announcement.value) return ''
  const userInfo = groupStore.getUserInfo(announcement.value.uid)
  return userInfo?.avatar || ''
})

// 기본 프로필 사진 가져오기
const getFallbackAvatar = () => {
  return '/logo.png'
}

const canEdit = computed(() => {
  if (!announcement.value) return false

  // 현재 사용자가 공지 작성자인 경우
  const currentUid = userStore.userInfo?.uid
  const isPublisher = announcement.value.uid === currentUid

  // 현재 사용자가 그룹 소유자 또는 관리자인 경우
  const isLord = currentUid ? groupStore.isCurrentLord(currentUid) : false
  const isAdmin = currentUid ? groupStore.isAdmin(currentUid) : false
  return isPublisher || isLord || isAdmin
})

// 공지 상세 정보 가져오기
const fetchAnnouncementDetail = async () => {
  try {
    loading.value = true

    const data = await getAnnouncementDetail({
      roomId: globalStore.currentSessionRoomId,
      announcementId: route.params.id as string
    })
    announcement.value = data
  } catch (err) {
    console.error('공지 상세 정보 가져오기 실패:', err)
    error.value = '공지 상세 정보 가져오기 실패, 다시 시도해주세요'
  } finally {
    loading.value = false
  }
}

// 편집 페이지로 이동
const goToNoticeEdit = () => {
  if (announcement.value) {
    router.push(`/mobile/chatRoom/notice/edit/${announcement.value.id}`)
  }
}

onMounted(() => {
  fetchAnnouncementDetail()
})
</script>

<style scoped>
.announcement-content {
  line-height: 1.6;
  max-height: none; /* 높이 제한 제거, 내용이 자연스럽게 스크롤되도록 함 */
  overflow-y: auto;
}

/* 긴 텍스트 및 줄 바꿈이 정상적으로 표시되도록 보장 */
.whitespace-pre-wrap {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
