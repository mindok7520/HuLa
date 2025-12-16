import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'

export const useHistoryStore = defineStore(
  StoresEnum.HISTORY,
  () => {
    const emoji = ref<string[]>([])
    // 마지막으로 선택된 이모티콘 탭 인덱스 기록
    const lastEmojiTabIndex = ref<number>(0)

    const setEmoji = (item: string[]) => {
      emoji.value = item
    }

    // 마지막으로 선택된 이모티콘 탭 인덱스 설정
    const setLastEmojiTabIndex = (index: number) => {
      lastEmojiTabIndex.value = index
    }

    return {
      emoji,
      setEmoji,
      lastEmojiTabIndex,
      setLastEmojiTabIndex
    }
  },
  {
    share: {
      enable: true
    }
  }
)
