<template>
  <div class="bot-container">
    <!-- 상단 도구 모음 -->
    <div class="language-switcher">
      <div v-if="canGoBack" class="back-btn flex-shrink-0" @click="goBack">
        <svg class="rotate-180"><use href="#right"></use></svg>
        뒤로
      </div>
      <div v-if="showAssistantMinimalToolbar" class="assistant-compact-toolbar">
        <n-button v-if="canImportLocalModel" size="small" strong secondary class="import-btn" @click="openLocalModel">
          모델 가져오기
        </n-button>
        <n-dropdown
          v-if="isAssistantView"
          trigger="click"
          :show-arrow="false"
          placement="bottom-end"
          :options="assistantModelDropdownOptions"
          @select="handlePresetModelSelect">
          <div :class="['model-select-btn', { active: selectedModelKey && selectedModelKey !== 'local' }]">
            <span class="model-select-text">{{ selectedModelLabel }}</span>
            <svg class="size-12px model-select-icon"><use href="#down"></use></svg>
          </div>
        </n-dropdown>
      </div>
      <template v-else>
        <!-- 언어 전환기 (README를 볼 때만 표시) -->
        <div v-if="!isViewingLink" class="flex-y-center w-full justify-between">
          <div class="flex-center gap-12px">
            <div :class="['lang-btn', { active: currentLang === 'zh' }]" @click="switchLanguage('zh')">중국어</div>
            <div :class="['lang-btn', { active: currentLang === 'en' }]" @click="switchLanguage('en')">English</div>
          </div>
          <div class="flex-center">
            <n-button
              v-if="isAssistantView && canImportLocalModel"
              size="small"
              strong
              secondary
              class="import-btn"
              @click="openLocalModel">
              모델 가져오기
            </n-button>
            <n-badge class="mr-14px" value="Beta" :color="'var(--bate-color)'">
              <div :class="['assistant-btn', { active: isAssistantView }]" @click="showAssistant()">3D 미리보기</div>
            </n-badge>
            <n-dropdown
              v-if="isAssistantView"
              trigger="click"
              :show-arrow="false"
              placement="bottom-end"
              :options="assistantModelDropdownOptions"
              @select="handlePresetModelSelect">
              <div :class="['model-select-btn', { active: selectedModelKey && selectedModelKey !== 'local' }]">
                <span class="model-select-text">{{ selectedModelLabel }}</span>
                <svg class="size-12px model-select-icon"><use href="#down"></use></svg>
              </div>
            </n-dropdown>
          </div>
        </div>

        <!-- 현재 페이지 제목 및 작업 버튼 -->
        <div v-if="isViewingLink" class="page-title">{{ currentUrl }}</div>
        <div v-if="isViewingLink" class="open-in-browser-btn" @click="openInBrowser">
          <svg class="size-16px"><use href="#share"></use></svg>
          브라우저에서 열기
        </div>
      </template>
    </div>

    <div class="bot-content">
      <n-loading-bar-provider ref="loadingBarRef" :to="false" :container-style="loadingBarContainerStyle">
        <!-- HuLa 비서 3D 모델 -->
        <HuLaAssistant
          v-if="isAssistantView"
          :active="isAssistantView"
          :custom-model="customModelPath"
          @ready="handleAssistantReady"
          @error="handleAssistantError" />

        <!-- Markdown 내용 영역 -->
        <div
          v-else-if="!isViewingLink"
          ref="markdownContainer"
          class="markdown-content markdown-body"
          v-html="renderedMarkdown"></div>

        <!-- 외부 링크 Tauri Webview 컨테이너 -->
        <div v-else ref="webviewContainer" class="external-webview">
          <div v-if="!canEmbedWebview" class="external-webview__fallback">
            현재 환경은 임베디드 브라우저를 지원하지 않습니다. 시스템 브라우저에서 열기를 시도했습니다.
          </div>
        </div>
      </n-loading-bar-provider>
    </div>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import DOMPurify from 'dompurify'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { DropdownOption, LoadingBarProviderInst } from 'naive-ui'
import { Webview } from '@tauri-apps/api/webview'
import { getCurrentWindow, type Window as TauriWindow } from '@tauri-apps/api/window'
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { isDesktop } from '@/utils/PlatformConstants'
import { useBotStore } from '@/stores/bot'
import { useAssistantModelPresets, type AssistantModelPreset } from '@/hooks/useAssistantModelPresets'
import HuLaAssistant from './HuLaAssistant.vue'

// 현재 언어
const currentLang = ref<'zh' | 'en'>('zh')

// 렌더링된 HTML
const renderedMarkdown = ref('')

// 링크를 보고 있는지 여부
const isViewingLink = ref(false)

// 현재 링크 URL
const currentUrl = ref('')

// markdown 컨테이너 참조
const markdownContainer = ref<HTMLElement | null>(null)
const webviewContainer = ref<HTMLElement | null>(null)

// 뷰 상태 설명, "뒤로" 스택 유지에 사용
type ViewState =
  | { type: 'readme' }
  | { type: 'markdown'; source: string }
  | { type: 'web'; url: string }
  | { type: 'assistant' }

const cloneView = (view: ViewState): ViewState => {
  if (view.type === 'readme' || view.type === 'assistant') {
    return { type: view.type }
  }
  if (view.type === 'markdown') {
    return { type: 'markdown', source: view.source }
  }
  return { type: 'web', url: view.url }
}

const currentView = ref<ViewState>({ type: 'readme' })
// 기록 스택, Markdown과 외부 링크 간에 돌아갈 수 있도록 기록
const historyStack = ref<ViewState[]>([])
const canGoBack = computed(() => historyStack.value.length > 0)
const isAssistantView = computed(() => currentView.value.type === 'assistant')
const customModelPath = ref<string | null>(null)
const selectedModelKey = ref<string | null>(null)
const canImportLocalModel = isDesktop()
const showAssistantMinimalToolbar = computed(() => canImportLocalModel && isAssistantView.value)
let assistantFallbackView: ViewState | null = null

const { presets: assistantModelPresets, fetchAssistantModelPresets } = useAssistantModelPresets()
void fetchAssistantModelPresets()

const botStore = useBotStore()

// 로컬 로딩 바 참조
const loadingBarRef = ref<LoadingBarProviderInst | null>(null)

const startLoading = () => {
  loadingBarRef.value?.start()
}

const finishLoading = () => {
  loadingBarRef.value?.finish()
}

const errorLoading = () => {
  loadingBarRef.value?.error()
}

const loadingBarContainerStyle = {
  position: 'absolute',
  top: '0',
  left: '0',
  right: '0',
  pointerEvents: 'none'
} as const

// README/Markdown 콘텐츠 필터링: 로컬 파일은 신뢰할 수 있으므로 레이아웃 변경을 최소화합니다. 향후 필터링이 필요한 경우 이 메서드를 확장할 수 있습니다.
const sanitizeMarkdown = (html: string, options?: { trustContent?: boolean }) => {
  if (options?.trustContent ?? true) {
    return html
  }
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['style', 'align', 'width', 'height', 'cellpadding', 'cellspacing', 'border']
  })
}

const externalWebview = shallowRef<Webview | null>(null)
const webviewLabel = 'bot-inline-browser'
const webviewListeners: UnlistenFn[] = []
let containerResizeObserver: ResizeObserver | null = null
let hostWindow: TauriWindow | null = null
// 데스크톱 환경에서만 임베디드 Webview 생성을 허용하며, Tauri 내부 컨텍스트가 준비되었는지 확인합니다.
const canEmbedWebview = computed(() => {
  if (typeof window === 'undefined') return false
  return isDesktop() && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
})

const findPresetByKey = (key: string | null | undefined): AssistantModelPreset | undefined => {
  if (!key) return void 0
  return assistantModelPresets.value.find((preset) => preset.modelKey === key)
}

const formatPresetLabel = (preset: AssistantModelPreset) => {
  if (!preset.version || preset.modelName.includes(preset.version)) {
    return preset.modelName
  }
  return `${preset.modelName} (버전 ${preset.version})`
}

const assistantModelDropdownOptions = computed<DropdownOption[]>(() =>
  assistantModelPresets.value.map((preset) => ({
    key: preset.modelKey,
    label: formatPresetLabel(preset),
    extra: preset.description ?? (preset.version ? `버전 ${preset.version}` : void 0)
  }))
)

const selectedModelLabel = computed(() => {
  if (selectedModelKey.value === 'local') {
    return '로컬 모델'
  }
  const preset = findPresetByKey(selectedModelKey.value)
  if (preset) {
    return formatPresetLabel(preset)
  }
  const first = assistantModelPresets.value[0]
  return first ? formatPresetLabel(first) : '모델 선택'
})

const applyFirstPreset = (options?: { force?: boolean }) => {
  const firstPreset = assistantModelPresets.value[0]
  if (!firstPreset) {
    if (options?.force && selectedModelKey.value !== 'local') {
      selectedModelKey.value = null
      customModelPath.value = null
    }
    return
  }
  if (!options?.force && selectedModelKey.value === 'local') {
    return
  }
  selectedModelKey.value = firstPreset.modelKey
  customModelPath.value = firstPreset.modelUrl
}

watch(
  assistantModelPresets,
  (presets) => {
    if (!presets.length) {
      if (selectedModelKey.value !== 'local') {
        selectedModelKey.value = null
        customModelPath.value = null
      }
      return
    }
    if (selectedModelKey.value === 'local') {
      return
    }
    const current = presets.find((preset) => preset.modelKey === selectedModelKey.value)
    if (current) {
      customModelPath.value = current.modelUrl
    } else {
      applyFirstPreset({ force: true })
    }
  },
  { immediate: true }
)

// 현재 뷰 스냅샷을 스택에 푸시하여 나중에 되돌릴 수 있도록 보장
const pushCurrentView = () => {
  historyStack.value.push(cloneView(currentView.value))
}

const ensureHostWindow = async () => {
  if (!canEmbedWebview.value) return null
  if (!hostWindow) {
    hostWindow = getCurrentWindow()
  }
  return hostWindow
}

const clearWebviewListeners = () => {
  while (webviewListeners.length) {
    try {
      const unsubscribe = webviewListeners.pop()
      unsubscribe?.()
    } catch (error) {
      console.warn('webview 리스너 취소 실패:', error)
    }
  }
}

const updateExternalWebviewBounds = async () => {
  if (!externalWebview.value || !webviewContainer.value) return

  const rect = webviewContainer.value.getBoundingClientRect()
  try {
    await externalWebview.value.setPosition(new LogicalPosition(rect.left, rect.top))
    await externalWebview.value.setSize(new LogicalSize(rect.width, rect.height))
  } catch (error) {
    console.warn('임베디드 Webview 크기 업데이트 실패:', error)
  }
}

const destroyExternalWebview = async () => {
  // 리스너/옵저버 해제, 여러 인스턴스가 시스템 리소스를 차지하는 것을 방지
  clearWebviewListeners()

  if (containerResizeObserver && webviewContainer.value) {
    containerResizeObserver.unobserve(webviewContainer.value)
    containerResizeObserver.disconnect()
    containerResizeObserver = null
  }

  window.removeEventListener('resize', updateExternalWebviewBounds)

  if (externalWebview.value) {
    try {
      await externalWebview.value.close()
    } catch (error) {
      console.warn('임베디드 Webview 닫기 실패:', error)
    }
    externalWebview.value = null
  }
}

let assistantShouldPopHistoryOnError = false

const handleAssistantReady = () => {
  assistantFallbackView = null
  assistantShouldPopHistoryOnError = false
}

const handleAssistantError = async (error: unknown) => {
  console.error('HuLa 비서 로드 실패:', error)
  customModelPath.value = null
  selectedModelKey.value = null
  applyFirstPreset({ force: true })
  if (assistantShouldPopHistoryOnError && historyStack.value.length) {
    historyStack.value.pop()
  }
  assistantShouldPopHistoryOnError = false
  const fallback = assistantFallbackView
  assistantFallbackView = null
  if (!fallback) return
  if (fallback.type === 'readme') {
    await loadReadme(false)
  } else if (fallback.type === 'markdown') {
    await loadMarkdownFile(fallback.source, false)
  } else if (fallback.type === 'web') {
    await showExternalLink(fallback.url, false)
  }
}

const showAssistant = async (recordHistory = true, preserveCustomModel = false) => {
  await fetchAssistantModelPresets(assistantModelPresets.value.length <= 1)
  if (currentView.value.type === 'assistant') {
    botStore.setAssistant('모델 미리보기 중')
    if (preserveCustomModel) {
      await nextTick()
    }
    return
  }
  if (!preserveCustomModel) {
    applyFirstPreset({ force: true })
  }
  assistantFallbackView = cloneView(currentView.value)
  assistantShouldPopHistoryOnError = recordHistory
  if (recordHistory) {
    pushCurrentView()
  }
  await destroyExternalWebview()
  isViewingLink.value = false
  currentUrl.value = ''
  currentView.value = { type: 'assistant' }
  botStore.setAssistant('모델 미리보기 중')
  await nextTick()
}

const openLocalModel = async () => {
  try {
    const selected = await open({
      filters: [
        {
          name: '3D Models',
          extensions: ['glb', 'gltf', 'vrm']
        }
      ],
      multiple: false
    })
    if (!selected) return
    customModelPath.value = Array.isArray(selected) ? selected[0] : selected
    selectedModelKey.value = 'local'
    await showAssistant(true, true)
  } catch (error) {
    console.error('로컬 모델 선택 실패:', error)
    window.$message?.error('모델 파일 선택 실패, 다시 시도해주세요')
  }
}

const handlePresetModelSelect = async (key: string) => {
  const preset = findPresetByKey(key)
  if (!preset) return
  const targetModelPath = preset.modelUrl
  if (selectedModelKey.value === key && targetModelPath === customModelPath.value) {
    if (currentView.value.type !== 'assistant') {
      await showAssistant(true, true)
    }
    return
  }
  selectedModelKey.value = key
  customModelPath.value = targetModelPath
  await showAssistant(true, true)
}

const createExternalWebview = async (url: string) => {
  // 새 Webview를 현재 창에 연결하고, 컨테이너에 맞춰 좌표와 크기를 조정합니다.
  const windowInstance = await ensureHostWindow()
  if (!windowInstance || !webviewContainer.value) return

  // 새로고침 후 이전 인스턴스가 남아있을 수 있으므로, 동일한 이름의 Webview를 닫으려고 시도합니다.
  try {
    const existing = await Webview.getByLabel(webviewLabel)
    await existing?.close()
  } catch (error) {
    // 찾을 수 없는 경우는 무시합니다.
  }

  await destroyExternalWebview()
  const rect = webviewContainer.value.getBoundingClientRect()
  const newWebview = new Webview(windowInstance, webviewLabel, {
    url,
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    focus: true,
    dragDropEnabled: true
  })

  externalWebview.value = newWebview
  containerResizeObserver = new ResizeObserver(() => {
    updateExternalWebviewBounds()
  })
  containerResizeObserver.observe(webviewContainer.value)
  window.addEventListener('resize', updateExternalWebviewBounds, { passive: true })

  const createdListener = await newWebview.once('tauri://created', async () => {
    await updateExternalWebviewBounds()
    botStore.setWeb(url)
    finishLoading()
  })
  const errorListener = await newWebview.once('tauri://error', async (error) => {
    console.error('임베디드 Webview 생성 실패:', error)
    errorLoading()
    await destroyExternalWebview()
    isViewingLink.value = false
    currentUrl.value = ''
    try {
      await openUrl(url)
    } catch (openError) {
      console.error('브라우저에서 열기 실패:', openError)
    }
  })
  webviewListeners.push(createdListener, errorListener)
}

const showExternalLink = async (url: string, recordHistory = true) => {
  const previousView = currentView.value
  if (recordHistory) {
    pushCurrentView()
  }
  currentUrl.value = url
  isViewingLink.value = true
  currentView.value = { type: 'web', url }

  startLoading()
  await nextTick()

  if (!canEmbedWebview.value) {
    finishLoading()
    botStore.setWeb(url)
    try {
      await openUrl(url)
    } catch (error) {
      console.error('브라우저에서 열기 실패:', error)
      errorLoading()
    }
    return
  }

  try {
    await createExternalWebview(url)
  } catch (error) {
    console.error('임베디드 Webview 생성 실패:', error)
    errorLoading()
    if (recordHistory) {
      historyStack.value.pop()
    }
    await destroyExternalWebview()
    if (previousView.type === 'markdown') {
      await loadMarkdownFile(previousView.source, false)
    } else {
      await loadReadme(false)
    }
  }
}

// README 로드
const loadReadme = async (recordHistory = false, resetHistory = false) => {
  startLoading()
  try {
    if (recordHistory) {
      pushCurrentView()
    }
    if (resetHistory) {
      historyStack.value = []
    }
    // Markdown 뷰로 돌아가기 전에 Webview 제거, 잔여물 방지
    await destroyExternalWebview()
    const html = await invoke<string>('get_readme_html', {
      language: currentLang.value
    })
    // README는 신뢰할 수 있는 소스이므로 원래 레이아웃을 유지하기 위해 직접 렌더링합니다.
    renderedMarkdown.value = sanitizeMarkdown(html)
    // 뷰 상태를 먼저 업데이트하여 nextTick 시 컨테이너가 마운트되었는지 확인합니다.
    currentView.value = { type: 'readme' }
    isViewingLink.value = false
    currentUrl.value = ''

    // DOM 업데이트 후 링크 클릭 리스너 추가 대기
    await nextTick()
    attachLinkListeners()
    finishLoading()
    botStore.setReadme(currentLang.value)
  } catch (error) {
    console.error('README 로드 실패:', error)
    renderedMarkdown.value = '<p>로드 실패, 잠시 후 다시 시도해주세요</p>'
    if (recordHistory) {
      historyStack.value.pop()
    }
    errorLoading()
  }
}

// 로컬 markdown 파일 로드
const loadMarkdownFile = async (filePath: string, recordHistory = true) => {
  startLoading()
  try {
    if (recordHistory) {
      pushCurrentView()
    }
    // 로컬 Markdown 로드 시에도 임베디드 페이지 제거
    await destroyExternalWebview()
    const html = await invoke<string>('parse_markdown', {
      filePath: filePath
    })
    // 로컬 Markdown은 신뢰할 수 있으므로 원래 레이아웃을 유지하기 위해 직접 렌더링합니다.
    renderedMarkdown.value = sanitizeMarkdown(html)

    // iframe이 아닌 markdown 뷰에 표시
    isViewingLink.value = false
    // 뷰 상태를 먼저 업데이트하여 nextTick 시 컨테이너가 마운트되었는지 확인합니다.
    currentView.value = { type: 'markdown', source: filePath }
    currentUrl.value = ''

    // DOM 업데이트 후 링크 클릭 리스너 추가 대기
    await nextTick()
    attachLinkListeners()
    finishLoading()
    botStore.setMarkdown(filePath)
  } catch (error) {
    console.error('markdown 파일 로드 실패:', error)
    renderedMarkdown.value = `<p>파일 로드 실패: ${filePath}</p><p>오류: ${error}</p>`
    if (recordHistory) {
      historyStack.value.pop()
    }
    errorLoading()
  }
}

// 링크 클릭 리스너 제거
const removeLinkListeners = () => {
  if (!markdownContainer.value) return
  markdownContainer.value.removeEventListener('click', handleLinkClick, true)
}

// 링크 클릭 리스너 추가
const attachLinkListeners = () => {
  if (!markdownContainer.value) return

  // (존재하는 경우) 이전 리스너를 먼저 제거하여 중복 추가 방지
  removeLinkListeners()

  // 컨테이너 수준에서 이벤트 위임을 사용하여 캡처 단계에서 우선 처리
  markdownContainer.value.addEventListener('click', handleLinkClick, true)
  console.log('링크 리스너가 추가되었습니다')
}

// 링크 클릭 처리
const handleLinkClick = async (event: Event) => {
  // 클릭된 요소가 자식 요소라도 a 태그를 가져오도록 보장
  let target = event.target as HTMLElement
  while (target && target.tagName !== 'A') {
    target = target.parentElement as HTMLElement
  }

  if (!target || target.tagName !== 'A') return

  const href = (target as HTMLAnchorElement).getAttribute('href')
  if (!href) return

  // 기본 동작 방지
  event.preventDefault()
  event.stopPropagation()

  console.log('링크 클릭:', href)

  // 앵커 링크 처리 - 해당 위치로 스크롤
  if (href.startsWith('#')) {
    console.log('앵커로 스크롤:', href)
    const id = href.substring(1)
    const element = markdownContainer.value?.querySelector(`#${id}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  } else if (href.endsWith('.md')) {
    // .md 파일인 경우 Rust 백엔드를 사용하여 파싱 및 렌더링
    console.log('markdown 파일 로드:', href)
    await loadMarkdownFile(href, true)
  } else {
    // 다른 모든 링크(외부 링크 및 상대 링크 포함)는 Tauri Webview에 임베디드되어 열립니다.
    console.log('컴포넌트 내에서 열기:', href)
    await showExternalLink(href)
  }
}

// 외부 브라우저에서 현재 링크 열기
const openInBrowser = async () => {
  if (!currentUrl.value) return
  try {
    await openUrl(currentUrl.value)
  } catch (error) {
    console.error('브라우저에서 열기 실패:', error)
  }
}

// README로 돌아가기
const goBack = async () => {
  if (!historyStack.value.length) return
  const previous = historyStack.value.pop()
  if (!previous) return

  if (previous.type === 'readme') {
    await loadReadme(false)
  } else if (previous.type === 'markdown') {
    await loadMarkdownFile(previous.source, false)
  } else if (previous.type === 'assistant') {
    await showAssistant(false)
  } else {
    await showExternalLink(previous.url, false)
  }
}

// 언어 전환
const switchLanguage = (lang: 'zh' | 'en') => {
  currentLang.value = lang
}

// 언어 변경 감지 시 다시 로드
watch(currentLang, () => {
  loadReadme(false, true)
})

// 뷰 전환 감지, README로 돌아갈 때 리스너 다시 추가
watch(isViewingLink, async (newValue) => {
  if (!newValue) {
    // README 뷰로 돌아갈 때, DOM 업데이트 후 리스너 다시 추가
    await nextTick()
    attachLinkListeners()
  } else {
    // 외부 링크 뷰로 전환할 때, 임베디드 Webview 다시 정렬
    await nextTick()
    updateExternalWebviewBounds()
  }
})

// 컴포넌트 마운트 시 로드
onMounted(() => {
  // 새로고침 후 남아있을 수 있는 임베디드 Webview를 닫으려고 시도
  Webview.getByLabel(webviewLabel)
    .then((webview) => webview?.close())
    .catch(() => {})

  window.addEventListener('beforeunload', destroyExternalWebview)
  loadReadme(false, true)
})

// 컴포넌트 언마운트 시 이벤트 리스너 정리
onUnmounted(() => {
  removeLinkListeners()
  // 컴포넌트 파괴 시 Webview 닫기, 고립된 창 방지
  void destroyExternalWebview()
  window.removeEventListener('beforeunload', destroyExternalWebview)
})
</script>

<style scoped lang="scss">
.bot-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  background: var(--bg-color);
}

.language-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-color);
  background: var(--bg-color);
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;

  .assistant-compact-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex: 1;
    width: 100%;
  }

  .back-btn {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-color);
    background: var(--bg-msg-hover);
    transition: all 0.2s ease;
    user-select: none;
    -webkit-user-select: none;

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      @apply bg-[#13987f40] text-[#13987f];
    }
  }

  .page-title {
    flex: 1;
    font-size: 13px;
    color: var(--chat-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.25;
    padding: 0 12px;
    &:hover {
      text-decoration-line: underline;
      color: #13987f;
    }
  }

  .open-in-browser-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-color);
    background: var(--bg-msg-hover);
    transition: all 0.2s ease;
    user-select: none;
    -webkit-user-select: none;
    white-space: nowrap;

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      @apply bg-[#13987f40] text-[#13987f];
    }
  }

  .assistant-btn {
    padding: 6px 18px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-color);
    background: linear-gradient(135deg, rgba(19, 152, 127, 0.32), rgba(19, 152, 127, 0.1));
    transition: all 0.2s ease-in-out;
    user-select: none;
    -webkit-user-select: none;

    &:hover {
      color: #13987f;
    }

    &.active {
      color: #ffffff;
      background: linear-gradient(135deg, #13987f, #1fb39b80);
      border-color: rgba(19, 152, 127, 0.4);
    }
  }

  .model-select-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    margin-left: 12px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-color);
    background: var(--bg-msg-hover);
    transition: all 0.2s ease-in-out;
    user-select: none;
    -webkit-user-select: none;

    &:hover {
      color: #13987f;
    }

    &.active {
      color: #13987f;
      background: rgba(19, 152, 127, 0.18);
      box-shadow: inset 0 0 0 1px rgba(19, 152, 127, 0.25);
    }
  }

  .model-select-text {
    white-space: nowrap;
  }

  .model-select-icon {
    color: currentColor;
  }

  .lang-btn {
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-color);
    background: var(--bg-msg-hover);
    transition: all 0.2s ease;
    user-select: none;
    -webkit-user-select: none;

    &:hover {
      @apply dark:bg-[#13987f40] bg-[#e8f4f1] text-[#13987f];
    }

    &.active {
      @apply dark:bg-[#13987f40] bg-[#e8f4f1] text-[#13987f];
      box-shadow: inset 0 0 0 1px #13987f60;
    }
  }

  .import-btn {
    margin-right: 16px;
  }
}

.bot-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.external-webview {
  flex: 1;
  min-height: 0;
  max-width: 100%;
  position: relative;
  box-sizing: border-box;
}

.external-webview__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-color-secondary, #909090);
  font-size: 14px;
  padding: 16px;
  text-align: center;
}

// Markdown 내용 컨테이너
.markdown-content {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  background-color: transparent;
  color: var(--text-color);
  box-sizing: border-box;
  font-size: 14px;
  line-height: 1.7;
  word-wrap: break-word;
  overflow-wrap: break-word;

  // 모든 직접적인 자식 요소가 컨테이너를 초과하지 않도록 강제
  > * {
    max-width: 100%;
  }
  --fgColor-default: var(--text-color);
  --fgColor-muted: var(--chat-text-color, var(--text-color));
  --fgColor-accent: #13987f;
  --fgColor-attention: #13987f;
  --fgColor-success: var(--success-color, #13987f);
  --fgColor-danger: var(--danger-color, #d1242f);
  --bgColor-default: var(--bg-color);
  --bgColor-muted: var(--bg-msg-hover);
  --bgColor-neutral-muted: rgba(144, 144, 144, 0.15);
  --bgColor-attention-muted: #13987f16;
  --borderColor-default: var(--line-color);
  --borderColor-muted: var(--line-color);
  --borderColor-neutral-muted: rgba(144, 144, 144, 0.2);
  --borderColor-accent-emphasis: #13987f;

  // 일반 테이블 처리
  :deep(table) {
    display: table;
    width: 100%;
    max-width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    overflow-x: auto;
    box-sizing: border-box;
    margin: 16px 0;

    tbody,
    thead {
      display: table;
      width: 100%;
      table-layout: auto;
    }

    tr {
      display: table-row;
    }

    td,
    th {
      display: table-cell;
      padding: 8px 10px;
      border: 1px solid var(--borderColor-default);
      word-break: break-word;
      overflow-wrap: break-word;
    }

    th {
      background: var(--bgColor-neutral-muted);
      font-weight: 600;
      text-align: left;
    }
  }

  // 코드 블록 적응형 - 컨테이너 내에서 스크롤
  :deep(pre) {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: pre;
    word-wrap: normal;
    box-sizing: border-box;
    margin: 16px 0;

    code {
      display: inline-block;
      min-width: 100%;
      white-space: pre;
      word-wrap: normal;
    }
  }

  // 인라인 코드 적응형
  :deep(code) {
    max-width: 100%;
    word-break: break-word;
    box-sizing: border-box;
  }

  // 이미지 적응형
  :deep(img) {
    max-width: 100%;
    height: auto;
    box-sizing: border-box;
  }

  // 긴 URL 및 텍스트 처리
  :deep(a) {
    color: #13987f;
    word-break: break-word;
    overflow-wrap: break-word;
    text-decoration: none;
  }

  :deep(a:hover) {
    text-decoration: underline;
  }

  // 단락 및 제목 적응형
  :deep(p),
  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    max-width: 100%;
    word-wrap: break-word;
    overflow-wrap: break-word;
    box-sizing: border-box;
    margin: 0 0 12px;
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    font-weight: 700;
    line-height: 1.4;
  }

  :deep(h1) {
    font-size: 26px;
  }

  :deep(h2) {
    font-size: 22px;
  }

  :deep(h3) {
    font-size: 18px;
  }

  :deep(h4),
  :deep(h5),
  :deep(h6) {
    font-size: 16px;
  }

  // 목록 적응형
  :deep(ul),
  :deep(ol) {
    max-width: 100%;
    box-sizing: border-box;
    padding-left: 20px;
    margin: 0 0 12px;
  }

  :deep(li) {
    margin-bottom: 6px;
  }

  // 인용 블록 적응형
  :deep(blockquote) {
    max-width: 100%;
    overflow-x: auto;
    box-sizing: border-box;
    padding: 8px 12px;
    margin: 12px 0;
    border-left: 3px solid var(--fgColor-accent);
    background: var(--bgColor-attention-muted);
  }

  // div 및 기타 컨테이너 적응형
  :deep(div) {
    max-width: 100%;
    box-sizing: border-box;
  }

  // 스크롤바 미화
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(144, 144, 144, 0.3);
    border-radius: 3px;

    &:hover {
      background: rgba(144, 144, 144, 0.5);
    }
  }
}
</style>
