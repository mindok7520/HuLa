import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { BaseDirectory, exists, writeFile } from '@tauri-apps/plugin-fs'
import { sumBy } from 'es-toolkit'
import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import type { FilesMeta } from '@/services/types'
import { useUserStore } from '@/stores/user'
import { getFilesMeta } from '@/utils/PathUtil'
import { isMobile } from '../utils/PlatformConstants'

export interface FileDownloadStatus {
  /** 파일 다운로드 완료 여부 */
  isDownloaded: boolean
  /** 로컬 파일 상대 경로 (Resource 디렉토리 기준) */
  localPath?: string
  /** 로컬 파일 절대 경로 */
  absolutePath?: string
  /** 네이티브 경로 형식 (파일 작업용) */
  nativePath?: string
  /** 표시 경로 형식 (정규화 후) */
  displayPath?: string
  /** 다운로드 상태 */
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  /** 다운로드 진행률 */
  progress?: number
  /** 오류 메시지 */
  error?: string
}

export const useFileDownloadStore = defineStore(
  StoresEnum.FILE_DOWNLOAD,
  () => {
    const userStore = useUserStore()

    // 파일 다운로드 상태를 저장하는 Map, key는 파일 URL, value는 다운로드 상태
    const downloadStatusMap = ref<Record<string, FileDownloadStatus>>({})

    /**
     * 파일 다운로드 상태 가져오기
     * @param fileUrl 파일 URL
     */
    const getFileStatus = (fileUrl: string): FileDownloadStatus => {
      return (
        downloadStatusMap.value[fileUrl] || {
          isDownloaded: false,
          status: 'pending'
        }
      )
    }

    /**
     * 파일 다운로드 상태 업데이트
     * @param fileUrl 파일 URL
     * @param status 상태 업데이트
     */
    const updateFileStatus = (fileUrl: string, status: Partial<FileDownloadStatus>) => {
      const currentStatus = getFileStatus(fileUrl)
      const newStatus = { ...currentStatus, ...status }
      downloadStatusMap.value[fileUrl] = newStatus
    }

    /**
     * 파일 메시지의 다운로드 상태 새로 고침
     */
    const refreshFileDownloadStatus = async (options: {
      fileUrl: string
      userId: string
      roomId: string
      fileName: string
      exists?: boolean
    }) => {
      console.log('상태 새로 고침 트리거:', options)
      const fileStatus = downloadStatusMap.value[options.fileUrl]

      const resetStatus = () => {
        if (fileStatus) {
          fileStatus.isDownloaded = false
          fileStatus.absolutePath = ''
          fileStatus.displayPath = ''
          fileStatus.localPath = ''
          fileStatus.nativePath = ''
          fileStatus.progress = 0
          fileStatus.status = 'pending'
        }
      }

      const updateSuccess = (absolutePath: string) => {
        if (fileStatus) {
          const normalizedPath = absolutePath.replace(/\\/g, '/')
          fileStatus.isDownloaded = true
          fileStatus.nativePath = absolutePath
          fileStatus.absolutePath = absolutePath
          fileStatus.displayPath = normalizedPath
        }
      }

      const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
      const absolutePath = await join(resourceDirPath, options.fileName)

      // 파일이 존재하지 않는 것을 알고 있다면 바로 새로 고침, 모르면 추가 처리
      if (Object.hasOwn(options, 'exists')) {
        if (options.exists && fileStatus?.isDownloaded) {
          console.log('일치 1')
          return
        }

        if (options.exists) {
          console.log('일치 2')
          updateSuccess(absolutePath)
          return
        }

        if (options.exists && !fileStatus?.isDownloaded) {
          console.log('일치 3')
          updateSuccess(absolutePath)
          return
        }

        if (!options.exists && fileStatus?.isDownloaded) {
          console.log('일치 4')
          resetStatus()
          return
        }

        if (!options.exists && fileStatus?.isDownloaded) {
          console.log('일치 5')
          resetStatus()
          return
        }
        console.log('일치 6')

        resetStatus()
        return
      }

      // exists 필드를 찾지 못한 경우의 로직
      const result = await getFilesMeta<FilesMeta>([absolutePath || options.fileUrl])
      const fileMeta = result[0]

      if (fileMeta.exists) {
        // 상태를 완료로 업데이트
        updateSuccess(absolutePath)
        console.log('일치 7')
      } else {
        // 상태를 미완료로 업데이트
        resetStatus()
        console.log('일치 8')
      }
    }

    /**
     * 파일 다운로드 완료 여부 확인
     * @param fileUrl 파일 URL
     * @param fileName 파일명
     */
    const checkFileExists = async (fileUrl: string, fileName: string): Promise<boolean> => {
      try {
        const downloadsDir = await userStore.getUserRoomDir()
        const filePath = await join(downloadsDir, fileName)

        const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
        const fileExists = await exists(filePath, { baseDir })

        if (fileExists) {
          // 파일이 존재하면 절대 경로를 구축하고 상태 업데이트
          const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
          const absolutePath = await join(baseDirPath, filePath)

          // 파일 작업을 위해 네이티브 경로 형식 유지, 표시는 정규화된 경로 사용
          const normalizedPath = absolutePath.replace(/\\/g, '/')

          updateFileStatus(fileUrl, {
            isDownloaded: true,
            localPath: filePath,
            absolutePath: absolutePath, // 네이티브 경로 형식 사용
            nativePath: absolutePath, // 네이티브 경로 저장
            displayPath: normalizedPath, // 표시 경로 저장
            status: 'completed'
          })
        }

        return fileExists
      } catch (error) {
        console.error('파일 존재 여부 확인 실패:', error)
        return false
      }
    }

    const finalizeSuccessfulWrite = (fileUrl: string, _fileName: string, absolutePath: string, localPath: string) => {
      const normalizedPath = absolutePath.replace(/\\/g, '/')
      updateFileStatus(fileUrl, {
        isDownloaded: true,
        localPath,
        absolutePath,
        nativePath: absolutePath,
        displayPath: normalizedPath,
        status: 'completed',
        progress: 100
      })
    }

    /**
     * 파일 다운로드
     * @param fileUrl 파일 URL
     * @param fileName 파일명
     */
    const downloadFile = async (fileUrl: string, fileName: string): Promise<string | null> => {
      try {
        // 파일 존재 여부 확인
        const isExists = await checkFileExists(fileUrl, fileName)
        if (isExists) {
          const existingStatus = getFileStatus(fileUrl)
          return existingStatus.localPath || null
        }

        // 상태를 다운로드 중으로 업데이트
        updateFileStatus(fileUrl, {
          status: 'downloading',
          progress: 0
        })

        // 다운로드 디렉토리 가져오기
        const downloadsDir = await userStore.getUserRoomDir()
        const filePath = await join(downloadsDir, fileName)

        // 파일 다운로드
        const response = await fetch(fileUrl)
        if (!response.ok) {
          throw new Error(`다운로드 실패: ${response.status} ${response.statusText}`)
        }

        const contentLength = response.headers.get('content-length')
        const total = contentLength ? parseInt(contentLength, 10) : 0
        let downloaded = 0

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('응답 스트림을 읽을 수 없습니다')
        }

        const chunks: Uint8Array[] = []

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          downloaded += value.length

          // 다운로드 진행률 업데이트
          if (total > 0) {
            const progress = Math.round((downloaded / total) * 100)
            updateFileStatus(fileUrl, {
              status: 'downloading',
              progress
            })
          }
        }

        // 모든 데이터 청크 병합
        const totalLength = sumBy(chunks, (chunk) => chunk.length)
        const fileData = new Uint8Array(totalLength)
        let offset = 0

        for (const chunk of chunks) {
          fileData.set(chunk, offset)
          offset += chunk.length
        }

        // 파일 쓰기
        const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
        await writeFile(filePath, fileData, { baseDir })

        // 절대 경로 구축
        const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
        const absolutePath = await join(baseDirPath, filePath)

        finalizeSuccessfulWrite(fileUrl, fileName, absolutePath, filePath)
        return absolutePath // 네이티브 경로 형식 반환
      } catch (error) {
        console.error('파일 다운로드 실패:', error)

        // 상태를 실패로 업데이트
        updateFileStatus(fileUrl, {
          status: 'failed',
          error: error instanceof Error ? error.message : '다운로드 실패'
        })

        window.$message?.error(`파일 다운로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
        return null
      }
    }

    /**
     * worker가 다운로드한 바이트 데이터를 로컬 파일에 쓰기
     * @param fileUrl 파일 URL (상태 매핑 key로 사용)
     * @param fileName 파일명
     * @param data 파일 데이터
     */
    const saveFileFromBytes = async (fileUrl: string, fileName: string, data: Uint8Array): Promise<string | null> => {
      try {
        const downloadsDir = await userStore.getUserRoomDir()
        const filePath = await join(downloadsDir, fileName)
        const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource

        await writeFile(filePath, data, { baseDir })

        const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
        const absolutePath = await join(baseDirPath, filePath)

        finalizeSuccessfulWrite(fileUrl, fileName, absolutePath, filePath)
        return absolutePath
      } catch (error) {
        console.error('파일 저장 실패:', error)
        updateFileStatus(fileUrl, {
          status: 'failed',
          error: error instanceof Error ? error.message : '저장 실패'
        })
        return null
      }
    }

    /**
     * 로컬 파일 경로 가져오기
     * @param fileUrl 파일 URL
     * @param absolute 절대 경로 반환 여부, 기본값 true
     */
    const getLocalPath = (fileUrl: string, absolute: boolean = true): string | null => {
      const status = getFileStatus(fileUrl)
      if (!status.isDownloaded) return null

      return absolute ? status.absolutePath || null : status.localPath || null
    }

    /**
     * 다운로드 상태 정리
     */
    const clearDownloadStatus = () => {
      downloadStatusMap.value = {}
    }

    /**
     * 특정 파일의 다운로드 상태 제거
     * @param fileUrl 파일 URL
     */
    const removeFileStatus = (fileUrl: string) => {
      delete downloadStatusMap.value[fileUrl]
    }

    /**
     * 파일 상태 일괄 확인
     * @param fileInfos 파일 정보 배열
     */
    const batchCheckFileStatus = async (fileInfos: Array<{ url: string; fileName: string }>) => {
      const promises = fileInfos.map(({ url, fileName }) => checkFileExists(url, fileName))

      await Promise.all(promises)
    }

    return {
      getFileStatus,
      updateFileStatus,
      checkFileExists,
      downloadFile,
      saveFileFromBytes,
      getLocalPath,
      clearDownloadStatus,
      removeFileStatus,
      batchCheckFileStatus,
      refreshFileDownloadStatus
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
