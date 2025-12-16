<template>
  <main v-cloak class="size-full bg-[--right-bg-color] select-none cursor-default">
    <ActionBar :shrink="false" :max-w="false" />
    <!-- 공지 편집 뷰 -->
    <n-flex v-if="viewType === '0' && isAdmin" vertical class="size-full flex-center">
      <div class="text-(14px [--chat-text-color]) flex-start-center w-95% h-40px">{{ title }}</div>
      <div class="w-95%">
        <n-input
          class="max-h-480px border-(1px solid #90909080) rounded-6px bg-[--center-bg-color]"
          v-model:value="announContent"
          type="textarea"
          :placeholder="t('announcement.form.placeholder')"
          :autosize="announcementAutosize"
          maxlength="600"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          show-count
          autofocus />
      </div>
      <n-flex justify="space-between" class="w-95%">
        <div class="w-40% h-42px flex-start-center">
          <!--상단 고정 여부-->
          <n-switch
            class="bg-[--button-bg]"
            size="small"
            v-model:value="isTop"
            :true-value="true"
            :false-value="false" />
          <span class="text-(14px [--text-color]) ml-10px">{{ t('announcement.form.pinned') }}</span>
        </div>
        <div class="w-45% h-42px flex-end-center">
          <n-button quaternary size="small" class="bg-[--button-bg]" @click="handleCancel">
            {{ t('announcement.form.actions.cancel') }}
          </n-button>
          <n-button
            secondary
            type="primary"
            size="small"
            class="bg-[--button-bg] ml-5px"
            @click="handlePushAnnouncement">
            {{ t('announcement.form.actions.publish') }}
          </n-button>
        </div>
      </n-flex>
    </n-flex>
    <!-- 공지 목록 보기 뷰 -->
    <n-flex v-else vertical :size="6" class="size-full flex-center">
      <div class="text-(14px [--chat-text-color]) flex-between-center w-95% pt-10px">
        <span>{{ title }}</span>
        <n-button v-if="isAdmin" size="small" secondary @click="handleNew">
          {{ t('announcement.form.actions.new') }}
        </n-button>
      </div>

      <!--데이터 없음-->
      <div v-if="!announList || announList.length === 0" class="flex-center">
        <n-empty
          style="height: calc(100vh / var(--page-scale, 1) - 100px)"
          class="flex-center"
          :description="t('announcement.list.empty')">
          <template #icon>
            <n-icon>
              <svg>
                <use href="#explosion"></use>
              </svg>
            </n-icon>
          </template>
        </n-empty>
      </div>

      <n-scrollbar @scroll="handleScroll" v-else class="h-95%">
        <!-- 공지 목록 표시 -->
        <div class="w-full flex-col-x-center">
          <div
            v-for="announcement in announList"
            :key="announcement.id"
            class="w-91% h-auto bg-[--group-notice-list-bg] flex-start-center flex-col p-[0px_8px_12px_8px] border-[1px --group-notice-list-bg] mt-10px rounded-6px">
            <div class="w-full h-40px flex-start-center">
              <div class="size-full flex-between-center">
                <n-flex align="center" :size="16" class="pl-4px pt-4px">
                  <n-flex align="center" :size="6">
                    <n-avatar
                      round
                      :size="28"
                      :src="avatarSrc(announcement.uid)"
                      :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
                      :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'" />
                    <n-flex vertical :size="4">
                      <div class="text-(12px [--chat-text-color])">
                        {{ groupStore.getUserInfo(announcement.uid)?.name }}
                      </div>
                      <div class="text-(12px [#909090])">{{ formatTimestamp(announcement?.createTime) }}</div>
                    </n-flex>
                  </n-flex>
                  <div
                    v-if="announcement?.top"
                    class="p-[3px_4px] bg-[#237265] c-#fff rounded-3px text-[10px] flex-center">
                    <span>{{ t('announcement.form.pinned') }}</span>
                  </div>
                </n-flex>

                <n-flex align="center" :size="6">
                  <n-button class="rounded-6px" v-if="isAdmin" @click="handleEdit(announcement)" quaternary size="tiny">
                    <template #icon>
                      <svg class="size-14px">
                        <use href="#edit"></use>
                      </svg>
                    </template>
                  </n-button>
                  <n-popconfirm v-if="isAdmin" v-model:show="announcementStates[announcement.id].showDeleteConfirm">
                    <template #icon>
                      <svg class="size-22px"><use href="#explosion"></use></svg>
                    </template>
                    <template #action>
                      <n-button
                        size="small"
                        tertiary
                        @click.stop="announcementStates[announcement.id].showDeleteConfirm = false">
                        {{ t('announcement.list.delete.cancel') }}
                      </n-button>
                      <n-button
                        size="small"
                        type="error"
                        :loading="announcementStates[announcement.id].deleteLoading"
                        @click="handleDel(announcement)">
                        {{ t('announcement.list.delete.confirm') }}
                      </n-button>
                    </template>
                    <template #trigger>
                      <n-button class="rounded-6px" quaternary size="tiny">
                        <template #icon>
                          <svg class="size-14px">
                            <use href="#delete"></use>
                          </svg>
                        </template>
                      </n-button>
                    </template>
                    {{ t('announcement.list.deleteConfirm') }}
                  </n-popconfirm>
                </n-flex>
              </div>
            </div>
            <div
              class="w-full select-text cursor-auto text-(13px [--text-color]) ws-pre-wrap line-height-tight pt-12px break-words">
              <div
                :class="[
                  'content-wrapper',
                  { 'content-collapsed': !announcement.expanded && needsExpansion(announcement.content) }
                ]">
                <template v-for="(segment, index) in extractLinkSegments(announcement?.content || '')" :key="index">
                  <span v-if="segment.isLink" class="announcement-link" @click.stop="openExternalUrl(segment.text)">
                    {{ segment.text }}
                  </span>
                  <template v-else>{{ segment.text }}</template>
                </template>
              </div>
              <div
                v-if="needsExpansion(announcement.content)"
                class="expand-button"
                @click.stop="toggleExpand(announcement)">
                <span>
                  {{ announcement.expanded ? t('announcement.list.collapse') : t('announcement.list.expand') }}
                </span>
                <svg class="size-12px ml-2px" :class="{ 'rotate-180': announcement.expanded }">
                  <use href="#arrow-down"></use>
                </svg>
              </div>
            </div>
          </div>
        </div>
        <!-- 더 불러오기 -->
        <div v-if="announList.length > 0" class="w-full h-40px flex-center mt-10px">
          <!-- <n-button v-if="!isLast" class="bg-[--button-bg]" @click="handleLoadMore">더 불러오기</n-button> -->
          <img v-if="isLoading" class="size-16px" src="@/assets/img/loading.svg" alt="" />
          <span v-if="isLast && !isLoading" class="text-[12px] color-[#909090]">
            {{ t('announcement.list.noMore') }}
          </span>
        </div>
        <div class="w-full h-40px"></div>
      </n-scrollbar>
    </n-flex>
  </main>
</template>
<script setup lang="ts">
import { emitTo } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import { useRoute } from 'vue-router'
import { ThemeEnum } from '@/enums'
import { useCachedStore } from '@/stores/cached'
import { useGroupStore } from '@/stores/group.ts'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { deleteAnnouncement, editAnnouncement, pushAnnouncement } from '@/utils/ImRequestUtils'
import { extractLinkSegments, openExternalUrl } from '@/hooks/useLinkSegments'
import { useI18n } from 'vue-i18n'

// 반응형 변수 정의
const title = ref('')
const announContent = ref('')
const roomId = ref('')
const $route = useRoute()
const viewType = ref('0')
const announList = ref<any[]>([])
const isBack = ref(false)
const isTop = ref(false)
const isEdit = ref(false)
const editAnnoouncement = ref<any>({})
const announcementAutosize = { minRows: 20 }
// 페이지 매김 매개변수
const pageSize = 10
const pageNum = ref(1)
// 마지막 페이지 도달 여부
const isLast = ref(false)
const isLoading = ref(false)
const announcementStates = ref<Record<string, { showDeleteConfirm: boolean; deleteLoading: boolean }>>({})

// group store 가져오기
const groupStore = useGroupStore()
const cachedStore = useCachedStore()
const userStore = useUserStore()
const settingStore = useSettingStore()
const { t } = useI18n()
const { themes } = storeToRefs(settingStore)
/** 현재 사용자가 id가 6인 배지를 가지고 있고 채널인지 확인 */
const hasBadge6 = computed(() => {
  // roomId가 "1"인 경우에만 배지 판단 (채널)
  if (roomId.value !== '1') return false

  const currentUser = groupStore.getUserInfo(userStore.userInfo!.uid)!
  return currentUser?.itemIds?.includes('6')
})
const isAdmin = computed(() => {
  const LordId = groupStore.currentLordId
  const adminUserTds = groupStore.adminUidList
  const uid = useUserStore().userInfo?.uid
  // uid가 undefined일 수 있으므로 string 타입인지 확인하는 유형 검사 필요
  if (uid && (uid === LordId || adminUserTds.includes(uid) || hasBadge6.value)) {
    return true
  }
  return false
})

watch(
  () => viewType.value,
  (newVal) => {
    if (newVal === '0') {
      title.value = t('announcement.title.create')
    }
  }
)

const avatarSrc = (uid: string) => AvatarUtils.getAvatarUrl(groupStore.getUserInfo(uid)!.avatar as string)

// 초기화 함수, 그룹 공지 목록 가져오기
const handleInit = async () => {
  if (roomId.value) {
    try {
      pageNum.value = 1
      isLast.value = false
      const data = await cachedStore.getGroupAnnouncementList(roomId.value, pageNum.value, pageSize)
      if (data) {
        announList.value = data.records
        if (announList.value.length === 0) {
          viewType.value = '0'
          return
        }

        // 공지의 userName 처리 getUserGroupNickname
        announList.value.forEach((item) => {
          const user = groupStore.getUser(roomId.value, item.uid)
          const fallbackName = item.userName || item.name || ''
          item.userName = user?.myName || user?.name || fallbackName
          // 펼치기/접기 상태 제어 추가
          item.expanded = false
          announcementStates.value[item.id] = {
            showDeleteConfirm: false,
            deleteLoading: false
          }
        })

        // 상단 고정 공지 처리, 고정된 공지를 목록 앞에 배치
        announList.value.sort((a, b) => {
          if (a.top && !b.top) return -1
          if (!a.top && b.top) return 1
          return 0
        })
        pageNum.value++
      }
    } catch (error) {
      console.error('그룹 공지 목록 가져오기 실패:', error)
    }
  }
}

/**
 * 스크롤 이벤트 처리
 * @param event 스크롤 이벤트
 */
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  const isBottom = target.scrollHeight - target.scrollTop === target.clientHeight

  if (isBottom && !isLast.value) {
    handleLoadMore()
  }
}

// 공지 더 불러오기
const handleLoadMore = async () => {
  if (roomId.value && !isLoading.value && !isLast.value) {
    try {
      isLoading.value = true
      const data = await cachedStore.getGroupAnnouncementList(roomId.value, pageNum.value, pageSize)
      if (data) {
        // 데이터가 없으면 마지막 페이지로 표시
        if (!data.records) {
          isLast.value = true
          return
        }

        // 중복 데이터 확인
        const existingIds = new Set(announList.value.map((item) => item.id))
        const newRecords = data.records.filter((newItem: any) => !existingIds.has(newItem.id))

        // 새로 로드된 공지에 펼치기/접기 상태 추가
        newRecords.forEach((item: any) => {
          item.expanded = false
          announcementStates.value[item.id] = {
            showDeleteConfirm: false,
            deleteLoading: false
          }
          // 공지의 userName 처리
          const user = groupStore.getUser(roomId.value, item.uid)
          const fallbackName = item.userName || item.name || ''
          item.userName = user?.myName || user?.name || fallbackName
        })

        // 중복되지 않은 새 데이터를 목록에 추가
        if (newRecords.length > 0) {
          announList.value.push(...newRecords)
          // 누적 로드된 데이터 양이 총계에 도달했는지 확인
          if (announList.value.length >= Number(data.total)) {
            isLast.value = true
            return
          }
          pageNum.value++
        } else if (pageNum.value < Number(data.pages)) {
          // 현재 페이지에 새 데이터가 없지만 아직 마지막 페이지가 아닌 경우 다음 페이지 로드 시도
          pageNum.value++
          handleLoadMore()
          return
        } else {
          isLast.value = true
        }
      }
    } catch (error) {
      console.error('공지 더 불러오기 실패:', error)
    } finally {
      isLoading.value = false
    }
  }
}

// 공지 편집 뷰로 전환
const handleNew = () => {
  announContent.value = ''
  viewType.value = '0'
  isBack.value = true
  isEdit.value = false
  title.value = t('announcement.title.create')
}

// 취소 작업 처리
const handleCancel = () => {
  announContent.value = ''
  if (isBack.value) {
    viewType.value = '1'
    isBack.value = false
    title.value = t('announcement.title.view')
    return
  }
  getCurrentWebviewWindow().close()
}

// 공지 삭제
const handleDel = async (announcement: any) => {
  try {
    announcementStates.value[announcement.id].deleteLoading = true

    // 삭제 요청과 최소 지연 시간 동시 처리
    await Promise.all([deleteAnnouncement({ id: announcement.id }), new Promise((resolve) => setTimeout(resolve, 600))])

    // 해당 공지의 확인 상자 상태 초기화
    announcementStates.value[announcement.id].showDeleteConfirm = false
    announcementStates.value[announcement.id].deleteLoading = false

    // 공지 목록 다시 가져오기
    await handleInit()

    // 새로운 상단 고정 공지 찾기
    let newTopAnnouncement = null
    if (announList.value.length > 0) {
      newTopAnnouncement = announList.value.find((item: any) => item.top)
    }

    // 다른 컴포넌트에 새로고침 메시지 전송
    if (announList.value.length === 0) {
      // 공지가 없으면 비우기 이벤트 전송
      await emitTo('home', 'announcementClear')
    }

    // 어쨌든 최신 상태를 포함하여 업데이트 이벤트 전송
    await emitTo('home', 'announcementUpdated', {
      hasAnnouncements: announList.value.length > 0,
      topAnnouncement: newTopAnnouncement
    })
  } catch (error) {
    console.error('공지 삭제 실패:', error)
    announcementStates.value[announcement.id].deleteLoading = false
  }
}

// 공지 편집
const handleEdit = (announcement: any) => {
  isEdit.value = true
  editAnnoouncement.value = announcement
  announContent.value = announcement.content
  isTop.value = announcement.top
  viewType.value = '0'
  isBack.value = true
  title.value = t('announcement.title.edit')
}

// 공지 내용 검증
const validateAnnouncement = (content: string) => {
  if (content.length < 1) {
    window.$message.error(t('announcement.toast.contentRequired'))
    return false
  }
  if (content.length > 600) {
    window.$message.error(t('announcement.toast.contentTooLong'))
    return false
  }
  return true
}

// 공지 게시
const handlePushAnnouncement = async () => {
  if (!validateAnnouncement(announContent.value)) {
    return
  }

  const apiCall = isEdit.value
    ? () =>
        editAnnouncement({
          id: editAnnoouncement.value.id,
          roomId: roomId.value,
          content: announContent.value,
          top: isTop.value
        })
    : () =>
        pushAnnouncement({
          roomId: roomId.value,
          content: announContent.value,
          top: isTop.value
        })

  const successMessage = isEdit.value ? t('announcement.toast.editSuccess') : t('announcement.toast.createSuccess')
  const errorMessage = isEdit.value ? t('announcement.toast.editFail') : t('announcement.toast.createFail')

  try {
    await apiCall()
    window.$message.success(successMessage)

    // 공지 목록 다시 가져오기
    await handleInit()

    // 새로운 상단 고정 공지 찾기
    let newTopAnnouncement = null
    if (announList.value.length > 0) {
      newTopAnnouncement = announList.value.find((item: any) => item.top)
    }

    info(`home에 업데이트 이벤트 알림 전송: `)
    // 다른 컴포넌트에 업데이트 이벤트 알림 전송
    await emitTo('home', 'announcementUpdated', {
      hasAnnouncements: announList.value.length > 0,
      topAnnouncement: newTopAnnouncement
    })

    if (!isEdit.value) {
      setTimeout(() => {
        getCurrentWebviewWindow().close()
      }, 1000)
    } else {
      viewType.value = '1'
      isBack.value = false
    }
  } catch (error) {
    console.error(errorMessage, error)
    window.$message.error(errorMessage)
  }
}

// 내용 펼치기/접기 제어
const needsExpansion = (content: string) => {
  return content && content.length > 80 // 실제 상황에 따라 조정, 약 200px 텍스트 양
}

// 펼치기/접기 상태 전환
const toggleExpand = (announcement: any) => {
  announcement.expanded = !announcement.expanded
}

// 컴포넌트 마운트 시 초기화 작업 수행
onMounted(async () => {
  try {
    await nextTick()
    roomId.value = $route.params.roomId as string
    viewType.value = $route.params.type as string

    await handleInit()

    setTimeout(async () => {
      const currentWindow = getCurrentWebviewWindow()
      await currentWindow.show()
      await currentWindow.setFocus()
      title.value = await currentWindow.title()
    }, 200)
  } catch (error) {
    console.error('컴포넌트 마운트 초기화 실패:', error)
  }
})
</script>
<style scoped lang="scss">
[v-cloak] {
  display: none;
}

.content-wrapper {
  position: relative;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.content-collapsed {
  max-height: 100px; // 약 200px 표시 높이로 설정
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0));
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0));
}

.expand-button {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 4px;
  color: #13987f;
  cursor: pointer;
  font-size: 12px;

  svg {
    transition: transform 0.3s ease;
  }
}

.announcement-link {
  color: #13987f;
  cursor: pointer;
  word-break: break-all;
  line-height: 2.1rem;

  &:hover {
    opacity: 0.8;
    text-decoration: underline;
  }
}
</style>
