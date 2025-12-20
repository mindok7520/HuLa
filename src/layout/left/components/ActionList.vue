<template>
  <div ref="actionList" class="flex-1 mt-20px flex-col-x-center justify-between" data-tauri-drag-region>
    <!-- 상단 작업 표시줄 -->
    <header ref="header" class="flex-col-x-center gap-10px color-[--left-icon-color]">
      <div
        v-for="(item, index) in menuTop"
        :key="index"
        :class="[
          { active: activeUrl === item.url },
          openWindowsList.has(item.url) ? 'color-[--left-win-icon-color]' : 'top-action flex-col-center',
          showMode === ShowModeEnum.ICON ? 'p-[6px_8px]' : 'w-46px py-4px'
        ]"
        style="text-align: center"
        @click="pageJumps(item.url, item.title, item.size, item.window)"
        :title="item.title">
        <!-- 창이 이미 열려 있을 때 표시 -->
        <n-popover :show-arrow="false" v-if="openWindowsList.has(item.url)" trigger="hover" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge">
              <svg class="size-22px" @click="tipShow = false">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction || item.icon : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <p>{{ item.title }} {{ t('home.action.opened') }}</p>
        </n-popover>
        <!-- 해당 옵션에 팁이 있을 때 표시 -->
        <n-popover style="padding: 12px" v-else-if="item.tip" trigger="manual" v-model:show="tipShow" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge" dot :show="item.dot">
              <svg class="size-22px" @click="handleTipShow(item)">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <n-flex align="center" justify="space-between">
            <p class="select-none">{{ item.tip }}</p>
            <svg @click="handleTipShow(item)" class="size-12px cursor-pointer">
              <use href="#close"></use>
            </svg>
          </n-flex>
        </n-popover>
        <!-- 해당 옵션에 팁이 없을 때 표시 -->
        <!-- 메시지 팁 -->
        <n-badge
          v-if="item.url === 'message'"
          :max="99"
          :value="unReadMark.newMsgUnreadCount"
          :show="unreadReady && unReadMark.newMsgUnreadCount > 0">
          <svg class="size-22px">
            <use
              :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
          </svg>
        </n-badge>
        <!-- 친구 팁 -->
        <n-badge
          v-if="item.url === 'friendsList'"
          :max="99"
          :value="unreadApplyCount"
          :show="unreadApplyCount > 0 && unreadReady">
          <svg class="size-22px">
            <use
              :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
          </svg>
        </n-badge>
        <p v-if="showMode === ShowModeEnum.TEXT && item.title" class="text-(10px center)">
          {{ item.shortTitle }}
        </p>
      </div>

      <div
        v-for="(item, index) in noMiniShowPlugins"
        :key="index"
        :class="[
          { active: activeUrl === item.url },
          openWindowsList.has(item.url) ? 'color-[--left-win-icon-color]' : 'top-action flex-col-center',
          showMode === ShowModeEnum.ICON ? 'p-[6px_8px]' : 'w-46px py-4px'
        ]"
        style="text-align: center"
        @click="pageJumps(item.url, item.title, item.size, item.window)"
        :title="item.title">
        <!-- 창이 이미 열려 있을 때 표시 -->
        <n-popover :show-arrow="false" v-if="openWindowsList.has(item.url)" trigger="hover" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge">
              <svg class="size-22px" @click="tipShow = false">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction || item.icon : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <p>{{ item.title }} {{ t('home.action.opened') }}</p>
        </n-popover>
        <!-- 해당 옵션에 팁이 있을 때 표시 -->
        <n-popover style="padding: 12px" v-else-if="item.tip" trigger="manual" v-model:show="tipShow" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge" dot :show="item.dot">
              <svg class="size-22px" @click="handleTipShow(item)">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <n-flex align="center" justify="space-between">
            <p class="select-none">{{ item.tip }}</p>
            <svg @click="handleTipShow(item)" class="size-12px cursor-pointer">
              <use href="#close"></use>
            </svg>
          </n-flex>
        </n-popover>
        <!-- 해당 옵션에 팁이 없을 때 표시 -->
        <n-badge v-else :max="99" :value="item.badge" :show="(item.badge ?? 0) > 0">
          <svg class="size-22px">
            <use
              :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
          </svg>
        </n-badge>
        <p v-if="showMode === ShowModeEnum.TEXT && item.title" class="text-(10px center)">
          {{ item.shortTitle }}
        </p>
      </div>

      <!-- (독립)메뉴 옵션 -->
      <div
        :class="showMode === ShowModeEnum.ICON ? 'top-action p-[6px_8px]' : 'top-action w-46px py-4px flex-col-center'">
        <n-popover
          style="padding: 8px; margin-left: 4px; background: var(--bg-setting-item)"
          :show-arrow="false"
          trigger="hover"
          placement="right">
          <template #trigger>
            <svg class="size-22px">
              <use href="#menu"></use>
            </svg>
          </template>
          <div v-if="miniShowPlugins.length">
            <n-flex
              v-for="(item, index) in miniShowPlugins as any"
              :key="'excess-' + index"
              @click="pageJumps(item.url, item.title, item.size, item.window)"
              class="p-[6px_5px] rounded-4px cursor-pointer hover:bg-[--setting-item-line]"
              :size="5">
              <svg class="size-16px" @click="tipShow = false">
                <use :href="`#${item.icon}`"></use>
              </svg>
              {{ item.title }}
            </n-flex>
          </div>
          <n-flex
            @click="menuShow = true"
            class="p-[6px_5px] rounded-4px cursor-pointer hover:bg-[--setting-item-line]"
            :size="5">
            <svg class="size-16px">
              <use href="#settings"></use>
            </svg>
            <!-- <span class="select-none">플러그인 관리</span> -->
            {{ t('home.action.plugin_manage') }}
          </n-flex>
        </n-popover>
        <p v-if="showMode === ShowModeEnum.TEXT" class="text-(10px center)">{{ t('home.action.plugin') }}</p>
      </div>
    </header>

    <!-- 하단 작업 표시줄 -->
    <footer class="flex-col-x-center mt-10px gap-10px color-[--left-icon-color] select-none">
      <div
        v-for="(item, index) in itemsBottom"
        :key="index"
        :class="[
          { active: activeUrl === item.url },
          openWindowsList.has(item.url) ? 'color-[--left-win-icon-color]' : 'bottom-action flex-col-center',
          showMode === ShowModeEnum.ICON ? 'p-[6px_8px]' : 'w-46px py-4px'
        ]"
        style="text-align: center"
        @click="pageJumps(item.url, item.title, item.size, item.window)"
        :title="item.title">
        <!-- 창이 이미 열려 있을 때 표시 -->
        <n-popover :show-arrow="false" v-if="openWindowsList.has(item.url)" trigger="hover" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge">
              <svg class="size-22px" @click="tipShow = false">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <p>{{ item.title }} {{ t('home.action.opened') }}</p>
        </n-popover>
        <!-- 해당 옵션에 팁이 있을 때 표시 -->
        <n-popover style="padding: 12px" v-else-if="item.tip" trigger="manual" v-model:show="tipShow" placement="right">
          <template #trigger>
            <n-badge :max="99" :value="item.badge">
              <svg class="size-22px" @click="tipShow = false">
                <use
                  :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
              </svg>
            </n-badge>
          </template>
          <n-flex align="center" justify="space-between">
            <p class="select-none">{{ item.tip }}</p>
            <svg @click="tipShow = false" class="size-12px cursor-pointer">
              <use href="#close"></use>
            </svg>
          </n-flex>
        </n-popover>
        <!-- 해당 옵션에 팁이 없을 때 표시 -->
        <n-badge v-else :max="99" :value="item.badge">
          <svg class="size-22px">
            <use
              :href="`#${activeUrl === item.url || openWindowsList.has(item.url) ? item.iconAction : item.icon}`"></use>
          </svg>
        </n-badge>
        <p v-if="showMode === ShowModeEnum.TEXT && item.title" class="menu-text text-(10px center)">
          {{ item.shortTitle }}
        </p>
      </div>

      <!--  더보기 옵션 패널  -->
      <div :title="t('home.action.more')" :class="{ 'bottom-action py-4px': showMode === ShowModeEnum.TEXT }">
        <n-popover
          v-model:show="settingShow"
          style="padding: 0; background: transparent; user-select: none"
          :show-arrow="false"
          trigger="click">
          <template #trigger>
            <svg
              :class="[
                { 'color-[--left-active-hover]': settingShow },
                showMode === ShowModeEnum.ICON ? 'more p-[6px_8px]' : 'w-46px'
              ]"
              class="size-22px relative"
              @click="settingShow = !settingShow">
              <use :href="settingShow ? '#hamburger-button-action' : '#hamburger-button'"></use>
            </svg>
          </template>
          <div class="setting-item">
            <div class="menu-list">
              <div v-for="(item, index) in moreList" :key="index">
                <div class="menu-item" @click="() => item.click()">
                  <svg>
                    <use :href="`#${item.icon}`"></use>
                  </svg>
                  {{ item.label }}
                </div>
              </div>
            </div>
          </div>
        </n-popover>
        <p v-if="showMode === ShowModeEnum.TEXT" class="text-(10px center)">{{ t('home.action.more') }}</p>
      </div>
    </footer>
  </div>

  <DefinePlugins v-model="menuShow" />
</template>
<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { PluginEnum, ShowModeEnum } from '@/enums'
import { useTauriListener } from '@/hooks/useTauriListener.ts'
import { useGlobalStore } from '@/stores/global.ts'
import { useMenuTopStore } from '@/stores/menuTop.ts'
import { usePluginsStore } from '@/stores/plugins.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { useFeedStore } from '@/stores/feed.ts'
import { useItemsBottom, useMoreList } from '../config.tsx'
import { leftHook } from '../hook.ts'
import DefinePlugins from './definePlugins/index.vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

const appWindow = WebviewWindow.getCurrent()
const { addListener } = useTauriListener()
const globalStore = useGlobalStore()
const pluginsStore = usePluginsStore()
const feedStore = useFeedStore()
const { showMode } = storeToRefs(useSettingStore())
const { menuTop } = storeToRefs(useMenuTopStore())
const itemsBottom = useItemsBottom()
const { plugins } = storeToRefs(pluginsStore)
const { unreadCount: feedUnreadCount } = storeToRefs(feedStore)
const { t } = useI18n()
const unReadMark = computed(() => globalStore.unReadMark)
const unreadReady = computed(() => globalStore.unreadReady)
// const headerRef = useTemplateRef('header')
// const actionListRef = useTemplateRef('actionList')
//const { } = toRefs(getCurrentInstance) // 所有菜单的外层div
const menuShow = ref(false)
const moreList = useMoreList()
// 메뉴에 표시되는 플러그인
const activePlugins = computed(() => {
  return plugins.value.filter((i) => i.isAdd)
})
// 메뉴 외부에 표시되는 플러그인
const noMiniShowPlugins = computed(() => {
  return activePlugins.value.filter((i) => !i.miniShow)
})
// 메뉴 내부에 표시되는 플러그인
const miniShowPlugins = computed(() => {
  return activePlugins.value.filter((i) => i.miniShow)
})
const { activeUrl, openWindowsList, settingShow, tipShow, pageJumps } = leftHook()

const handleTipShow = (item: any) => {
  tipShow.value = false
  item.dot = false
}

const unreadApplyCount = computed(() => {
  return globalStore.unReadMark.newFriendUnreadCount + globalStore.unReadMark.newGroupUnreadCount
})

const startResize = () => {
  window.dispatchEvent(new Event('resize'))
}

const handleResize = async (e: Event) => {
  const windowHeight = (e.target as Window).innerHeight
  const menuDivHeight = showMode.value === ShowModeEnum.TEXT ? 46 : 34
  const spaceHeight = 10
  const newMenuHeight = menuDivHeight + spaceHeight
  const headerTopHeight = 120
  const bottomPadding = 15
  const randomHeight = 3 // 플러그인 메뉴의 높이는 다른 메뉴보다 2.66666666667 더 높음
  const staticMenuNum = 2
  const menuNum = Math.floor(
    (windowHeight -
      (menuTop.value.length + noMiniShowPlugins.value.length + itemsBottom.value.length + staticMenuNum) *
        menuDivHeight -
      (menuTop.value.length + noMiniShowPlugins.value.length + itemsBottom.value.length + staticMenuNum - 1) *
        spaceHeight -
      headerTopHeight -
      bottomPadding -
      randomHeight) /
      newMenuHeight
  )
  if (menuNum < 0) {
    noMiniShowPlugins.value.map((i, index) => {
      if (index >= noMiniShowPlugins.value.length + menuNum) {
        pluginsStore.updatePlugin({ ...i, miniShow: true })
      }
    })
  } else if (menuNum >= 0 && miniShowPlugins.value.length > 0) {
    miniShowPlugins.value.map((i, index) => {
      if (index < menuNum) {
        pluginsStore.updatePlugin({ ...i, miniShow: false })
      }
    })
  }
}

/** 메인 인터페이스 높이 조정 */
const setHomeHeight = () => {
  invoke('set_height', { height: showMode.value === ShowModeEnum.TEXT ? 505 : 423 })
}

// 모멘트 읽지 않은 수 변경 감지, dynamic 플러그인의 뱃지에 동기화
watch(
  feedUnreadCount,
  (newCount) => {
    const dynamicPlugin = plugins.value.find((p) => p.url === 'dynamic')
    if (dynamicPlugin) {
      pluginsStore.updatePlugin({ ...dynamicPlugin, badge: newCount })
    }
  },
  { immediate: true }
)

onMounted(async () => {
  // 창 높이 초기화
  setHomeHeight()

  // 창 크기 변경 이벤트 감지, 메뉴 접기 처리
  window.addEventListener('resize', handleResize)

  // resize 이벤트 한 번 트리거, 플러그인 메뉴 표시 조정
  startResize()

  // 사용자 정의 이벤트 감지, 설정에서 메뉴 표시 모드 전환 및 플러그인 추가 후 높이 변화로 인해 플러그인 메뉴 표시 재조정 필요 처리
  await addListener(
    appWindow.listen('startResize', () => {
      startResize()
    }),
    'startResize'
  )

  if (tipShow.value) {
    menuTop.value.filter((item) => {
      if (item.state !== PluginEnum.BUILTIN) {
        item.dot = true
      }
    })
  }
  /** 10초 후 팁 닫기 */
  setTimeout(() => {
    tipShow.value = false
  }, 5000)
})
</script>
<style lang="scss" scoped>
@use '../style';

.setting-item {
  left: 24px;
  bottom: -40px;
}
</style>
