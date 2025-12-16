<template>
  <div>
    <div class="flex gap-2 mx-2">
      <input class="flex-1" type="text" placeholder="채팅 내용 입력" />
      <n-button type="primary" @click="() => router.back()">취소</n-button>
    </div>

    <div class="flex flex-col items-center mt-10">
      <div class="mb-8 text-gray">채팅 내용 빠른 검색</div>
      <div class="grid grid-cols-3 gap-4 max-w-xs">
        <n-button text class="text-size-lg text-center" type="primary">멤버</n-button>
        <n-button text class="text-size-lg text-center" type="primary">날짜</n-button>
        <n-button
          text
          class="text-size-lg text-center"
          type="primary"
          @click="
            () =>
              router.push({
                name: 'mobileMediaViewer'
              })
          ">
          사진 및 동영상
        </n-button>
        <n-button text class="text-size-lg text-center" type="primary">파일</n-button>
        <n-button text class="text-size-lg text-center" type="primary">링크</n-button>
        <n-button text class="text-size-lg text-center" type="primary">음악 및 오디오</n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
</script>

<style scoped></style>
