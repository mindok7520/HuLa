import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'

export const useImageViewer = defineStore(
  StoresEnum.IMAGEVIEWER,
  () => {
    const imageList = ref<string[]>([])
    const currentIndex = ref(0)
    const originalImageList = ref<string[]>([])
    // 단일 이미지 모드 관련 변수
    const singleImage = ref('')
    const isSingleMode = ref(false)

    // 새로운 이미지 목록을 설정하기 위한 초기화 메서드 추가
    const resetImageList = (list: string[], originalIndex: number, originalList?: string[]) => {
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
      originalImageList.value = (originalList && originalList.length > 0 ? originalList : uniqueList).slice()
    }

    // 단일 이미지 설정 메서드
    const setSingleImage = (url: string) => {
      singleImage.value = url
      isSingleMode.value = true
      const singleList = url ? [url] : []
      originalImageList.value = singleList.slice()
      imageList.value = singleList.slice()
      currentIndex.value = 0
    }

    const updateImageAt = (index: number, newUrl: string) => {
      if (!imageList.value[index]) {
        return
      }
      imageList.value[index] = newUrl
    }

    const updateSingleImageSource = (url: string) => {
      if (isSingleMode.value) {
        singleImage.value = url
      }
    }

    return {
      imageList,
      currentIndex,
      resetImageList,
      originalImageList,
      singleImage,
      isSingleMode,
      setSingleImage,
      updateImageAt,
      updateSingleImageSource
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
