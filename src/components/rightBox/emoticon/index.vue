<template>
  <n-scrollbar
    ref="panelScrollbarRef"
    style="max-height: 290px"
    :class="[isMobile() ? 'h-15rem w-auto' : 'h-290px w-460px', isSeriesView ? 'emoji-panel-series' : '']"
    class="p-[14px_14px_0_14px] box-border select-none"
    :size="isSeriesView ? 0 : undefined"
    :trigger="isSeriesView ? 'none' : undefined"
    @scroll="handlePanelScroll">
    <transition name="fade" mode="out-in">
      <div :key="activeIndex" class="emoji-content">
        <!-- 최근 사용 -->
        <div v-if="activeIndex === 0">
          <div v-if="emojiRef.historyList?.length > 0">
            <span v-if="!checkIsUrl(emojiRef.historyList[0])" class="text-12px text-[--text-color]">
              {{ t('emoticon.recent.title') }}
            </span>
            <n-flex align="center" :class="isMobile() ? 'emoji-grid-mobile mt-12px mb-12px' : 'mt-12px mb-12px'">
              <n-flex
                align="center"
                justify="center"
                class="emoji-item"
                v-for="(item, index) in [...new Set(emojiRef.historyList)].filter((emoji) => !checkIsUrl(emoji))"
                :key="index"
                @click.stop="chooseEmoji(item)">
                {{ item }}
              </n-flex>
            </n-flex>
          </div>

          <!-- emoji 이모지 -->
          <div v-for="items in emojiObj" :key="items?.name">
            <template v-if="items?.name && items.value?.length">
              <span class="text-12px text-[--text-color]">{{ items.name }}</span>
              <n-flex align="center" :class="isMobile() ? 'emoji-grid-mobile my-12px' : 'my-12px'">
                <n-flex
                  align="center"
                  justify="center"
                  class="emoji-item"
                  v-for="(item, index) in items.value"
                  :key="index"
                  @click.stop="chooseEmoji(item)">
                  {{ item }}
                </n-flex>
              </n-flex>
            </template>
          </div>
        </div>

        <!-- 이모지 팩 시리즈 -->
        <div v-else-if="currentSeries" class="series-virtual-wrapper">
          <span class="text-12px text-[--text-color] pl-12px">{{ currentSeries.name }}</span>
          <div class="series-virtual-container mt-12px">
            <n-virtual-list
              ref="seriesVirtualListRef"
              :items="displaySeriesRows"
              :item-size="seriesRowHeight"
              :style="{ height: seriesViewportHeight }"
              class="series-virtual-list"
              @scroll="handleSeriesScroll">
              <template #default="{ item }">
                <div
                  class="emoji-pack-row"
                  :style="{
                    gridTemplateColumns: `repeat(${packColumns}, 1fr)`,
                    gap: isMobile() ? '8px' : '12px'
                  }">
                  <div
                    class="emoji-item emoji-item--image"
                    v-for="(emojiItem, index) in item.emojis"
                    :key="index"
                    @click.stop="
                      chooseEmoji(
                        {
                          renderUrl: emojiItem.url,
                          serverUrl: emojiItem.url
                        },
                        'url'
                      )
                    ">
                    <img
                      :alt="emojiItem.name"
                      :title="emojiItem.name"
                      :src="emojiItem.url"
                      loading="lazy"
                      decoding="async"
                      class="emoji-image size-full object-contain rounded-8px transition duration-300 ease-in-out transform-gpu" />
                  </div>
                </div>
              </template>
            </n-virtual-list>
          </div>
        </div>

        <!-- 내가 좋아하는 페이지 -->
        <div v-else>
          <div v-if="emojiStore.emojiList?.length > 0">
            <span class="text-12px text-[--text-color]">{{ t('emoticon.favorites.title') }}</span>
            <n-flex align="center" :class="isMobile() ? 'emoji-pack-grid-mobile mx-6px my-12px' : 'mx-6px my-12px'">
              <n-flex
                align="center"
                justify="center"
                class="emoji-item emoji-item--image py-4px"
                v-for="(item, index) in displayFavoriteEmojis"
                :key="index"
                @click.stop="
                  chooseEmoji(
                    {
                      id: item.id,
                      renderUrl: getEmojiRenderUrl(item),
                      serverUrl: item.expressionUrl
                    },
                    'url'
                  )
                ">
                <n-popover
                  trigger="manual"
                  :show="activeMenuId === item.id"
                  :duration="300"
                  :show-arrow="false"
                  placement="top"
                  @clickoutside="activeMenuId = ''">
                  <template #trigger>
                    <div
                      class="emoji-visibility-wrapper size-full"
                      :ref="(el: any) => registerEmojiVisibilityTarget(el, item)">
                      <n-image
                        width="60"
                        height="60"
                        preview-disabled
                        :src="getEmojiRenderUrl(item)"
                        @contextmenu.prevent="handleContextMenu($event, item)"
                        class="emoji-image size-full object-contain rounded-8px transition duration-300 ease-in-out transform-gpu" />
                    </div>
                  </template>
                  <n-button quaternary size="tiny" @click.stop="deleteMyEmoji(item.id)">
                    {{ t('emoticon.favorites.delete') }}
                    <template #icon>
                      <n-icon>
                        <svg><use href="#delete"></use></svg>
                      </n-icon>
                    </template>
                  </n-button>
                </n-popover>
              </n-flex>
            </n-flex>
          </div>
          <span v-else>{{ t('emoticon.favorites.empty') }}</span>
        </div>
      </div>
    </transition>
  </n-scrollbar>

  <!-- 하단 옵션 -->
  <n-flex align="center" class="expression-item">
    <n-scrollbar x-scrollable class="scrollbar-container">
      <div class="series-container">
        <template v-for="item in tabList" :key="item.id">
          <!-- 아이콘 유형 옵션 -->
          <svg
            class="series-icon"
            v-if="item.type === 'icon'"
            :class="{ active: activeIndex === item.id }"
            @click="handleTabChange(item.id)">
            <use :href="item.icon"></use>
          </svg>

          <!-- 시리즈 유형 옵션 -->
          <div
            v-else
            :class="{ active: activeIndex === item.id }"
            @click="selectSeries(item.id - 1)"
            class="series-icon">
            <img :title="item.name" :src="item.cover" class="w-full h-full object-contain" />
          </div>
        </template>
      </div>
    </n-scrollbar>
  </n-flex>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { BaseDirectory, exists, writeFile } from '@tauri-apps/plugin-fs'
import HulaEmojis from 'hula-emojis'
import type { ScrollbarInst, VirtualListInst } from 'naive-ui'
import pLimit from 'p-limit'
import type { EmojiItem as EmojiListItem } from '@/services/types'
import { useEmojiStore } from '@/stores/emoji'
import { useHistoryStore } from '@/stores/history.ts'
import { useUserStore } from '@/stores/user'
import { getAllTypeEmojis } from '@/utils/Emoji.ts'
import { md5FromString } from '@/utils/Md5Util'
import { detectRemoteFileType, getUserEmojiDir } from '@/utils/PathUtil'
import { isMobile } from '@/utils/PlatformConstants'
import { useI18n } from 'vue-i18n'

type TabItem = {
  id: number
  type: 'icon' | 'series'
  name: string
  icon?: string
  cover?: string
}

interface EmojiGroupItem {
  name: string
  value: any[]
}

type EmojiType = {
  expressionEmojis: EmojiGroupItem
  animalEmojis: EmojiGroupItem
  gestureEmojis: EmojiGroupItem
}

type EmojiCacheEnvironment = {
  uid: string
  emojiDir: string
  baseDir: BaseDirectory
  baseDirPath: string
}

const emit = defineEmits(['emojiHandle'])
const props = defineProps<{
  all: boolean
}>()
const { emoji, setEmoji, lastEmojiTabIndex, setLastEmojiTabIndex } = useHistoryStore()
const emojiStore = useEmojiStore()
const userStore = useUserStore()
const { t } = useI18n()
/** 미요세의 이모지 팩 가져오기 */
const emojisBbs = HulaEmojis.MihoyoBbs
const activeIndex = ref(lastEmojiTabIndex)
const isFavoritesView = computed(() => activeIndex.value === -1)
const isSeriesView = computed(() => activeIndex.value > 0)
const seriesVirtualListRef = ref<VirtualListInst | null>(null)
const panelScrollbarRef = ref<ScrollbarInst | null>(null)
// 현재 우클릭한 이모지 아이템 ID 설정
const activeMenuId = ref('')
const emojiLocalPathMap = ref<Record<string, string>>({})
// 요소가 보일 때만 로컬 캐시 스케줄링, 임계값은 단말기에 따라 변화
// 즐겨찾기 페이지의 IntersectionObserver를 비활성화하여 스크롤 오버헤드 감소
const enableEmojiVisibilityObserver = false
const observeEmojiVisibility = (_el: Element, _p0: () => void) => {}
const unobserveEmojiVisibility = (_target: Element) => {}
const disconnectEmojiObserver = () => {}
const emojiVisibilityTargetMap = new Map<string, Element>()
const cachingEmojiIds = new Set<string>()
const emojiCacheEnv = ref<EmojiCacheEnvironment | null>(null)
const emojiWorkerUrl = new URL('../../../workers/imageDownloader.ts', import.meta.url)
let emojiCacheWorker: Worker | null = null
const emojiExtCache = new Map<string, string>()
const localUrlCache = new Map<string, string>() // 최근 사용한 이모지 팩의 로컬 링크 빠른 매칭에만 사용
const emojiUrlToLocalMap = new Map<string, string>() // expressionUrl -> localUrl
const downloadLimit = pLimit(3)
const downloadingUrls = new Set<string>()
const clearEmojiLocalPath = (id: string, expressionUrl?: string) => {
  const next = { ...emojiLocalPathMap.value }
  delete next[id]
  emojiLocalPathMap.value = next
  emojiStore.setLocalUrl(id, null)
  if (expressionUrl) {
    emojiUrlToLocalMap.delete(expressionUrl)
    localUrlCache.delete(expressionUrl)
  }
}

// 옵션 탭 배열 생성
const tabList = computed<TabItem[]>(() => {
  const baseItems: TabItem[] = [
    { id: 0, type: 'icon', name: t('emoticon.tabs.emoji'), icon: '#face' },
    { id: -1, type: 'icon', name: t('emoticon.tabs.favorites'), icon: '#heart' }
  ]

  // 미요세 이모지 팩 시리즈 추가
  const seriesItems: TabItem[] = emojisBbs.series.map((series, index) => ({
    id: index + 1,
    type: 'series',
    name: series.name,
    cover: series.cover
  }))

  return [...baseItems, ...seriesItems]
})

const currentSeries = computed(() => (activeIndex.value > 0 ? emojisBbs.series[activeIndex.value - 1] : null))
const packColumns = computed(() => (isMobile() ? 4 : 6))
const SERIES_EMOJI_SIZE = 60
const SERIES_ROW_VERTICAL_PADDING = 12
const seriesRowHeight = computed(() => SERIES_EMOJI_SIZE + SERIES_ROW_VERTICAL_PADDING)
const seriesViewportHeight = computed(() => (isMobile() ? '240px' : '260px'))
const SERIES_PAGE_SIZE = 30
const favoritesPage = ref(1)
const seriesPage = ref(1)
const favoritesPageSize = computed(() => (isMobile() ? 20 : 25))

// "내 이모지" 목록 역순 표시
const reversedEmojiList = computed(() => {
  return [...emojiStore.emojiList].reverse()
})

const displayFavoriteEmojis = computed(() => {
  const size = favoritesPage.value * favoritesPageSize.value
  return reversedEmojiList.value.slice(0, size)
})

const displaySeriesRows = computed(() => {
  if (!currentSeries.value) return []
  const cols = packColumns.value
  const size = seriesPage.value * SERIES_PAGE_SIZE
  const visibleEmojiCount = Math.min(currentSeries.value.emojis.length, size)
  const rows: { key: number; emojis: (typeof currentSeries.value.emojis)[number][] }[] = []
  for (let i = 0; i < visibleEmojiCount; i += cols) {
    rows.push({ key: i, emojis: currentSeries.value.emojis.slice(i, i + cols) })
  }
  return rows
})

const SCROLL_LOAD_MORE_THRESHOLD = 32
const isNearBottom = (target: HTMLElement) =>
  target.scrollTop + target.clientHeight >= target.scrollHeight - SCROLL_LOAD_MORE_THRESHOLD

const favoritesLoadMoreLock = ref(false)
const seriesLoadMoreLock = ref(false)
const hydrateScheduled = ref(false)

const loadMoreFavorites = async () => {
  if (favoritesLoadMoreLock.value) return
  if (displayFavoriteEmojis.value.length >= reversedEmojiList.value.length) return
  favoritesLoadMoreLock.value = true
  favoritesPage.value += 1
  await nextTick()
  favoritesLoadMoreLock.value = false
}

const loadMoreSeries = async () => {
  if (seriesLoadMoreLock.value) return
  if (!currentSeries.value) return
  if (seriesPage.value * SERIES_PAGE_SIZE >= currentSeries.value.emojis.length) return
  seriesLoadMoreLock.value = true
  seriesPage.value += 1
  await nextTick()
  seriesLoadMoreLock.value = false
}

const handlePanelScroll = (event: Event) => {
  activeMenuId.value = ''
  const target =
    (panelScrollbarRef.value as any)?.containerRef ||
    (event.target as HTMLElement | null) ||
    (event.currentTarget as HTMLElement | null)
  if (!target) return
  if (isFavoritesView.value) {
    if (isNearBottom(target)) {
      void loadMoreFavorites()
    }
    return
  }
}

const handleSeriesScroll = (event?: Event) => {
  if (!currentSeries.value) return
  const target =
    (event?.target as HTMLElement | null) ||
    (event?.currentTarget as HTMLElement | null) ||
    (seriesVirtualListRef.value as any)?.listElRef
  if (!target) return
  if (isNearBottom(target)) {
    void loadMoreSeries()
  }
}

const res = getAllTypeEmojis()

const emojiObj = ref<EmojiType>({
  expressionEmojis: res.expressionEmojis,
  animalEmojis: res.animalEmojis,
  gestureEmojis: res.gestureEmojis
} as EmojiType)

if (props.all) {
  emojiObj.value = res
} else {
  emojiObj.value = {
    expressionEmojis: res.expressionEmojis,
    animalEmojis: res.animalEmojis,
    gestureEmojis: res.gestureEmojis
  } as EmojiType
}

const emojiRef = reactive<{
  chooseItem: string
  historyList: string[]
  allEmoji: EmojiType
}>({
  chooseItem: '',
  historyList: emoji,
  allEmoji: emojiObj.value
})

// window/Worker 환경에서만 필요에 따라 이모지 캐시 Worker를 생성하고 전역에서 재사용
const getEmojiWorker = () => {
  if (!isFavoritesView.value) {
    return null
  }
  if (typeof window === 'undefined') {
    return null
  }
  if (!emojiCacheWorker) {
    emojiCacheWorker = new Worker(emojiWorkerUrl)
  }
  return emojiCacheWorker
}

const getEmojiBaseDir = () => (isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource)
const getEmojiBaseDirPath = async () => (isMobile() ? await appDataDir() : await resourceDir())

// URL 문자열에서 확장자 추측 (원격 유형 식별 실패 대비)
const inferExtFromUrl = (url: string) => {
  try {
    const { pathname } = new URL(url)
    const index = pathname.lastIndexOf('.')
    if (index !== -1) {
      return pathname.slice(index + 1)
    }
  } catch {
    const clean = url.split('?')[0]
    const index = clean.lastIndexOf('.')
    if (index !== -1) {
      return clean.slice(index + 1)
    }
  }
  return null
}

// detectRemoteFileType을 우선 사용하여 실제 확장자를 가져오고, 실패 시 URL 규칙으로 추측하여 결과 캐시
const resolveEmojiExtension = async (url: string) => {
  if (emojiExtCache.has(url)) {
    return emojiExtCache.get(url)!
  }
  const inferred = inferExtFromUrl(url)
  if (inferred) {
    const ext = inferred.toLowerCase()
    emojiExtCache.set(url, ext)
    return ext
  }
  let ext = ''
  try {
    const info = await detectRemoteFileType({ url, fileSize: null })
    ext = info?.ext || ''
  } catch (error) {
    console.warn('이모지 유형 식별 실패:', error)
  }
  if (!ext) {
    ext = 'png'
  }
  emojiExtCache.set(url, ext)
  return ext
}

// 이모지 URL의 md5 + 확장자를 사용하여 안정적인 파일명 생성, 중복 다운로드 방지
const buildEmojiFileName = async (url: string) => {
  const hash = await md5FromString(url)
  const ext = await resolveEmojiExtension(url)
  return `${hash}.${ext}`
}

// 절대 경로를 Tauri가 접근 가능한 file URI로 변환하여 반응형 맵에 기록
const setEmojiLocalPath = (id: string, absolutePath: string, expressionUrl?: string) => {
  const localUrl = convertFileSrc(absolutePath)
  emojiLocalPathMap.value = {
    ...emojiLocalPathMap.value,
    [id]: localUrl
  }
  emojiStore.setLocalUrl(id, localUrl)
  if (expressionUrl) {
    emojiUrlToLocalMap.set(expressionUrl, localUrl)
    localUrlCache.set(expressionUrl, localUrl)
  }
}

const ensureEmojiCacheEnvironment = async () => {
  if (!isFavoritesView.value) return null
  const uid = userStore.userInfo?.uid
  if (!uid) {
    return null
  }
  if (emojiCacheEnv.value?.uid === uid) {
    return emojiCacheEnv.value
  }
  try {
    const [emojiDir, baseDirPath] = await Promise.all([getUserEmojiDir(uid), getEmojiBaseDirPath()])
    const env: EmojiCacheEnvironment = {
      uid,
      emojiDir,
      baseDir: getEmojiBaseDir(),
      baseDirPath
    }
    emojiCacheEnv.value = env
    return env
  } catch (error) {
    console.error('이모지 캐시 디렉터리 초기화 실패:', error)
    return null
  }
}

const releaseEmojiObserver = (id: string) => {
  const target = emojiVisibilityTargetMap.get(id)
  if (target) {
    unobserveEmojiVisibility(target)
    emojiVisibilityTargetMap.delete(id)
  }
}

const resolveVisibilityElement = (target: Element | ComponentPublicInstance | null) => {
  if (!target) {
    return null
  }
  if (target instanceof Element) {
    return target
  }
  const el = target.$el
  return el instanceof Element ? el : null
}

// 네트워크 I/O 격리를 위해 Worker 다운로드 우선 사용, Worker 미지원 시 fetch 사용
const downloadEmojiFile = async (url: string) => {
  const worker = getEmojiWorker()
  if (!worker) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`이모지 다운로드 실패: ${response.status} ${response.statusText}`)
    }
    return new Uint8Array(await response.arrayBuffer())
  }

  return await new Promise<Uint8Array>((resolve, reject) => {
    const handleMessage = (event: MessageEvent<any>) => {
      const data = event.data
      if (!data || data.url !== url) {
        return
      }
      cleanup()
      if (data.success && data.buffer) {
        resolve(new Uint8Array(data.buffer))
      } else {
        reject(new Error(data.error || '이모지 다운로드 실패'))
      }
    }

    const handleError = (event: ErrorEvent) => {
      cleanup()
      reject(new Error(event.message))
    }

    const cleanup = () => {
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
    }

    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleError)
    worker.postMessage({ url })
  })
}

const cleanupLocalEmojiMap = (validIds: string[]) => {
  const validSet = new Set(validIds)
  const nextMap = { ...emojiLocalPathMap.value }
  let changed = false
  Object.keys(nextMap).forEach((id) => {
    if (!validSet.has(id)) {
      delete nextMap[id]
      changed = true
    }
  })
  if (changed) {
    emojiLocalPathMap.value = nextMap
  }
}

const cleanupEmojiObservers = (validIds: string[]) => {
  const validSet = new Set(validIds)
  emojiVisibilityTargetMap.forEach((el, id) => {
    if (!validSet.has(id)) {
      unobserveEmojiVisibility(el)
      emojiVisibilityTargetMap.delete(id)
    }
  })
}

const cleanupAllEmojiCaches = () => {
  emojiLocalPathMap.value = {}
  emojiExtCache.clear()
  localUrlCache.clear()
  emojiUrlToLocalMap.clear()
  emojiVisibilityTargetMap.forEach((el) => unobserveEmojiVisibility(el))
  emojiVisibilityTargetMap.clear()
  cachingEmojiIds.clear()
  downloadingUrls.clear()
  emojiCacheEnv.value = null
}

// 즐겨찾기 항목이 실제로 뷰포트 내에 나타날 때만 캐시 다운로드 실행
const handleEmojiVisibility = async (emojiItem: EmojiListItem) => {
  const id = emojiItem.id
  if (emojiItem.localUrl || emojiLocalPathMap.value[id] || cachingEmojiIds.has(id)) {
    releaseEmojiObserver(id)
    return
  }
  const env = await ensureEmojiCacheEnvironment()
  if (!env) {
    return
  }
  cachingEmojiIds.add(id)
  try {
    await ensureEmojiCached(emojiItem, env.emojiDir, env.baseDir, env.baseDirPath)
  } catch (error) {
    console.error('이모지 캐싱 실패:', emojiItem.expressionUrl, error)
  } finally {
    cachingEmojiIds.delete(id)
    releaseEmojiObserver(id)
  }
}

// DOM 요소를 관찰자에 바인딩하고, 뷰포트에 들어오면 다운로드 트리거
const registerEmojiVisibilityTarget = (target: Element | ComponentPublicInstance | null, emojiItem: EmojiListItem) => {
  if (!enableEmojiVisibilityObserver) return
  releaseEmojiObserver(emojiItem.id)
  const el = resolveVisibilityElement(target)
  if (!el || !emojiItem.expressionUrl || emojiItem.localUrl || emojiLocalPathMap.value[emojiItem.id]) {
    return
  }
  emojiVisibilityTargetMap.set(emojiItem.id, el)
  observeEmojiVisibility(el, () => {
    void handleEmojiVisibility(emojiItem)
  })
}

// 사용자 UID의 캐시 디렉터리에 개별 이모지 저장, 파일이 없으면 다운로드 후 쓰기
const ensureEmojiCached = async (
  emojiItem: EmojiListItem,
  emojiDir: string,
  baseDir: BaseDirectory,
  baseDirPath: string
) => {
  const fileName = await buildEmojiFileName(emojiItem.expressionUrl)
  const relativePath = await join(emojiDir, fileName)
  const hasFile = await exists(relativePath, { baseDir })
  if (!hasFile) {
    const bytes = await downloadEmojiFile(emojiItem.expressionUrl)
    await writeFile(relativePath, bytes, { baseDir })
  }
  const absolutePath = await join(baseDirPath, relativePath)
  setEmojiLocalPath(emojiItem.id, absolutePath, emojiItem.expressionUrl)
}

// store의 기존 이모지와 로컬 캐시를 정렬, 로컬 링크를 우선 사용하여 렌더링
const hydrateEmojiLocalCache = async () => {
  if (!isFavoritesView.value) return
  const env = await ensureEmojiCacheEnvironment()
  if (!env) return
  const downloadTasks: Promise<unknown>[] = []
  for (const item of emojiStore.emojiList) {
    const fileName = await buildEmojiFileName(item.expressionUrl)
    const relativePath = await join(env.emojiDir, fileName)
    const hasFile = await exists(relativePath, { baseDir: env.baseDir })
    const absolutePath = await join(env.baseDirPath, relativePath)

    if (!hasFile) {
      // 로컬 파일이 존재하지 않으면 유효하지 않은 매핑 제거
      clearEmojiLocalPath(item.id, item.expressionUrl)
      // 비동기 다운로드 (Worker 사용)
      if (!downloadingUrls.has(item.expressionUrl)) {
        downloadingUrls.add(item.expressionUrl)
        const task = downloadLimit(async () => {
          try {
            await ensureEmojiCached(item, env.emojiDir, env.baseDir, env.baseDirPath)
          } catch (error) {
            console.error('[emoji] 이모지 재캐싱 실패:', item.expressionUrl, error)
          } finally {
            downloadingUrls.delete(item.expressionUrl)
          }
        })
        downloadTasks.push(task)
      }
    } else {
      // 파일은 존재하지만 store에 기록이 없는 경우, 로컬 링크를 다시 채움
      const localUrl = convertFileSrc(absolutePath)
      setEmojiLocalPath(item.id, absolutePath, item.expressionUrl)
      localUrlCache.set(item.expressionUrl, localUrl)
      emojiUrlToLocalMap.set(item.expressionUrl, localUrl)
    }
  }
  if (downloadTasks.length) {
    await Promise.allSettled(downloadTasks)
  }
}

const scheduleHydrateFavorites = () => {
  if (hydrateScheduled.value || !isFavoritesView.value) return
  hydrateScheduled.value = true
  const runner = () => {
    hydrateScheduled.value = false
    void hydrateEmojiLocalCache()
  }
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    ;(window as any).requestIdleCallback(runner, { timeout: 800 })
  } else {
    setTimeout(runner, 80)
  }
}

// 즐겨찾기 목록 변경 감지, 로컬 매핑 및 관찰 대상 동기화 유지
watch(
  () => emojiStore.emojiList.map((item) => ({ id: item.id, url: item.expressionUrl })),
  (list) => {
    if (!isFavoritesView.value) return
    const ids = list.map((item) => item.id)
    cleanupLocalEmojiMap(ids)
    cleanupEmojiObservers(ids)
    scheduleHydrateFavorites()
  },
  { immediate: false, deep: true }
)

// 사용자 전환 시 캐시 컨텍스트 및 관찰자 초기화
watch(
  () => userStore.userInfo?.uid,
  () => {
    cleanupAllEmojiCaches()
    disconnectEmojiObserver()
    // 계정 전환 후 목록이 있고 현재 '좋아요' 뷰인 경우, 로컬 캐시로 링크 교체 시도
    if (emojiStore.emojiList.length > 0 && userStore.userInfo?.uid && isFavoritesView.value) {
      scheduleHydrateFavorites()
    }
  },
  { immediate: false }
)

/**
 * 문자열이 URL인지 확인
 */
const checkIsUrl = (str: string) => {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

/**
 * 우클릭 메뉴 클릭 이벤트 처리
 * @param event 마우스 이벤트
 * @param item 이모지 아이템
 */
const handleContextMenu = (event: MouseEvent, item: any) => {
  // 기본 우클릭 메뉴 방지
  event.preventDefault()
  activeMenuId.value = item.id
}

/**
 * 내 이모지 삭제
 * @param id 이모지 ID
 */
const deleteMyEmoji = async (id: string) => {
  try {
    await emojiStore.deleteEmoji(id)
    window.$message.success(t('emoticon.favorites.deleteSuccess'))
    // 메뉴 닫기
    activeMenuId.value = ''
    localUrlCache.clear()
    emojiUrlToLocalMap.clear()
  } catch (error) {
    console.error('이모지 삭제 실패:', error)
    window.$message.error(t('emoticon.favorites.deleteFail'))
  }
}

/**
 * 이모지 선택
 * @param item
 */
const chooseEmoji = async (item: any, type: 'emoji' | 'url' = 'emoji') => {
  emojiRef.chooseItem = typeof item === 'string' ? item : item?.renderUrl || item?.expressionUrl || ''

  // URL이 아닌 이모지만 히스토리에 기록
  if (type === 'emoji') {
    // 이미 히스토리에 존재하면 먼저 제거
    const index = emojiRef.historyList.indexOf(item)
    if (index !== -1) {
      emojiRef.historyList.splice(index, 1)
    }
    emojiRef.historyList.unshift(item)
    if (emojiRef.historyList.length > 18) {
      emojiRef.historyList.splice(18) // 앞의 18개 요소만 유지
    }
    setEmoji([...emojiRef.historyList])
  }

  // 이모지 유형 정보 전달, URL 유형의 이모지는 EMOJI-URL 유형으로 처리
  // URL 유형일 때 renderUrl이 로컬 링크를 우선적으로 사용하도록 보장
  if (type === 'url') {
    const payload =
      typeof item === 'object' && item
        ? {
            id: item.id,
            renderUrl: item.renderUrl || item.expressionUrl || '',
            serverUrl: item.serverUrl || item.expressionUrl || ''
          }
        : { renderUrl: typeof item === 'string' ? item : '', serverUrl: typeof item === 'string' ? item : '' }
    if (!isFavoritesView.value) {
      emit('emojiHandle', payload, 'emoji-url')
      return payload
    }
    // 즐겨찾기 페이지: 기존 캐시만 사용, 클릭 시 다운로드 트리거 안 함 (전송 차단 방지)
    const serverKey = payload.serverUrl || payload.renderUrl
    const cached =
      (payload.id && emojiLocalPathMap.value[payload.id]) || (serverKey ? emojiUrlToLocalMap.get(serverKey) : undefined)
    if (cached) {
      payload.renderUrl = cached
    }
    emit('emojiHandle', payload, 'emoji-url')
    return payload
  }

  emit('emojiHandle', item, 'emoji')
  return item
}

const getEmojiRenderUrl = (item: EmojiListItem) => {
  const mapped = emojiUrlToLocalMap.get(item.expressionUrl)
  if (mapped) return mapped
  if (item.localUrl) {
    emojiUrlToLocalMap.set(item.expressionUrl, item.localUrl)
    localUrlCache.set(item.expressionUrl, item.localUrl)
    return item.localUrl
  }
  const localById = emojiLocalPathMap.value[item.id]
  if (localById) return localById
  return item.expressionUrl
}

/**
 * 이모지 유형 탭 전환
 */
const handleTabChange = (index: number) => {
  activeIndex.value = index
  if (index === -1) {
    favoritesPage.value = 1
  }
  if (index > 0) {
    seriesPage.value = 1
  }
  void nextTick().then(() => {
    panelScrollbarRef.value?.scrollTo({ top: 0 })
  })
  // '좋아요' 뷰가 아닌 다른 뷰로 전환 시 캐시 관련 상태 즉시 정리
  if (index !== -1) {
    cleanupAllEmojiCaches()
    disconnectEmojiObserver()
    if (emojiCacheWorker) {
      emojiCacheWorker.terminate()
      emojiCacheWorker = null
    }
  } else {
    // '좋아요' 뷰로 다시 전환 시 로컬 캐시 동기화 시도
    void hydrateEmojiLocalCache()
  }
  setLastEmojiTabIndex(index)
}

/**
 * 이모지 팩 시리즈 선택
 */
const selectSeries = (index: number) => {
  handleTabChange(index + 1)
}

onMounted(async () => {
  // 내 이모지 목록 가져오기
  await emojiStore.getEmojiList()
  // '좋아요' 뷰일 때만 로컬 캐시 사용 시도, 시리즈 이모지가 캐시 로직을 타는 것 방지
  scheduleHydrateFavorites()
})

onBeforeUnmount(() => {
  disconnectEmojiObserver()
  if (emojiCacheWorker) {
    emojiCacheWorker.terminate()
    emojiCacheWorker = null
  }
  cleanupAllEmojiCaches()
})
</script>

<style lang="scss">
/**! naive-ui 스크롤바 간서 조절 */
.n-scrollbar > .n-scrollbar-rail.n-scrollbar-rail--vertical,
.n-scrollbar + .n-scrollbar-rail.n-scrollbar-rail--vertical {
  right: 0;
}

.n-scrollbar > .n-scrollbar-rail.n-scrollbar-rail--horizontal > .n-scrollbar-rail__scrollbar,
.n-scrollbar + .n-scrollbar-rail.n-scrollbar-rail--horizontal > .n-scrollbar-rail__scrollbar {
  top: 4px;
}

.emoji-item {
  @apply cursor-pointer;
  @apply size-36px text-26px hover:bg-[--emoji-hover] rounded-8px;
}

.emoji-item--image {
  @apply size-60px hover:bg-transparent;

  &:hover .emoji-image {
    @apply scale-116 bg-[--emoji-hover] rounded-8px;
  }
}

.emoji-visibility-wrapper {
  @apply w-full h-full;
}

.expression-item {
  @apply h-50px w-full p-[0_14px] box-border select-none;
  border-top: 1px solid var(--line-color);

  .scrollbar-container {
    @apply w-full max-w-420px;
    overflow-x: auto;
  }

  .series-container {
    @apply flex items-center;
    white-space: nowrap;
    width: max-content;

    svg {
      @apply size-26px my-4px p-6px rounded-8px mr-12px flex-shrink-0 inline-flex items-center justify-center;
      &:not(.active):hover {
        background-color: var(--emoji-hover);
        cursor: pointer;
      }
    }
  }

  .series-icon {
    @apply size-30px my-4px p-4px rounded-8px mr-12px flex-shrink-0 inline-flex items-center justify-center;
    &:not(.active):hover {
      background-color: var(--emoji-hover);
      cursor: pointer;
    }

    &.active {
      background-color: var(--emoji-active-color) !important;
    }

    &:last-child {
      margin-right: 0;
    }
  }
}

.emoji-content {
  position: relative;
  width: 100%;
}

.emoji-pack-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  padding: 6px 12px;
  min-height: 72px;
}

.series-virtual-container {
  width: 100%;
  margin: 0;
  padding: 6px 0 0 0;
}

.emoji-panel-series > .n-scrollbar-rail.n-scrollbar-rail--vertical {
  // 외부 스크롤바만 숨기고 내부 가상 목록에는 영향을 주지 않음
  display: none !important;
}

.emoji-panel-series {
  padding: 14px 0 0 0 !important;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

// 모바일 이모지 그리드 레이아웃 - 일반 이모지 (7열)
.emoji-grid-mobile {
  display: grid !important;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  justify-items: center;
  width: 100%;
}

// 모바일 이모지 팩 그리드 레이아웃 - 이모지 팩 이미지 (4열)
.emoji-pack-grid-mobile {
  display: grid !important;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  justify-items: center;
  width: 100%;
}
</style>
