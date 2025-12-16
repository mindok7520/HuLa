<template>
  <div class="tab-bar flex justify-around items-end pt-3">
    <RouterLink
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="tab-item flex flex-col flex-1 items-center no-underline relative"
      :class="route.path === item.path ? 'color-[--tab-bar-icon-color]' : 'text-#000'">
      <n-badge
        class="flex flex-col w-55% flex-1 relative items-center"
        :offset="[-6, 6]"
        color="red"
        :value="getUnReadCount(item.label)"
        :max="99">
        <svg class="w-22px h-22px">
          <use :href="`#${route.path === item.path ? item.actionIcon : item.icon}`"></use>
        </svg>
        <span class="text-xs mt-1">{{ item.label }}</span>
      </n-badge>
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { useFeedStore } from '@/stores/feed'
import { storeToRefs } from 'pinia'

type NavItem = {
  label: string
  path: string
  icon: string
  actionIcon: string
}

const route = useRoute()
const feedStore = useFeedStore()
const { unreadCount: feedUnreadCount } = storeToRefs(feedStore)

const getUnReadCount = (label: string) => {
  if (label === '커뮤니티') {
    return feedUnreadCount.value
  }
  return 0

  // 기타 읽지 않은 카운트는 일시적으로 비활성화 (메시지 페이지 문제)
  // if (label === '메시지') {
  //   return unReadMark.value.newMsgUnreadCount
  // } else if (label === '연락처') {
  //   return unReadMark.value.newFriendUnreadCount
  // }
}

const navItems: NavItem[] = [
  {
    label: '메시지',
    path: '/mobile/message',
    icon: 'message',
    actionIcon: 'message-action'
  },
  {
    label: '연락처',
    path: '/mobile/friends',
    icon: 'avatar',
    actionIcon: 'avatar-action'
  },
  {
    label: '커뮤니티',
    path: '/mobile/community',
    icon: 'fire',
    actionIcon: 'fire-action'
  },
  {
    label: '마이',
    path: '/mobile/my',
    icon: 'wode',
    actionIcon: 'wode-action'
  }
]
</script>

<style scoped lang="scss">
.tab-bar {
  border-top: 0.5px solid #e3e3e3;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}
</style>
