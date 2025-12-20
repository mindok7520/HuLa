<template>
  <div ref="ContextMenuRef">
    <slot></slot>
    <Teleport to="body">
      <transition-group @beforeEnter="handleBeforeEnter" @enter="handleEnter">
        <!-- 이모지 메뉴 -->
        <div
          v-if="showMenu && emoji && emoji.length > 0"
          class="context-menu select-none"
          style="height: fit-content"
          :style="emojiMenuPosition">
          <div class="emoji-container">
            <div v-for="(item, index) in displayedEmojis" :key="index" class="p-4px">
              <n-popover :delay="500" :duration="0" trigger="hover" :show-arrow="false" placement="top">
                <template #trigger>
                  <div class="emoji-item" @click="handleReplyEmoji(item)">
                    <img :title="item.title" class="size-18px" :src="item.url" :alt="item.title" />
                  </div>
                </template>
                <span>{{ item.title }}</span>
              </n-popover>
            </div>
            <div v-if="!showAllEmojis && emoji.length > 4" class="py-4px">
              <div class="emoji-more-btn" @click="showAllEmojis = true">{{ t('menu.ctx_menu_more') }}</div>
            </div>
          </div>
        </div>
        <!-- 일반 우클릭 메뉴 -->
        <div
          v-if="!isMobile() && showMenu && !(emoji && emoji.length > 0 && showAllEmojis)"
          class="context-menu select-none"
          :style="{
            left: `${pos.posX}px`,
            top: `${pos.posY}px`
          }">
          <div
            v-resize="handleSize"
            v-if="(visibleMenu && visibleMenu.length > 0) || (visibleSpecialMenu && visibleSpecialMenu.length > 0)"
            class="menu-list">
            <div v-for="(item, index) in visibleMenu" :key="index">
              <!-- 비활성화된 메뉴 옵션은 클릭 이벤트 차단 필요  -->
              <div class="menu-item-disabled" v-if="item.disabled" @click.prevent="$event.preventDefault()">
                <div class="menu-item-content">
                  <svg><use :href="`#${getMenuItemProp(item, 'icon')}`"></use></svg>
                  <p class="h-24px">{{ getMenuItemProp(item, 'label') }}</p>
                </div>
              </div>
              <div
                class="menu-item"
                :class="{ 'menu-item-danger': isDangerousItem(item) }"
                v-else
                @click="handleClick(item)"
                @mouseenter="handleMouseEnter(item, index)"
                @mouseleave="handleMouseLeave">
                <div class="menu-item-content">
                  <svg><use :href="`#${getMenuItemProp(item, 'icon')}`"></use></svg>
                  <p class="h-24px">{{ getMenuItemProp(item, 'label') }}</p>
                  <svg v-if="shouldShowArrow(item)" class="arrow-icon">
                    <use href="#right"></use>
                  </svg>
                </div>
              </div>
            </div>
            <!-- 특별한 메뉴 항목이 있는 경우에만 구분선 필요 -->
            <div v-if="visibleSpecialMenu.length > 0" class="flex-col-y-center gap-6px">
              <!-- 구분선 (일반 메뉴가 있을 때만 표시) -->
              <div v-if="visibleMenu && visibleMenu.length > 0" class="h-1px bg-[--line-color] m-[2px_8px]"></div>
              <div
                @click="handleClick(item)"
                class="menu-item"
                :class="{ 'menu-item-danger': isDangerousItem(item) }"
                v-for="item in visibleSpecialMenu"
                :key="item.label">
                <svg><use :href="`#${getMenuItemProp(item, 'icon')}`"></use></svg>
                <p class="h-24px">{{ getMenuItemProp(item, 'label') }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 모바일 메뉴 -->
        <div
          v-if="isMobile() && showMenu && !(emoji && emoji.length > 0 && showAllEmojis)"
          class="context-menu select-none"
          :style="{
            left: `${pos.posX}px`,
            top: `${pos.posY}px`
          }">
          <div
            v-resize="handleSize"
            v-if="(visibleMenu && visibleMenu.length > 0) || (visibleSpecialMenu && visibleSpecialMenu.length > 0)"
            class="max-w-70vw grid grid-cols-5 gap-5px h-auto!">
            <div
              @click="handleClick(item)"
              v-for="(item, index) in visibleMenu"
              :key="index"
              class="w-45px h-45px flex justify-center items-center">
              <div class="flex w-45px flex-col active:bg-gray-200 justify-center items-center max-h-45px">
                <svg class="w-18px w-18px"><use :href="`#${getMenuItemProp(item, 'icon')}`"></use></svg>
                <p class="h-24px text-12px">{{ getMenuItemProp(item, 'label') }}</p>
                <svg v-if="shouldShowArrow(item)" class="arrow-icon w-18px w-18px">
                  <use href="#right"></use>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- 하위 메뉴 -->
        <div v-if="showSubmenu && activeSubmenu" class="context-submenu" :style="submenuPosition">
          <div class="menu-list">
            <div
              v-for="(subItem, subIndex) in activeSubmenu"
              :key="subIndex"
              class="menu-item"
              :class="{ 'menu-item-danger': isDangerousItem(subItem) }">
              <div class="menu-item-content" @click="handleSubItemClick(subItem)">
                <svg class="check-icon">
                  <use :href="`#${getMenuItemProp(subItem, 'icon')}`"></use>
                </svg>
                <p class="h-24px">{{ getMenuItemProp(subItem, 'label') }}</p>
              </div>
            </div>
          </div>
        </div>
      </transition-group>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useContextMenu } from '@/hooks/useContextMenu.ts'
import { useViewport } from '@/hooks/useViewport.ts'
import { isMobile } from '@/utils/PlatformConstants'
import { useI18n } from 'vue-i18n'

type Props = {
  content?: Record<string, any>
  menu?: any[]
  emoji?: any[]
  specialMenu?: any[]
}
const { t } = useI18n()

const props = withDefaults(defineProps<Props>(), {
  content: () => ({}),
  menu: () => [],
  emoji: () => [],
  specialMenu: () => []
})

// 전체 이모지 표시 여부 제어
const showAllEmojis = ref(false)

// 표시할 이모지 목록 계산
const displayedEmojis = computed(() => {
  return showAllEmojis.value ? props.emoji : props.emoji.slice(0, 4)
})

// 계산된 속성을 사용하여 표시할 메뉴 항목 필터링
const visibleMenu = computed(() => {
  // visible 속성이 함수인지 확인하고 호출
  return props.menu?.filter((item: any) => {
    if (typeof item.visible === 'function') {
      return item.visible(props.content) // visible이 함수인 경우 호출
    }
    // visible 속성이 없으면 기본적으로 표시
    return true
  })
})

// specialMenu 필터링 기능 추가
const visibleSpecialMenu = computed(() => {
  return props.specialMenu?.filter((item: any) => {
    if (typeof item.visible === 'function') {
      return item.visible(props.content)
    }
    return true
  })
})

/** menu 전달 여부 확인 */
const isNull = computed(() => props.menu === void 0)
const ContextMenuRef = useTemplateRef('ContextMenuRef')
const emit = defineEmits(['select', 'reply-emoji', 'menu-show'])
/** 마우스 위치 및 우클릭 메뉴 표시 여부 확인 */
const { x, y, showMenu } = useContextMenu(ContextMenuRef, isNull)

// showMenu 상태 변화 감지 및 부모 컴포넌트에 이벤트 전송
watch(
  () => showMenu.value,
  (newVal) => {
    emit('menu-show', newVal)
  },
  { immediate: true }
)
/** 뷰포트 너비/높이 확인 */
const { vw, vh } = useViewport()
/** 우클릭 메뉴 크기 정의 */
const w = ref(0)
const h = ref(0)
// 하위 메뉴 상태
const showSubmenu = ref(false)
const activeSubmenu = ref<any[]>([])
const submenuPosition = ref({
  left: '0px',
  top: '0px'
})
/** 우클릭 메뉴 위치 계산 */
const pos = computed(() => {
  let posX = x.value
  let posY = y.value
  // x 좌표
  if (x.value > vw.value - w.value) {
    posX -= w.value
  }
  // y 좌표
  if (y.value > vh.value - h.value) {
    posY -= y.value - vh.value + h.value
  }
  return {
    posX,
    posY
  }
})

/** 이모지 메뉴 크기 및 위치 */
const emojiWidth = ref(180) // 이모지 메뉴 대략적인 너비, .emoji-container의 max-w-180px 설정 기준

// 모든 이모지 표시 여부에 따라 메뉴 높이 동적 계산
const emojiHeight = computed(() => {
  return showAllEmojis.value ? 114 : 40 // 더보기 미표시 시 40, 펼쳤을 때 114
})

/** 이모지 메뉴 위치 계산 */
const emojiMenuPosition = computed(() => {
  // 일반 우클릭 메뉴 계산 위치를 기준으로 사용
  let posX = pos.value.posX
  let posY = pos.value.posY - emojiHeight.value // 기본적으로 우클릭 메뉴 위쪽에 표시

  // 메시지가 왼쪽인지 오른쪽인지 판단 (마우스 원래 위치와 화면 중앙 관계 이용)
  const isRightSideMessage = x.value > vw.value / 2

  if (isRightSideMessage) {
    // 이모지 메뉴 왼쪽 위치 = 우클릭 메뉴 오른쪽 경계 - 이모지 메뉴 너비
    posX = pos.value.posX + w.value - emojiWidth.value

    // 왼쪽 경계를 벗어나지 않도록 보장
    if (posX < 10) {
      posX = 10
    }
  } else {
    posX = pos.value.posX

    // 오른쪽 경계를 벗어나지 않는지 확인
    if (posX + emojiWidth.value > vw.value) {
      posX = vw.value - emojiWidth.value - 10
    }
  }

  // 수직 방향으로 뷰포트를 벗어나지 않는지 확인
  if (posY < 10) {
    // 위쪽 공간이 부족하면 우클릭 메뉴 아래쪽에 표시
    posY = pos.value.posY + 10
  }

  return {
    left: `${posX}px`,
    top: `${posY}px`
  }
})

// 주 메뉴 표시 상태 감지용 watch 추가
watch(
  () => showMenu.value,
  (newVal) => {
    if (!newVal) {
      // 주 메뉴가 숨겨질 때 하위 메뉴도 함께 숨김
      showSubmenu.value = false
      activeSubmenu.value = []
      // 이모지 표시 상태 초기화
      showAllEmojis.value = false
    }
  }
)

const handleSize = ({ width, height }: any) => {
  w.value = width
  h.value = height
}

/** 우클릭 주 메뉴 클릭 이벤트 처리 */
const handleClick = (item: string) => {
  nextTick(() => {
    showMenu.value = false
    emit('select', item)
  })
}

/** 이모지 답장 이벤트 처리 */
const handleReplyEmoji = (item: string) => {
  if (!item) return
  nextTick(() => {
    showMenu.value = false
    emit('reply-emoji', item)
  })
}

// 하위 메뉴 항목 클릭 처리
const handleSubItemClick = (item: any) => {
  if (typeof item.click === 'function') {
    item.click(props.content)
  }
  showSubmenu.value = false
}

const handleBeforeEnter = (el: any) => {
  el.style.height = 0
}

const handleEnter = (el: any) => {
  el.style.height = 'auto'
  const h = el.clientHeight
  el.style.height = 0
  requestAnimationFrame(() => {
    el.style.height = `${h}px`
  })
}

/**
 * 메뉴 항목 속성 값 가져오기 (함수형 및 정적 값 처리)
 * @param item 메뉴 항목
 * @param prop 속성명 ('icon' | 'label')
 */
const getMenuItemProp = (item: any, prop: 'icon' | 'label') => {
  return typeof item[prop] === 'function' ? item[prop](props.content) : item[prop]
}

/**
 * 메뉴 항목에 위험 스타일이 필요한지 판단
 * @param item 메뉴 항목
 */
const isDangerousItem = (item: any) => {
  const icon = getMenuItemProp(item, 'icon')
  return ['logout', 'forbid'].includes(icon)
}

// handleMouseEnter 함수 수정
const handleMouseEnter = (item: any, index: number) => {
  // 하위 메뉴 존재 여부 확인 (함수 형태 children 포함)
  const hasChildren = typeof item.children === 'function' ? true : Array.isArray(item.children)
  if (!hasChildren) {
    showSubmenu.value = false
    return
  }

  // 하위 메뉴 내용 가져오기
  const children = typeof item.children === 'function' ? item.children(props.content) : item.children
  if (!children || children.length === 0) {
    showSubmenu.value = false
    return
  }

  // 현재 메뉴 항목 위치 확인
  const menuItem = document.querySelectorAll('.menu-item')[index]
  const rect = menuItem.getBoundingClientRect()

  // 하위 메뉴 예상 너비 및 높이 계산
  const submenuWidth = 120 // 하위 메뉴 최소 너비
  const submenuHeight = children.length * 30 // 각 항목 예상 높이

  let left = rect.right + 5
  let top = rect.top

  // 오른쪽 공간이 충분한지 판단
  if (rect.right + submenuWidth > vw.value) {
    // 오른쪽 공간 부족 시 아래쪽에 표시
    left = rect.left
    top = rect.bottom + 5 // 간격 약간 추가

    // 아래쪽 공간이 충분한지 확인, 부족하면 위쪽으로 표시
    if (top + submenuHeight > vh.value) {
      top = rect.top - submenuHeight - 5
    }
  } else {
    // 오른쪽 공간은 충분하지만 수직 방향 확인 필요
    if (rect.top + submenuHeight > vh.value) {
      // 뷰포트 하단을 벗어나면 위로 오프셋
      top = vh.value - submenuHeight - 10
    }
  }

  submenuPosition.value = {
    left: `${left}px`,
    top: `${top}px`
  }

  activeSubmenu.value = children
  showSubmenu.value = true
}

// 마우스 이탈 처리 함수 수정
const handleMouseLeave = (e: MouseEvent) => {
  // 마우스 이동 추적을 위한 상태 추가
  const relatedTarget = e.relatedTarget as HTMLElement

  // 마우스가 하위 메뉴 또는 하위 메뉴 요소로 이동하면 메뉴를 닫지 않음
  if (relatedTarget?.closest('.context-submenu')) {
    return
  }

  // 주 메뉴와 하위 메뉴 모두에 없으면 하위 메뉴 닫기
  setTimeout(() => {
    if (!isMouseInSubmenu(e) && !isMouseInMainMenu(e)) {
      showSubmenu.value = false
    }
  }, 100)
}

// 마우스가 하위 메뉴 내에 있는지 확인하는 함수 수정
const isMouseInSubmenu = (e: MouseEvent) => {
  const submenu = document.querySelector('.context-submenu')
  if (!submenu) return false

  // document.elementFromPoint를 사용하여 마우스 아래 요소 확인
  const elementsUnderMouse = document.elementsFromPoint(e?.clientX || 0, e?.clientY || 0)

  return elementsUnderMouse.some((el) => el.closest('.context-submenu'))
}

// 마우스가 주 메뉴 내에 있는지 확인하는 함수 수정
const isMouseInMainMenu = (e: MouseEvent) => {
  const mainMenu = document.querySelector('.context-menu')
  if (!mainMenu) return false

  const elementsUnderMouse = document.elementsFromPoint(e.clientX, e.clientY)
  return elementsUnderMouse.some((el) => el.closest('.context-menu'))
}

// 화살표 표시 여부 판단 함수 추가
const shouldShowArrow = (item: any) => {
  // children이 함수인 경우 먼저 결과 확인
  const children = typeof item.children === 'function' ? item.children(props.content) : item.children

  // 유효한 하위 메뉴 내용이 있는지 확인
  return Array.isArray(children) && children.length > 0
}
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/variable.scss' as *;

// 공통 menu-item 스타일
@mixin menu-item {
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 10px;
  svg {
    width: 16px;
    height: 16px;
  }
  .menu-item-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }
}

@mixin menu-item-wrap {
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 10px;
  svg {
    width: 16px;
    height: 16px;
  }
  .menu-item-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }
}

// menu-list 공통 스타일
@mixin menu-list {
  -webkit-backdrop-filter: blur(10px);
  padding: 5px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  .menu-item {
    @include menu-item();
    display: flex;
    align-items: center;
    &:hover {
      background-color: var(--bg-menu-hover);
      svg {
        animation: twinkle 0.3s ease-in-out;
      }
    }
  }
}

@mixin menu-list-wrap {
  -webkit-backdrop-filter: blur(10px);
  padding: 5px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 6px;

  .menu-item-wrap {
    @include menu-item();
    display: flex;
    align-items: center;
    &:hover {
      background-color: var(--bg-menu-hover);
      svg {
        animation: twinkle 0.3s ease-in-out;
      }
    }
  }
}

// menu-list 공통 스타일
@mixin menu-list-wrap {
  -webkit-backdrop-filter: blur(10px);
  padding: 5px;
  display: flex;
  flex-direction: row;
  gap: 6px;

  .menu-item {
    @include menu-item();
    display: flex;
    align-items: center;
    &:hover {
      background-color: var(--bg-menu-hover);
      svg {
        animation: twinkle 0.3s ease-in-out;
      }
    }
  }
}

.context-menu {
  @include menu-item-style();
  .emoji-container {
    -webkit-backdrop-filter: blur(10px);
    background: var(--bg-menu);
    /* 이모지 배치 허용, 각 28px 너비 및 간격 추가 */
    @apply flex flex-wrap max-w-180px px-6px select-none;
  }

  .emoji-item {
    @apply flex-center size-28px rounded-4px text-16px cursor-pointer hover:bg-[--emoji-hover];
  }

  .emoji-more-btn {
    @apply flex-center size-28px px-4px rounded-4px text-12px cursor-pointer bg-[--bg-menu-hover] hover:bg-[--emoji-hover];
  }
  .menu-list {
    @include menu-list();
    width: max-content;
    .menu-item-disabled {
      @include menu-item();
      color: var(--disabled-color);
      svg {
        color: var(--disabled-color);
      }
    }
    .menu-item-danger {
      color: #d03553;
      svg {
        color: #d03553;
      }
    }
  }

  .menu-list-wrap {
    display: flex;
    justify-content: row;
    flex-wrap: wrap;
    @include menu-list-wrap();
    .menu-item-disabled {
      @include menu-item-wrap();
      color: var(--disabled-color);
      svg {
        color: var(--disabled-color);
      }
    }
    .menu-item-danger {
      color: #d03553;
      svg {
        color: #d03553;
      }
    }
  }
}

.context-submenu {
  position: fixed;
  z-index: 1000;
  @include menu-item-style();

  .menu-list {
    @include menu-list();
    min-width: 120px;
    .menu-item-danger {
      color: #d03553;
      svg {
        color: #d03553;
      }
    }
  }
}

.menu-item {
  .menu-item-content {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    column-gap: 12px;
    width: max-content;
    position: relative;
    svg {
      flex-shrink: 0;
      min-width: 16px;
    }
    p {
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .arrow-icon {
      position: static;
      justify-self: end;
      width: 12px;
      height: 12px;
      color: var(--text-color);
    }

    .check-icon {
      width: 14px;
      height: 14px;
    }
  }
}
</style>
