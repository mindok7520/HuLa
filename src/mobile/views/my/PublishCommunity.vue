<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white"
        style="border-bottom: 1px solid; border-color: #dfdfdf"
        :hidden-right="true"
        room-name="새 게시물 작성" />
    </template>

    <template #container>
      <div class="flex flex-col gap-1 overflow-auto h-full bg-#f5f5f5">
        <div class="flex flex-col p-16px gap-12px">
          <!-- 게시물 내용 입력 -->
          <div class="bg-white rounded-12px p-16px">
            <div class="text-14px text-#333 mb-8px font-500">게시물 내용</div>
            <van-field
              v-model="feedContent"
              type="textarea"
              placeholder="마음껏 일상을 공유해보세요~😎"
              :maxlength="500"
              show-word-limit
              :rows="8"
              :autosize="feedAutosize" />
          </div>

          <!-- 미디어 유형 팁 (일시적 비활성화) -->
          <div class="bg-white rounded-12px p-16px">
            <div class="text-14px text-#333 mb-8px font-500">미디어 유형</div>
            <div class="text-13px text-#999">
              <div class="flex items-center gap-8px mb-6px">
                <span class="text-#c8c9cc">📷</span>
                <span class="text-#c8c9cc">사진/글 (미개방)</span>
              </div>
              <div class="flex items-center gap-8px">
                <span class="text-#c8c9cc">🎬</span>
                <span class="text-#c8c9cc">동영상 (미개방)</span>
              </div>
            </div>
          </div>

          <!-- 권한 선택 -->
          <div class="bg-white rounded-12px p-16px">
            <div class="text-14px text-#333 mb-12px font-500">공개 설정</div>
            <van-radio-group v-model="permission" direction="vertical" @change="handlePermissionChange">
              <van-radio name="open" icon-size="18px" class="mb-12px">
                <template #icon="props">
                  <div
                    :class="[
                      'w-20px h-20px rounded-full border-2 flex items-center justify-center transition-all',
                      props.checked ? 'border-#13987f bg-#13987f' : 'border-#c8c9cc'
                    ]">
                    <div v-if="props.checked" class="w-8px h-8px rounded-full bg-white"></div>
                  </div>
                </template>
                <span class="ml-8px text-14px">전체 공개</span>
              </van-radio>
              <van-radio name="partVisible" icon-size="18px" class="mb-12px">
                <template #icon="props">
                  <div
                    :class="[
                      'w-20px h-20px rounded-full border-2 flex items-center justify-center transition-all',
                      props.checked ? 'border-#13987f bg-#13987f' : 'border-#c8c9cc'
                    ]">
                    <div v-if="props.checked" class="w-8px h-8px rounded-full bg-white"></div>
                  </div>
                </template>
                <span class="ml-8px text-14px">일부 공개</span>
              </van-radio>
              <van-radio name="notAnyone" icon-size="18px">
                <template #icon="props">
                  <div
                    :class="[
                      'w-20px h-20px rounded-full border-2 flex items-center justify-center transition-all',
                      props.checked ? 'border-#13987f bg-#13987f' : 'border-#c8c9cc'
                    ]">
                    <div v-if="props.checked" class="w-8px h-8px rounded-full bg-white"></div>
                  </div>
                </template>
                <span class="ml-8px text-14px">비공개 대상</span>
              </van-radio>
            </van-radio-group>
          </div>

          <!-- 사용자 선택 -->
          <div v-if="permission === 'partVisible' || permission === 'notAnyone'" class="bg-white rounded-12px p-16px">
            <div class="text-14px text-#333 mb-12px font-500">
              {{ permission === 'partVisible' ? '공개 대상 선택' : '비공개 대상 선택' }}
            </div>
            <van-button
              type="primary"
              size="small"
              plain
              @click="showUserSelectPopup = true"
              class="w-full"
              :style="{ borderColor: '#13987f', color: '#13987f' }">
              사용자 선택 ({{ selectedUsers.length }}명 선택됨)
            </van-button>
            <div v-if="selectedUsers.length > 0" class="mt-12px flex flex-wrap gap-8px">
              <van-tag
                v-for="user in selectedUsers"
                :key="user.uid"
                closeable
                size="medium"
                color="#e8f5f4"
                text-color="#13987f"
                @close="removeSelectedUser(user.uid)">
                {{ getUserName(user) }}
              </van-tag>
            </div>
          </div>

          <!-- 게시 버튼 -->
          <div class="flex gap-12px mt-8px pb-20px">
            <van-button block plain @click="goBack" :style="{ borderColor: '#c8c9cc', color: '#666' }">취소</van-button>
            <van-button
              block
              type="primary"
              :loading="isPublishing"
              :disabled="!isPublishValid"
              @click="handlePublish"
              :style="{ background: '#13987f', borderColor: '#13987f' }">
              게시
            </van-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>

  <!-- 사용자 선택 팝업 -->
  <van-popup v-model:show="showUserSelectPopup" position="bottom" :style="{ height: '70%' }" round>
    <div class="flex flex-col h-full">
      <!-- 팝업 제목 -->
      <div class="flex items-center justify-between p-16px border-b border-#eee">
        <span class="text-16px font-500 text-#333">사용자 선택</span>
        <van-button type="primary" size="small" @click="confirmUserSelection" :style="{ background: '#13987f' }">
          확인
        </van-button>
      </div>

      <!-- 검색창 -->
      <div class="p-12px border-b border-#f5f5f5">
        <van-search v-model="userSearchKeyword" placeholder="사용자 검색" shape="round" />
      </div>

      <!-- 사용자 목록 -->
      <div class="flex-1 overflow-y-auto">
        <van-checkbox-group v-model="selectedUserIds">
          <van-cell-group>
            <van-cell
              v-for="user in filteredContactsList"
              :key="user.uid"
              clickable
              @click="toggleUser(user.uid)"
              class="user-item">
              <template #title>
                <div class="flex items-center gap-12px">
                  <van-image
                    :src="getUserAvatar(user)"
                    round
                    width="40"
                    height="40"
                    fit="cover"
                    :style="{ flexShrink: 0 }" />
                  <div class="flex-1 min-w-0">
                    <div class="text-14px text-#333 font-500 truncate">
                      {{ getUserName(user) }}
                    </div>
                    <div v-if="user.remark" class="text-12px text-#999 truncate mt-2px">{{ user.remark }}</div>
                  </div>
                </div>
              </template>
              <template #right-icon>
                <van-checkbox :name="user.uid" @click.stop ref="checkboxes" />
              </template>
            </van-cell>
          </van-cell-group>
        </van-checkbox-group>

        <!-- 빈 상태 -->
        <van-empty v-if="filteredContactsList.length === 0" description="연락처 없음" />
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useFeedStore } from '@/stores/feed'
import { useContactStore } from '@/stores/contacts'
import { useGroupStore } from '@/stores/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import type { FriendItem } from '@/services/types'
import 'vant/lib/index.css' // Vant UI 样式

const router = useRouter()
const feedAutosize = { minHeight: 150, maxHeight: 300 }
const feedStore = useFeedStore()
const contactStore = useContactStore()
const groupStore = useGroupStore()

// 반응형 데이터
const feedContent = ref('')
const isPublishing = ref(false)

// 권한 관련
const permission = ref<'open' | 'partVisible' | 'notAnyone'>('open')
const showUserSelectPopup = ref(false)
const selectedUserIds = ref<string[]>([])
const selectedUsers = ref<FriendItem[]>([])
const userSearchKeyword = ref('')

// 필터링된 연락처 목록
const filteredContactsList = computed(() => {
  // uid가 1인 친구 필터링
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

// 사용자 프로필 사진 가져오기
const getUserAvatar = (user: FriendItem) => {
  const userInfo = groupStore.getUserInfo(user.uid)
  return AvatarUtils.getAvatarUrl(userInfo?.avatar || '')
}

// 사용자 이름 가져오기
const getUserName = (user: FriendItem) => {
  const userInfo = groupStore.getUserInfo(user.uid)
  return userInfo?.name || user.remark || user.uid || '알 수 없는 사용자'
}

// 게시 내용 유효성 검사
const isPublishValid = computed(() => {
  // 내용이 비어있지 않은지만 검사
  return feedContent.value.trim().length > 0
})

// 권한 변경 처리
const handlePermissionChange = (value: string) => {
  // 전체 공개로 전환 시 선택된 사용자 초기화
  if (value === 'open') {
    selectedUserIds.value = []
    selectedUsers.value = []
  }
}

// 사용자 선택 전환
const toggleUser = (uid: string) => {
  const index = selectedUserIds.value.indexOf(uid)
  if (index > -1) {
    selectedUserIds.value.splice(index, 1)
  } else {
    selectedUserIds.value.push(uid)
  }
}

// 사용자 선택 확인
const confirmUserSelection = () => {
  // 선택된 사용자 목록 업데이트
  selectedUsers.value = contactStore.contactsList.filter((user) => selectedUserIds.value.includes(user.uid))
  showUserSelectPopup.value = false
}

// 선택된 사용자 제거
const removeSelectedUser = (uid: string) => {
  const index = selectedUserIds.value.indexOf(uid)
  if (index > -1) {
    selectedUserIds.value.splice(index, 1)
  }
  selectedUsers.value = selectedUsers.value.filter((user) => user.uid !== uid)
}

// 이전 페이지로 복귀
const goBack = () => {
  router.back()
}

// 게시물 게시
const handlePublish = async () => {
  // 내용 검증
  if (!feedContent.value.trim()) {
    showToast('게시물 내용을 입력해주세요')
    return
  }

  // 권한 설정 검증
  if ((permission.value === 'partVisible' || permission.value === 'notAnyone') && selectedUsers.value.length === 0) {
    showToast(`${permission.value === 'partVisible' ? '공개' : '비공개'} 대상을 선택해주세요`)
    return
  }

  isPublishing.value = true

  try {
    const feedData: any = {
      content: feedContent.value.trim(),
      mediaType: 0, // 텍스트
      permission: permission.value
    }

    // 권한 제한 사용자 ID 목록 추가
    if (permission.value === 'partVisible' || permission.value === 'notAnyone') {
      feedData.uidList = selectedUsers.value.map((user) => Number(user.uid))
    }

    // store 게시 메서드 호출, 목록 자동 새로고침
    await feedStore.publishFeed(feedData)

    showToast('게시 성공!')

    // 이전 페이지로 복귀
    router.back()
  } catch (error) {
    console.error('게시물 게시 실패:', error)
    showToast('게시 실패, 잠시 후 다시 시도해주세요')
  } finally {
    isPublishing.value = false
  }
}

// 초기화
onMounted(async () => {
  // 연락처 목록 로드
  try {
    await contactStore.getContactList(true)
  } catch (error) {
    console.error('연락처 목록 로드 실패:', error)
  }
})
</script>

<style scoped>
.user-item {
  transition: background-color 0.2s;
}

.user-item:active {
  background-color: #f5f5f5;
}
</style>
