import { BaseDirectory, readFile } from '@tauri-apps/plugin-fs'
import { fetch } from '@tauri-apps/plugin-http'
import { createEventHook } from '@vueuse/core'
import { UploadSceneEnum } from '@/enums'
import { useConfigStore } from '@/stores/config'
import { useUserStore } from '@/stores/user'
import { extractFileName, getMimeTypeFromExtension } from '@/utils/Formatting'
import { getImageDimensions } from '@/utils/ImageUtils'
import { getQiniuToken, getUploadProvider } from '@/utils/ImRequestUtils'
import { isAndroid, isMobile } from '@/utils/PlatformConstants'
import { getWasmMd5 } from '@/utils/Md5Util'

/** 파일 정보 유형 */
export type FileInfoType = {
  name: string
  type: string
  size: number
  suffix: string
  width?: number
  height?: number
  downloadUrl?: string
  second?: number
  thumbWidth?: number
  thumbHeight?: number
  thumbUrl?: string
}

/** 업로드 방식 */
export enum UploadProviderEnum {
  /** 기본 업로드 방식 */
  DEFAULT = 'default',
  /** Qiniu 클라우드 업로드 */
  QINIU = 'qiniu',
  /** MinIO 업로드 */
  MINIO = 'minio'
}

/** 업로드 설정 */
export interface UploadOptions {
  /** 업로드 방식 */
  provider?: UploadProviderEnum
  /** 업로드 시나리오 */
  scene?: UploadSceneEnum
  /** 청크 업로드 사용 여부 (Qiniu 클라우드에만 유효) */
  useChunks?: boolean
  /** 청크 크기 (단위: 바이트, 기본값 4MB) */
  chunkSize?: number
  /** 파일 중복 제거 활성화 여부 (파일 해시를 파일명으로 사용) */
  enableDeduplication?: boolean
}

/** 청크 업로드 진행 정보 */
interface ChunkProgressInfo {
  uploadedChunks: number
  totalChunks: number
  currentChunkProgress: number
}

const Max = 100 // 단위 M
const MAX_FILE_SIZE = Max * 1024 * 1024 // 최대 업로드 제한
const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024 // 기본 청크 크기: 4MB
const QINIU_CHUNK_SIZE = 4 * 1024 * 1024 // Qiniu 클라우드 청크 크기: 4MB
const CHUNK_THRESHOLD = 4 * 1024 * 1024 // 4MB, 이 크기를 초과하는 파일은 청크 업로드 사용

let cryptoJS: any | null = null

const loadCryptoJS = async () => {
  if (!cryptoJS) {
    const module = await import('crypto-js')
    cryptoJS = module.default ?? module
  }
  return cryptoJS as {
    lib: { WordArray: { create: (arr: ArrayBuffer | Uint8Array) => any } }
    MD5: (wordArray: any) => { toString: () => string }
  }
}

/**
 * 파일 업로드 Hook
 */
export const useUpload = () => {
  // configStore 설정에서 ossDomain 가져오기
  const configStore = useConfigStore()
  const userStore = useUserStore()
  const isUploading = ref(false) // 업로드 중 여부
  const progress = ref(0) // 진행률
  const fileInfo = ref<FileInfoType | null>(null) // 파일 정보
  const currentProvider = ref<UploadProviderEnum>(UploadProviderEnum.DEFAULT) // 현재 업로드 방식

  const { on: onChange, trigger } = createEventHook()
  const onStart = createEventHook()

  /**
   * 파일의 MD5 해시 값 계산
   * @param file 파일
   * @returns MD5 해시 값
   */
  const calculateFileHash = async (file: File): Promise<string> => {
    const startTime = performance.now()
    try {
      console.log('MD5 해시 값 계산 시작, 파일 크기:', file.size, 'bytes')
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      let hash: string

      if (isAndroid()) {
        const CryptoJS = await loadCryptoJS()
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer as ArrayBuffer)
        hash = CryptoJS.MD5(wordArray).toString()
      } else {
        const Md5 = await getWasmMd5()
        hash = await Md5.digest_u8(uint8Array)
      }
      const endTime = performance.now()
      const duration = (endTime - startTime).toFixed(2)
      console.log(`MD5 계산 완료, 소요 시간: ${duration}ms, 해시 값: ${hash}`)
      return hash.toLowerCase()
    } catch (error) {
      const endTime = performance.now()
      const duration = (endTime - startTime).toFixed(2)
      console.error(`파일 해시 값 계산 실패, 소요 시간: ${duration}ms:`, error)
      // 계산 실패 시 타임스탬프를 대체 방안으로 반환
      return Date.now().toString()
    }
  }

  /**
   * 파일명으로 파일 유형 가져오기
   * @param fileName 파일명
   */
  const getFileType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase()

    // 이미지 유형의 경우 통합된 getMimeTypeFromExtension 함수 사용
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(extension || '')) {
      return getMimeTypeFromExtension(fileName)
    }

    // 기타 파일 유형
    switch (extension) {
      case 'mp4':
        return 'video/mp4'
      case 'mp3':
        return 'audio/mp3'
      default:
        return 'application/octet-stream' // 기본 유형
    }
  }

  /**
   * 파일 해시 생성
   * @param options 업로드 설정
   * @param fileObj 파일 객체
   * @param fileName 파일명
   * @returns 파일 해시
   */
  const generateHashKey = async (
    options: { scene: UploadSceneEnum; enableDeduplication: boolean },
    fileObj: File,
    fileName: string
  ) => {
    let key: string

    if (options.enableDeduplication) {
      // 파일 해시를 파일명의 일부로 사용하여 중복 제거 구현
      const fileHash = await calculateFileHash(fileObj)
      const fileSuffix = fileName.split('.').pop() || ''
      // 현재 로그인한 사용자의 account 가져오기
      const account = userStore.userInfo!.account
      key = `${options.scene}/${account}/${fileHash}.${fileSuffix}`
      console.log('파일 중복 제거 모드 사용, 파일 해시:', fileHash)
    } else {
      // 타임스탬프를 사용하여 고유한 파일명 생성
      key = `${options.scene}/${Date.now()}_${fileName}`
    }
    return key
  }

  /**
   * 기본 스토리지로 청크 업로드
   * @param url 업로드 링크
   * @param file 파일
   */
  const uploadToDefaultWithChunks = async (url: string, file: File) => {
    progress.value = 0
    const chunkSize = DEFAULT_CHUNK_SIZE
    const totalSize = file.size
    const totalChunks = Math.ceil(totalSize / chunkSize)

    console.log('기본 스토리지 청크 업로드 시작:', {
      fileName: file.name,
      fileSize: totalSize,
      chunkSize,
      totalChunks
    })

    try {
      // 임시 업로드 세션 ID 생성
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2)}`

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, totalSize)
        const chunk = file.slice(start, end)
        const chunkArrayBuffer = await chunk.arrayBuffer()

        // 각 청크에 필요한 헤더 정보 추가
        const headers: Record<string, string> = {
          'Content-Type': 'application/octet-stream',
          'X-Chunk-Index': i.toString(),
          'X-Total-Chunks': totalChunks.toString(),
          'X-Upload-Id': uploadId,
          'X-File-Name': file.name,
          'X-File-Size': totalSize.toString()
        }

        // 마지막 청크인 경우 완료 표시 추가
        if (i === totalChunks - 1) {
          headers['X-Last-Chunk'] = 'true'
        }

        const response = await fetch(url, {
          method: 'PUT',
          headers,
          body: chunkArrayBuffer,
          duplex: 'half'
        } as RequestInit)

        if (!response.ok) {
          throw new Error(`청크 ${i + 1}/${totalChunks} 업로드 실패: ${response.statusText}`)
        }

        // 진행률 업데이트
        progress.value = Math.floor(((i + 1) / totalChunks) * 100)
        trigger('progress') // 진행률 이벤트 트리거

        console.log(`청크 ${i + 1}/${totalChunks} 업로드 성공, 진행률: ${progress.value}%`)
      }

      isUploading.value = false
      progress.value = 100
      trigger('success')
    } catch (error) {
      isUploading.value = false
      console.error('기본 스토리지 청크 업로드 실패:', error)
      throw error
    }
  }

  /**
   * Qiniu 클라우드로 파일 업로드
   * @param file 파일
   * @param qiniuConfig Qiniu 클라우드 설정
   * @param enableDeduplication 파일 중복 제거 활성화 여부
   */
  const uploadToQiniu = async (
    file: File,
    scene: UploadSceneEnum,
    qiniuConfig: { token: string; domain: string; storagePrefix: string; region?: string },
    enableDeduplication: boolean = true
  ) => {
    isUploading.value = true
    progress.value = 0

    try {
      // FormData 객체 생성
      const formData = new FormData()

      // 파일명 생성
      const key = await generateHashKey({ scene, enableDeduplication }, file, file.name)

      // Qiniu 클라우드 업로드에 필요한 매개변수 추가
      formData.append('token', qiniuConfig.token)
      formData.append('key', key)
      formData.append('file', file)

      // fetch API를 사용하여 업로드
      const response = await fetch(qiniuConfig.domain, {
        method: 'POST',
        body: formData
      })

      isUploading.value = false

      if (response.ok) {
        const result = await response.json()
        const downloadUrl = `${configStore.config.qiNiu.ossDomain}/${result.key || key}`
        trigger('success')
        return { downloadUrl, key }
      } else {
        trigger('fail')
        return { error: 'Upload failed' }
      }
    } catch (error) {
      isUploading.value = false
      console.error('Qiniu upload failed:', error)
      return { error: 'Upload failed' }
    }
  }

  /**
   * 파일을 청크로 나누어 Qiniu 클라우드에 업로드
   * @param file 파일
   * @param qiniuConfig Qiniu 클라우드 설정
   * @param chunkSize 청크 크기 (바이트)
   * @param inner 내부 호출 여부
   */
  const uploadToQiniuWithChunks = async (
    file: File,
    qiniuConfig: { token: string; domain: string; storagePrefix: string; region?: string },
    chunkSize: number = QINIU_CHUNK_SIZE,
    inner?: boolean
  ) => {
    isUploading.value = true
    progress.value = 0

    try {
      // 고유한 파일명 생성
      const key = `${qiniuConfig.storagePrefix}/${Date.now()}_${file.name}`

      // 청크 수 계산
      const totalSize = file.size
      const totalChunks = Math.ceil(totalSize / chunkSize)

      // 진행률 추적 객체 생성
      const progressInfo: ChunkProgressInfo = {
        uploadedChunks: 0,
        totalChunks,
        currentChunkProgress: 0
      }

      console.log('Qiniu 클라우드 청크 업로드 시작:', {
        fileName: file.name,
        fileSize: totalSize,
        chunkSize,
        totalChunks,
        token: qiniuConfig.token.substring(0, 10) + '...',
        domain: qiniuConfig.domain
      })

      // Qiniu 클라우드 청크 업로드 API v2 사용 - 업로드 블록 생성
      const contexts: string[] = []

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, totalSize)
        const chunkData = await file.slice(start, end).arrayBuffer()
        const currentChunkSize = end - start

        // 블록 생성
        const blockResponse = await fetch(`${qiniuConfig.domain}/mkblk/${currentChunkSize}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            Authorization: `UpToken ${qiniuConfig.token}`
          },
          body: chunkData
        })

        if (!blockResponse.ok) {
          const errorText = await blockResponse.text()
          console.error(`청크 ${i + 1}/${totalChunks} 업로드 실패:`, {
            status: blockResponse.status,
            statusText: blockResponse.statusText,
            errorText
          })
          throw new Error(`청크 ${i + 1}/${totalChunks} 업로드 실패: ${blockResponse.statusText}`)
        }

        const blockResult = await blockResponse.json()
        contexts.push(blockResult.ctx)
        progressInfo.uploadedChunks++

        progress.value = Math.floor((progressInfo.uploadedChunks / progressInfo.totalChunks) * 100)

        console.log(`청크 ${progressInfo.uploadedChunks}/${progressInfo.totalChunks} 업로드 성공:`, {
          ctx: blockResult.ctx.substring(0, 10) + '...',
          progress: progress.value + '%'
        })
      }

      // 업로드 완료 - 모든 블록 병합
      const completeResponse = await fetch(`${qiniuConfig.domain}/mkfile/${totalSize}/key/${btoa(key)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Authorization: `UpToken ${qiniuConfig.token}`
        },
        body: contexts.join(',')
      })

      if (!completeResponse.ok) {
        throw new Error(`청크 업로드 완료 실패: ${completeResponse.statusText}`)
      }

      const completeResult = await completeResponse.json()
      console.log('청크 업로드 완료:', completeResult)

      isUploading.value = false
      progress.value = 100

      if (inner) return { key, domain: qiniuConfig.domain }

      const downloadUrl = `${qiniuConfig.domain}/${completeResult.key || key}`
      trigger('success')
      return { downloadUrl, key }
    } catch (error) {
      isUploading.value = false
      if (!inner) {
        trigger('fail')
      }
      console.error('Qiniu 클라우드 청크 업로드 실패:', error)
      return { error: 'Upload failed' }
    }
  }

  /**
   * 이미지 너비/높이 가져오기
   */
  const getImgWH = async (file: File) => {
    try {
      const result = await getImageDimensions(file, { includePreviewUrl: true })
      return {
        width: result.width,
        height: result.height,
        tempUrl: result.previewUrl!
      }
    } catch (_error) {
      return { width: 0, height: 0, url: null }
    }
  }

  /**
   * 오디오 재생 시간 가져오기
   */
  const getAudioDuration = (file: File) => {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      const tempUrl = URL.createObjectURL(file)
      audio.src = tempUrl
      // 오디오 재생 시간 계산
      const countAudioTime = async () => {
        while (isNaN(audio.duration) || audio.duration === Infinity) {
          // 브라우저 멈춤 방지
          await new Promise((resolve) => setTimeout(resolve, 100))
          // 랜덤 진행률 표시줄 위치
          audio.currentTime = 100000 * Math.random()
        }
        // 반올림
        const second = Math.round(audio.duration || 0)
        resolve({ second, tempUrl })
      }
      countAudioTime()
      audio.onerror = () => {
        reject({ second: 0, tempUrl })
      }
    })
  }

  /**
   * 파일 파싱
   * @param file 파일
   * @param addParams 매개변수
   * @returns 파일 크기, 파일 유형, 파일명, 파일 접미사...
   */
  const parseFile = async (file: File, addParams: Record<string, any> = {}) => {
    const { name, size, type } = file
    const suffix = name.split('.').pop()?.trim().toLowerCase() || ''
    const baseInfo = { name, size, type, suffix, ...addParams }

    // TODO: 여기서 유형 판단을 할 필요가 없을 수 있으며, baseInfo를 직접 반환할 수 있음
    if (type.includes('image')) {
      const { width, height, tempUrl } = (await getImgWH(file)) as any
      return { ...baseInfo, width, height, tempUrl }
    }

    if (type.includes('audio')) {
      const { second, tempUrl } = (await getAudioDuration(file)) as any
      return { second, tempUrl, ...baseInfo }
    }
    // 비디오인 경우
    if (type.includes('video')) {
      return { ...baseInfo }
    }

    return baseInfo
  }

  /**
   * 파일 업로드
   * @param file 파일
   * @param options 업로드 옵션
   */
  const uploadFile = async (file: File, options?: UploadOptions) => {
    if (isUploading.value || !file) return

    // 현재 업로드 방식 설정
    if (options?.provider) {
      currentProvider.value = options.provider
    }
    // provider가 지정되지 않은 경우 백엔드 기본 provider 읽기
    if (!options?.provider) {
      try {
        const res = await getUploadProvider()
        if (res?.provider === 'minio') currentProvider.value = UploadProviderEnum.MINIO
        else if (res?.provider === 'qiniu') currentProvider.value = UploadProviderEnum.QINIU
      } catch { }
    }

    const info = await parseFile(file, options)

    // 파일 크기 제한
    if (info.size > MAX_FILE_SIZE) {
      window.$message.error(`파일 크기는 ${Max}MB를 초과할 수 없습니다`)
      return
    }

    // 업로드 방식에 따라 다른 업로드 로직 선택
    if (currentProvider.value === UploadProviderEnum.QINIU) {
      try {
        const cred = await getQiniuToken({ scene: options?.scene, fileName: file.name })
        fileInfo.value = { ...info }
        await onStart.trigger(fileInfo)

        if ((cred as any)?.uploadUrl) {
          const arrayBuffer = await file.arrayBuffer()
          const response = await fetch((cred as any).uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: arrayBuffer,
            duplex: 'half'
          } as RequestInit)
          isUploading.value = false
          progress.value = 100
          if (!response.ok) {
            await trigger('fail')
            throw new Error(`업로드 실패: ${response.statusText}`)
          }
          fileInfo.value = { ...fileInfo.value!, downloadUrl: (cred as any).downloadUrl }
          trigger('success')
          return { downloadUrl: (cred as any).downloadUrl }
        }

        console.log(`uploadFile - 파일 크기 확인: ${file.size} bytes, 임계값: ${CHUNK_THRESHOLD} bytes`)
        if (file.size > CHUNK_THRESHOLD) {
          console.log('uploadFile - 청크 업로드 방식 사용')
          const result = (await uploadToQiniuWithChunks(file, cred as any, QINIU_CHUNK_SIZE)) as any
          if (result && result.downloadUrl) {
            fileInfo.value = { ...info, downloadUrl: result.downloadUrl }
          }
          return result
        } else {
          console.log('uploadFile - 기본 일반 업로드 방식 사용')
          const result = await uploadToQiniu(
            file,
            options?.scene || UploadSceneEnum.CHAT,
            cred as any,
            options?.enableDeduplication || true
          )
          if (result && result.downloadUrl) {
            fileInfo.value = { ...info, downloadUrl: result.downloadUrl }
          }
          return result
        }
      } catch (error) {
        console.error('업로드 자격 증명 가져오기 실패:', error)
        await trigger('fail')
      }
    } else if (currentProvider.value === UploadProviderEnum.MINIO) {
      try {
        fileInfo.value = { ...(await parseFile(file, options)) }
        await onStart.trigger(fileInfo)

        const presign = await getQiniuToken({ scene: options?.scene, fileName: file.name })

        const arrayBuffer = await file.arrayBuffer()
        const response = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream'
          },
          body: arrayBuffer,
          duplex: 'half'
        } as RequestInit)

        isUploading.value = false
        progress.value = 100

        if (!response.ok) {
          trigger('fail')
          throw new Error(`업로드 실패: ${response.statusText}`)
        }

        fileInfo.value = { ...fileInfo.value!, downloadUrl: presign.downloadUrl }
        trigger('success')
        return { downloadUrl: presign.downloadUrl }
      } catch (error) {
        isUploading.value = false
        console.error('MinIO 업로드 실패:', error)
        await trigger('fail')
      }
    }
  }

  /**
   * 업로드 및 다운로드 URL 가져오기
   * 기본 업로드 방식인 경우 업로드 및 다운로드 URL을 가져와 업로드 실행
   * Qiniu 클라우드 업로드 방식인 경우 Qiniu 클라우드 token을 가져오고 업로드 실행 안 함
   * @param path 파일 경로
   * @param options 업로드 옵션
   */
  const getUploadAndDownloadUrl = async (
    _path: string,
    options?: UploadOptions
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: any }> => {
    // 현재 업로드 방식 설정
    if (options?.provider) {
      currentProvider.value = options.provider
    }
    // provider가 지정되지 않은 경우 백엔드 기본 provider 읽기
    if (!options?.provider) {
      try {
        const res = await getUploadProvider()
        if (res?.provider === 'minio') currentProvider.value = UploadProviderEnum.MINIO
        else if (res?.provider === 'qiniu') currentProvider.value = UploadProviderEnum.QINIU
      } catch { }
    }

    // 업로드 방식에 따라 다른 업로드 로직 선택
    if (currentProvider.value === UploadProviderEnum.QINIU) {
      try {
        const cred = await getQiniuToken({ scene: options?.scene, fileName: extractFileName(_path) })
        if ((cred as any)?.token) {
          const config = { ...cred, provider: options?.provider, scene: options?.scene }
          return { uploadUrl: UploadProviderEnum.QINIU, downloadUrl: (cred as any).domain, config }
        }
        return {
          uploadUrl: (cred as any).uploadUrl,
          downloadUrl: (cred as any).downloadUrl,
          config: { objectKey: (cred as any).objectKey, provider: UploadProviderEnum.MINIO }
        }
      } catch (_error) {
        throw new Error('업로드 자격 증명 가져오기 실패, 다시 시도해주세요')
      }
    }
    if (currentProvider.value === UploadProviderEnum.MINIO) {
      const resp = await getQiniuToken({ scene: options?.scene, fileName: extractFileName(_path) })
      return {
        uploadUrl: resp.uploadUrl,
        downloadUrl: resp.downloadUrl,
        config: { objectKey: resp.objectKey, provider: UploadProviderEnum.MINIO }
      }
    }
    return { uploadUrl: '', downloadUrl: '' }
  }

  /**
   * 실제 파일 업로드 실행
   * @param path 파일 경로
   * @param uploadUrl 업로드 URL
   * @param options 업로드 옵션
   */
  const doUpload = async (path: string, uploadUrl: string, options?: any): Promise<{ qiniuUrl: string } | string> => {
    // Qiniu 클라우드 업로드인 경우
    if (uploadUrl === UploadProviderEnum.QINIU && options) {
      const fileName = extractFileName(path)
      // Qiniu 클라우드 설정이 제공되지 않은 경우 가져오기 시도
      if (!options.domain || !options.token) {
        try {
          const cred = await getQiniuToken({ scene: options.scene, fileName })
          if ((cred as any)?.token) {
            options.domain = (cred as any).domain
            options.token = (cred as any).token
            options.storagePrefix = (cred as any).storagePrefix
            options.region = (cred as any).region
          } else if ((cred as any)?.uploadUrl) {
            const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
            const file = await readFile(path, { baseDir })
            const response = await fetch((cred as any).uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/octet-stream' },
              body: file,
              duplex: 'half'
            } as RequestInit)
            isUploading.value = false
            progress.value = 100
            if (!response.ok) {
              trigger('fail')
              throw new Error(`업로드 실패: ${response.statusText}`)
            }
            trigger('success')
            return (cred as any).downloadUrl
          }
        } catch (error) {
          console.error('업로드 자격 증명 가져오기 실패', error)
        }
      }

      try {
        const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
        const file = await readFile(path, { baseDir })
        console.log(`📁 파일 읽기: ${path}, 크기: ${file.length} bytes`)

        const fileObj = new File([new Uint8Array(file)], fileName, { type: getFileType(fileName) })
        console.log(`📦 File 객체 생성: ${fileName}, 원본 크기: ${fileObj.size} bytes, 배열 크기: ${file.length} bytes`)

        isUploading.value = true
        progress.value = 0

        const useChunks = fileObj.size > CHUNK_THRESHOLD
        if (useChunks) {
          const r = await uploadToQiniuWithChunks(
            fileObj,
            {
              token: options.token,
              domain: options.domain,
              storagePrefix: options.storagePrefix,
              region: options.region
            },
            QINIU_CHUNK_SIZE,
            true
          )
          isUploading.value = false
          progress.value = 100
          const qiniuUrl = `${configStore.config.qiNiu.ossDomain}/${(r as any).key}`
          trigger('success')
          return qiniuUrl
        } else {
          const r = await uploadToQiniu(
            fileObj,
            options.scene,
            {
              token: options.token,
              domain: options.domain,
              storagePrefix: options.storagePrefix,
              region: options.region
            },
            options.enableDeduplication
          )
          isUploading.value = false
          progress.value = 100
          if ((r as any).downloadUrl) {
            trigger('success')
            return (r as any).downloadUrl
          }
          trigger('fail')
          throw new Error('업로드 실패')
        }
      } catch (error) {
        isUploading.value = false
        trigger('fail')
        console.error('Qiniu 클라우드 업로드 실패:', error)
        throw new Error('파일 업로드 실패, 다시 시도해주세요')
      }
    } else {
      // 기본 업로드 방식 사용
      console.log('파일 업로드 실행:', path)
      try {
        const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
        const file = await readFile(path, { baseDir })

        // 파일 크기 확인 추가
        if (file.length > MAX_FILE_SIZE) {
          throw new Error(`파일 크기는 ${Max}MB를 초과할 수 없습니다`)
        }

        isUploading.value = true
        progress.value = 0

        if (file.length > CHUNK_THRESHOLD && options?.provider !== UploadProviderEnum.MINIO) {
          // file 유형 변환
          // TODO: 로컬 업로드 테스트 필요
          const fileObj = new File([new Uint8Array(file)], __filename, { type: 'application/octet-stream' })
          await uploadToDefaultWithChunks(uploadUrl, fileObj)
        } else {
          const response = await fetch(uploadUrl, {
            headers: { 'Content-Type': 'application/octet-stream' },
            method: 'PUT',
            body: file,
            duplex: 'half'
          } as RequestInit)

          isUploading.value = false
          progress.value = 100

          if (!response.ok) {
            trigger('fail')
            throw new Error(`업로드 실패: ${response.statusText}`)
          }

          console.log('파일 업로드 성공')
          trigger('success')
        }

        // 다운로드 URL 반환
        return options?.downloadUrl
      } catch (error) {
        isUploading.value = false
        trigger('fail')
        console.error('파일 업로드 실패:', error)
        throw new Error('파일 업로드 실패, 다시 시도해주세요')
      }
    }
  }

  return {
    fileInfo,
    isUploading,
    progress,
    onStart: onStart.on,
    onChange,
    uploadFile,
    parseFile,
    uploadToQiniu,
    getUploadAndDownloadUrl,
    doUpload,
    UploadProviderEnum,
    generateHashKey
  }
}
