import { convertFileSrc } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { MsgEnum } from '@/enums'
import { useWindow } from '@/hooks/useWindow'
import { useChatStore } from '@/stores/chat'
import { useFileDownloadStore } from '@/stores/fileDownload'
import { useImageViewer as useImageViewerStore } from '@/stores/imageViewer'
import type { FilesMeta } from '@/services/types'
import { extractFileName } from '@/utils/Formatting'
import { getFilesMeta } from '@/utils/PathUtil'

type WorkerResponse = {
  success: boolean
  url: string
  buffer?: ArrayBuffer
  error?: string
}

type WorkerRequest = {
  resolve: (value: string | null) => void
  reject: (reason?: unknown) => void
  fileName: string
}

const workerRequests = new Map<string, WorkerRequest>()
let imageDownloadWorker: Worker | null = null
const imageDownloaderWorkerUrl = new URL('../workers/imageDownloader.ts', import.meta.url)

const ensureWorker = () => {
  if (imageDownloadWorker || typeof window === 'undefined') return
  imageDownloadWorker = new Worker(imageDownloaderWorkerUrl, { type: 'module' })
  imageDownloadWorker.onmessage = async (event: MessageEvent<WorkerResponse>) => {
    const { success, url, buffer, error } = event.data
    const request = workerRequests.get(url)
    if (!request) {
      return
    }
    workerRequests.delete(url)

    if (!success || !buffer) {
      request.reject(new Error(error || '다운로드 실패'))
      return
    }

    try {
      const fileDownloadStore = useFileDownloadStore()
      const absolutePath = await fileDownloadStore.saveFileFromBytes(url, request.fileName, new Uint8Array(buffer))
      request.resolve(absolutePath)
    } catch (err) {
      request.reject(err)
    }
  }
}

const downloadImageWithWorker = (url: string, fileName: string) => {
  ensureWorker()
  if (!imageDownloadWorker) {
    return Promise.reject(new Error('Web Worker 사용 불가'))
  }

  const existing = workerRequests.get(url)
  if (existing) {
    return new Promise<string | null>((resolve, reject) => {
      const prevResolve = existing.resolve
      const prevReject = existing.reject
      existing.resolve = (value) => {
        prevResolve(value)
        resolve(value)
      }
      existing.reject = (reason) => {
        prevReject(reason)
        reject(reason)
      }
    })
  }

  const promise = new Promise<string | null>((resolve, reject) => {
    workerRequests.set(url, { resolve, reject, fileName })
    imageDownloadWorker!.postMessage({ url })
  })

  return promise
}

const deduplicateList = (list: string[]) => {
  const uniqueList: string[] = []
  const seen = new Set<string>()
  list.forEach((url) => {
    if (url && !seen.has(url)) {
      seen.add(url)
      uniqueList.push(url)
    }
  })
  return uniqueList
}

/**
 * 이미지와 이모티콘 보기 기능을 처리하는 이미지 뷰어 훅
 */
export const useImageViewer = () => {
  const chatStore = useChatStore()
  const { createWebviewWindow } = useWindow()
  const imageViewerStore = useImageViewerStore()
  const fileDownloadStore = useFileDownloadStore()

  const ensureLocalFileExists = async (url: string) => {
    if (!url) return null
    const status = fileDownloadStore.getFileStatus(url)
    const validatePath = async (absolutePath: string | undefined | null) => {
      if (!absolutePath) {
        return null
      }
      try {
        const [meta] = await getFilesMeta<FilesMeta>([absolutePath])
        if (meta?.exists) {
          return absolutePath
        }
        return null
      } catch (error) {
        console.error('로컬 이미지 확인 실패:', error)
        return null
      }
    }

    if (status?.isDownloaded) {
      const validPath = await validatePath(status.absolutePath)
      if (validPath) {
        return validPath
      }

      fileDownloadStore.updateFileStatus(url, {
        isDownloaded: false,
        absolutePath: '',
        localPath: '',
        nativePath: '',
        displayPath: '',
        status: 'pending',
        progress: 0
      })
    }

    const fileName = extractFileName(url)
    if (!fileName) {
      return null
    }

    try {
      const exists = await fileDownloadStore.checkFileExists(url, fileName)
      if (!exists) {
        return null
      }

      const refreshedStatus = fileDownloadStore.getFileStatus(url)
      return await validatePath(refreshedStatus.absolutePath)
    } catch (error) {
      console.error('로컬 이미지 재확인 실패:', error)
      return null
    }
  }

  const getDisplayUrl = async (url: string) => {
    const localPath = await ensureLocalFileExists(url)
    if (localPath) {
      try {
        return convertFileSrc(localPath)
      } catch (error) {
        console.error('로컬 이미지 경로 변환 실패:', error)
      }
    }
    return url
  }

  const getLocalMediaPathFromChat = (url: string, includeTypes: MsgEnum[]) => {
    const messages = Object.values(chatStore.currentMessageMap || {})
    for (const msg of messages) {
      if (!includeTypes.includes(msg.message?.type)) continue
      if (msg.message.body?.url !== url) continue
      if (msg.message.body?.localPath) {
        return msg.message.body.localPath as string
      }
    }
    return null
  }

  const resolveDisplayUrl = async (url: string, includeTypes: MsgEnum[]) => {
    const localPath = getLocalMediaPathFromChat(url, includeTypes)
    if (localPath) {
      try {
        return convertFileSrc(localPath)
      } catch (error) {
        console.error('로컬 미디어 경로 변환 실패:', error)
      }
    }
    return await getDisplayUrl(url)
  }

  const replaceImageWithLocalPath = (originalUrl: string, absolutePath: string) => {
    const index = imageViewerStore.originalImageList.indexOf(originalUrl)
    if (index === -1) {
      return
    }
    try {
      const displayUrl = convertFileSrc(absolutePath)
      imageViewerStore.updateImageAt(index, displayUrl)
      imageViewerStore.updateSingleImageSource(displayUrl)
    } catch (error) {
      console.error('로컬 이미지 경로 교체 실패:', error)
    }
  }

  const scheduleDownload = (originalUrl: string) => {
    const fileName = extractFileName(originalUrl) || `image-${Date.now()}.png`
    downloadImageWithWorker(originalUrl, fileName)
      .then((absolutePath) => {
        if (absolutePath) {
          replaceImageWithLocalPath(originalUrl, absolutePath)
        }
      })
      .catch((error) => {
        console.error('이미지 다운로드 실패:', error)
      })
  }

  const downloadOriginalByIndex = (index: number) => {
    if (index < 0) {
      return
    }
    const originalUrl = imageViewerStore.originalImageList[index]
    if (!originalUrl) {
      return
    }
    const displayUrl = imageViewerStore.imageList[index]
    if (!displayUrl || displayUrl !== originalUrl) {
      return
    }
    scheduleDownload(originalUrl)
  }

  /**
   * 현재 채팅의 모든 이미지 및 이모티콘 URL 가져오기
   * @param currentUrl 현재 보고 있는 URL
   * @param includeTypes 포함할 메시지 유형 배열
   */
  const getAllMediaFromChat = (currentUrl: string, includeTypes: MsgEnum[] = [MsgEnum.IMAGE, MsgEnum.EMOJI]) => {
    const messages = [...Object.values(chatStore.currentMessageMap || {})]
    const mediaUrls: string[] = []
    let currentIndex = 0

    messages.forEach((msg) => {
      // 지정된 유형의 미디어 URL 수집
      if (includeTypes.includes(msg.message?.type) && msg.message.body?.url) {
        mediaUrls.push(msg.message.body.url)
        // 현재 미디어의 인덱스 찾기
        if (msg.message.body.url === currentUrl) {
          currentIndex = mediaUrls.length - 1
        }
      }
    })

    return {
      list: mediaUrls,
      index: currentIndex
    }
  }

  /**
   * 이미지 뷰어 열기
   * @param url 볼 URL
   * @param includeTypes 뷰어에 포함할 메시지 유형
   * @param customImageList 사용자 지정 이미지 목록 (채팅 기록 등)
   */
  const openImageViewer = async (
    url: string,
    includeTypes: MsgEnum[] = [MsgEnum.IMAGE, MsgEnum.EMOJI],
    customImageList?: string[]
  ) => {
    if (!url) return

    try {
      let list: string[]
      let index: number

      if (customImageList && customImageList.length > 0) {
        // 사용자 지정 이미지 목록 사용
        list = customImageList
        index = customImageList.indexOf(url)
        if (index === -1) {
          // 현재 이미지가 목록에 없으면 목록 맨 앞에 추가
          list = [url, ...customImageList]
          index = 0
        }
      } else {
        // 기본 로직을 사용하여 채팅에서 가져오기
        const result = getAllMediaFromChat(url, includeTypes)
        list = result.list
        index = result.index
      }

      const dedupedList = deduplicateList(list)
      const resolvedList = await Promise.all(dedupedList.map((item) => resolveDisplayUrl(item, includeTypes)))

      const targetIndex = dedupedList.indexOf(url)
      const resolvedIndex = targetIndex === -1 ? (index >= 0 ? index : 0) : targetIndex

      imageViewerStore.resetImageList(resolvedList, resolvedIndex, dedupedList)

      // 이미지 뷰어 창이 이미 존재하는지 확인
      const existingWindow = await WebviewWindow.getByLabel('imageViewer')

      if (existingWindow) {
        // 창이 이미 존재하면 이미지 내용을 업데이트하고 창 표시
        await existingWindow.emit('update-image', { list: resolvedList, index: resolvedIndex })
        await existingWindow.show()
        await existingWindow.setFocus()
        return
      }

      const img = new Image()
      img.src = resolvedList[resolvedIndex] || url

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      // 기본 창 크기 (최소 크기)
      const MIN_WINDOW_WIDTH = 630
      const MIN_WINDOW_HEIGHT = 660
      // 실제 창 크기 계산 (여백 유지)
      const MARGIN = 100 // 창 여백
      let windowWidth = MIN_WINDOW_WIDTH
      let windowHeight = MIN_WINDOW_HEIGHT

      // 화면 크기 가져오기
      const { width: screenWidth, height: screenHeight } = window.screen

      // 최대 사용 가능 크기 계산 (여백 고려)
      const maxWidth = screenWidth - MARGIN * 2
      const maxHeight = screenHeight - MARGIN * 2

      // 이미지 비율 유지하며 창 크기 계산
      const imageRatio = img.width / img.height

      // 실제 창 크기 계산
      if (img.width > MIN_WINDOW_WIDTH || img.height > MIN_WINDOW_HEIGHT) {
        if (imageRatio > maxWidth / maxHeight) {
          // 너비 기준
          windowWidth = Math.min(img.width + MARGIN, maxWidth)
          windowHeight = Math.max(windowWidth / imageRatio + MARGIN, MIN_WINDOW_HEIGHT)
        } else {
          // 높이 기준
          windowHeight = Math.min(img.height + MARGIN, maxHeight)
          windowWidth = Math.max(windowHeight * imageRatio + MARGIN, MIN_WINDOW_WIDTH)
        }
      }

      // 계산된 크기로 창 생성
      await createWebviewWindow(
        '이미지 보기',
        'imageViewer',
        Math.round(windowWidth),
        Math.round(windowHeight),
        '',
        true,
        Math.round(windowWidth),
        Math.round(windowHeight)
      )
    } catch (error) {
      console.error('이미지 뷰어 열기 실패:', error)
    }
  }

  return {
    getAllMediaFromChat,
    openImageViewer,
    downloadOriginalByIndex
  }
}
