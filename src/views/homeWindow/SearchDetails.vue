<template>
  <n-flex :size="14" vertical justify="center" class="p-14px text-(12px #909090)">
    <!-- 검색 결과가 없을 때 추천 및 히스토리 표시 -->
    <template v-if="searchResults.length === 0 && !searchQuery">
      <!-- 검색 추천 -->
      <p class="text-(12px #909090)">{{ t('home.search_suggestions') }}</p>
      <n-flex align="center" class="text-(12px #909090)">
        <p class="p-6px bg-[--search-color] rounded-8px cursor-pointer" @click="applySearchTerm('hula')">hula</p>
      </n-flex>

      <span :class="{ 'mb-10px': historyList.length > 0 }" class="w-full h-1px bg-[--line-color]"></span>

      <!-- 히스토리 -->
      <n-flex v-if="historyList.length > 0" align="center" justify="space-between">
        <p class="text-(12px #909090)">{{ t('home.search_history') }}</p>
        <p class="cursor-pointer text-(12px #13987f)" @click="clearHistory">{{ t('home.clear_search_history') }}</p>
      </n-flex>

      <n-flex
        v-else
        align="center"
        :size="14"
        class="p-6px mb-6px mr-10px cursor-pointer rounded-8px hover:bg-[--list-hover-color]">
        <n-avatar :size="38" round src="msgAction/clapping.png" />
        <p class="text-(12px [--chat-text-color]) flex-1 truncate">{{ t('home.search_guide') }}</p>
      </n-flex>

      <n-scrollbar style="max-height: calc(100vh / var(--page-scale, 1) - 212px)">
        <template v-for="(item, _index) in historyList" :key="_index">
          <n-flex
            align="center"
            :size="14"
            class="p-6px mb-6px mr-10px cursor-pointer rounded-8px hover:bg-[--list-hover-color]"
            @click="openConversation(item)">
            <n-avatar :size="38" round bordered :src="AvatarUtils.getAvatarUrl(item.avatar)" />
            <p class="text-(14px [--text-color]) flex-1 truncate">{{ item.name }}</p>
          </n-flex>
        </template>
      </n-scrollbar>
    </template>

    <!-- 검색 결과 -->
    <template v-else-if="searchResults.length > 0">
      <p class="text-(12px #909090) mb-6px">{{ t('home.search_result') }}</p>

      <n-scrollbar style="max-height: calc(100vh / var(--page-scale, 1) - 118px)">
        <template v-for="item in searchResults" :key="item.roomId">
          <n-flex
            align="center"
            :size="14"
            class="p-6px mb-6px mr-10px cursor-pointer rounded-8px hover:bg-[--list-hover-color]"
            @click="openConversation(item)">
            <n-avatar :size="38" round bordered :src="AvatarUtils.getAvatarUrl(item.avatar)" />
            <p class="text-(14px [--text-color])">{{ item.name }}</p>
          </n-flex>
        </template>
      </n-scrollbar>
    </template>

    <!-- 검색 결과가 없을 때 -->
    <template v-else-if="searchQuery && searchResults.length === 0">
      <div style="height: calc(100vh / var(--page-scale, 1) - 212px)" class="flex-col-center gap-12px">
        <img class="size-64px" src="/msgAction/exploding-head.png" />
        <p class="text-(12px [--chat-text-color])">{{ t('home.no_search_results') }}</p>
      </div>
    </template>
  </n-flex>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { MittEnum, RoomTypeEnum } from '@/enums'
import { useCommon } from '@/hooks/useCommon.ts'
import { useMitt } from '@/hooks/useMitt'
import { useChatStore } from '@/stores/chat.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useI18n } from 'vue-i18n'

type SessionItem = {
  avatar: string
  name: string
  id?: string
  detailId: string
  roomId: string
  type: number
}
type HistoryItem = {
  avatar: string
  name: string
  id: string
  detailId: string
  roomId: string
  type: number
  timestamp?: number
}

const { t } = useI18n()
const router = useRouter()
const chatStore = useChatStore()
const { openMsgSession } = useCommon()
// 라우트 파라미터 또는 공유 상태에서 검색 쿼리 가져오기
const searchQuery = ref('')
// 검색 결과
const searchResults = ref<SessionItem[]>([])
// 히스토리 - localStorage에 저장
const HISTORY_STORAGE_KEY = 'HULA_SEARCH_HISTORY'
const historyList = ref<HistoryItem[]>([])

// 검색창 입력 변화 감지
useMitt.on('search_input_change', (value) => {
  searchQuery.value = value
  handleSearch(value)
})

// 검색 처리
const handleSearch = (value: string) => {
  if (!value) {
    searchResults.value = []
    return
  }
  // 이름과 마지막 메시지 내용을 기준으로 검색 일치 확인
  searchResults.value = chatStore.sessionList.filter((session) => {
    // 이름에서 검색
    const nameMatch = session.name.toLowerCase().includes(value.toLowerCase())
    return nameMatch
  })
  // 검색 키워드가 있는 경우 키워드 히스토리에 저장 가능 (현재는 저장하지 않음)
  if (value) {
    saveToHistory(value)
  }
}

// 검색어 적용
const applySearchTerm = (term: string) => {
  searchQuery.value = term
  handleSearch(term)
}

// 히스토리 로드
const loadHistory = () => {
  try {
    const history = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (history) {
      historyList.value = JSON.parse(history)
      // 타임스탬프 내림차순 정렬, 최근 방문 항목을 앞으로
      historyList.value.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      // 상위 10개 기록만 유지
      if (historyList.value.length > 10) {
        historyList.value = historyList.value.slice(0, 10)
        // localStorage에 동기화
        saveHistoryToStorage()
      }
    }
  } catch (error) {
    console.error('히스토리 로드 실패:', error)
    // 로드 실패 시 빈 배열로 초기화
    historyList.value = []
  }
}

// 히스토리를 localStorage에 저장
const saveHistoryToStorage = () => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyList.value))
  } catch (error) {
    console.error('히스토리 저장 실패:', error)
  }
}

// 검색 키워드를 히스토리에 저장
const saveToHistory = (term: string) => {
  console.log(`검색 기록 저장: ${term}`)
  // 키워드 검색 기록 저장 구현 가능
}

// 세션을 히스토리에 저장
const saveSessionToHistory = (session: SessionItem) => {
  // 세션 데이터가 충분한지 확인
  if (!session || !session.roomId) return

  // 히스토리 항목 생성
  const historyItem: HistoryItem = {
    avatar: session.avatar || '',
    name: session.name || '',
    id: session.id || session.detailId,
    detailId: session.detailId,
    roomId: session.roomId,
    type: session.type || RoomTypeEnum.SINGLE,
    timestamp: Date.now() // 현재 타임스탬프 추가
  }

  // 동일한 기록이 이미 존재하는지 확인
  const existingIndex = historyList.value.findIndex((item) => item.roomId === session.roomId)

  if (existingIndex !== -1) {
    // 이미 존재하면 삭제 (나중에 목록 맨 앞에 추가됨)
    historyList.value.splice(existingIndex, 1)
  }

  // 새 기록을 목록 맨 앞에 추가
  historyList.value.unshift(historyItem)

  // 히스토리 기록 수를 10개로 제한
  if (historyList.value.length > 10) {
    historyList.value = historyList.value.slice(0, 10)
  }

  // localStorage에 저장
  saveHistoryToStorage()
}

// 히스토리 삭제
const clearHistory = () => {
  historyList.value = []
  // localStorage에서 기록 삭제
  localStorage.removeItem(HISTORY_STORAGE_KEY)
}

// 세션 열기
const openConversation = async (item: SessionItem | HistoryItem) => {
  // 세션을 히스토리에 저장
  saveSessionToHistory(item)
  // 검색 기록 저장
  if (searchQuery.value) {
    saveToHistory(searchQuery.value)
  }
  // 이전 페이지로 이동 (검색 페이지 닫기)
  router.go(-1)
  // 해당 세션 열기
  const id = item.type === RoomTypeEnum.GROUP ? item.roomId : item.detailId
  await openMsgSession(id, item.type)
  // 해당 세션으로 위치 이동 (채팅 목록을 선택된 세션으로 스크롤)
  nextTick(() => {
    useMitt.emit(MittEnum.LOCATE_SESSION, { roomId: item.roomId })
  })
}

onMounted(() => {
  // 히스토리 로드
  loadHistory()
})
</script>
