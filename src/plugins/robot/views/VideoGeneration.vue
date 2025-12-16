<template>
  <main class="video-generation-container">
    <div class="content-area">
      <!-- 헤더 -->
      <div data-tauri-drag-region class="header flex p-[8px_16px_10px_16px] justify-between items-center">
        <n-flex :size="10" vertical>
          <p class="leading-6 text-(18px [--chat-text-color]) font-500">AI 비디오 생성</p>
          <p class="text-(11px #707070)">총 {{ totalVideos }}개의 비디오 생성됨</p>
        </n-flex>
      </div>

      <!-- 생성 영역 -->
      <div class="generation-area p-16px">
        <n-card title="비디오 생성" :bordered="false" class="mb-16px">
          <n-form ref="formRef" :model="formData" label-placement="left" label-width="80">
            <!-- 모델 선택 -->
            <n-form-item label="모델 선택" path="modelId">
              <n-select
                v-model:value="formData.modelId"
                :options="modelOptions"
                placeholder="비디오 생성 모델을 선택하세요"
                filterable
                @update:value="handleModelChange" />
            </n-form-item>

            <!-- 프롬프트 입력 -->
            <n-form-item label="프롬프트" path="prompt">
              <n-input
                v-model:value="formData.prompt"
                type="textarea"
                placeholder="비디오 설명을 입력하세요. 예: 정원에서 나비를 쫓는 귀여운 고양이"
                :autosize="promptAutosize"
                maxlength="2000"
                show-count />
            </n-form-item>

            <!-- 매개변수 설정 -->
            <n-form-item label="비디오 크기">
              <n-flex :size="12">
                <n-input-number
                  v-model:value="formData.width"
                  placeholder="너비"
                  :min="256"
                  :max="1920"
                  :step="64"
                  style="width: 120px" />
                <span class="text-14px text-#909090">×</span>
                <n-input-number
                  v-model:value="formData.height"
                  placeholder="높이"
                  :min="256"
                  :max="1080"
                  :step="64"
                  style="width: 120px" />
              </n-flex>
            </n-form-item>

            <n-form-item label="비디오 길이">
              <n-input-number
                v-model:value="formData.duration"
                placeholder="길이 (초)"
                :min="1"
                :max="60"
                :step="1"
                style="width: 120px" />
              <span class="text-12px text-#909090 ml-8px">초</span>
            </n-form-item>

            <!-- 생성 버튼 -->
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

        <!-- 비디오 표시 영역 -->
        <n-card title="생성 기록" :bordered="false">
          <n-spin :show="isLoading">
            <div v-if="videoList.length > 0" class="video-grid">
              <div v-for="video in videoList" :key="video.id" class="video-item">
                <div class="video-wrapper">
                  <!-- 상태 태그 -->
                  <n-tag v-if="video.status === 10" class="status-tag" type="info" size="small" :bordered="false">
                    생성 중
                  </n-tag>
                  <n-tag v-else-if="video.status === 30" class="status-tag" type="error" size="small" :bordered="false">
                    실패
                  </n-tag>

                  <!-- 비디오 플레이어 -->
                  <div v-if="video.status === 20 && video.videoUrl" class="video-player">
                    <video :src="video.videoUrl" :poster="video.coverUrl" controls class="video" @click.stop></video>
                  </div>
                  <div v-else-if="video.status === 10" class="video-placeholder">
                    <n-spin size="large" />
                    <p class="text-12px text-#909090 mt-12px">비디오 생성 중, 잠시만 기다려주세요...</p>
                  </div>
                  <div v-else-if="video.status === 30" class="video-placeholder error">
                    <Icon icon="mdi:alert-circle-outline" class="text-48px text-#d5304f" />
                    <p class="text-12px text-#d5304f mt-8px">{{ video.errorMessage || '생성 실패' }}</p>
                  </div>
                </div>

                <!-- 비디오 정보 -->
                <div class="video-info">
                  <p class="prompt" :title="video.prompt">{{ video.prompt }}</p>
                  <n-flex justify="space-between" align="center" class="mt-8px">
                    <span class="text-11px text-#909090">
                      {{ formatTime(video.createTime) }}
                      <span v-if="video.duration" class="ml-4px">· {{ video.duration }}초</span>
                    </span>
                    <n-flex :size="8">
                      <n-button v-if="video.status === 20" text size="small" @click="handleDownload(video)">
                        <template #icon>
                          <Icon icon="mdi:download" />
                        </template>
                      </n-button>
                      <n-popconfirm @positive-click="handleDelete(video.id)">
                        <template #trigger>
                          <n-button text size="small" type="error">
                            <template #icon>
                              <Icon icon="mdi:delete" />
                            </template>
                          </n-button>
                        </template>
                        이 비디오를 삭제하시겠습니까?
                      </n-popconfirm>
                    </n-flex>
                  </n-flex>
                </div>
              </div>
            </div>
            <n-empty v-else description="생성 기록 없음" class="py-40px" />
          </n-spin>

          <!-- 페이지네이션 -->
          <n-flex justify="center" class="mt-16px" v-if="totalVideos > pageSize">
            <n-pagination
              v-model:page="pageNo"
              :page-count="Math.ceil(totalVideos / pageSize)"
              :page-size="pageSize"
              show-size-picker
              :page-sizes="paginationSizes"
              @update:page="handlePageChange"
              @update:page-size="handlePageSizeChange" />
          </n-flex>
        </n-card>
      </div>
    </div>

    <!-- 비디오 상세 미리보기 -->
    <n-modal v-model:show="showPreview" preset="card" style="width: 90%; max-width: 1200px">
      <template #header>
        <span>비디오 상세</span>
      </template>
      <div v-if="previewVideo" class="preview-container">
        <video :src="previewVideo.videoUrl" :poster="previewVideo.coverUrl" controls class="preview-video"></video>
        <div class="preview-info mt-16px">
          <p class="text-14px">
            <strong>프롬프트:</strong>
            {{ previewVideo.prompt }}
          </p>
          <p class="text-12px text-#909090 mt-8px">
            <strong>크기:</strong>
            {{ previewVideo.width }} × {{ previewVideo.height }}
          </p>
          <p class="text-12px text-#909090 mt-4px">
            <strong>길이:</strong>
            {{ previewVideo.duration }} 초
          </p>
          <p class="text-12px text-#909090 mt-4px">
            <strong>모델:</strong>
            {{ previewVideo.model }} ({{ previewVideo.platform }})
          </p>
          <p class="text-12px text-#909090 mt-4px">
            <strong>생성 시간:</strong>
            {{ formatTime(previewVideo.createTime) }}
          </p>
        </div>
      </div>
    </n-modal>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import { videoMyPage, videoGenerate, videoDeleteMy, modelPage } from '@/utils/ImRequestUtils'
import { useMessage } from 'naive-ui'

const message = useMessage()
const promptAutosize = { minRows: 3, maxRows: 6 }
const paginationSizes = [10, 20, 30, 50]

// 폼 데이터
const formData = ref({
  modelId: '',
  prompt: '',
  width: 1280,
  height: 720,
  duration: 5,
  options: {}
})

// 모델 옵션
const modelOptions = ref<Array<{ label: string; value: string }>>([])

// 비디오 목록
const videoList = ref<any[]>([])
const totalVideos = ref(0)
const pageNo = ref(1)
const pageSize = ref(12)

// 상태
const isGenerating = ref(false)
const isLoading = ref(false)

// 미리보기
const showPreview = ref(false)
const previewVideo = ref<any>(null)

// 폴링 타이머
let pollingTimer: NodeJS.Timeout | null = null
let pollingStartAt: number | null = null
const MAX_POLL_DURATION = 5 * 60 * 1000 // 5분 타임아웃, 장시간 메모리 점유 방지

// 모델 목록 로드
const loadModels = async () => {
  try {
    const res: any = await modelPage({ pageNo: 1, pageSize: 100 })
    if (res?.data?.list) {
      // 비디오 생성 모델 필터링 (type = 4)
      modelOptions.value = res.data.list
        .filter((m: any) => m.type === 4 && m.status === 0)
        .map((m: any) => ({
          label: `${m.name} (${m.platform})`,
          value: m.id
        }))
    }
  } catch (error) {
    console.error('모델 로드 실패:', error)
  }
}

// 비디오 목록 로드
const loadVideos = async () => {
  isLoading.value = true
  try {
    const res = await videoMyPage({
      pageNo: pageNo.value,
      pageSize: pageSize.value
    })
    if (res?.data) {
      videoList.value = res.data.list || []
      totalVideos.value = res.data.total || 0
    }
  } catch (error) {
    console.error('비디오 목록 로드 실패:', error)
    message.error('비디오 목록 로드 실패')
  } finally {
    isLoading.value = false
  }
}

// 비디오 생성
const handleGenerate = async () => {
  if (!formData.value.modelId || !formData.value.prompt) {
    message.warning('모델을 선택하고 프롬프트를 입력하세요')
    return
  }

  isGenerating.value = true
  try {
    const res = await videoGenerate({
      modelId: formData.value.modelId,
      prompt: formData.value.prompt,
      width: formData.value.width,
      height: formData.value.height,
      duration: formData.value.duration,
      options: formData.value.options
    })

    if (res?.data) {
      message.success('비디오 생성 작업이 제출되었습니다, 잠시만 기다려주세요...')
      // 목록 다시 로드
      await loadVideos()
      // 폴링 시작
      startPolling()
    }
  } catch (error: any) {
    console.error('비디오 생성 실패:', error)
    message.error(error?.message || '비디오 생성 실패')
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
      message.warning('비디오 생성 폴링 시간 초과가 감지되어 자동으로 중지되었습니다. 새로고침 후 다시 시도하세요')
      return
    }

    // 진행 중인 작업이 있는지 확인
    const hasInProgress = videoList.value.some((video) => video.status === 10)
    if (hasInProgress) {
      await loadVideos()
    } else {
      stopPolling()
    }
  }, 5000) // 5초마다 폴링 (비디오 생성은 느림)
}

// 폴링 중지
const stopPolling = () => {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
  pollingStartAt = null
}

// 비디오 삭제
const handleDelete = async (id: string) => {
  try {
    await videoDeleteMy({ id })
    message.success('삭제 성공')
    await loadVideos()
  } catch (error) {
    console.error('삭제 실패:', error)
    message.error('삭제 실패')
  }
}

// 비디오 다운로드
const handleDownload = (video: any) => {
  if (!video.videoUrl) return
  const link = document.createElement('a')
  link.href = video.videoUrl
  link.download = `ai-video-${video.id}.mp4`
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
  loadVideos()
}

const handlePageSizeChange = (size: number) => {
  pageSize.value = size
  pageNo.value = 1
  loadVideos()
}

const handleModelChange = () => {
  // 모델 전환 시 매개변수 초기화 가능
}

// 생명주기
onMounted(() => {
  loadModels()
  loadVideos()
  // 진행 중인 작업이 있는지 확인하고, 있으면 폴링 시작
  if (videoList.value.some((video) => video.status === 10)) {
    startPolling()
  }
})

onUnmounted(() => {
  stopPolling()
  // 상태 초기화, 메모리 해제
  videoList.value = []
  formData.value.prompt = ''
})
</script>

<style scoped lang="scss">
.video-generation-container {
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

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.video-item {
  border: 1px solid var(--line-color);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
}

.video-wrapper {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 aspect ratio */
  background: var(--bg-color);
  overflow: hidden;
}

.status-tag {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}

.video-player {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-placeholder {
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

.video-info {
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

.preview-video {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 8px;
}

.preview-info {
  width: 100%;
  padding: 16px;
  background: var(--bg-color);
  border-radius: 8px;
}
</style>
