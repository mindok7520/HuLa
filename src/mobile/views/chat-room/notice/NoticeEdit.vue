<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white"
        style="border-bottom: 1px solid; border-color: #dfdfdf"
        :hidden-right="true"
        :room-name="isEditMode ? '그룹 공지 편집' : '그룹 공지 추가'" />
    </template>

    <template #container>
      <div
        class="bg-[url('@/assets/mobile/chat-home/background.webp')] bg-cover bg-center flex flex-col overflow-auto h-full">
        <div class="flex flex-col flex-1 gap-20px py-15px px-20px">
          <!-- 공지 내용 편집 영역 -->
          <div class="bg-white rounded-15px p-15px shadow">
            <n-form label-placement="top" size="medium">
              <n-form-item label="공지 내용" required>
                <n-input
                  v-model:value="announcementContent"
                  type="textarea"
                  placeholder="공지 내용을 입력하세요..."
                  class="w-full"
                  :autosize="announcementAutosize"
                  :maxlength="1000"
                  :show-count="true" />
              </n-form-item>

              <n-form-item label="이미지 업로드 (미지원)">
                <div class="upload-image-container">
                  <n-upload
                    action="https://www.mocky.io/v2/5e4bafc63100007100d8b70f"
                    list-type="image-card"
                    :max="4"
                    disabled>
                    <div class="upload-trigger">
                      <svg class="size-24px text-#999">
                        <use href="#plus"></use>
                      </svg>
                      <span class="text-12px text-#999 mt-5px">클릭하여 업로드</span>
                    </div>
                  </n-upload>
                </div>
              </n-form-item>
            </n-form>
          </div>

          <!-- 상단 고정 설정 영역 -->
          <div class="bg-white rounded-15px shadow">
            <div class="flex flex-col w-full">
              <div class="flex justify-between py-15px px-15px items-center border-b border-gray-200">
                <div class="flex flex-col">
                  <div class="text-14px font-medium">상단 고정 설정</div>
                  <div class="text-12px text-gray-500 mt-5px">공지가 그룹 공지 목록 상단에 고정됩니다</div>
                </div>
                <n-switch v-model:value="top" />
              </div>
            </div>
          </div>

          <!-- 작업 버튼 -->
          <div class="flex justify-center gap-15px">
            <n-button type="default" class="w-40%" size="large" @click="handleCancel">취소</n-button>
            <n-button type="primary" class="w-40%" size="large" @click="handleSubmit" :loading="submitting">
              저장
            </n-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useGlobalStore } from '@/stores/global'
import { getAnnouncementDetail, editAnnouncement, pushAnnouncement } from '@/utils/ImRequestUtils'

defineOptions({
  name: 'mobileChatNoticeEdit'
})

const route = useRoute()
const router = useRouter()
const globalStore = useGlobalStore()
const announcementAutosize = { minRows: 5, maxRows: 10 }

// 편집 모드인지 추가 모드인지 확인
const isEditMode = computed(() => !!route.params.id)

// 공지 내용
const announcementContent = ref('')
const top = ref(false)
const submitting = ref(false)

// 공지 상세 정보 로드
const loadAnnouncementDetail = async () => {
  // 추가 모드인 경우 상세 정보 로드 불필요
  if (!isEditMode.value) {
    return
  }

  try {
    const data = await getAnnouncementDetail({
      roomId: globalStore.currentSessionRoomId,
      announcementId: route.params.id as string
    })

    // 폼 데이터 채우기
    announcementContent.value = data.content
    top.value = data.top || false
    console.log('announcementContent ', announcementContent)
  } catch (error) {
    console.error('공지 상세 정보 로드 실패:', error)
  }
}

// 취소 처리
const handleCancel = () => {
  router.back()
}

// 제출 처리
const handleSubmit = async () => {
  // 간단 검증
  if (!announcementContent.value.trim()) {
    window.$message?.error('공지 내용을 입력하세요')
    return
  }

  submitting.value = true

  try {
    if (isEditMode.value) {
      // 편집 모드
      const announcementData = {
        id: route.params.id as string,
        roomId: (route.query.roomId as string) || globalStore.currentSessionRoomId,
        content: announcementContent.value,
        top: top.value
      }

      await editAnnouncement(announcementData)
      window.$message?.success('공지 수정 성공')
      router.push({
        path: `/mobile/chatRoom/notice/detail/${announcementData.id}`
      })
    } else {
      // 추가 모드
      const announcementData = {
        roomId: (route.query.roomId as string) || globalStore.currentSessionRoomId,
        content: announcementContent.value,
        top: top.value
      }

      await pushAnnouncement(announcementData)
      window.$message?.success('공지 게시 성공')
      router.back()
    }
  } catch (error) {
    console.error('공지 저장 실패:', error)
    window.$message?.error('공지 저장 실패, 다시 시도해주세요')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadAnnouncementDetail()
})
</script>

<style scoped>
/* 버튼 스타일 최적화 */
.n-button {
  border-radius: 30px;
  font-weight: 500;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
}

.n-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.n-button--primary {
  background: linear-gradient(145deg, #7eb7ac, #6fb0a4, #5fa89c);
  border: none;
}

/* 이미지 업로드 컴포넌트 스타일 최적화 */
.upload-image-container {
  width: 100%;
}

.upload-image-container :deep(.n-upload) {
  width: 100%;
}

.upload-image-container :deep(.n-upload-trigger) {
  width: 100px;
  height: 100px;
}

.upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  background-color: #fafafa;
  cursor: not-allowed;
}

.upload-image-container :deep(.n-upload-file-list) {
  display: grid;
  grid-template-columns: repeat(auto-fill, 100px);
  gap: 10px;
}
</style>
