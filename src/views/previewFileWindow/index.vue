<template>
  <div class="size-full bg-[--right-bg-color]">
    <ActionBar :shrink="false" :current-label="WebviewWindow.getCurrent().label" />
    <n-scrollbar
      style="max-height: calc(100vh)"
      class="w-full box-border bg-[--center-bg-color] rounded-b-8px border-(solid 1px [--line-color])">
      <div class="flex flex-col gap-4 bg-#808080">
        <VueOfficeDocx v-if="isShowWord" :src="resourceSrc" style="height: 100vh" />

        <VueOfficePdf v-else-if="isShowPdf" :src="resourceSrc" style="height: 95vh" />

        <VueOfficeExcel v-else-if="isShowExcel" :src="resourceSrc" style="height: 95vh" />

        <VueOfficePptx v-else-if="isShowPpt" :src="resourceSrc" style="height: 95vh" />

        <div v-else class="text-gray-500">📄 미리보기할 문서가 없습니다</div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import VueOfficeDocx from '@vue-office/docx/lib/v3/vue-office-docx.mjs'
import VueOfficeExcel from '@vue-office/excel/lib/v3/vue-office-excel.mjs'
import VueOfficePdf from '@vue-office/pdf/lib/v3/vue-office-pdf.mjs'
import VueOfficePptx from '@vue-office/pptx/lib/v3/vue-office-pptx.mjs'
import type { FileTypeResult } from 'file-type'
import '@vue-office/docx/lib/v3/index.css'
import '@vue-office/excel/lib/v3/index.css'
import { listen } from '@tauri-apps/api/event'
import { merge } from 'es-toolkit'
import { useTauriListener } from '@/hooks/useTauriListener'
import { useWindow } from '@/hooks/useWindow'
import { getFile } from '@/utils/PathUtil'

type PayloadData = {
  userId: string
  roomId: string
  messageId: string
  resourceFile: {
    fileName: string
    absolutePath: string | undefined
    nativePath: string | undefined
    url: string
    type: FileTypeResult | undefined
    localExists: boolean
  }
}

const uiData = reactive({
  payload: {
    messageId: '',
    userId: '',
    roomId: '',
    resourceFile: {
      fileName: '',
      absolutePath: '',
      nativePath: '',
      url: '',
      localExists: false,
      type: {
        ext: '',
        mime: ''
      }
    }
  } as PayloadData,

  file: new File([], ''), // 로컬 파일을 찾았을 때만 사용함
  fileBuffer: [] as unknown as ArrayBuffer,
  fileLoading: false
})

const resourceSrc = computed(() => {
  const { resourceFile } = uiData.payload
  const { localExists, url } = resourceFile

  // 로컬에 로드된 파일 버퍼를 우선 사용
  if (localExists && uiData.fileBuffer) {
    return uiData.fileBuffer
  }

  // 그렇지 않으면 원격 주소 사용
  return url
})

const fileExt = computed(() => uiData.payload.resourceFile.type?.ext || '')
const localExists = computed(() => uiData.payload.resourceFile.localExists)

const isShowWord = computed(() => {
  const match = ['doc', 'docx', 'cfb'].includes(fileExt.value)
  return match && (localExists.value ? uiData.fileLoading : true)
})

const isShowPdf = computed(() => {
  const match = fileExt.value === 'pdf'
  return match && (localExists.value ? uiData.fileLoading : true)
})

const isShowExcel = computed(() => {
  const match = fileExt.value === 'xlsx'
  return match && (localExists.value ? uiData.fileLoading : true)
})

const isShowPpt = computed(() => {
  const match = fileExt.value === 'pptx'
  return match && (localExists.value ? uiData.fileLoading : true)
})

const updateFile = async (absolutePath: string, exists: boolean) => {
  try {
    if (exists) {
      uiData.fileLoading = false // 초기에 false로 설정하여 상태를 깨끗하게 유지

      // 로컬에 파일이 존재하면 업데이트
      const file = await getFile(absolutePath)
      uiData.file = file.file

      const buffer = await file.file.arrayBuffer()
      uiData.fileBuffer = buffer

      uiData.fileLoading = true // 파일 로드가 완료되어 렌더링 준비됨
      console.log('로컬 파일 업데이트 완료 ', file.file.size, uiData.file.size)
    } else {
      // 네트워크 파일은 기본적으로 로드 가능으로 표시
      uiData.fileLoading = true
    }
  } catch (error) {
    console.error('파일 읽기 중 오류 발생: ', error)
    uiData.fileLoading = false // 읽기 실패 시에도 false로 표시해야 함
  }
}

const { getWindowPayload } = useWindow()
const { addListener } = useTauriListener()

onMounted(async () => {
  const webviewWindow = getCurrentWebviewWindow()
  const label = webviewWindow.label

  await addListener(
    listen(`${label}:update`, (event: any) => {
      const payload: PayloadData = event.payload.payload
      console.log('payload 업데이트: ', payload)

      merge(uiData.payload, payload)

      updateFile(payload.resourceFile.absolutePath || '', payload.resourceFile.localExists)
    }),
    'preview-file-update'
  )

  try {
    const payload = await getWindowPayload<PayloadData>(label)
    console.log('가져온 페이로드 정보: ', payload)

    merge(uiData.payload, payload)

    updateFile(payload.resourceFile.absolutePath || '', payload.resourceFile.localExists)
  } catch (error) {
    console.log('가져오기 오류: ', error)
  }

  await webviewWindow.show()
})
</script>

<style scoped lang="scss"></style>
