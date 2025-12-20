/**
 * 이미지 처리 유틸리티 클래스
 * 이미지 형식 감지, 변환, 처리 등의 기능 제공
 */

/**
 * 이미지 정보 타입
 */
type ImageInfo = {
  width: number
  height: number
  previewUrl?: string
  size?: number
}

/**
 * 이미지 정보 가져오기 옵션
 */
type GetImageInfoOptions = {
  /** 미리보기 URL 포함 여부 (File 객체에만 유효) */
  includePreviewUrl?: boolean
  /** 파일 크기 포함 여부 (URL에만 유효) */
  includeSize?: boolean
}

/**
 * 이미지 형식 감지
 * @param imageUrl 이미지 URL
 */
export const detectImageFormat = (imageUrl: string): string => {
  if (imageUrl.startsWith('data:image/')) {
    const formatMatch = imageUrl.match(/data:image\/([^;]+)/)
    return formatMatch ? formatMatch[1].toUpperCase() : 'UNKNOWN'
  } else {
    const extension = imageUrl.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'JPEG'
      case 'png':
        return 'PNG'
      case 'gif':
        return 'GIF'
      case 'webp':
        return 'WEBP'
      case 'bmp':
        return 'BMP'
      case 'svg':
        return 'SVG'
      default:
        return 'UNKNOWN'
    }
  }
}

/**
 * 이미지 URL을 PNG 형식의 Uint8Array로 변환
 * base64 및 HTTP URL 형식의 이미지 지원
 * @param imageUrl 이미지 URL
 */
export const imageUrlToUint8Array = async (imageUrl: string): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      try {
        // canvas 생성 및 크기 설정
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height

        // 2D 컨텍스트 가져오기 및 이미지 그리기
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas 컨텍스트를 가져올 수 없습니다.'))
          return
        }

        ctx.drawImage(img, 0, 0)

        // canvas를 PNG 형식의 blob으로 변환
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('이미지 변환 실패'))
            return
          }

          // blob을 ArrayBuffer로 읽은 후 Uint8Array로 변환
          const reader = new FileReader()
          reader.onload = () => {
            const arrayBuffer = reader.result as ArrayBuffer
            resolve(new Uint8Array(arrayBuffer))
          }
          reader.onerror = () => {
            reject(new Error('이미지 데이터 읽기 실패'))
          }
          reader.readAsArrayBuffer(blob)
        }, 'image/png') // PNG 형식으로 강제 변환
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('이미지 로드 실패'))
    }

    // 교차 출처 문제 처리
    img.crossOrigin = 'anonymous'
    img.src = imageUrl
  })
}

/**
 * Tauri의 RGBA 이미지 데이터를 PNG 형식의 File 객체로 변환
 * @param imageData RGBA 바이트 배열
 * @param width 이미지 너비
 * @param height 이미지 높이
 * @param filename 파일명 (선택 사항)
 */
export const rgbaToFile = async (
  imageData: Uint8Array,
  width: number,
  height: number,
  filename: string = `image-${Date.now()}.png`
): Promise<File> => {
  return new Promise((resolve, reject) => {
    try {
      // Canvas 생성
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Canvas 컨텍스트를 생성할 수 없습니다.'))
        return
      }

      // ImageData 객체 생성
      const canvasImageData = ctx.createImageData(width, height)

      // 다양한 데이터 소스 형식 처리
      let uint8Array: Uint8Array
      if (imageData.buffer instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(imageData.buffer, imageData.byteOffset, imageData.byteLength)
      } else {
        uint8Array = new Uint8Array(imageData)
      }

      // 데이터를 canvas ImageData에 복사
      canvasImageData.data.set(uint8Array)

      // ImageData를 canvas에 그리기
      ctx.putImageData(canvasImageData, 0, 0)

      // canvas를 Blob으로 변환한 후 File 객체 생성
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas를 Blob으로 변환하지 못했습니다.'))
            return
          }

          const file = new File([blob], filename, { type: 'image/png' })
          resolve(file)
        },
        'image/png',
        1
      )
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Tauri의 RGBA 이미지 데이터를 PNG 형식의 Uint8Array로 변환
 * @param imageData RGBA 바이트 배열
 * @param width 이미지 너비
 * @param height 이미지 높이
 */
export const rgbaToUint8Array = async (imageData: Uint8Array, width: number, height: number): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    try {
      // Canvas 생성
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Canvas 컨텍스트를 생성할 수 없습니다.'))
        return
      }

      // ImageData 객체 생성
      const canvasImageData = ctx.createImageData(width, height)

      // 다양한 데이터 소스 형식 처리
      let uint8Array: Uint8Array
      if (imageData.buffer instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(imageData.buffer, imageData.byteOffset, imageData.byteLength)
      } else {
        uint8Array = new Uint8Array(imageData)
      }

      // 데이터를 canvas ImageData에 복사
      canvasImageData.data.set(uint8Array)

      // ImageData를 canvas에 그리기
      ctx.putImageData(canvasImageData, 0, 0)

      // canvas를 Blob으로 변환한 후 Uint8Array로 읽기
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas를 Blob으로 변환하지 못했습니다.'))
            return
          }

          const reader = new FileReader()
          reader.onload = () => {
            const arrayBuffer = reader.result as ArrayBuffer
            resolve(new Uint8Array(arrayBuffer))
          }
          reader.onerror = () => {
            reject(new Error('이미지 데이터 읽기 실패'))
          }
          reader.readAsArrayBuffer(blob)
        },
        'image/png',
        1
      )
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 이미지 상세 정보 가져오기
 * File 객체 및 이미지 URL 지원, 선택적으로 추가 정보 반환 가능
 * @param input 이미지 소스 (File 객체 또는 URL 문자열)
 * @param options 옵션 설정
 */
export const getImageDimensions = async (
  input: File | string,
  options: GetImageInfoOptions = {}
): Promise<ImageInfo> => {
  const { includePreviewUrl = false, includeSize = false } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    let previewUrl: string | undefined
    let shouldRevokeUrl = false

    // 다양한 입력 유형 처리
    if (input instanceof File) {
      // File 객체 처리
      previewUrl = URL.createObjectURL(input)
      shouldRevokeUrl = true
      img.src = previewUrl
    } else {
      // URL 문자열 처리
      img.crossOrigin = 'anonymous'
      img.src = input
    }

    img.onload = async () => {
      try {
        const result: ImageInfo = {
          width: img.width,
          height: img.height
        }

        // 옵션에 따라 추가 정보 추가
        if (includePreviewUrl && previewUrl) {
          result.previewUrl = previewUrl
          shouldRevokeUrl = false // 자동으로 해제하지 않음, 호출자가 결정
        }

        if (includeSize && typeof input === 'string') {
          try {
            // 원격 이미지 크기 가져오기
            const response = await fetch(input, { method: 'HEAD' })
            result.size = parseInt(response.headers.get('content-length') || '0', 10)
          } catch (_error) {
            // 크기를 가져올 수 없는 경우 기본값 사용
            result.size = 0
          }
        }

        // 미리보기 URL을 유지할 필요가 없는 경우 해제
        if (shouldRevokeUrl && previewUrl) {
          URL.revokeObjectURL(previewUrl)
        }

        resolve(result)
      } catch (error) {
        if (shouldRevokeUrl && previewUrl) {
          URL.revokeObjectURL(previewUrl)
        }
        reject(error)
      }
    }

    img.onerror = () => {
      if (shouldRevokeUrl && previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      reject(new Error('이미지 로드 실패'))
    }
  })
}

/**
 * 이미지 항목 확인
 * @param url 확인할 URL
 */
export const isImageUrl = (url: string): boolean => {
  if (url.startsWith('data:image/')) {
    return true
  }

  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']
  const extension = url.split('.').pop()?.toLowerCase()
  return imageExtensions.includes(extension || '')
}

/**
 * 클립보드 이미지 데이터 처리
 * Tauri 클립보드에서 읽은 이미지 데이터를 처리하기 위한 간소화된 버전
 * @param clipboardImage Tauri 클립보드 이미지 객체
 */
export const processClipboardImage = async (clipboardImage: any): Promise<File> => {
  // 이미지의 너비와 높이 가져오기
  const { width, height } = await clipboardImage.size()

  // 이미지의 RGBA 데이터 가져오기
  const imageData = await clipboardImage.rgba()

  // rgbaToFile 함수를 사용하여 File 객체로 변환
  return await rgbaToFile(imageData, width, height)
}
