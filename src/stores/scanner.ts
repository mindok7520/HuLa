import type { UnlistenFn } from '@tauri-apps/api/event'
import { listen } from '@tauri-apps/api/event'
import { appCacheDir } from '@tauri-apps/api/path'
import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import { ErrorType, invokeSilently, invokeWithErrorHandler } from '@/utils/TauriInvokeHandler.ts'

type DirectoryScanProgress = {
  current_path: string
  files_processed: number
  total_size: number
  elapsed_time: number
  elapsed_seconds: number
  progress_percentage: number
}

type DirectoryInfo = {
  path: string
  total_size: number
  disk_mount_point: string
  disk_total_space: number
  disk_used_space: number
  disk_usage_percentage: number
  usage_percentage: number
}
/**
 * 스캐너 상태 관리
 * 스캐너의 상태, 구성 및 이벤트 리스너 관리 담당
 * 스캔, 스캔 취소, 리소스 정리 등의 기능 제공
 */
export const useScannerStore = defineStore(StoresEnum.SCANNER, () => {
  const pathType = ref<'default' | 'custom'>('default')
  const defaultDirectory = ref<string>('')
  const customDirectory = ref<string>('')
  const scanning = ref<boolean>(false)
  const scanComplete = ref<boolean>(false)
  const showDiskUsage = ref<boolean>(false)
  const totalSize = ref<number>(0)
  const diskInfo = ref<DirectoryInfo | null>(null)
  const scanProgress = ref<DirectoryScanProgress>({
    current_path: '',
    files_processed: 0,
    total_size: 0,
    elapsed_time: 0,
    elapsed_seconds: 0,
    progress_percentage: 0
  })
  const isInitialized = ref<boolean>(false)
  const listeners = ref<UnlistenFn[]>([])

  const currentDirectory = computed(() => {
    return pathType.value === 'default' ? defaultDirectory.value : customDirectory.value
  })

  const scanFilesUsagePercentage = computed(() => {
    if (!diskInfo.value || !scanProgress.value.total_size) return 0
    const percentage = (scanProgress.value.total_size / diskInfo.value.disk_total_space) * 100
    return Math.min(percentage, 1000)
  })

  const scanningProgress = computed(() => {
    if (!scanning.value && !scanComplete.value) return 0
    if (scanComplete.value && !showDiskUsage.value) return 100
    return scanProgress.value.progress_percentage || 0
  })

  // 메서드
  const setupEventListeners = async () => {
    // 진행 상황 업데이트 수신
    const progressListener = await listen<DirectoryScanProgress>('directory-scan-progress', (event) => {
      scanProgress.value = event.payload
    })
    listeners.value.push(progressListener)

    // 스캔 완료 수신
    const completeListener = await listen<DirectoryScanProgress>('directory-scan-complete', (event) => {
      scanProgress.value = event.payload
      scanComplete.value = true
      scanning.value = false

      // 스캔 완료 후 디스크 점유율 표시로 전환
      setTimeout(() => {
        showDiskUsage.value = true
      }, 300)
    })
    listeners.value.push(completeListener)

    // 스캔 취소 수신
    const cancelListener = await listen('directory-scan-cancelled', () => {
      console.log('스캔 취소 이벤트 수신')
      scanning.value = false
      scanComplete.value = false
      showDiskUsage.value = false
    })
    listeners.value.push(cancelListener)
  }

  const initializeScanner = async () => {
    if (isInitialized.value) return

    try {
      // 기본 디렉토리 가져오기
      const cacheDir = await appCacheDir()
      defaultDirectory.value = cacheDir

      // 이벤트 리스너 설정
      await setupEventListeners()

      isInitialized.value = true

      // 현재 디렉토리가 있으면 자동으로 스캔 시작
      if (currentDirectory.value) {
        await startScan()
      }
    } catch (error) {
      console.error('스캐너 초기화 실패:', error)
      window.$message?.error('스캐너 초기화 실패')
    }
  }

  const setPathType = (type: 'default' | 'custom') => {
    pathType.value = type
  }

  const setCustomDirectory = (path: string) => {
    customDirectory.value = path
  }

  const startScan = async () => {
    if (!currentDirectory.value) {
      window.$message?.warning('디렉토리를 먼저 선택해주세요')
      return
    }

    scanning.value = true
    scanComplete.value = false
    showDiskUsage.value = false
    totalSize.value = 0
    diskInfo.value = null

    // 진행 상황 초기화
    scanProgress.value = {
      current_path: '스캔 시작...',
      files_processed: 0,
      total_size: 0,
      elapsed_time: 0,
      elapsed_seconds: 0,
      progress_percentage: 0
    }

    try {
      const result = await invokeWithErrorHandler<DirectoryInfo>(
        'get_directory_usage_info_with_progress',
        {
          directoryPath: currentDirectory.value
        },
        {
          customErrorMessage: '디렉토리 정보 가져오기 실패',
          errorType: ErrorType.Client
        }
      )

      diskInfo.value = result
      totalSize.value = result.total_size
      scanComplete.value = true
      scanning.value = false
    } catch (error) {
      console.error('스캔 실패:', error)
      scanning.value = false
    }
  }

  const cancelScan = async () => {
    try {
      await invokeSilently('cancel_directory_scan')
      console.log('스캔이 취소됨')
    } catch (error) {
      console.error('스캔 취소 실패:', error)
    }
  }

  const resetState = () => {
    // 모든 상태를 초기값으로 재설정
    pathType.value = 'default'
    customDirectory.value = ''
    scanning.value = false
    scanComplete.value = false
    showDiskUsage.value = false
    totalSize.value = 0
    diskInfo.value = null
    isInitialized.value = false
    scanProgress.value = {
      current_path: '',
      files_processed: 0,
      total_size: 0,
      elapsed_time: 0,
      elapsed_seconds: 0,
      progress_percentage: 0
    }
  }

  const cleanup = async () => {
    // 진행 중인 스캔 취소
    if (scanning.value) {
      await cancelScan()
    }

    // 이벤트 리스너 정리
    listeners.value.forEach((unlisten) => {
      try {
        unlisten()
      } catch (error) {
        console.warn('리스너 정리 실패:', error)
      }
    })
    listeners.value = []

    // 상태 초기화
    isInitialized.value = false
    scanning.value = false
    scanComplete.value = false
    showDiskUsage.value = false
  }

  return {
    pathType,
    defaultDirectory,
    customDirectory,
    scanning,
    scanComplete,
    showDiskUsage,
    totalSize,
    diskInfo,
    scanProgress,
    isInitialized,
    listeners,
    currentDirectory,
    scanFilesUsagePercentage,
    scanningProgress,
    initializeScanner,
    setPathType,
    setCustomDirectory,
    startScan,
    cancelScan,
    resetState,
    cleanup
  }
})
