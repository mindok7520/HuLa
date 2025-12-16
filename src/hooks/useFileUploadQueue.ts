import { computed, reactive, readonly } from 'vue'

export type FileUploadItem = {
  id: string
  name: string
  size: number
  type: string
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  progress: number
  startTime?: number
  endTime?: number
}

export type FileUploadQueue = {
  items: FileUploadItem[]
  totalFiles: number
  completedFiles: number
  failedFiles: number
  isActive: boolean
  startTime?: number
  endTime?: number
}

/**
 * 파일 업로드 대기열 상태 관리
 */
export const useFileUploadQueue = () => {
  // 대기열 상태
  const queue = reactive<FileUploadQueue>({
    items: [],
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    isActive: false,
    startTime: undefined,
    endTime: undefined
  })

  // 계산된 속성
  const progress = computed(() => {
    if (queue.totalFiles === 0) return 0
    return Math.round((queue.completedFiles / queue.totalFiles) * 100)
  })

  const isUploading = computed(() => {
    return queue.isActive && queue.items.some((item) => item.status === 'uploading')
  })

  /**
   * 대기열 초기화
   */
  const initQueue = (files: File[]) => {
    queue.items = files.map((file, index) => ({
      id: `${Date.now()}_${index}`,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending',
      progress: 0
    }))
    queue.totalFiles = files.length
    queue.completedFiles = 0
    queue.failedFiles = 0
    queue.isActive = true
    queue.startTime = Date.now()
    queue.endTime = undefined
  }

  /**
   * 파일 상태 업데이트
   */
  const updateFileStatus = (fileId: string, status: FileUploadItem['status'], progress?: number) => {
    const item = queue.items.find((item) => item.id === fileId)
    if (!item) return

    const oldStatus = item.status
    item.status = status
    if (progress !== undefined) {
      item.progress = Math.min(100, Math.max(0, progress))
    }

    // 타임스탬프 업데이트
    if (status === 'uploading' && oldStatus === 'pending') {
      item.startTime = Date.now()
    } else if ((status === 'completed' || status === 'failed') && oldStatus === 'uploading') {
      item.endTime = Date.now()
    }

    // 카운터 업데이트
    if (status === 'completed' && oldStatus !== 'completed') {
      queue.completedFiles++
      if (oldStatus === 'failed') queue.failedFiles--
    } else if (status === 'failed' && oldStatus !== 'failed') {
      queue.failedFiles++
      if (oldStatus === 'completed') queue.completedFiles--
    }

    // 완료 여부 확인
    if (queue.completedFiles + queue.failedFiles >= queue.totalFiles) {
      finishQueue()
    }
  }

  /**
   * 파일 업로드 진행률 업데이트
   */
  const updateFileProgress = (fileId: string, progress: number) => {
    const item = queue.items.find((item) => item.id === fileId)
    if (item && item.status === 'uploading') {
      item.progress = Math.min(100, Math.max(0, progress))
    }
  }

  /**
   * 대기열 완료
   */
  const finishQueue = () => {
    queue.isActive = false
    queue.endTime = Date.now()

    // 2초 후 대기열 정리
    setTimeout(() => {
      clearQueue()
    }, 2000)
  }

  /**
   * 대기열 비우기
   */
  const clearQueue = () => {
    queue.items = []
    queue.totalFiles = 0
    queue.completedFiles = 0
    queue.failedFiles = 0
    queue.isActive = false
    queue.startTime = undefined
    queue.endTime = undefined
  }

  return {
    queue: readonly(queue),
    progress,
    isUploading,
    initQueue,
    updateFileStatus,
    updateFileProgress,
    finishQueue,
    clearQueue
  }
}

// 전역 싱글톤
export const globalFileUploadQueue = useFileUploadQueue()
