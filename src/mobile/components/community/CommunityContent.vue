<template>
  <div class="flex flex-col gap-4 pb-4 border-b border-gray-100">
    <!-- 프로필 사진 데이터 -->
    <div class="grid grid-cols-[38px_1fr] items-start gap-1">
      <!-- 프로필 사진: 단독 중앙 정렬 -->
      <div class="self-center h-38px">
        <n-avatar :size="40" :src="avatarUrl" fallback-src="/logo.png" round />
      </div>

      <!-- 중간: 두 줄 콘텐츠 -->
      <div class="truncate pl-4 flex gap-10px flex-col">
        <div class="text-14px leading-tight font-bold flex-1 truncate text-#333 flex items-center gap-2">
          <span>{{ userName }}</span>
        </div>
        <div class="text-12px text-#666 truncate">{{ formatTime(feedItem.createTime) }}</div>
      </div>
    </div>

    <!-- 동적 콘텐츠 -->
    <div class="grid grid-cols-[38px_1fr] items-start gap-1">
      <!-- 빈 공간 -->
      <div></div>
      <div class="flex flex-col gap-2 text-14px">
        <!-- 텍스트 콘텐츠 -->
        <div class="text-#333 leading-relaxed whitespace-pre-wrap break-words">
          {{ feedItem.content }}
        </div>

        <!-- 이미지 그리드 - 이미지 수에 따라 동적 조정 -->
        <div v-if="feedItem.urls && feedItem.urls.length > 0" :class="getImageGridClass(feedItem.urls.length)">
          <div
            v-for="(image, index) in feedItem.urls"
            :key="index"
            class="relative w-full aspect-square rounded-10px mask-rounded overflow-hidden"
            @click="handleImageClick(index)">
            <img :src="image" class="absolute inset-0 rounded-10px w-full h-full object-cover" alt="동적 이미지" />
          </div>
        </div>

        <!-- 비디오 -->
        <div
          v-if="feedItem.videoUrl"
          class="relative w-full aspect-video rounded-10px overflow-hidden"
          @click="handleVideoClick">
          <video :src="feedItem.videoUrl" class="w-full h-full object-cover" />
          <!-- 재생 버튼 -->
          <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
            <svg class="w-48px h-48px color-white opacity-80">
              <use href="#play"></use>
            </svg>
          </div>
        </div>

        <!-- 하단 작업 표시줄 -->
        <div class="w-full flex justify-end mt-5px gap-5 items-center text-12px text-#666">
          <!-- 공유 -->
          <div class="flex items-center gap-1 cursor-pointer active:opacity-60" @click="handleShare">
            <svg class="iconpark-icon w-20px h-20px"><use href="#fenxiang"></use></svg>
          </div>

          <!-- 댓글 -->
          <div class="flex items-center gap-1 cursor-pointer active:opacity-60" @click="handleComment">
            <svg class="iconpark-icon w-20px h-20px"><use href="#huifu"></use></svg>
            <span v-if="feedItem.commentCount && feedItem.commentCount > 0">
              {{ formatCount(feedItem.commentCount) }}
            </span>
          </div>

          <!-- 좋아요 -->
          <div class="flex items-center gap-1 cursor-pointer active:opacity-60" @click="handleLike">
            <svg class="iconpark-icon w-20px h-20px">
              <use :href="isLiked ? '#dianzan' : '#weidianzan'"></use>
            </svg>
            <span v-if="likeCount > 0">{{ formatCount(likeCount) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeedItem } from '@/stores/feed'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useGroupStore } from '@/stores/group'

interface Props {
  feedItem: FeedItem
}

const props = defineProps<Props>()
const groupStore = useGroupStore()

const isLiked = ref(false)
const likeCount = ref(0)

// 프로필 사진 URL 계산 - uid를 사용하여 groupStore에서 사용자 정보 가져오기
const avatarUrl = computed(() => {
  if (props.feedItem.uid) {
    const userInfo = groupStore.getUserInfo(props.feedItem.uid)
    if (userInfo?.avatar) {
      return AvatarUtils.getAvatarUrl(userInfo.avatar)
    }
  }
  return AvatarUtils.getAvatarUrl('')
})

// 사용자 이름 계산
const userName = computed(() => {
  if (props.feedItem.uid) {
    const userInfo = groupStore.getUserInfo(props.feedItem.uid)
    if (userInfo?.name || userInfo?.myName) {
      return userInfo.name || userInfo.myName
    }
  }
  return '알 수 없는 사용자'
})

// 시간 포맷
const formatTime = (timestamp?: number) => {
  if (!timestamp) return ''

  const now = Date.now()
  const diff = now - timestamp

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const month = 30 * day

  if (diff < minute) {
    return '방금'
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}분 전`
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}시간 전`
  } else if (diff < month) {
    return `${Math.floor(diff / day)}일 전`
  } else {
    const date = new Date(timestamp)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
}

// 숫자 포맷
const formatCount = (count: number) => {
  if (count < 1000) return count.toString()
  if (count < 10000) return `${(count / 1000).toFixed(1)}K`
  return `${(count / 10000).toFixed(1)}W`
}

// 이미지 수에 따라 그리드 클래스명 가져오기
const getImageGridClass = (count: number) => {
  if (count === 1) return 'grid grid-cols-1 gap-2'
  if (count === 2) return 'grid grid-cols-2 gap-2'
  if (count === 4) return 'grid grid-cols-2 gap-2'
  return 'grid grid-cols-3 gap-2'
}

// 이미지 클릭 처리
const handleImageClick = (index: number) => {
  console.log('이미지 클릭', index)
  // TODO: 이미지 미리보기 기능 구현
}

// 비디오 클릭 처리
const handleVideoClick = () => {
  console.log('비디오 클릭')
  // TODO: 비디오 재생 기능 구현
}

// 공유 처리
const handleShare = () => {
  console.log('동적 공유', props.feedItem.id)
  // TODO: 공유 기능 구현
}

// 댓글 처리
const handleComment = () => {
  console.log('동적 댓글', props.feedItem.id)
  // TODO: 댓글 기능 구현
}

// 좋아요 처리
const handleLike = () => {
  isLiked.value = !isLiked.value
  likeCount.value += isLiked.value ? 1 : -1
  console.log('동적 좋아요', props.feedItem.id, isLiked.value)
  // TODO: 좋아요 기능 구현
}
</script>

<style scoped>
.mask-rounded {
  -webkit-mask-image: radial-gradient(circle, white 100%, transparent 100%);
  mask-image: radial-gradient(circle, white 100%, transparent 100%);
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}
</style>
