<template>
  <main class="size-full rounded-8px bg-#fff dark:bg-#303030" data-tauri-drag-region>
    <!-- 프로필 섹션 -->
    <div class="flex flex-col h-32vh relative" data-tauri-drag-region>
      <div class="flex h-95% w-full relative" data-tauri-drag-region>
        <ActionBar
          style="position: absolute; top: 8px; right: 16px"
          :shrink="false"
          :max-w="true"
          :icon-color="'white'"
          :top-win-label="WebviewWindow.getCurrent().label"
          :current-label="WebviewWindow.getCurrent().label">
          <div data-tauri-drag-region class="w-fit flex-center gap-16px">
            <div class="cursor-pointer ms-15px" @click="handleInfoTip">
              <n-popover trigger="hover">
                <template #trigger>
                  <n-badge :value="unreadCount" :max="100" :show="unreadCount > 0">
                    <svg class="size-17px color-white">
                      <use href="#remind"></use>
                    </svg>
                  </n-badge>
                </template>
                <span>{{ t('dynamic.list.actions.comment_notice') }}</span>
              </n-popover>
            </div>

            <div class="cursor-pointer" @click="showAddFeedModal = true">
              <n-popover trigger="hover">
                <template #trigger>
                  <svg class="size-22px color-white text-white">
                    <use href="#plus"></use>
                  </svg>
                </template>
                <span>{{ t('dynamic.list.actions.publish') }}</span>
              </n-popover>
            </div>

            <div class="cursor-pointer" @click="handleRefresh">
              <n-popover trigger="hover">
                <template #trigger>
                  <svg class="size-16px color-white"><use href="#refresh"></use></svg>
                </template>
                <span>{{ t('dynamic.list.actions.refresh') }}</span>
              </n-popover>
            </div>
          </div>
        </ActionBar>
        <div data-tauri-drag-region class="size-full flex-center bg-#90909048 dark:bg-[#202020]">
          <!-- TODO: 기본 이미지는 이 형식이며, 동적으로 교체할 경우 다른 형식으로 변경해야 함 -->
          <img data-tauri-drag-region class="size-76% object-contain" src="/hula.png" alt="" />
        </div>
      </div>
      <div data-tauri-drag-region class="flex absolute right-20px bottom-0 gap-15px">
        <div class="text-#fff items-center flex">
          {{ userStore.userInfo?.name }}
        </div>
        <div>
          <n-avatar :size="65" round bordered :src="AvatarUtils.getAvatarUrl(userStore.userInfo!.avatar)" />
        </div>
      </div>
    </div>

    <!-- 게시물 목록 -->
    <div class="flex flex-col items-center h-full mt-15px">
      <n-scrollbar style="max-height: calc(100vh / var(--page-scale, 1) - 272px)" class="w-full">
        <DynamicList
          mode="pc"
          :avatar-size="42"
          item-class="w-full mb-10px px-32px py-10px box-border cursor-pointer"
          :empty-text="t('dynamic.list.empty')"
          :show-loaded-all="false"
          :single-image-size="{ width: '200px', height: '200px' }"
          :grid-image-size="{ width: '136px', height: '136px' }"
          :video-size="{ width: '200px', height: '200px' }"
          grid-max-width="max-width: 420px"
          single-image-class="rounded-4px"
          grid-image-class="rounded-4px"
          video-class="rounded-4px"
          play-icon-size="w-48px h-48px"
          play-icon-inner-size="size-24px"
          @preview-image="previewImage"
          @video-play="handleVideoPlay"
          @load-more="loadMore"
          @item-click="handleItemClick" />
      </n-scrollbar>
    </div>

    <!-- 게시물 추가 팝업 -->
    <n-modal v-model:show="showAddFeedModal" class="w-80vw border-rd-8px">
      <div class="bg-[--bg-popover] p-20px box-border flex flex-col">
        <div class="flex justify-between items-center mb-20px">
          <h3 class="text-18px font-bold text-[--text-color]">{{ t('dynamic.list.modal.add_title') }}</h3>
          <n-button text @click="handleCloseModal">
            <template #icon>
              <n-icon>
                <svg class="size-16px">
                  <use href="#close"></use>
                </svg>
              </n-icon>
            </template>
          </n-button>
        </div>

        <!-- 게시물 내용 입력 -->
        <n-input
          v-model:value="newFeedContent"
          type="textarea"
          :placeholder="t('dynamic.list.modal.content_placeholder')"
          :rows="6"
          :maxlength="500"
          show-count
          class="mb-15px" />

        <!-- 권한 선택 -->
        <div class="mb-15px">
          <p class="text-14px text-[--text-color] mb-10px">{{ t('dynamic.list.modal.visibility_label') }}</p>
          <n-select
            v-model:value="permission"
            :options="permissionOptions"
            :placeholder="t('dynamic.list.modal.visibility_placeholder')"
            @update:value="handlePermissionChange" />
        </div>

        <!-- 사용자 목록 선택 -->
        <div v-if="permission === 'partVisible' || permission === 'notAnyone'" class="mb-15px">
          <p class="text-14px text-[--text-color] mb-10px">
            {{
              permission === 'partVisible'
                ? t('dynamic.list.modal.select_visible')
                : t('dynamic.list.modal.select_hidden')
            }}
          </p>
          <n-button @click="showUserSelectModal = true" size="small">
            {{ t('dynamic.list.modal.selected_count', { count: selectedUsers.length }) }}
          </n-button>
          <div v-if="enrichedSelectedUsers.length > 0" class="mt-10px">
            <n-tag
              v-for="user in enrichedSelectedUsers"
              :key="user.uid"
              closable
              @close="removeSelectedUser(user.uid)"
              class="mr-5px mb-5px">
              {{ user.name }}
            </n-tag>
          </div>
        </div>

        <!-- 작업 버튼 -->
        <n-flex justify="end" :size="10">
          <n-button @click="handleCloseModal">{{ t('dynamic.list.buttons.cancel') }}</n-button>
          <n-button type="primary" :loading="isPublishing" :disabled="!isPublishValid" @click="handlePublishFeed">
            {{ t('dynamic.list.buttons.publish') }}
          </n-button>
        </n-flex>
      </div>
    </n-modal>

    <!-- 사용자 선택 팝업 -->
    <n-modal v-model:show="showUserSelectModal" class="w-75vw border-rd-8px">
      <div class="bg-[--bg-popover] p-20px box-border flex flex-col">
        <div class="flex justify-between items-center mb-20px">
          <h3 class="text-16px font-bold text-[--text-color]">{{ t('dynamic.list.modal.user_modal_title') }}</h3>
          <n-button text @click="showUserSelectModal = false">
            <template #icon>
              <n-icon>
                <svg class="size-16px">
                  <use href="#close"></use>
                </svg>
              </n-icon>
            </template>
          </n-button>
        </div>

        <!-- 검색창 -->
        <n-input
          v-model:value="userSearchKeyword"
          :placeholder="t('dynamic.list.modal.user_search_placeholder')"
          class="mb-15px"
          clearable>
          <template #prefix>
            <n-icon>
              <svg>
                <use href="#search"></use>
              </svg>
            </n-icon>
          </template>
        </n-input>

        <!-- 사용자 목록 -->
        <n-scrollbar style="max-height: 400px">
          <n-checkbox-group v-model:value="selectedUserIds">
            <n-flex vertical :size="8">
              <div
                v-for="user in filteredContactsList"
                :key="user.uid"
                class="user-item p-10px rounded-6px hover:bg-[--hover-color]">
                <n-checkbox :value="user.uid" class="w-full">
                  <n-flex align="center" :size="10">
                    <n-avatar
                      :size="36"
                      round
                      :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(user.uid)?.avatar || '')" />
                    <div>
                      <p class="text-14px font-medium text-[--text-color]">
                        {{ groupStore.getUserInfo(user.uid)?.name || user.remark || user.uid }}
                      </p>
                      <p class="text-12px text-gray-500">{{ user.uid }}</p>
                    </div>
                  </n-flex>
                </n-checkbox>
              </div>
            </n-flex>
          </n-checkbox-group>
        </n-scrollbar>

        <!-- 확인 버튼 -->
        <n-flex justify="end" :size="10" class="mt-15px">
          <n-button @click="showUserSelectModal = false">{{ t('dynamic.list.buttons.cancel') }}</n-button>
          <n-button type="primary" @click="confirmUserSelection">
            {{ t('dynamic.list.buttons.confirm_with_count', { count: selectedUserIds.length }) }}
          </n-button>
        </n-flex>
      </div>
    </n-modal>

    <!-- 댓글 알림 팝업 - 원격으로 푸시된 댓글 기록만 표시 -->
    <n-modal v-model:show="showCommentModal" class="w-75vw border-rd-8px">
      <div class="bg-[--bg-popover] h-full p-6px box-border flex flex-col">
        <div class="flex justify-between items-center mb-15px">
          <h3 class="text-16px font-bold">{{ t('dynamic.list.modal.comment_notice_title') }}</h3>
          <n-button text @click="showCommentModal = false">
            <template #icon>
              <n-icon>
                <use href="#close"></use>
              </n-icon>
            </template>
          </n-button>
        </div>

        <!-- 댓글 목록 -->
        <n-scrollbar style="max-height: 500px">
          <div v-if="currentComments.length === 0" class="text-center text-gray-500 py-40px">
            <div class="text-16px mb-10px">{{ t('dynamic.list.modal.comment_notice_empty_title') }}</div>
            <div class="text-12px">{{ t('dynamic.list.modal.comment_notice_empty_desc') }}</div>
          </div>
          <div v-else>
            <n-flex
              vertical
              v-for="comment in currentComments"
              :key="comment.id"
              class="p-12px border-b border-[--line-color] hover:bg-[--hover-color] transition-colors">
              <n-flex align="center">
                <n-avatar :size="36" round :src="AvatarUtils.getAvatarUrl(comment.userAvatar)" />
                <div class="ml-10px flex-1">
                  <p class="text-14px font-medium">{{ comment.userName }}</p>
                  <p class="text-12px text-gray-500">{{ formatTime(comment.createTime) }}</p>
                </div>
              </n-flex>
              <p class="text-14px mt-8px text-[--text-color] break-words">{{ comment.content }}</p>
            </n-flex>
          </div>
        </n-scrollbar>
      </div>
    </n-modal>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useUserStore } from '@/stores/user.ts'
import { useContactStore } from '@/stores/contacts.ts'
import { useFeedStore } from '@/stores/feed.ts'
import { useGroupStore } from '@/stores/group.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime'
import type { FriendItem } from '@/services/types'
import { storeToRefs } from 'pinia'
import DynamicList from '@/components/common/DynamicList.vue'
import { useWindow } from '@/hooks/useWindow'

const { createWebviewWindow, sendWindowPayload, checkWinExist } = useWindow()
const { t } = useI18n()
const userStore = useUserStore()
const contactStore = useContactStore()
const feedStore = useFeedStore()
const groupStore = useGroupStore()

const { unreadCount } = storeToRefs(feedStore)

const showCommentModal = ref(false)
const currentComments = ref<CommentItem[]>([])

// 게시물 추가 관련 상태
const showAddFeedModal = ref(false)
const newFeedContent = ref('')
const isPublishing = ref(false)

// 미디어 타입: 순수 텍스트로 고정
const mediaType = ref(0)

// 권한 설정
const permission = ref<'open' | 'partVisible' | 'notAnyone'>('open')
const permissionOptions = computed(() => [
  { label: t('dynamic.list.permission.open'), value: 'open' },
  { label: t('dynamic.list.permission.part_visible'), value: 'partVisible' },
  { label: t('dynamic.list.permission.not_anyone'), value: 'notAnyone' }
])

// 사용자 선택 관련
const showUserSelectModal = ref(false)
const selectedUserIds = ref<string[]>([])
const selectedUsers = ref<FriendItem[]>([])
const userSearchKeyword = ref('')

// const titleList = computed(() => [
//   {
//     label: '动态',
//     total: feedStats.value.total
//   },
//   {
//     label: '关注',
//     total: feedStats.value.followCount
//   },
//   {
//     label: '粉丝',
//     total: feedStats.value.fansCount
//   }
// ])

interface CommentItem {
  id: string
  content: string
  createTime: number
  userName: string
  userAvatar: string
}

// 게시물 내용 유효성 검사 (텍스트 내용만 검증)
const isPublishValid = computed(() => {
  return newFeedContent.value.trim().length > 0
})

// 필터링된 연락처 목록 (uid가 1인 친구 제외)
const filteredContactsList = computed(() => {
  // uid가 1인 친구 먼저 필터링
  const validContacts = contactStore.contactsList.filter((user) => user.uid !== '1')

  if (!userSearchKeyword.value.trim()) {
    return validContacts
  }
  const keyword = userSearchKeyword.value.toLowerCase()
  return validContacts.filter((user) => {
    const userInfo = groupStore.getUserInfo(user.uid)
    const name = userInfo?.name || user.remark || user.uid || ''
    return name.toLowerCase().includes(keyword) || user.uid.toLowerCase().includes(keyword)
  })
})

// selectedUsers 데이터 보강, name 속성 추가
const enrichedSelectedUsers = computed(() => {
  return selectedUsers.value.map((user) => {
    const userInfo = groupStore.getUserInfo(user.uid)
    return {
      ...user,
      name: userInfo?.name || user.remark || user.uid || t('dynamic.common.unknown_user')
    }
  })
})

// 시간 표시 형식 지정 (댓글 팝업 사용) - 프로젝트 통일 시간 포맷 함수 사용
const formatTime = (timestamp: number) => {
  return formatTimestamp(timestamp)
}

/**
 * 타임라인 더 불러오기
 */
const loadMore = async () => {
  await feedStore.loadMore()
}

// 이미지 미리보기
const previewImage = (images: string[], index: number) => {
  // 이미지 미리보기 로직 구현
  console.log('이미지 미리보기:', images, index)
}

// 동영상 재생
const handleVideoPlay = (url: string) => {
  // 동영상 재생 로직 구현
  console.log('동영상 재생:', url)
}

// 정보 팁 처리
const handleInfoTip = () => {
  showCommentModal.value = true
}

// 새로고침 처리
const handleRefresh = async () => {
  try {
    await feedStore.refresh()
    // 새로고침 후 읽지 않은 수 초기화
    feedStore.clearUnreadCount()
    window.$message.success(t('dynamic.messages.refresh_success'))
  } catch (error) {
    console.error('게시물 새로고침 실패:', error)
    window.$message.error(t('dynamic.messages.refresh_fail'))
  }
}

// 게시물 항목 클릭 처리 - 새 창에서 열기
const handleItemClick = async (feedId: string) => {
  const windowLabel = `dynamicDetail`

  // 윈도우가 이미 존재하는지 먼저 확인
  const existingWindow = await WebviewWindow.getByLabel(windowLabel)
  if (existingWindow) {
    // 윈도우가 이미 존재하면 활성화하고 내용 업데이트
    await checkWinExist(windowLabel)
    // 윈도우 내용 업데이트 이벤트 전송
    await existingWindow.emit('window-payload-updated', { feedId })
    return
  }

  // 게시물 상세 내용을 표시할 새 webview 윈도우 생성
  const webview = await createWebviewWindow(
    t('dynamic.page.detail.title'), // 윈도우 제목
    windowLabel, // 윈도우 라벨
    800, // 너비
    900, // 높이
    undefined, // 다른 윈도우 닫지 않음
    true, // 크기 조절 가능
    600, // 최소 너비
    700, // 최소 높이
    false, // 투명하지 않음
    false // 초기 표시 안 함 (로딩 완료 대기)
  )

  // 윈도우 생성 후 payload 전송
  if (webview) {
    await sendWindowPayload(windowLabel, { feedId })
  }
}

// 권한 선택 관련 메서드
const handlePermissionChange = (value: string) => {
  // 공개로 전환 시 선택된 사용자 초기화
  if (value === 'open') {
    selectedUserIds.value = []
    selectedUsers.value = []
  }
}

// 사용자 선택 관련 메서드
const confirmUserSelection = () => {
  // 선택된 사용자 목록 업데이트
  selectedUsers.value = contactStore.contactsList.filter((user) => selectedUserIds.value.includes(user.uid))
  showUserSelectModal.value = false
}

const removeSelectedUser = (uid: string) => {
  const index = selectedUserIds.value.indexOf(uid)
  if (index > -1) {
    selectedUserIds.value.splice(index, 1)
  }
  selectedUsers.value = selectedUsers.value.filter((user) => user.uid !== uid)
}

// 팝업 닫기
const handleCloseModal = () => {
  showAddFeedModal.value = false
  resetAddFeedForm()
}

// 게시물 추가 폼 초기화
const resetAddFeedForm = () => {
  newFeedContent.value = ''
  mediaType.value = 0
  permission.value = 'open'
  selectedUserIds.value = []
  selectedUsers.value = []
  userSearchKeyword.value = ''
}

// 게시물 게시
const handlePublishFeed = async () => {
  // 내용 검증
  if (!newFeedContent.value.trim()) {
    window.$message.warning(t('dynamic.messages.publish_empty'))
    return
  }

  // 권한 설정 검증
  if ((permission.value === 'partVisible' || permission.value === 'notAnyone') && selectedUsers.value.length === 0) {
    window.$message.warning(
      permission.value === 'partVisible'
        ? t('dynamic.messages.publish_select_visible')
        : t('dynamic.messages.publish_select_hidden')
    )
    return
  }

  isPublishing.value = true

  try {
    const feedData: any = {
      uid: userStore.userInfo?.uid, // 게시자 id
      content: newFeedContent.value,
      mediaType: mediaType.value, // 0으로 고정 (순수 텍스트)
      permission: permission.value
    }

    // 권한 제한 사용자 ID 목록 추가
    if (permission.value === 'partVisible' || permission.value === 'notAnyone') {
      feedData.uidList = selectedUsers.value.map((user) => Number(user.uid))
    }

    // 게시 인터페이스 호출
    const response = await feedStore.publishFeed(feedData)

    // 백엔드에서 생성된 타임라인 ID 반환
    console.log('게시 성공, 반환 데이터:', response)

    window.$message.success(t('dynamic.messages.publish_success'))

    // 팝업 닫기
    showAddFeedModal.value = false

    // 폼 초기화
    resetAddFeedForm()
  } catch (error) {
    console.error('게시물 게시 실패:', error)
    window.$message.error(t('dynamic.messages.publish_fail'))
  } finally {
    isPublishing.value = false
  }
}

// 데이터 초기화
onMounted(async () => {
  // 타임라인 목록 초기 로드
  await feedStore.getFeedList(true)

  // 타임라인 열 때 읽지 않은 수 초기화
  feedStore.clearUnreadCount()

  // 연락처 목록 로드
  try {
    await contactStore.getContactList(true)
  } catch (error) {
    console.error('연락처 목록 로드 실패:', error)
  }

  // 윈도우 표시
  const currentWindow = WebviewWindow.getCurrent()
  if (currentWindow) {
    await currentWindow.show()
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';

.mac-close:hover {
  svg {
    display: block;
  }
}

.custom-shadow {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

// 사용자 선택 항목 스타일
.user-item {
  transition: all 0.3s;

  &:hover {
    background: var(--hover-color);
  }
}

// 반응형 디자인
@media (max-width: 768px) {
  .login-box {
    height: 120px;

    .n-avatar {
      width: 80px;
      height: 80px;
    }
  }
}
</style>
