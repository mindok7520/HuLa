<template>
  <div
    class="file-container select-none"
    :class="{ downloading: isDownloading, uploading: isUploading }"
    @dblclick="handleFileClick">
    <!-- 파일 정보 -->
    <div class="file-info select-none">
      <div class="file-name" :title="body?.fileName">
        <n-highlight
          v-if="props.searchKeyword"
          :text="truncateFileName(body?.fileName || fallbackFileName)"
          :patterns="[props.searchKeyword]"
          :highlight-style="{
            padding: '0 4px',
            borderRadius: '6px',
            color: '#000',
            background: '#13987f'
          }" />
        <template v-else>
          {{ truncateFileName(body?.fileName || fallbackFileName) }}
        </template>
      </div>
      <div class="file-size">
        {{ formatBytes(body?.size != null && !isNaN(body.size) ? body.size : 0) }}
        <span class="download-status" :class="{ downloaded: fileStatus?.isDownloaded }">
          {{ fileStatus?.isDownloaded ? t('message.file.status.downloaded') : t('message.file.status.not_downloaded') }}
        </span>
      </div>
    </div>

    <!-- 파일 아이콘 영역 -->
    <div :title="body?.fileName" class="file-icon-wrapper select-none cursor-pointer" @click="handleIconClick">
      <!-- 파일 아이콘 -->
      <img
        :src="`/file/${getFileSuffix(body?.fileName || '')}.svg`"
        :alt="getFileSuffix(body?.fileName || '')"
        @error="handleIconError"
        @load="handleIconLoad"
        class="file-icon-img" />

      <!-- 오버레이 및 작업 아이콘 -->
      <div v-if="isUploading || isDownloading || needsDownload" class="file-overlay" :style="overlayStyle">
        <!-- 업로드 중 진행률 표시 -->
        <div v-if="isUploading" class="upload-progress">
          <div class="progress-circle">
            <svg class="progress-ring" width="24" height="24">
              <circle
                class="progress-ring-circle"
                stroke="rgba(19, 152, 127, 0.4)"
                stroke-width="2"
                fill="transparent"
                r="10"
                cx="12"
                cy="12" />
              <circle
                class="progress-ring-circle progress-ring-fill"
                stroke="#13987f"
                stroke-width="2"
                fill="transparent"
                r="10"
                cx="12"
                cy="12"
                :stroke-dasharray="`${2 * Math.PI * 10}`"
                :stroke-dashoffset="`${2 * Math.PI * 10 * (1 - (isUploading ? uploadProgress : downloadProgress) / 100)}`" />
            </svg>
          </div>
          <!-- 업로드 진행률 -->
          <!-- <div class="progress-text">{{ isUploading ? uploadProgress : downloadProgress }}%</div> -->
        </div>
        <!-- 다운로드 중 진행률 표시 -->
        <div v-else-if="isDownloading" class="download-progress">
          <div class="progress-circle">
            <svg class="progress-ring" width="24" height="24">
              <circle
                class="progress-ring-circle"
                stroke="rgba(255, 255, 255, 0.3)"
                stroke-width="2"
                fill="transparent"
                r="10"
                cx="12"
                cy="12" />
              <circle
                class="progress-ring-circle progress-ring-fill"
                stroke="#fff"
                stroke-width="2"
                fill="transparent"
                r="10"
                cx="12"
                cy="12"
                :stroke-dasharray="`${2 * Math.PI * 10}`"
                :stroke-dashoffset="`${2 * Math.PI * 10 * (1 - downloadProgress / 100)}`" />
            </svg>
          </div>
          <!-- 다운로드 진행률 -->
          <!-- <div class="progress-text">{{ downloadProgress }}%</div> -->
        </div>
        <!-- 다운로드 필요 시 다운로드 아이콘 표시 -->
        <div v-else-if="needsDownload" class="download-icon">
          <div class="download-circle">
            <svg class="download-btn-icon">
              <use href="#arrow-down"></use>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { join } from '@tauri-apps/api/path'
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener'
import { MessageStatusEnum, TauriCommand } from '@/enums'
import { useDownload } from '@/hooks/useDownload'
import type { FileBody, FilesMeta, MsgType } from '@/services/types'
import { useFileDownloadStore } from '@/stores/fileDownload'
import { useGlobalStore } from '@/stores/global'
import { useUserStore } from '@/stores/user'
import { useChatStore } from '@/stores/chat'
import { formatBytes, getFileSuffix } from '@/utils/Formatting'
import { getFilesMeta } from '@/utils/PathUtil'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { useI18n } from 'vue-i18n'

const userStore = useUserStore()
const globalStore = useGlobalStore()
const chatStore = useChatStore()
const { t } = useI18n()

const { isDownloading: legacyIsDownloading } = useDownload()
const fileDownloadStore = useFileDownloadStore()
const fallbackFileName = computed(() => t('message.file.unknown_file'))

const props = defineProps<{
  body: FileBody
  messageStatus?: MessageStatusEnum
  uploadProgress?: number
  searchKeyword?: string
  message?: MsgType
}>()

// 아이콘 크기 상태
const iconDimensions = ref({ width: 40, height: 40 })

// 업로드 상태
const isUploading = computed(() => props.messageStatus === MessageStatusEnum.SENDING)
const uploadProgress = computed(() => props.uploadProgress || 0)

// 파일 다운로드 상태
const fileStatus = computed(() => {
  if (!props.body?.url) return null
  return fileDownloadStore.getFileStatus(props.body.url)
})

// 다운로드 중 여부
const isDownloading = computed(() => {
  return fileStatus.value?.status === 'downloading' || legacyIsDownloading.value
})

// 다운로드 진행률
const downloadProgress = computed(() => {
  return fileStatus.value?.progress || 0
})

const persistFileLocalPath = async (absolutePath: string) => {
  if (!props.message?.id || !absolutePath) return
  const target = chatStore.getMessage(props.message.id)
  if (!target) return
  if (target.message.body?.localPath === absolutePath) return

  const nextBody = { ...(target.message.body || {}), localPath: absolutePath }
  chatStore.updateMsg({ msgId: target.message.id, status: target.message.status, body: nextBody })
  const updated = { ...target, message: { ...target.message, body: nextBody } }
  await invokeSilently(TauriCommand.SAVE_MSG, { data: updated as any })
}

const revealInDirSafely = async (targetPath?: string | null) => {
  if (!targetPath) {
    window.$message?.error(t('message.file.toast.missing_local'))
    return
  }
  try {
    await revealItemInDir(targetPath)
  } catch (error) {
    console.error('폴더에서 파일 표시 실패:', error)
    window.$message?.error(t('message.file.toast.reveal_fail'))
  }
}

// 다운로드 필요 여부 (파일이 로컬에 없고 업로드/다운로드 상태가 아님)
const needsDownload = computed(() => {
  if (isUploading.value || isDownloading.value) return false
  if (!props.body?.url) return false
  if (props.body.localPath) return false

  // 로컬 파일 경로인 경우 다운로드 불필요
  if (props.body.url.startsWith('file://') || props.body.url.startsWith('/')) return false

  // 파일 다운로드 여부 확인
  const status = fileStatus.value
  return !status?.isDownloaded
})

// 오버레이 스타일 계산
const overlayStyle = computed(() => {
  const { width, height } = iconDimensions.value
  const overlayWidth = Math.max(width - 4, 38)
  const overlayHeight = Math.max(height, 42)
  return {
    width: `${overlayWidth}px`,
    height: `${overlayHeight}px`,
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    position: 'absolute' as const
  }
})

// props 변경 감시, 파일 상태 재확인
watch(
  () => [props.body?.url, props.body?.fileName],
  async ([newUrl, newFileName]) => {
    if (newUrl && newFileName) {
      try {
        await fileDownloadStore.checkFileExists(newUrl, newFileName)
      } catch (error) {
        console.error('파일 상태 확인 실패:', error)
      }
    }
  },
  { immediate: false }
)

watch(
  fileStatus,
  (status) => {
    if (status?.isDownloaded && status.absolutePath) {
      void persistFileLocalPath(status.absolutePath)
    }
  },
  { immediate: true }
)

// 파일 이름 자르기, 확장자 유지
const truncateFileName = (fileName?: string): string => {
  if (!fileName) return fallbackFileName.value

  const maxWidth = 160 // 최대 너비 픽셀
  const averageCharWidth = 9 // 평균 문자 너비 (14px Arial 글꼴 기준)
  const maxChars = Math.floor(maxWidth / averageCharWidth)

  if (fileName.length <= maxChars) {
    return fileName
  }

  // 파일 확장자 가져오기
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex === -1) {
    // 확장자가 없으면 바로 자름
    return fileName.substring(0, maxChars - 3) + '...'
  }

  const name = fileName.substring(0, lastDotIndex)
  const extension = fileName.substring(lastDotIndex)

  // 파일명에 사용할 수 있는 문자 수 계산 (확장자와 말줄임표 공간 제외)
  const availableChars = maxChars - extension.length - 3 // 3은 말줄임표의 길이

  if (availableChars <= 0) {
    // 확장자가 너무 길면 확장자만 표시
    return '...' + extension
  }

  return name.substring(0, availableChars) + '...' + extension
}

// 아이콘 로드 처리
const handleIconLoad = (event: Event) => {
  const target = event.target as HTMLImageElement
  // 아이콘의 실제 표시 크기 가져오기
  const rect = target.getBoundingClientRect()
  iconDimensions.value = {
    width: rect.width,
    height: rect.height
  }
}

// 아이콘 로딩 오류 처리
const handleIconError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.src = '/file/other.svg'
}

// 파일 클릭 처리
const handleFileClick = async () => {
  if (!props.body?.url || !props.body?.fileName || isUploading.value) return

  try {
    // 파일 다운로드 여부 확인
    const status = fileStatus.value

    if (status?.isDownloaded && status.absolutePath) {
      // 파일이 다운로드됨, 로컬 파일 열기 시도
      try {
        await openPath(status.absolutePath)
      } catch (openError) {
        await revealInDirSafely(status.absolutePath)
      }
    } else if (needsDownload.value) {
      // 파일 다운로드 필요
      await downloadAndOpenFile()
    } else {
      // 로컬 파일 경로, 열기 시도
      try {
        await openPath(props.body.url)
      } catch (openError) {
        console.warn('파일을 직접 열 수 없습니다. 파일 관리자에서 표시를 시도합니다:', openError)
        await revealInDirSafely(props.body.url)
      }
    }
  } catch (error) {
    console.error('파일 열기 실패:', error)
    const errorMessage = error instanceof Error ? error.message : t('message.file.unknown_error')
    if (errorMessage.includes('Not allowed to open path') || errorMessage.includes('revealItemInDir')) {
      console.error('파일을 열거나 표시할 수 없습니다. 파일 관리자에서 직접 찾아 열어주세요.')
    } else {
      console.error(`파일 열기 실패: ${errorMessage}`)
    }
  } finally {
    const currentChatRoomId = globalStore.currentSessionRoomId // 이 ID는 그룹 ID일 수도 있고 사용자 UID일 수도 있습니다.
    const currentUserUid = userStore.userInfo!.uid as string

    const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
    const absolutePath = await join(resourceDirPath, props.body.fileName)

    const [fileMeta] = await getFilesMeta<FilesMeta>([absolutePath || props.body.url])

    await fileDownloadStore.refreshFileDownloadStatus({
      fileUrl: props.body.url,
      roomId: currentChatRoomId,
      userId: currentUserUid,
      fileName: props.body.fileName,
      exists: fileMeta.exists
    })
  }
}

// 파일 다운로드 후 열기
const downloadAndOpenFile = async () => {
  if (!props.body?.url || !props.body?.fileName) return

  try {
    const fileName = props.body.fileName
    const absolutePath = await fileDownloadStore.downloadFile(props.body.url, fileName)

    if (absolutePath) {
      void persistFileLocalPath(absolutePath)
      // 다운로드 성공 후 파일 열기 시도
      try {
        await openPath(absolutePath)
      } catch (openError) {
        console.warn('파일을 직접 열 수 없습니다. 파일 관리자에서 표시를 시도합니다:', openError)
        await revealInDirSafely(absolutePath)
      }
    }
  } catch (error) {
    console.error('파일 다운로드 실패:', error)
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    if (errorMessage.includes('Not allowed to open path') || errorMessage.includes('revealItemInDir')) {
      window.$message?.error(t('message.file.toast.download_open_fail'))
    } else {
      window.$message?.error(t('message.file.toast.download_failed', { reason: errorMessage }))
    }
  }
}

// 파일 다운로드만 수행 (열지 않음)
const downloadFileOnly = async () => {
  if (!props.body?.url || !props.body?.fileName) return

  try {
    const fileName = props.body.fileName
    const absolutePath = await fileDownloadStore.downloadFile(props.body.url, fileName)
    if (absolutePath) {
      void persistFileLocalPath(absolutePath)
    }
  } catch (error) {
    console.error('파일 다운로드 실패:', error)
  } finally {
    // 파일 상태 새로고침
    const currentChatRoomId = globalStore.currentSessionRoomId
    const currentUserUid = userStore.userInfo!.uid as string

    const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
    const absolutePath = await join(resourceDirPath, props.body.fileName)

    const [fileMeta] = await getFilesMeta<FilesMeta>([absolutePath || props.body.url])

    await fileDownloadStore.refreshFileDownloadStatus({
      fileUrl: props.body.url,
      roomId: currentChatRoomId,
      userId: currentUserUid,
      fileName: props.body.fileName,
      exists: fileMeta.exists
    })
  }
}

// 아이콘 클릭 처리 (파일 다운로드)
const handleIconClick = async (event: Event) => {
  event.stopPropagation() // 이벤트 전파 방지, 더블 클릭 이벤트 발생 방지

  if (!props.body?.url || !props.body?.fileName || isUploading.value || isDownloading.value) return

  const status = fileStatus.value

  // 파일이 이미 다운로드된 경우 안내 표시
  if (status?.isDownloaded) {
    return
  }

  // 다운로드가 필요한 경우 다운로드 실행
  if (needsDownload.value) {
    await downloadFileOnly()
  }
}

// 컴포넌트 마운트 시 파일 상태 확인
onMounted(async () => {
  if (props.body?.url && props.body?.fileName) {
    try {
      // 파일이 로컬에 이미 존재하는지 확인
      await fileDownloadStore.checkFileExists(props.body.url, props.body.fileName)
    } catch (error) {
      console.error('파일 상태 확인 실패:', error)
    }
  }
})
</script>

<style scoped lang="scss">
.file-container {
  @apply relative custom-shadow bg-[--file-bg-color] w-225px h-70px rounded-8px px-14px py-4px flex-y-center;
  cursor: default !important;
  user-select: none !important;
  transition: all 0.2s ease;

  &.downloading {
    opacity: 0.7;
  }

  &.uploading {
    opacity: 0.8;
  }
}

.file-info {
  flex: 1;
  min-width: 0;
  margin-right: 10px;
}

.file-name {
  font-size: 14px;
  color: var(--text-color);
  line-height: 1.2;
  margin-bottom: 8px;
  white-space: nowrap;
  padding: 2px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 170px;
}

.file-size {
  font-size: 12px;
  color: #909090;
  display: flex;
  align-items: center;
  gap: 8px;
}

.download-status {
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 4px;
  @apply light:bg-#60606020 dark:bg-#444;
  color: #909090;

  &.downloaded {
    background: rgba(19, 152, 127, 0.3);
    color: #13987f;
  }
}

.file-icon-wrapper {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  width: 39px;
  height: 41px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-icon-img {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

.file-overlay {
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.upload-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.download-progress,
.download-icon {
  @apply flex-center;
}

.download-circle {
  width: 22px;
  height: 22px;
  background: rgba(20, 20, 20, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.4);
}

.download-circle .download-btn-icon {
  width: 14px;
  height: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.progress-circle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-ring {
  transform: rotate(-90deg);
}

.progress-ring-circle {
  transition: stroke-dashoffset 0.3s ease;
}

.progress-text {
  font-size: 8px;
  color: #fff;
  text-align: center;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.loading-icon {
  width: 20px;
  height: 20px;
  color: #fff;
  animation: spin 1s linear infinite;
}

.download-btn-icon {
  width: 16px;
  height: 16px;
  color: #fff;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
