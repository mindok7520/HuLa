import { invoke } from '@tauri-apps/api/core'
import { appCacheDir, join } from '@tauri-apps/api/path'
import { BaseDirectory, remove, writeFile } from '@tauri-apps/plugin-fs'
import { AppException } from '@/common/exception'
import { isMobile } from '@/utils/PlatformConstants'

// 섬네일을 주어진 크기와 품질로 압축, 비율 유지, 압축된 File 반환
const compressThumbnail = async (
  file: File,
  maxWidth: number = 300,
  maxHeight: number = 150,
  quality: number = 0.6
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    img.onload = () => {
      let { width, height } = img

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }
      }

      canvas.width = width
      canvas.height = height

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          } else {
            reject(new AppException('섬네일 압축 실패'))
          }
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      reject(new AppException('섬네일 로드 실패'))
    }

    img.src = URL.createObjectURL(file)
  })
}

// 브라우저 기능을 사용하여 비디오 첫 프레임 캐처하여 섬네일 생성, Rust 지원이 없을 때의 대체 방안
const getLocalVideoThumbnail = async (file: File) => {
  const url = URL.createObjectURL(file)
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.src = url
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(0.1, video.duration || 0.1)
      }
      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new AppException('비디오 섬네일 생성 실패: 캠버스 컨텍스트를 가져올 수 없음'))
          return
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blobResult) => {
            if (blobResult) {
              resolve(blobResult)
            } else {
              reject(new AppException('비디오 섬네일 생성 실패: 캠버스 변환 실패'))
            }
          },
          'image/jpeg',
          0.8
        )
      }
      video.onerror = () => reject(new AppException('비디오 섬네일 생성 실패: 비디오를 로드할 수 없음'))
    })

    const fallbackFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' })
    return await compressThumbnail(fallbackFile)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 비디오 섬네일 생성: 우선 Rust를 호출하여 첫 프레임 획득, 실패하거나 모바일인 경우 프론트엔드 프레임 캡처로 대체
export const generateVideoThumbnail = async (file: File): Promise<File> => {
  try {
    const tempPath = `temp-video-${Date.now()}-${file.name}`
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
    await writeFile(tempPath, uint8Array, { baseDir })
    const fullPath = await join(await appCacheDir(), tempPath)

    const thumbnailInfo = await invoke<{
      thumbnail_base64: string
      width: number
      height: number
      duration: number
    }>('get_video_thumbnail', {
      videoPath: fullPath,
      targetTime: 0.1
    })

    const base64Data = thumbnailInfo.thumbnail_base64
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const thumbnailBlob = new Blob([bytes], { type: 'image/jpeg' })
    const thumbnailFile = new File([thumbnailBlob], 'thumbnail.jpg', { type: 'image/jpeg' })

    try {
      await remove(tempPath, { baseDir })
    } catch (cleanupError) {
      console.warn('임시 파일 정리 실패:', cleanupError)
    }

    return await compressThumbnail(thumbnailFile)
  } catch (error) {
    console.error('Rust 섬네일 생성 실패, 프론트엔드 대체 방안 시도:', error)
    if (isMobile() || String(error).includes('Command get_video_thumbnail not found')) {
      return await getLocalVideoThumbnail(file)
    }
    throw new AppException(`비디오 섬네일 생성 실패: ${error}`)
  }
}
