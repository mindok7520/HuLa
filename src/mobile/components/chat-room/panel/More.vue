<template>
  <div class="h-15rem w-full">
    <van-swipe class="h-full" :loop="false" :show-indicators="true" indicator-color="#999">
      <van-swipe-item v-for="(page, pageIndex) in pages" :key="pageIndex">
        <div class="px-15px pt-15px pb-30px grid grid-cols-4 gap-3 auto-rows-18">
          <div
            @click="handleClickIcon(item)"
            v-for="item in page"
            :key="item.id"
            class="flex flex-col gap-8px items-center justify-center rounded-2">
            <svg
              v-if="item.label !== '파일' && item.label !== '이미지' && item.isShow()"
              class="h-24px w-24px iconpark-icon">
              <use :href="`#${item.icon}`"></use>
            </svg>

            <van-uploader
              v-if="item.label === '파일' && item.isShow()"
              accept="*/*"
              multiple
              :after-read="afterReadFile">
              <svg class="h-24px w-24px iconpark-icon">
                <use :href="`#${item.icon}`"></use>
              </svg>
              <svg
                v-if="item.showArrow"
                :class="[
                  'h-15px w-15px iconpark-icon transition-transform duration-300',
                  item.isRotate ? 'rotate' : ''
                ]">
                <use href="#down" />
              </svg>
            </van-uploader>

            <van-uploader
              v-if="item.label === '이미지' && item.isShow()"
              accept="image/*"
              multiple
              :after-read="afterReadImage">
              <svg class="h-24px w-24px iconpark-icon">
                <use :href="`#${item.icon}`"></use>
              </svg>
              <svg
                v-if="item.showArrow"
                :class="[
                  'h-15px w-15px iconpark-icon transition-transform duration-300',
                  item.isRotate ? 'rotate' : ''
                ]">
                <use href="#down" />
              </svg>
            </van-uploader>

            <div class="text-10px" v-if="item.isShow()">
              {{ item.label }}
            </div>
          </div>
        </div>
      </van-swipe-item>
    </van-swipe>

    <van-popup v-model:show="pickRtcCall" position="bottom">
      <div class="flex flex-col items-center justify-center">
        <div class="w-full text-center py-3" @click="startCall(CallTypeEnum.VIDEO)">영상 통화</div>
        <div class="w-full text-center py-3" @click="startCall(CallTypeEnum.AUDIO)">음성 통화</div>
        <div class="w-full text-center py-3">취소</div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { CallTypeEnum, RoomTypeEnum } from '@/enums'
import { UploaderFileListItem } from 'vant'
import router from '@/router'
import { useGlobalStore } from '@/stores/global'

const globalStore = useGlobalStore()

const isGroup = computed(() => globalStore.currentSession?.type === RoomTypeEnum.GROUP)

const pickRtcCall = ref(false)
// ==== 패널 펼치기 ====
const options = ref([
  { label: '파일', icon: 'file', showArrow: false, isRotate: true, onClick: () => {}, isShow: () => true },
  { label: '이미지', icon: 'photo', showArrow: false, isRotate: true, onClick: () => {}, isShow: () => true },
  { label: '영상', icon: 'voice', showArrow: true, isRotate: false, onClick: () => {}, isShow: () => true },
  { label: '기록', icon: 'history', showArrow: true, isRotate: false, onClick: () => {}, isShow: () => true },
  {
    label: '영상 통화',
    icon: 'video-one',
    showArrow: true,
    isRotate: false,
    onClick: () => {
      pickRtcCall.value = true
    },
    isShow: () => {
      return !isGroup.value
    }
  }
])

// 데이터를 8개씩 페이지화 (2행 4열)
const pages = computed(() => {
  const pageSize = 8
  const result: any[][] = []
  for (let i = 0; i < options.value.length; i += pageSize) {
    result.push(options.value.slice(i, i + pageSize))
  }
  return result
})

const handleClickIcon = (item: any) => {
  item.onClick()
}

const startCall = (callType: CallTypeEnum) => {
  const currentSession = globalStore.currentSession
  if (!currentSession?.detailId) {
    pickRtcCall.value = false
    return
  }
  router.push({
    path: `/mobile/rtcCall`,
    query: {
      remoteUserId: currentSession.detailId,
      roomId: globalStore.currentSessionRoomId,
      callType: callType
    }
  })
}

const emit = defineEmits<(e: 'sendFiles', files: File[]) => void>()

const selectedFiles = ref<File[]>([])

const uploadFileList = ref<
  {
    url: string
    status: 'uploading' | 'failed' | 'done'
    message: string
  }[]
>([])

const afterReadFile = (fileList: UploaderFileListItem | UploaderFileListItem[]) => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif']
  const files = Array.isArray(fileList) ? fileList : [fileList]

  console.log('선택된 파일:', files)

  for (const file of files) {
    const rawFile = file.file

    if (!rawFile) {
      console.log('파일이 존재하지 않음:', file)
      continue
    }

    // ✅ 비이미지 파일만 유지
    if (imageTypes.includes(rawFile.type)) {
      console.log('이미지 파일 필터링됨:', file)
      continue
    }

    selectedFiles.value.push(rawFile)
    uploadFileList.value.push({
      url: file.url as string,
      status: 'done',
      message: '업로드 대기(비이미지)'
    })

    console.log('파일 선택됨:', file)
  }

  if (selectedFiles.value.length > 0) {
    emit('sendFiles', [...selectedFiles.value])
    selectedFiles.value = []
    uploadFileList.value = []
  }
}

const afterReadImage = (fileList: UploaderFileListItem | UploaderFileListItem[]) => {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif']
  const files = Array.isArray(fileList) ? fileList : [fileList]

  console.log('선택된 파일:', files)

  for (const file of files) {
    const rawFile = file.file

    if (!rawFile) {
      console.log('파일이 존재하지 않음:', file)
      continue
    }

    if (!validTypes.includes(rawFile.type)) {
      console.log('비이미지 파일 필터링됨:', file)
      if (!Array.isArray(fileList)) {
        window.$message.warning('이미지만 선택할 수 있어요~')
      }
      continue
    }

    selectedFiles.value.push(rawFile)
    uploadFileList.value.push({
      url: file.url as string,
      status: 'done',
      message: '업로드 대기'
    })

    console.log('파일 추가됨:', file)
  }

  if (selectedFiles.value.length > 0) {
    emit('sendFiles', [...selectedFiles.value])
    selectedFiles.value = []
    uploadFileList.value = []
  }
}
</script>

<style scoped></style>
