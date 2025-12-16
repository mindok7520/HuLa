import { join } from '@tauri-apps/api/path'
import { BaseDirectory, create, exists, mkdir, readFile } from '@tauri-apps/plugin-fs'
import type { Ref } from 'vue'
import type { FilesMeta } from '@/services/types'
import { getFilesMeta, getImageCache } from '@/utils/PathUtil'
import { isMac, isMobile } from '@/utils/PlatformConstants'

/**
 * 개별 파일 메타데이터 인터페이스
 */
export type FileMetaItem = {
  name: string
  path: string
  file_type: string
  mime_type: string
  exists: boolean
}

/**
 * 로컬 오디오 파일 정보 인터페이스
 */
export type LocalAudioFile = {
  fileBuffer: ArrayBuffer
  cachePath: string
  fullPath: string
  fileExists: boolean
}

/**
 * 오디오 존재 여부 검사 결과 인터페이스
 */
export type AudioExistsResult = {
  exists: boolean
  fullPath: string
  fileMeta: FileMetaItem
}

/**
 * 오디오 파일 관리자 반환 인터페이스
 */
export type AudioFileManagerReturn = {
  // 상태
  isFileReady: Ref<boolean>
  audioBuffer: Ref<ArrayBuffer | null>

  // 메서드
  getAudioUrl: (originalUrl: string) => Promise<string>
  checkAudioSupport: (mimeType: string) => boolean
  downloadAndCache: (url: string, fileName: string) => Promise<ArrayBuffer>
  loadAudioWaveform: (url: string) => Promise<ArrayBuffer | Uint8Array | SharedArrayBuffer>
  existsAudioFile: (url: string) => Promise<AudioExistsResult>

  // 정리
  cleanup: () => void
}

/**
 * 오디오 파일 관리 Hook
 * @param userId 사용자 ID, 캐시 경로 생성에 사용
 * @returns 파일 관리 인터페이스
 */
export const useAudioFileManager = (userId: string): AudioFileManagerReturn => {
  const isFileReady = ref(false)
  const audioBuffer = ref<ArrayBuffer | null>(null)
  const isMacOS = isMac()

  /**
   * 오디오 형식 지원 확인
   * @param mimeType MIME 유형
   * @returns 지원 수준 문자열
   */
  const checkAudioSupport = (mimeType: string): boolean => {
    const audio = document.createElement('audio')
    const support = audio.canPlayType(mimeType)
    return support === 'probably' || support === 'maybe'
  }

  /**
   * 로컬 캐시에서 오디오 파일 읽기 시도
   * @param fileName 오디오 파일 이름 (예: voice_1234.mp3)
   * @returns 파일 buffer, 전체 경로, 캐시 경로 및 존재 여부 플래그를 포함하는 객체
   */
  const getLocalAudioFile = async (fileName: string): Promise<LocalAudioFile> => {
    const audioFolder = 'audio'
    // 캐시 경로 연결 (예: cache\46022457888256\audio)
    const cachePath = getImageCache(audioFolder, userId)
    const fullPath = await join(cachePath, fileName)

    // 파일이 로컬 캐시 폴더에 존재하는지 확인
    const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
    const fileExists = await exists(fullPath, { baseDir })
    if (!fileExists) {
      return {
        cachePath,
        fullPath,
        fileBuffer: new ArrayBuffer(0),
        fileExists
      }
    }

    // 오디오 파일 내용 읽기
    const fileBuffer = await readFile(fullPath, { baseDir })

    // Uint8Array인 경우 수동으로 ArrayBuffer로 변환
    const arrayBuffer =
      fileBuffer instanceof Uint8Array
        ? fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
        : fileBuffer

    return {
      fileBuffer: arrayBuffer,
      cachePath,
      fullPath,
      fileExists
    }
  }

  /**
   * 원격에서 오디오 파일을 다운로드하여 로컬 캐시 디렉토리에 저장
   * @param cachePath 저장할 디렉토리 경로
   * @param fileName 저장할 파일 이름
   * @param url 원격 URL
   * @returns 다운로드된 ArrayBuffer 데이터
   */
  const fetchAndDownloadAudioFile = async (cachePath: string, fileName: string, url: string): Promise<ArrayBuffer> => {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
    const dirExists = await exists(cachePath, { baseDir })

    // 디렉토리가 존재하지 않으면 캐시 디렉토리 생성
    if (!dirExists) {
      await mkdir(cachePath, { baseDir, recursive: true })
    }

    // 전체 경로 연결 및 파일 저장
    const fullPath = await join(cachePath, fileName)
    const file = await create(fullPath, { baseDir })
    await file.write(new Uint8Array(arrayBuffer))
    await file.close()

    return arrayBuffer
  }

  /**
   * 오디오 파일이 로컬 캐시에 존재하는지 확인
   * @param url 오디오 파일 URL
   * @returns 존재 여부 검사 결과
   */
  const existsAudioFile = async (url: string): Promise<AudioExistsResult> => {
    const [fileMeta] = await getFilesMeta<FilesMeta>([url])
    const audioFolder = 'audio'
    const cachePath = getImageCache(audioFolder, userId)
    const fullPath = await join(cachePath, fileMeta.name)

    const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
    const fileExists = await exists(fullPath, { baseDir })

    return {
      exists: fileExists,
      fullPath: fullPath,
      fileMeta: fileMeta // 여기서 fileMeta는 구조 분해 할당된 것이며, 타입은 정확함
    }
  }

  /**
   * 재생 가능한 오디오 URL 가져오기
   * @param originalUrl 원본 오디오 URL
   * @returns 재생 가능한 URL (로컬 또는 원격)
   */
  const getAudioUrl = async (originalUrl: string): Promise<string> => {
    const existsData = await existsAudioFile(originalUrl)

    if (existsData.exists) {
      const fileData = await getLocalAudioFile(existsData.fileMeta.name)

      // Mac 시스템 최적화: 올바른 MIME 유형 설정
      const mimeType = existsData.fileMeta.mime_type || 'audio/mpeg'

      // 오디오 형식 지원 확인 (mac)
      const support = checkAudioSupport(mimeType)
      if (!support && isMacOS) {
        console.warn(`Mac 시스템이 이 오디오 형식을 지원하지 않을 수 있음: ${mimeType}`)
        // 원격 URL로 다운그레이드
        return originalUrl
      } else {
        // fileBuffer가 ArrayBuffer 유형인지 확인
        let arrayBuffer: ArrayBuffer
        if (fileData.fileBuffer instanceof ArrayBuffer) {
          arrayBuffer = fileData.fileBuffer
        } else {
          arrayBuffer = new ArrayBuffer((fileData.fileBuffer as any).byteLength)
          new Uint8Array(arrayBuffer).set(new Uint8Array(fileData.fileBuffer as any))
        }
        return URL.createObjectURL(new Blob([new Uint8Array(arrayBuffer)], { type: mimeType }))
      }
    }

    return originalUrl
  }

  /**
   * 오디오 파일 다운로드 및 캐시
   * @param url 오디오 URL
   * @param fileName 파일 이름
   * @returns ArrayBuffer 데이터
   */
  const downloadAndCache = async (url: string, fileName: string): Promise<ArrayBuffer> => {
    const audioFolder = 'audio'
    const cachePath = getImageCache(audioFolder, userId)

    return await fetchAndDownloadAudioFile(cachePath, fileName, url)
  }

  /**
   * 오디오 파형 데이터 로드
   * 로컬 캐시에서 오디오 파일 읽기를 우선 시도하고, 없으면 원격 URL에서 다운로드하여
   * 나중에 사용할 수 있도록 로컬 캐시에 저장합니다. 오류 발생 시 기본 파형 생성으로 폴백을 지원합니다.
   * @param url 오디오 URL
   * @returns 오디오 데이터 buffer
   */
  const loadAudioWaveform = async (url: string): Promise<ArrayBuffer | Uint8Array | SharedArrayBuffer> => {
    try {
      // url에서 파일 기본 정보 추출
      const [fileMeta] = await getFilesMeta<FilesMeta>([url])

      // 로컬 오디오 파일 가져오기 시도
      const localAudioFile = await getLocalAudioFile(fileMeta.name)

      // 로컬 오디오 파일 존재 여부 확인
      if (localAudioFile.fileExists) {
        // 로컬 오디오가 존재하면 해당 Buffer를 Uint8Array<ArrayBufferLike> 형식으로 읽기
        audioBuffer.value = localAudioFile.fileBuffer
        isFileReady.value = true
        return localAudioFile.fileBuffer
      } else {
        // 로컬 오디오가 없으면 온라인 리소스 파일 읽기, 형식은 Uint8Array<ArrayBufferLike>
        const arrayBuffer = await fetchAndDownloadAudioFile(localAudioFile.cachePath, fileMeta.name, url)
        audioBuffer.value = arrayBuffer
        isFileReady.value = true
        return arrayBuffer
      }
    } catch (error) {
      console.error('오디오 파형 로드 실패:', error)
      isFileReady.value = false
      throw error
    }
  }

  /**
   * 리소스 정리
   */
  const cleanup = () => {
    audioBuffer.value = null
    isFileReady.value = false
  }

  return {
    isFileReady,
    audioBuffer,
    getAudioUrl,
    checkAudioSupport,
    downloadAndCache,
    loadAudioWaveform,
    existsAudioFile,
    cleanup
  }
}
