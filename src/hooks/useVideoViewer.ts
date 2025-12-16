import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { BaseDirectory, exists } from '@tauri-apps/plugin-fs'
import { MsgEnum } from '@/enums'
import { useWindow } from '@/hooks/useWindow'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'
import { useVideoViewer as useVideoViewerStore } from '@/stores/videoViewer'
import { isMobile } from '@/utils/PlatformConstants'

/** 비디오 처리 */
export const useVideoViewer = () => {
  const { createWebviewWindow } = useWindow()
  const VideoViewerStore = useVideoViewerStore()
  const userStore = useUserStore()

  // 비디오 파일명 가져오기
  const getVideoFilename = (url: string) => {
    if (!url) return 'video.mp4'
    // URL에서 파일명 추출
    const urlParts = url.split('/')
    const filename = urlParts[urlParts.length - 1]
    if (filename && filename.includes('.')) {
      return filename
    }
    return 'video.mp4'
  }

  // // 생략된 비디오 파일명 가져오기
  // const getVideoFilenameEllipsis = (url: string, maxLength: number = 20) => {
  //   const filename = getVideoFilename(url)
  //   if (filename.length <= maxLength) {
  //     return filename
  //   }

  //   // 마지막 점 위치 찾기 (파일 확장자)
  //   const lastDotIndex = filename.lastIndexOf('.')
  //   if (lastDotIndex === -1) {
  //     // 확장자가 없으면 직접 자르기
  //     return filename.substring(0, maxLength - 3) + '...'
  //   }

  //   const extension = filename.substring(lastDotIndex)
  //   const nameWithoutExt = filename.substring(0, lastDotIndex)

  //   // 파일명 본문에 사용할 수 있는 길이 계산 (확장자 및 줄임표 길이 제외)
  //   const availableLength = maxLength - extension.length - 3

  //   if (availableLength <= 0) {
  //     // 확장자가 너무 길면 줄임표와 확장자만 표시
  //     return '...' + extension
  //   }

  //   return nameWithoutExt.substring(0, availableLength) + '...' + extension
  // }

  // 로컬 비디오 경로 가져오기
  const getLocalVideoPath = async (url: string) => {
    if (!url) return ''
    const filename = getVideoFilename(url)
    const videosDir = await userStore.getUserRoomDir()
    return await join(videosDir, filename)
  }

  // 비디오가 로컬에 다운로드되었는지 확인
  const checkVideoDownloaded = async (url: string) => {
    if (!url) return false
    try {
      const localPath = await getLocalVideoPath(url)
      if (localPath) {
        const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
        return await exists(localPath, { baseDir })
      }
    } catch (error) {
      console.error('비디오 다운로드 상태 확인 실패:', error)
    }
    return false
  }

  // 비디오의 실제 재생 경로 가져오기 (로컬 경로 우선)
  const getVideoPlayPath = async (url: string) => {
    const isDownloaded = await checkVideoDownloaded(url)
    if (isDownloaded) {
      const localPath = await getLocalVideoPath(url)
      // 다운로드 시와 동일한 기본 디렉토리 사용
      const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
      return await join(baseDirPath, localPath)
    }
    return url
  }

  // 미디어 가져오기 (유형 필터링 및 인덱스 위치 지정 지원)
  const getAllMediaFromChat = (url: string, includeTypes: MsgEnum[] = [MsgEnum.VIDEO]) => {
    const chatStore = useChatStore()
    const messages = [...Object.values(chatStore.currentMessageMap || {})]
    const mediaUrls: string[] = []
    let currentIndex = -1
    messages.forEach((msg) => {
      if (includeTypes.includes(msg.message?.type) && msg.message.body?.url) {
        const isTarget = msg.message.body.url === url
        mediaUrls.push(msg.message.body.url)
        // 요소 추가 후 대상 URL인지 판단
        if (isTarget) {
          currentIndex = mediaUrls.length - 1 // 배열의 마지막 인덱스 사용
        }
      }
    })
    return {
      list: mediaUrls,
      index: Math.max(currentIndex, 0)
    }
  }

  /**
   * 비디오 로드 처리
   * @param url 비디오 링크
   * @param includeTypes 지원 유형
   * @param customVideoList 사용자 정의 비디오 목록, 채팅 기록 등 시나리오에 사용
   */
  const openVideoViewer = async (
    url: string,
    includeTypes: MsgEnum[] = [MsgEnum.VIDEO],
    customVideoList?: string[]
  ) => {
    if (isMobile()) return
    if (!url) return

    let list: string[]
    let index: number

    if (customVideoList && customVideoList.length > 0) {
      // 사용자 정의 비디오 목록 사용
      list = customVideoList
      index = customVideoList.indexOf(url)
      if (index === -1) {
        // 현재 비디오가 목록에 없으면 목록 맨 앞에 추가
        list = [url, ...customVideoList]
        index = 0
      }
    } else {
      // 채팅에서 가져오는 기본 로직 사용
      const result = getAllMediaFromChat(url, includeTypes)
      list = result.list
      index = result.index
    }

    // 각 비디오 URL에 대해 로컬 다운로드 상태 확인, 로컬 경로 우선 사용
    const processedList = await Promise.all(
      list.map(async (videoUrl) => {
        return await getVideoPlayPath(videoUrl)
      })
    )

    // 처리된 목록에서 현재 비디오의 인덱스 찾기
    const currentVideoPath = await getVideoPlayPath(url)
    const processedIndex = processedList.findIndex((path) => path === currentVideoPath || path === url)
    const finalIndex = processedIndex !== -1 ? processedIndex : index

    // 목록 모드 통일 사용, 단일 비디오 모드 구분 안 함
    VideoViewerStore.resetVideoListOptimized(processedList, finalIndex)
    VideoViewerStore.$patch({
      videoList: [...processedList],
      currentVideoIndex: finalIndex
    })

    // 기존 창 확인
    const existingWindow = await WebviewWindow.getByLabel('videoViewer')
    if (existingWindow) {
      await existingWindow.emit('video-updated', {
        list: processedList,
        index: finalIndex,
        currentVideoPath
      })
      await existingWindow.show()
      await existingWindow.setFocus()
      return
    }

    await createWebviewWindow('비디오 뷰어', 'videoViewer', 800, 600, '', true, 800, 600)
  }

  return {
    openVideoViewer,
    getLocalVideoPath,
    checkVideoDownloaded,
    getVideoFilename
  }
}
