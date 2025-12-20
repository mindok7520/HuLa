import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'

export const useVideoViewer = defineStore(
  StoresEnum.VIDEOVIEWER,
  () => {
    const imageList = ref<string[]>([])
    const currentIndex = ref(0)
    // 단일 이미지 모드 관련 변수
    const singleImage = ref('')
    const isSingleMode = ref(false)

    // 비디오 관련 변수
    const videoList = ref<string[]>([])
    const currentVideoIndex = ref(0)

    // 새로운 이미지 목록을 설정하기 위한 초기화 메서드 추가
    const resetImageList = (list: string[], originalIndex: number) => {
      isSingleMode.value = false
      // 중복 제거된 새 배열 생성 및 원래 순서 유지
      const uniqueList: string[] = []
      const seenUrls = new Set<string>()

      for (const url of list) {
        if (!seenUrls.has(url)) {
          uniqueList.push(url)
          seenUrls.add(url)
        }
      }

      // 중복 제거된 새 목록에서 원본 이미지의 인덱스 찾기
      const newIndex = uniqueList.indexOf(list[originalIndex])

      imageList.value = uniqueList
      currentIndex.value = newIndex !== -1 ? newIndex : 0
    }

    // 단일 이미지 설정 메서드
    const setSingleImage = (url: string) => {
      singleImage.value = url
      isSingleMode.value = true
    }

    // 새로운 비디오 목록 설정에 사용
    const resetVideoListOptimized = (list: string[], originalIndex: number) => {
      const uniqueList: string[] = []
      const seenUrls = new Set<string>()

      for (const url of list) {
        if (!seenUrls.has(url)) {
          uniqueList.push(url)
          seenUrls.add(url)
        }
      }

      const newIndex = uniqueList.indexOf(list[originalIndex])

      videoList.value = uniqueList
      currentVideoIndex.value = newIndex !== -1 ? newIndex : 0
    }

    // 비디오 목록의 특정 비디오 경로 업데이트 (다운로드 완료 후 로컬 경로로 업데이트)
    const updateVideoPath = (originalUrl: string, newPath: string) => {
      const index = videoList.value.indexOf(originalUrl)
      if (index !== -1) {
        videoList.value[index] = newPath
      }
    }

    // 비디오 경로 일괄 업데이트 (로컬 경로 일괄 처리에 사용)
    const updateVideoListPaths = (pathMapping: Record<string, string>) => {
      videoList.value = videoList.value.map((url) => pathMapping[url] || url)
    }

    return {
      imageList,
      currentIndex,
      resetImageList,
      singleImage,
      isSingleMode,
      setSingleImage,
      videoList,
      currentVideoIndex,
      resetVideoListOptimized,
      updateVideoPath,
      updateVideoListPaths
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
