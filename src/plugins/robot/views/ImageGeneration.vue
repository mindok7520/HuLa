<template>
  <main class="image-generation-container">
    <div class="content-area">
      <!-- 헤더 -->
      <div data-tauri-drag-region class="header flex p-[8px_16px_10px_16px] justify-between items-center">
        <n-flex :size="10" vertical>
          <p class="leading-6 text-(18px [--chat-text-color]) font-500">AI 이미지 생성</p>
          <p class="text-(11px #707070)">총 {{ totalImages }}장의 이미지 생성됨</p>
        </n-flex>
      </div>

      <!-- 생성 영역 -->
      <div class="generation-area p-16px">
        <n-card title="이미지 생성" :bordered="false" class="mb-16px">
          <n-form ref="formRef" :model="formData" label-placement="left" label-width="80">
            <!-- 모델 선택 -->
            <n-form-item label="모델 선택" path="modelId">
              <n-select
                v-model:value="formData.modelId"
                :options="modelOptions"
                placeholder="이미지 생성 모델을 선택하세요"
                filterable
                @update:value="handleModelChange" />
            </n-form-item>

            <!-- 프롬프트 입력 -->
            <n-form-item label="프롬프트" path="prompt">
              <n-input
                v-model:value="formData.prompt"
                type="textarea"
                placeholder="이미지 설명을 입력하세요. 예: 정원에서 노는 귀여운 고양이"
                :autosize="promptAutosize"
                maxlength="2000"
                show-count />
            </n-form-item>

            <n-form-item label="이미지 크기">
              <n-flex :size="12">
                <n-input-number
                  v-model:value="formData.width"
                  placeholder="너비"
                  :min="256"
                  :max="2048"
                  :step="64"
                  style="width: 120px" />
                <span class="text-14px text-#909090">×</span>
                <n-input-number
                  v-model:value="formData.height"
                  placeholder="높이"
                  :min="256"
                  :max="2048"
                  :step="64"
                  style="width: 120px" />
              </n-flex>
            </n-form-item>

            <n-form-item>
              <n-button
                type="primary"
                :loading="isGenerating"
                :disabled="!formData.modelId || !formData.prompt"
                @click="handleGenerate">
                {{ isGenerating ? '생성 중...' : '생성 시작' }}
              </n-button>
            </n-form-item>
          </n-form>
        </n-card>

        <!-- 이미지 표시 영역 -->
        <n-card title="생성 기록" :bordered="false">
          <n-spin :show="isLoading">
            <div v-if="imageList.length > 0" class="image-grid">
              <div v-for="image in imageList" :key="image.id" class="image-item">
                <div class="image-wrapper">
                  <!-- 상태 태그 -->
                  <n-tag v-if="image.status === 10" class="status-tag" type="info" size="small" :bordered="false">
                    생성 중
                  </n-tag>
                  <n-tag v-else-if="image.status === 30" class="status-tag" type="error" size="small" :bordered="false">
                    실패
                  </n-tag>

                  <!-- 이미지 -->
                  <img
                    v-if="image.status === 20 && image.picUrl"
                    :src="image.picUrl"
                    :alt="image.prompt"
                    class="image"
                    @click="handlePreview(image)" />
                  <div v-else-if="image.status === 10" class="image-placeholder">
                    <n-spin size="large" />
                  </div>
                  <div v-else-if="image.status === 30" class="image-placeholder error">
                    <Icon icon="mdi:alert-circle-outline" class="text-48px text-#d5304f" />
                    <p class="text-12px text-#d5304f mt-8px">{{ image.errorMessage || '생성 실패' }}</p>
                  </div>
                </div>

                <!-- 이미지 정보 -->
                <div class="image-info">
                  <p class="prompt" :title="image.prompt">{{ image.prompt }}</p>
                  <n-flex justify="space-between" align="center" class="mt-8px">
                    <span class="text-11px text-#909090">{{ formatTime(image.createTime) }}</span>
                    <n-flex :size="8">
                      <n-button v-if="image.status === 20" text size="small" @click="handleDownload(image)">
                        <template #icon>
                          <Icon icon="mdi:download" />
                        </template>
                      </n-button>
                      <n-popconfirm @positive-click="handleDelete(image.id)">
                        <template #trigger>
                          <n-button text size="small" type="error">
                            <template #icon>
                              <Icon icon="mdi:delete" />
                            </template>
                          </n-button>
                        </template>
                        이 이미지를 삭제하시겠습니까?
                      </n-popconfirm>
                    </n-flex>
                  </n-flex>
                </div>
              </div>
            </div>
            <n-empty v-else description="생성 기록 없음" class="py-40px" />
          </n-spin>

          <!-- 페이지네이션 -->
          <n-flex justify="center" class="mt-16px" v-if="totalImages > pageSize">
            <n-pagination
              v-model:page="pageNo"
              :page-count="Math.ceil(totalImages / pageSize)"
              :page-size="pageSize"
              show-size-picker
              :page-sizes="paginationSizes"
              @update:page="handlePageChange"
              @update:page-size="handlePageSizeChange" />
          </n-flex>
        </n-card>
      </div>
    </div>

    <!-- 이미지 미리보기 -->
    <n-modal v-model:show="showPreview" preset="card" style="width: 90%; max-width: 1200px">
      <template #header>
        <span>이미지 미리보기</span>
      </template>
      <div v-if="previewImage" class="preview-container">
        <img :src="previewImage.picUrl" :alt="previewImage.prompt" class="preview-image" />
        <div class="preview-info mt-16px">
          <p class="text-14px">
            <strong>프롬프트:</strong>
            {{ previewImage.prompt }}
          </p>
          <p class="text-12px text-#909090 mt-8px">
            <strong>크기:</strong>
            {{ previewImage.width }} × {{ previewImage.height }}
          </p>
          <p class="text-12px text-#909090 mt-4px">
            <strong>모델:</strong>
            {{ previewImage.model }} ({{ previewImage.platform }})
          </p>
          <p class="text-12px text-#909090 mt-4px">
            <strong>생성 시간:</strong>
            {{ formatTime(previewImage.createTime) }}
          </p>
        </div>
      </div>
    </n-modal>
  </main>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { imageMyPage, imageDraw, imageDeleteMy, modelPage } from '@/utils/ImRequestUtils'

const promptAutosize = { minRows: 3, maxRows: 6 }
const paginationSizes = [10, 20, 30, 50]

// 폼 데이터
const formData = ref({
  modelId: '',
  prompt: '',
  width: 1024,
  height: 1024,
  options: {}
})

// 모델 옵션
const modelOptions = ref<Array<{ label: string; value: string }>>([])

// 이미지 목록
const imageList = ref<any[]>([])
const totalImages = ref(0)
const pageNo = ref(1)
const pageSize = ref(20)

// 상태
const isGenerating = ref(false)
const isLoading = ref(false)

// 미리보기
const showPreview = ref(false)
const previewImage = ref<any>(null)

// 폴링 타이머
let pollingTimer: NodeJS.Timeout | null = null
let pollingStartAt: number | null = null
const MAX_POLL_DURATION = 5 * 60 * 1000 // 5분 타임아웃, 장시간 메모리 점유 방지
// 완료된 이미지 ID 기록, 중복 알림 방지
const completedImageIds = new Set<string>()

// 모델 목록 로드
const loadModels = async () => {
  try {
    const res = await modelPage({ pageNo: 1, pageSize: 100 })
    if (res?.data?.list) {
      // 이미지 생성 모델 필터링 (type = 2)
      modelOptions.value = res.data.list
        .filter((m: any) => m.type === 2 && m.status === 0)
        .map((m: any) => ({
          label: `${m.name} (${m.platform})`,
          value: m.id
        }))
    }
  } catch (error) {
    // console.error 제거
  }
}

// 이미지 목록 로드
const loadImages = async (showSuccessNotification = false) => {
  isLoading.value = true
  try {
    const res = await imageMyPage({
      pageNo: pageNo.value,
      pageSize: pageSize.value
    })
    if (res?.data) {
      const newList = res.data.list || []

      // 새로 완료된 이미지가 있는지 확인
      if (showSuccessNotification) {
        newList.forEach((img: any) => {
          if (img.status === 20 && !completedImageIds.has(img.id)) {
            completedImageIds.add(img.id)
            window.$message.success('이미지 생성 성공')
          }
        })
      }

      imageList.value = newList
      totalImages.value = res.data.total || 0
    }
  } catch (error) {
  } finally {
    isLoading.value = false
  }
}

// 이미지 생성
const handleGenerate = async () => {
  if (!formData.value.modelId || !formData.value.prompt) {
    window.$message.warning('모델을 선택하고 프롬프트를 입력하세요')
    return
  }

  isGenerating.value = true
  try {
    const res = await imageDraw({
      modelId: formData.value.modelId,
      prompt: formData.value.prompt,
      width: formData.value.width,
      height: formData.value.height,
      options: formData.value.options
    })

    if (res?.data) {
      // 제출 성공 알림은 한 번만 표시
      window.$message.success('이미지 생성 작업이 제출되었습니다')
      // 목록 다시 로드 (성공 알림 표시 안 함)
      await loadImages(false)
      // 폴링 시작
      startPolling()
    }
  } catch (error: any) {
    // console.error 제거
    window.$message.error(error?.message || '이미지 생성 실패')
  } finally {
    isGenerating.value = false
  }
}

// 생성 상태 폴링 시작
const startPolling = () => {
  if (pollingTimer) return

  pollingStartAt = Date.now()
  pollingTimer = setInterval(async () => {
    // 타임아웃 보호, 장시간 중단으로 인한 메모리 점유 방지
    if (pollingStartAt && Date.now() - pollingStartAt > MAX_POLL_DURATION) {
      stopPolling()
      window.$message.warning('이미지 생성 폴링 시간 초과가 감지되어 자동으로 중지되었습니다. 새로고침 후 다시 시도하세요')
      return
    }

    // 진행 중인 작업이 있는지 확인
    const hasInProgress = imageList.value.some((img) => img.status === 10)
    if (hasInProgress) {
      // 폴링 시 성공 알림 활성화
      await loadImages(true)
    } else {
      stopPolling()
    }
  }, 3000) // 3초마다 폴링
}

// 폴링 중지
const stopPolling = () => {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
  pollingStartAt = null
}

// 이미지 삭제
const handleDelete = async (id: string) => {
  try {
    await imageDeleteMy({ id })
    window.$message.success('삭제 성공')
    await loadImages(false)
  } catch (error) {
    // console.error 제거
    window.$message.error('삭제 실패')
  }
}

// 이미지 미리보기
const handlePreview = (image: any) => {
  previewImage.value = image
  showPreview.value = true
}

// 이미지 다운로드
const handleDownload = (image: any) => {
  if (!image.picUrl) return
  const link = document.createElement('a')
  link.href = image.picUrl
  link.download = `ai-image-${image.id}.png`
  link.click()
}

// 시간 포맷팅
const formatTime = (time: string) => {
  if (!time) return ''
  const date = new Date(time)
  return date.toLocaleString('ko-KR')
}

// 페이지네이션 처리
const handlePageChange = (page: number) => {
  pageNo.value = page
  loadImages(false)
}

const handlePageSizeChange = (size: number) => {
  pageSize.value = size
  pageNo.value = 1
  loadImages(false)
}

const handleModelChange = () => {
  // 모델 전환 시 매개변수 초기화 가능
}

onMounted(async () => {
  loadModels()
  await loadImages(false)
  // 진행 중인 작업이 있는지 확인하고, 있으면 폴링 시작
  if (imageList.value.some((img) => img.status === 10)) {
    startPolling()
  }
})

onUnmounted(() => {
  stopPolling()
  // 캐시 지우기, 메모리 해제
  completedImageIds.clear()
})
</script>

<style scoped lang="scss">
.image-generation-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--chat-bg-color);
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  border-bottom: 1px solid var(--line-color);
}

.generation-area {
  flex: 1;
  overflow-y: auto;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.image-item {
  border: 1px solid var(--line-color);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
}

.image-wrapper {
  position: relative;
  width: 100%;
  padding-top: 100%; /* 1:1 aspect ratio */
  background: var(--bg-color);
  overflow: hidden;
}

.status-tag {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}

.image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.3s;

  &:hover {
    transform: scale(1.05);
  }
}

.image-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);

  &.error {
    background: rgba(213, 48, 79, 0.05);
  }
}

.image-info {
  padding: 12px;
}

.prompt {
  font-size: 13px;
  color: var(--chat-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}

.preview-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 8px;
}

.preview-info {
  width: 100%;
  padding: 16px;
  background: var(--bg-color);
  border-radius: 8px;
}
</style>
