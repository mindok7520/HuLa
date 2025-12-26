import { MsgEnum } from '@/enums'

/**
 * 지원되는 비디오 확장자 (통합 정의)
 */
export const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'wmv', 'mkv', 'flv', 'webm', 'm4v'] as const

/**
 * 지원되는 오디오 확장자
 */
export const SUPPORTED_AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] as const

/**
 * 지원되는 이미지 확장자
 */
export const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] as const

/**
 * 비디오 MIME 유형 매핑
 */
export const VIDEO_MIME_TYPE_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  mkv: 'video/x-matroska',
  flv: 'video/x-flv',
  webm: 'video/webm',
  m4v: 'video/mp4'
} as const

/**
 * 오디오 MIME 유형 매핑
 */
export const AUDIO_MIME_TYPE_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac'
} as const

/**
 * 이미지 MIME 유형 매핑
 */
export const IMAGE_MIME_TYPE_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml'
} as const

/**
 * 파일명에서 확장자 가져오기
 * @param fileName 파일명
 * @returns 소문자 확장자 (점 제외)
 */
export const getFileExtension = (fileName: string): string => {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

/**
 * 일반 파일 유형 검사 함수
 * @param fileOrName File 객체 또는 파일명
 * @param supportedExtensions 지원되는 확장자 배열
 * @param mimeTypePrefix MIME 유형 접두사 (예: 'video/', 'audio/', 'image/')
 * @returns 지정된 유형의 파일 여부
 */
const checkFileType = (
  fileOrName: File | string,
  supportedExtensions: readonly string[],
  mimeTypePrefix: string
): boolean => {
  if (typeof fileOrName === 'string') {
    // 문자열인 경우 확장자 확인
    const extension = getFileExtension(fileOrName)
    return supportedExtensions.includes(extension as any)
  }

  // File 객체인 경우 먼저 MIME 유형을 확인한 다음 확장명을 확인합니다.
  const file = fileOrName as File
  const extension = getFileExtension(file.name)
  // 특수 처리: .ts 파일은 video/mp2t MIME 유형(MPEG Transport Stream)으로 잘못 설정될 수 있음
  if (extension === 'ts' && mimeTypePrefix === 'video/') {
    return false
  }

  // MIME 유형 우선 확인
  if (file.type && file.type.startsWith(mimeTypePrefix)) {
    return true
  }

  // MIME 유형이 비어 있거나 불분명한 경우 파일 확장자 확인
  return supportedExtensions.includes(extension as any)
}

/**
 * 파일 확장자에 따라 비디오 MIME 유형 가져오기
 * @param fileName 파일명
 * @returns 비디오 MIME 유형
 */
export const getVideoMimeType = (fileName: string): string => {
  const extension = getFileExtension(fileName)
  return VIDEO_MIME_TYPE_MAP[extension] || 'video/mp4' // 기본적으로 mp4 유형 반환
}

/**
 * 파일 확장자에 따라 오디오 MIME 유형 가져오기
 * @param fileName 파일명
 * @returns 오디오 MIME 유형
 */
export const getAudioMimeType = (fileName: string): string => {
  const extension = getFileExtension(fileName)
  return AUDIO_MIME_TYPE_MAP[extension] || 'audio/mpeg' // 기본적으로 mp3 유형 반환
}

/**
 * 파일 확장자에 따라 이미지 MIME 유형 가져오기
 * @param fileName 파일명
 * @returns 이미지 MIME 유형
 */
export const getImageMimeType = (fileName: string): string => {
  const extension = getFileExtension(fileName)
  return IMAGE_MIME_TYPE_MAP[extension] || 'image/jpeg' // 기본적으로 jpeg 유형 반환
}

/**
 * 파일의 MIME 유형 수정 (MIME 유형이 비어 있거나 올바르지 않은 경우)
 * @param file 원본 파일
 * @returns MIME 유형이 수정된 파일
 */
export const fixFileMimeType = (file: File): File => {
  // 이미 올바른 MIME 유형이 있는 경우 상속 반환
  if (
    file.type &&
    (file.type.startsWith('video/') || file.type.startsWith('audio/') || file.type.startsWith('image/'))
  ) {
    return file
  }

  const extension = getFileExtension(file.name)
  let correctMimeType = ''

  // 확장자에 따라 올바른 MIME 유형 결정
  if (SUPPORTED_VIDEO_EXTENSIONS.includes(extension as any)) {
    correctMimeType = getVideoMimeType(file.name)
  } else if (SUPPORTED_AUDIO_EXTENSIONS.includes(extension as any)) {
    correctMimeType = getAudioMimeType(file.name)
  } else if (SUPPORTED_IMAGE_EXTENSIONS.includes(extension as any)) {
    correctMimeType = getImageMimeType(file.name)
  } else {
    // 미디어 파일이 아니면 원래 유형 유지
    return file
  }

  // 새로운 File 객체 생성, MIME 유형 수정
  return new File([file], file.name, {
    type: correctMimeType,
    lastModified: file.lastModified
  })
}

/**
 * 파일 유형에 따라 해당 메시지 열거형 가져오기
 * @param file File 객체
 * @returns 메시지 유형 열거형
 */
export const getMessageTypeByFile = (file: File): MsgEnum => {
  if (checkFileType(file, SUPPORTED_VIDEO_EXTENSIONS, 'video/')) {
    return MsgEnum.VIDEO
  } else if (checkFileType(file, SUPPORTED_AUDIO_EXTENSIONS, 'audio/')) {
    return MsgEnum.VOICE
  } else if (checkFileType(file, SUPPORTED_IMAGE_EXTENSIONS, 'image/') && !file.type.includes('svg')) {
    return MsgEnum.IMAGE
  } else {
    return MsgEnum.FILE
  }
}

/**
 * URL이 비디오 링크인지 확인
 * @param url 링크 주소
 * @returns 비디오 링크 여부
 */
export const isVideoUrl = (url: string): boolean => {
  try {
    new URL(url)
    return checkFileType(url, SUPPORTED_VIDEO_EXTENSIONS, 'video/')
  } catch {
    return false
  }
}
