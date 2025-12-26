<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white"
        style="border-bottom: 1px solid; border-color: #dfdfdf"
        :hidden-right="true"
        room-name="그룹 공지" />
    </template>

    <template #container>
      <div
        class="bg-[url('@/assets/mobile/chat-home/background.webp')] bg-cover bg-center flex flex-col overflow-auto h-full relative">
        <div class="flex flex-col flex-1 gap-15px py-15px px-20px">
          <RecycleScroller :items="announList" :item-size="15" key-field="id" class="flex flex-col gap-15px">
            <template #default="{ item }">
              <!-- 공지 내용 블록 -->
              <div @click="goToNoticeDetail(item.id)" class="shadow flex p-15px bg-white rounded-10px">
                <div class="flex flex-col w-full gap-10px">
                  <!-- 시간/읽은 사람 수 -->
                  <div class="flex items-center justify-between text-14px">
                    <span class="flex gap-5px">
                      <span class="text-#717171">게시자:</span>
                      <span class="text-black">{{ groupStore.getUserInfo(item.uid)?.name }}</span>
                    </span>
                    <span
                      v-if="item.isTop"
                      class="text-#13987F rounded-15px px-7px py-5px text-12px"
                      style="border: 1px solid; border-color: #13987f">
                      상단 고정
                    </span>
                  </div>
                  <!-- 공지 내용 -->
                  <div class="text-14px line-clamp-3 line-height-20px text-#717171 max-h-60px">
                    {{ item.content }}
                  </div>

                  <div class="flex items-center justify-between text-12px">
                    <span class="flex gap-5px text-#717171">{{ formatTimestamp(item.createTime) }}</span>
                    <span class="text-#13987F">128명 읽음</span>
                  </div>
                </div>
              </div>
            </template>
          </RecycleScroller>
        </div>

        <!-- 우측 하단 플로팅 버튼 - 그룹장, 관리자 또는 특정 뱃지 사용자만 표시 -->
        <van-floating-bubble v-if="canAddAnnouncement" axis="xy" magnetic="x" @click="goToAddNotice">
          <template #default>
            <svg class="w-24px h-24px iconpark-icon text-white"><use href="#plus"></use></svg>
          </template>
        </van-floating-bubble>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { RecycleScroller } from 'vue-virtual-scroller'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { useGlobalStore } from '@/stores/global'
import { useCachedStore } from '@/stores/cached'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { onActivated } from 'vue'

defineOptions({
  name: 'mobileChatNoticeList'
})

const route = useRoute()
const router = useRouter()
const announList = ref<any[]>([])
const groupStore = useGroupStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()
const cacheStore = useCachedStore()

// 현재 사용자가 공지 추가 권한이 있는지 확인
const canAddAnnouncement = computed(() => {
  if (!userStore.userInfo?.uid) return false

  const isLord = groupStore.isCurrentLord(userStore.userInfo.uid) ?? false
  const isAdmin = groupStore.isAdmin(userStore.userInfo.uid) ?? false

  // 현재 사용자가 ID 6 뱃지를 보유하고 채널인지 확인
  const hasBadge6 = () => {
    if (globalStore.currentSessionRoomId !== '1') return false

    const currentUser = groupStore.getUserInfo(userStore.userInfo!.uid)
    return currentUser?.itemIds?.includes('6') ?? false
  }

  return isLord || isAdmin || hasBadge6()
})

// 그룹 공지 목록 로드
const loadAnnouncementList = async () => {
  try {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) {
      console.error('현재 세션에 roomId가 없습니다')
      return
    }

    const data = await cacheStore.getGroupAnnouncementList(roomId, 1, 10)
    if (data && data.records) {
      announList.value = data.records
      // 상단 고정 공지 처리
      if (announList.value && announList.value.length > 0) {
        const topAnnouncement = announList.value.find((item: any) => item.top)
        if (topAnnouncement) {
          announList.value = [topAnnouncement, ...announList.value.filter((item: any) => !item.top)]
        }
      }
    }
  } catch (error) {
    console.error('그룹 공지 로드 실패:', error)
  }
}

const goToNoticeDetail = (id: string) => {
  // 공지 상세 페이지로 이동
  console.log(`공지 상세 페이지로 이동, 공지 ID: ${id}`)
  router.push(`/mobile/chatRoom/notice/detail/${id}`)
}

const goToAddNotice = () => {
  // 공지 추가 페이지로 이동
  console.log('공지 추가 페이지로 이동')
  router.push('/mobile/chatRoom/notice/add')
}

onMounted(() => {
  // 최초 로드 시 라우트 파라미터에서 데이터 가져오기
  if (route.query.announList) {
    announList.value = JSON.parse(route.query.announList as string)
  } else {
    // 라우트 파라미터가 없으면 서버에서 로드
    loadAnnouncementList()
  }
})

// 페이지 활성화 시(다른 페이지에서 복귀) 데이터 다시 로드
onActivated(() => {
  loadAnnouncementList()
})
</script>

<style scoped></style>
