import { UploadSceneEnum } from '@/enums'
import { UploadProviderEnum, useUpload } from './useUpload'

export interface AvatarUploadOptions {
  // 업로드 성공 후 콜백 함수, 매개변수는 다운로드 URL
  onSuccess?: (downloadUrl: string) => void
  // 업로드 장면, 기본값은 아바타
  scene?: UploadSceneEnum
  // 파일 크기 제한 (KB), 기본값은 150KB
  sizeLimit?: number
}

/**
 * 아바타 업로드 hook
 * @param options 업로드 구성
 */
export const useAvatarUpload = (options: AvatarUploadOptions = {}) => {
  const { onSuccess, scene = UploadSceneEnum.AVATAR, sizeLimit = 150 } = options

  const fileInput = ref<HTMLInputElement>()
  const localImageUrl = ref('')
  const showCropper = ref(false)
  const cropperRef = ref()

  // 파일 선택기 열기
  const openFileSelector = () => {
    fileInput.value?.click()
  }

  // 파일 선택 처리
  const handleFileChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        localImageUrl.value = url
        nextTick(() => {
          showCropper.value = true
        })
      }
      img.onerror = () => {
        window.$message.error('이미지 로드 실패')
        URL.revokeObjectURL(url)
      }
      img.src = url
    }
  }

  // 아바타 변경 조건 확인
  const openAvatarCropper = () => {
    fileInput.value?.click()
  }

  // 자르기 처리
  const handleCrop = async (cropBlob: Blob) => {
    try {
      const fileName = `avatar_${Date.now()}.webp`
      const file = new File([cropBlob], fileName, { type: 'image/webp' })

      // 자른 후 파일 크기 확인
      if (file.size > sizeLimit * 1024) {
        window.$message.error(`이미지 크기는 ${sizeLimit}KB를 초과할 수 없습니다. 현재 자른 후 크기: ${Math.round(file.size / 1024)}KB`)
        // 로딩 상태 종료
        cropperRef.value?.finishLoading()
        return
      }

      // 먼저 이미지 URL을 설정하고 이미지가 로드될 때까지 기다린 후 자르기 창 표시
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        window.$message.error('JPG, PNG, WebP 형식의 이미지만 지원합니다')
        // 로딩 상태 종료
        cropperRef.value?.finishLoading()
        return
      }

      // useUpload의 Qiniu 클라우드 업로드 기능 사용
      const { uploadFile, fileInfo } = useUpload()

      // 업로드 실행, Qiniu 클라우드 업로드 방식 사용
      await uploadFile(file, {
        provider: UploadProviderEnum.QINIU,
        enableDeduplication: true,
        scene: scene
      })

      // 다운로드 URL 가져오기
      const downloadUrl = fileInfo.value?.downloadUrl || ''

      // 성공 콜백 호출
      if (onSuccess) {
        onSuccess(downloadUrl)
      }

      // 리소스 정리
      if (localImageUrl.value) {
        URL.revokeObjectURL(localImageUrl.value)
      }
      localImageUrl.value = ''
      if (fileInput.value) {
        fileInput.value.value = ''
      }

      // 로딩 상태 종료
      cropperRef.value?.finishLoading()
      // 자르기 창 닫기
      showCropper.value = false
    } catch (error) {
      console.error('아바타 업로드 실패:', error)
      window.$message.error('아바타 업로드 실패')
      // 오류 발생 시에도 로딩 상태 종료 필요
      cropperRef.value?.finishLoading()
    }
  }

  return {
    fileInput,
    localImageUrl,
    showCropper,
    cropperRef,
    openFileSelector,
    handleFileChange,
    handleCrop,
    openAvatarCropper
  }
}
