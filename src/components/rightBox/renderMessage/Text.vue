<template>
  <div :class="isMobile() ? 'text-16px' : 'text-14px'">
    <template v-for="(item, index) in fragments" :key="index">
      <n-popover
        trigger="click"
        placement="left"
        :show-arrow="false"
        style="padding: 0; background: var(--bg-info)"
        v-if="mentionTokenSet.has(item) && !props.historyMode">
        <template #trigger>
          <span
            :key="item"
            style="-webkit-user-select: text !important; user-select: text !important"
            class="text-#fbb990 cursor-pointer">
            {{ item }}
          </span>
        </template>
        <InfoPopover v-if="mentionTokenToUid.get(item)" :uid="mentionTokenToUid.get(item)!" />
      </n-popover>
      <span
        v-else-if="mentionTokenSet.has(item)"
        :key="item"
        style="-webkit-user-select: text !important; user-select: text !important"
        class="text-#fbb990 cursor-text">
        {{ item }}
      </span>
      <template v-else-if="item.startsWith('http')">
        <n-flex align="center" :wrap="false">
          <n-tooltip trigger="hover" style="flex-shrink: 0">
            <template #trigger>
              <svg class="size-12px cursor-pointer pr-4px" @click="handleCopy(item)">
                <use href="#copy"></use>
              </svg>
            </template>
            <span>URL 복사</span>
          </n-tooltip>
          <div style="flex: 1; word-wrap: break-word; overflow-wrap: anywhere">
            <n-highlight
              v-if="props.searchKeyword"
              :text="item"
              :patterns="[props.searchKeyword]"
              :highlight-style="{
                userSelect: 'text',
                padding: '2px 4px',
                borderRadius: '6px',
                color: '#000',
                background: '#13987f'
              }" />
            <p v-else style="margin: 0">{{ item }}</p>
          </div>
        </n-flex>
      </template>
      <n-highlight
        v-else-if="props.searchKeyword"
        :text="item"
        :patterns="[props.searchKeyword]"
        :highlight-style="{
          userSelect: 'text',
          padding: '2px 4px',
          borderRadius: '6px',
          color: '#000',
          background: '#13987f'
        }" />
      <template v-else>{{ item }}</template>
      <div
        v-if="keys.includes(item)"
        :key="item + index"
        rel="noopener noreferrer"
        target="_blank"
        class="text-card"
        @click="openUrl(item)">
        <div v-if="urlMap[item].image" class="text-card-image-wrapper">
          <img class="text-card-image" :src="urlMap[item].image" @error="onImageLoadError" />
        </div>
        <div class="text-card-link-content">
          <span class="text-14px line-clamp-1">{{ urlMap[item].title }}</span>
          <span class="text-(12px [--chat-text-color]) mt-4px line-clamp-2">{{ urlMap[item].description }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import { openExternalUrl } from '@/hooks/useLinkSegments'
import { useGroupStore } from '@/stores/group'
import type { TextBody } from '@/services/types'
import { isMobile } from '@/utils/PlatformConstants'

// 특수 렌더링이 필요한 조각 구간을 설명하는 마커 구조
type ContentMarker = {
  start: number
  end: number
  text: string
  type: 'mention' | 'url'
}

const props = defineProps<{
  body: TextBody
  searchKeyword?: string
  historyMode?: boolean
}>()
// 일치하는 모든 문자열 가져오기
const urlMap = props.body.urlContentMap || {}
const keys = Object.keys(urlMap)
// URL 매칭을 위한 정규식 상수
const URL_REGEX = /https?:\/\/[^\s<]+[^<.,:;"')\]\s]/g

const groupStore = useGroupStore()

// 사용자가 직접 입력한 '@텍스트'가 오판되지 않도록 백엔드에서 전달된 atUidList에만 의존
const mentionTokens = computed(() => {
  if (!Array.isArray(props.body.atUidList) || props.body.atUidList.length === 0) {
    return []
  }
  const tokens = new Set<string>()
  props.body.atUidList.forEach((uid) => {
    const user = groupStore.getUserInfo(uid)
    const name = user?.myName || user?.name
    if (name) {
      tokens.add(`@${name}`)
    }
  })
  return Array.from(tokens)
})
// Set을 사용하여 조각이 실제 @멘션에 속하는지 빠르게 판단
const mentionTokenSet = computed(() => new Set(mentionTokens.value))

// 멘션 토큰에서 uid로의 매핑 생성
const mentionTokenToUid = computed(() => {
  const map = new Map<string, string>()
  if (!Array.isArray(props.body.atUidList) || props.body.atUidList.length === 0) {
    return map
  }
  props.body.atUidList.forEach((uid) => {
    const user = groupStore.getUserInfo(uid)
    const name = user?.myName || user?.name
    if (name) {
      map.set(`@${name}`, uid)
    }
  })
  return map
})

// 긴 링크 처리
const processLongUrls = computed(() => {
  let content = props.body.content || ''
  content = content.replace(/&nbsp;/g, '\u00A0')

  return content.replace(URL_REGEX, (match, url) => {
    // urlMap에 이미 해당 링크 정보가 있으면 urlMap에 추가
    if (!urlMap[match] && url) {
      urlMap[match] = {
        title: url,
        description: '링크',
        image: ''
      }
      // keys에 동적으로 추가
      if (!keys.includes(match)) {
        keys.push(match)
      }
    }
    return match
  })
})

// 매칭 문자열을 사용하여 동적 정규식을 생성하고 텍스트를 조각 배열로 분할
const fragments = computed(() => {
  const content = processLongUrls.value

  // 모든 특수 마커 위치를 저장할 배열 생성
  const markers: ContentMarker[] = []

  // 매칭된 멘션 목록을 기반으로 @멘션 마커 추가
  mentionTokens.value.forEach((token) => {
    if (!token) return
    let searchIndex = 0
    while (searchIndex < content.length) {
      const index = content.indexOf(token, searchIndex)
      if (index === -1) break
      markers.push({
        start: index,
        end: index + token.length,
        text: token,
        type: 'mention'
      })
      searchIndex = index + token.length
    }
  })

  // URL 마커 추가
  keys.forEach((key) => {
    let index = 0
    while ((index = content.indexOf(key, index)) !== -1) {
      markers.push({
        start: index,
        end: index + key.length,
        text: key,
        type: 'url'
      })
      index += key.length
    }
  })

  // 시작 위치를 기준으로 마커 정렬
  markers.sort((a, b) => a.start - b.start)

  // 중복된 마커 병합
  for (let i = 0; i < markers.length - 1; i++) {
    if (markers[i + 1].start < markers[i].end) {
      // 다음 마커의 시작 위치가 현재 마커의 종료 위치보다 앞서면 중복됨
      // 더 긴 마커 유지 선택
      if (markers[i + 1].end - markers[i + 1].start > markers[i].end - markers[i].start) {
        markers.splice(i, 1) // 현재 마커 삭제
      } else {
        markers.splice(i + 1, 1) // 다음 마커 삭제
      }
      i-- // 현재 위치 다시 확인
    }
  }

  // 최종 조각 배열 생성
  const result: string[] = []
  let lastEnd = 0

  for (const marker of markers) {
    // 마커 앞의 일반 텍스트 추가
    if (marker.start > lastEnd) {
      result.push(content.substring(lastEnd, marker.start))
    }
    // 마커 텍스트 추가
    result.push(marker.text)
    lastEnd = marker.end
  }

  // 마지막 일반 텍스트 추가
  if (lastEnd < content.length) {
    result.push(content.substring(lastEnd))
  }

  // 마커가 없으면 전체 내용 반환
  return result.length > 0 ? result : [content]
})

// 링크 열기
const openUrl = (url: string) => openExternalUrl(url)

// 복사 처리
const handleCopy = (item: string) => {
  if (item) {
    navigator.clipboard.writeText(item)
    window.$message.success('복사 성공')
  }
}

const onImageLoadError = (e: Event) => {
  const target = e.target as HTMLImageElement
  if (!target) return
  target.style.opacity = '0'
}
</script>

<style scoped>
.text-card {
  display: flex;
  margin: 8px 0;
  padding: 12px;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.03);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
}

.text-card:hover {
  background-color: rgba(0, 0, 0, 0.08);
}

.text-card-image-wrapper {
  width: 60px;
  height: 60px;
  margin-right: 12px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.text-card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.2s ease;
}

.text-card-link-content {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
}
</style>
