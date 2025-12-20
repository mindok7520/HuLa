import { invoke } from '@tauri-apps/api/core'
import { appCacheDir, appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { BaseDirectory, exists, mkdir, readFile, writeFile } from '@tauri-apps/plugin-fs'
import { type FileTypeResult, fileTypeFromBuffer } from 'file-type'
import type { FilesMeta } from '@/services/types'
import { isMobile } from './PlatformConstants'

// Tauri 리소스 디렉터리 내 사용자 데이터가 저장되는 루트 디렉터리 이름
const USER_DATA = 'userData'
// 3D 모델이 통합되어 저장되는 하위 디렉터리 이름
const MODELS_DIR = 'models'
// 사용자 전용 이모지 디렉터리 이름
const EMOJIS_DIR = 'emojis'
// AI 생성 리소스 디렉터리 이름
const AI_DIR = 'ai'

// userData 루트 디렉터리 가져오기
export const getUserDataRootAbsoluteDir = async (): Promise<string> => {
  await ensureUserDataRoot()
  const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
  return await join(baseDirPath, USER_DATA)
}

// 원격 파일 형식 탐지 결과 및 진행 중인 Promise 캐시, 동일 리소스에 대한 중복 요청 방지
const remoteFileTypeResultCache = new Map<string, FileTypeResult | undefined>()
const remoteFileTypePromiseCache = new Map<string, Promise<FileTypeResult | undefined>>()

/**
 * 리소스 디렉터리에 userData 루트 디렉터리가 있는지 확인합니다.
 * Tauri는 빌드 후 기본적으로 이 디렉터리를 생성하지 않으므로 처음 사용하기 전에 직접 생성해야 합니다.
 */
const ensureUserDataRoot = async (): Promise<void> => {
  const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
  const dirExists = await exists(USER_DATA, { baseDir })
  if (!dirExists) {
    await mkdir(USER_DATA, {
      baseDir,
      recursive: true
    })
  }
}

/**
 * 캐시 디렉터리 가져오기, 경로 구조: appCacheDir/userUid/subFolder
 * @param subFolder 하위 디렉터리 이름
 * @param userUid 현재 사용자 ID
 */
const getPathCache = async (subFolder: string, userUid: string): Promise<string> => {
  const cacheDir = await appCacheDir()
  return await join(cacheDir, String(userUid), subFolder)
}

/**
 * 사용자 비디오 폴더(userData/userUid/roomId)를 가져오고 전체 경로가 존재하는지 확인합니다.
 * @param userUid 사용자 ID
 * @param roomId 방 ID
 */
const getUserVideosDir = async (userUid: string, roomId: string): Promise<string> => {
  await ensureUserDataRoot()
  // 사용자 ID와 방 ID의 하위 디렉터리도 존재하는지 확인
  const userRoomDir = await join(USER_DATA, userUid, roomId)
  const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
  const userRoomDirExists = await exists(userRoomDir, { baseDir })
  if (!userRoomDirExists) {
    await mkdir(userRoomDir, {
      baseDir,
      recursive: true
    })
  }
  return userRoomDir
}

export const getUserAbsoluteVideosDir = async (userUid: string, roomId: string) => {
  const userResourceDirectory = await getUserVideosDir(userUid, roomId)
  const filePath = await join(userResourceDirectory)

  const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
  const absoluteDir = await join(baseDirPath, filePath)
  return absoluteDir
}

/**
 * 사용자 이모지 디렉터리 userData/{uid}/emojis가 존재하는지 확인하고 상대 경로를 반환합니다.
 * @param userUid 사용자 ID
 */
const getUserEmojiDir = async (userUid: string): Promise<string> => {
  await ensureUserDataRoot()
  const emojiDir = await join(USER_DATA, userUid, EMOJIS_DIR)
  const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
  const hasEmojiDir = await exists(emojiDir, { baseDir })
  if (!hasEmojiDir) {
    await mkdir(emojiDir, {
      baseDir,
      recursive: true
    })
  }
  return emojiDir
}

/**
 * 사용자 이모지 디렉터리의 절대 경로를 가져옵니다.
 * @param userUid 사용자 ID
 */
export const getUserAbsoluteEmojiDir = async (userUid: string): Promise<string> => {
  const emojiDir = await getUserEmojiDir(userUid)
  const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
  return await join(baseDirPath, emojiDir)
}

const getImageCache = (subFolder: string, userUid: string): string => {
  return 'cache/' + String(userUid) + '/' + subFolder + '/'
}

// userData/ai 루트 디렉터리 존재 여부 확인, 모바일은 AppData, 데스크톱은 Resource 사용
const ensureAiDir = async (): Promise<string> => {
  await ensureUserDataRoot()
  const aiRoot = await join(USER_DATA, AI_DIR)
  const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
  const hasAiDir = await exists(aiRoot, { baseDir })
  if (!hasAiDir) {
    await mkdir(aiRoot, {
      baseDir,
      recursive: true
    })
  }
  return aiRoot
}

// AI 이미지 디렉터리 userData/ai/{uid}/{conversationId} 존재 여부 확인 및 상대 경로 반환
const ensureAiConversationDir = async (userUid: string, conversationId: string): Promise<string> => {
  const aiRoot = await ensureAiDir()
  const aiConversationDir = await join(aiRoot, userUid, conversationId)
  const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
  const hasConversationDir = await exists(aiConversationDir, { baseDir })
  if (!hasConversationDir) {
    await mkdir(aiConversationDir, {
      baseDir,
      recursive: true
    })
  }
  return aiConversationDir
}

// AI 이미지의 상대/절대 경로 및 해당 BaseDirectory 설정 생성
const buildAiImagePaths = async (options: {
  userUid: string
  conversationId: string
  fileName: string
}): Promise<{
  relativePath: string
  absolutePath: string
  baseDir: BaseDirectory
}> => {
  const { userUid, conversationId, fileName } = options
  const aiDir = await ensureAiConversationDir(userUid, conversationId)
  const relativePath = await join(aiDir, fileName)
  const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
  const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
  const absolutePath = await join(baseDirPath, relativePath)
  return { relativePath, absolutePath, baseDir }
}

// AI 이미지가 이미 존재하는지 확인하고 존재 상태와 경로 반환
export const resolveAiImagePath = async (options: {
  userUid: string
  conversationId: string
  fileName: string
}): Promise<{ exists: boolean; relativePath: string; absolutePath: string }> => {
  const { relativePath, absolutePath, baseDir } = await buildAiImagePaths(options)
  const existsFlag = await exists(relativePath, { baseDir })
  return { exists: existsFlag, relativePath, absolutePath }
}

// AI 이미지 이진 내용을 userData/ai/{uid}/{conversationId}에 쓰고 경로 반환
export const persistAiImageFile = async (options: {
  userUid: string
  conversationId: string
  fileName: string
  data: Uint8Array
}): Promise<{ relativePath: string; absolutePath: string }> => {
  const { relativePath, absolutePath, baseDir } = await buildAiImagePaths(options)
  await writeFile(relativePath, options.data, { baseDir })
  return { relativePath, absolutePath }
}

/**
 * 모델 저장 디렉터리 userData/models가 존재하는지 확인하고 해당 디렉터리의 상대 경로를 반환합니다.
 */
const ensureModelsDir = async (): Promise<string> => {
  await ensureUserDataRoot()
  const modelsPath = await join(USER_DATA, MODELS_DIR)
  const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
  const hasModelsDir = await exists(modelsPath, { baseDir })
  if (!hasModelsDir) {
    await mkdir(modelsPath, {
      baseDir,
      recursive: true
    })
  }
  return modelsPath
}

/**
 * 지정된 모델 파일이 로컬에 캐시되어 있는지 확인합니다.
 * 존재하지 않으면 원격 링크에서 다운로드하여 userData/models 디렉터리에 씁니다.
 * 최종적으로 리소스 디렉터리 내 모델 파일의 절대 경로를 반환합니다.
 * @param fileName 모델 파일명 (예: hula.glb)
 * @param remoteUrl 모델 원격 다운로드 주소
 */
export const ensureModelFile = async (fileName: string, remoteUrl: string): Promise<string> => {
  const modelsDir = await ensureModelsDir()
  const modelRelativePath = await join(modelsDir, fileName)
  const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
  const modelExists = await exists(modelRelativePath, { baseDir })

  if (!modelExists) {
    const response = await fetch(remoteUrl)
    if (!response.ok) {
      throw new Error(`모델 다운로드 실패: ${response.status} ${response.statusText}`)
    }
    const buffer = await response.arrayBuffer()
    await writeFile(modelRelativePath, new Uint8Array(buffer), {
      baseDir
    })
  }

  const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
  return await join(baseDirPath, modelRelativePath)
}

/**
 * 원격 파일의 실제 유형 분석
 * @param url 파일의 원격 주소
 * @param byteLength 요청할 바이트 수, 기본값 4100
 * @returns { ext: string, mime: string } 또는 undefined (식별 불가)
 */
export async function detectRemoteFileType(options: {
  url: string
  fileSize?: number | null
  byteLength?: number
}): Promise<FileTypeResult | undefined> {
  const { url } = options
  if (!/^https?:\/\//i.test(url)) {
    return void 0
  }
  const cacheKey = options.url
  if (remoteFileTypeResultCache.has(cacheKey)) {
    return remoteFileTypeResultCache.get(cacheKey)
  }
  if (remoteFileTypePromiseCache.has(cacheKey)) {
    return await remoteFileTypePromiseCache.get(cacheKey)!
  }

  const task = (async () => {
    try {
      const { url, byteLength = 4100 } = options

      // 1. 먼저 HEAD 요청을 보내 파일 존재 여부 및 크기 확인
      const headResponse = await fetch(url, { method: 'HEAD' })

      if (!headResponse.ok) {
        window.$message?.error('파일을 찾을 수 없습니다.')
        throw new Error(`파일이 존재하지 않습니다, 상태: ${headResponse.status}`)
      }

      const contentLengthHeader = headResponse.headers.get('content-length')
      const resolvedFileSize = options.fileSize ?? (contentLengthHeader ? Number(contentLengthHeader) : null)

      // 2. 빈 파일인 경우 즉시 undefined 반환
      if (resolvedFileSize === 0) {
        console.log('파일 크기가 0 바이트입니다. 확장자 기반 감지를 시도합니다.')
        try {
          const result = await invoke<FilesMeta>('get_files_meta', { filesPath: [url] })
          const meta = result[0]

          return {
            ext: meta.file_type,
            mime: meta.mime_type
          }
        } catch (_error) {
          console.warn(`해당 리소스의 유형을 식별할 수 없습니다: ${url}`)
          return void 0
        }
      }

      // 3. 파일 크기가 byteLength 보다 작으면 Range 오류를 방지하기 위해 전체 파일 GET
      const shouldUseRange = resolvedFileSize === null || resolvedFileSize >= byteLength
      const rangeEnd = shouldUseRange ? byteLength - 1 : void 0

      const response = await fetch(url, shouldUseRange ? { headers: { Range: `bytes=0-${rangeEnd}` } } : void 0)

      if (!response.ok) {
        throw new Error(`파일 데이터 가져오기 실패, 상태: ${response.status}`)
      }

      const buffer = await response.arrayBuffer()

      // 4. buffer에 데이터가 있으면 파일 유형 분석 시도
      return buffer.byteLength > 0 ? await fileTypeFromBuffer(buffer) : void 0
    } catch (error) {
      console.error('원격 파일 유형 분석 시도 중 오류 발생: ', error)
      return void 0
    }
  })()

  remoteFileTypePromiseCache.set(cacheKey, task)
  try {
    const result = await task
    remoteFileTypeResultCache.set(cacheKey, result)
    return result
  } finally {
    remoteFileTypePromiseCache.delete(cacheKey)
  }
}

export async function getFile(absolutePath: string) {
  const [fileMeta] = await getFilesMeta<FilesMeta>([absolutePath])

  const fileData = await readFile(absolutePath)
  const fileName = fileMeta.name
  const blob = new Blob([new Uint8Array(fileData)])

  const fileType = fileMeta?.mime_type || fileMeta?.file_type

  return {
    file: new File([blob], fileName, { type: fileType }),
    meta: fileMeta
  }
}

export async function getRemoteFileSize(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (!response.ok) {
      return null
    }
    const length = response.headers.get('content-length')
    return length ? Number(length) : null
  } catch (error) {
    console.warn('원격 파일 크기 가져오기 실패:', error)
    return null
  }
}

/**
 * 백엔드 명령을 호출하여 지정된 경로 또는 원격 URL 파일의 메타데이터 정보를 가져옵니다.
 *
 * @template T - 반환되는 메타데이터 유형, 일반적으로 FilesMeta 유형 또는 그 확장.
 * @param filesPath - 파일 경로 배열, 로컬 절대 경로 또는 원격 파일 URL 지원, 일괄 조회.
 * @returns 지정된 제네릭 T 유형의 데이터를 확인하는 Promise를 반환합니다.
 *
 * @example
 * interface FilesMeta {
 *   exists: boolean
 *   file_type: string // 확장자 형식의 파일 유형
 *   mime_type: string // mime 형식의 파일 유형
 * }
 *
 * // 로컬 절대 경로 파일 메타 정보 조회
 * const meta = await getFilesMeta<FilesMeta>(['C:\\Users\\User\\Documents\\file.docx'])
 * if (meta[0].exists) {
 *   console.log('파일이 존재하며 유형은', meta[0].file_type, '입니다.')
 * }
 *
 * // 원격 URL 파일 메타 정보 조회
 * const metas = await getFilesMeta<FilesMeta>(['https://example.com/file.pdf'])
 * metas.forEach(m => console.log(m.file_type))
 */
export async function getFilesMeta<T>(filesPath: string[]) {
  return invoke<T>('get_files_meta', {
    filesPath
  })
}

export { getPathCache, getUserVideosDir, getUserEmojiDir, getImageCache }
