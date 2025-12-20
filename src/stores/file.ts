import { defineStore } from 'pinia'
import { convertFileSrc } from '@tauri-apps/api/core'
import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { readDir } from '@tauri-apps/plugin-fs'
import { StoresEnum } from '@/enums'
import { isMobile } from '@/utils/PlatformConstants'
import { useUserStore } from './user'

/**
 * 파일 정보 인터페이스
 */
export interface FileInfo {
  /** 파일 ID (메시지 ID) */
  id: string
  /** 방 ID */
  roomId: string
  /** 파일명 */
  fileName: string
  /** 파일 유형 */
  type: 'file' | 'image' | 'video' | 'voice'
  /** 파일 URL */
  url: string
  /** 파일 확장자 */
  suffix?: string
  /** MIME 유형 */
  mimeType?: string
}

export const useFileStore = defineStore(
  StoresEnum.FILE,
  () => {
    // ==================== 상태 정의 ====================

    /** 모든 방의 파일 데이터 Map<roomId, Map<fileId, FileInfo>> */
    const roomFilesMap = reactive<Record<string, Record<string, FileInfo>>>({})

    // ==================== 계산된 속성 ====================

    /** 지정된 방의 모든 파일 가져오기 */
    const getRoomFiles = computed(() => (roomId: string) => {
      return roomFilesMap[roomId] ? Object.values(roomFilesMap[roomId]) : []
    })

    /** 지정된 방의 모든 파일을 가져와 img 태그에서 사용할 수 있는 형식으로 변환 */
    const getRoomFilesForDisplay = async (roomId: string) => {
      const files = roomFilesMap[roomId] ? Object.values(roomFilesMap[roomId]) : []

      if (files.length === 0) {
        return []
      }

      const processedFiles = await Promise.all(
        files.map(async (file) => {
          let displayUrl: string

          if (file.url.startsWith('http')) {
            // HTTP URL 직접 사용
            displayUrl = file.url
          } else {
            // 상대 경로는 기본 디렉토리의 절대 경로와 연결해야 함
            // 모바일은 AppData 사용, PC는 Resource 사용
            const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
            const absolutePath = await join(baseDirPath, file.url)
            displayUrl = convertFileSrc(absolutePath)
          }

          return {
            ...file,
            // 프론트엔드 표시를 위해 URL을 사용 가능한 형식으로 변환
            displayUrl,
            // 원본 URL 유지
            originalUrl: file.url
          }
        })
      )

      return processedFiles
    }

    /** 지정된 방의 총 파일 수 가져오기 */
    const getRoomFileCount = computed(() => (roomId: string) => {
      return roomFilesMap[roomId] ? Object.keys(roomFilesMap[roomId]).length : 0
    })

    // ==================== 작업 메서드 ====================

    /**
     * 지정된 방에 파일 추가
     */
    const addFile = (fileInfo: FileInfo) => {
      const { roomId, id } = fileInfo

      if (!roomFilesMap[roomId]) {
        roomFilesMap[roomId] = {}
      }

      roomFilesMap[roomId][id] = fileInfo
    }

    /**
     * 지정된 방의 파일 제거
     */
    const removeFile = (roomId: string, fileId: string) => {
      if (roomFilesMap[roomId] && roomFilesMap[roomId][fileId]) {
        delete roomFilesMap[roomId][fileId]
      }
    }

    /**
     * 지정된 방의 모든 파일 지우기
     */
    const clearRoomFiles = (roomId: string) => {
      if (roomFilesMap[roomId]) {
        roomFilesMap[roomId] = {}
      }
    }

    /**
     * 지정된 파일 정보 가져오기
     */
    const getFile = (roomId: string, fileId: string): FileInfo | undefined => {
      return roomFilesMap[roomId]?.[fileId]
    }

    /**
     * 로컬 디렉토리 스캔 및 file store 채우기
     * 초기화 시 기존 파일을 로드하는 데 사용
     * 주의: 이 기능은 모바일에서만 사용 가능
     */
    const scanLocalFiles = async (roomId: string) => {
      // 모바일에서만 로컬 파일 스캔 지원
      if (!isMobile()) {
        console.warn('scanLocalFiles는 모바일에서만 사용할 수 있습니다')
        return 0
      }

      try {
        const userStore = useUserStore()

        // 사용자 데이터 디렉토리 가져오기
        const userRoomDir = await userStore.getUserRoomDir()

        // 절대 경로 가져오기 (모바일은 AppData 사용)
        const baseDirPath = await appDataDir()
        const absolutePath = await join(baseDirPath, userRoomDir)

        // 디렉토리 내용 읽기
        const entries = await readDir(absolutePath)

        // 이미지 및 비디오 확장자
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
        const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm']

        let addedCount = 0

        for (const entry of entries) {
          if (!entry.isFile) continue

          const fileName = entry.name
          const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))

          let fileType: 'image' | 'video' | null = null
          let mimeType = ''

          if (imageExtensions.includes(ext)) {
            fileType = 'image'
            mimeType = `image/${ext === '.jpg' ? 'jpeg' : ext.substring(1)}`
          } else if (videoExtensions.includes(ext)) {
            fileType = 'video'
            mimeType = `video/${ext.substring(1)}`
          }

          if (fileType) {
            // 파일명을 ID로 사용 (원본 메시지 ID를 모르기 때문)
            const fileId = fileName.substring(0, fileName.lastIndexOf('.'))

            // 파일 URL 구성 (상대 경로 사용, getUserRoomDir 반환 형식과 일치)
            const fileUrl = await join(userRoomDir, fileName)

            addFile({
              id: fileId,
              roomId,
              fileName,
              type: fileType,
              url: fileUrl,
              suffix: ext.substring(1),
              mimeType
            })

            addedCount++
          }
        }

        return addedCount
      } catch (error) {
        console.error('로컬 파일 스캔 실패:', error)
        return 0
      }
    }

    return {
      // 상태
      roomFilesMap: readonly(roomFilesMap),

      // 계산된 속성
      getRoomFiles,
      getRoomFileCount,

      // 메서드
      addFile,
      removeFile,
      clearRoomFiles,
      getFile,
      getRoomFilesForDisplay,
      scanLocalFiles
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
