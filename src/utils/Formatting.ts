import DOMPurify from 'dompurify'
import { compact } from 'es-toolkit'

/**
 * 파일 크기 포맷팅
 */
export const formatBytes = (bytes: number): string => {
  if (bytes <= 0 || isNaN(bytes)) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const base = 1024
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(base))
  const size = parseFloat((bytes / base ** unitIndex).toFixed(2))

  return size + ' ' + units[unitIndex]
}

/** 파일 아이콘 매핑 관계 테이블 */
const fileSuffixMap: Record<string, string> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'jpg',
  webp: 'jpg',
  mp4: 'mp4',
  mov: 'mp4',
  avi: 'mp4',
  rmvb: 'mp4',
  doc: 'doc',
  docx: 'doc',
  mp3: 'mp3',
  wav: 'mp3',
  aac: 'mp3',
  flac: 'mp3',
  pdf: 'pdf',
  ppt: 'ppt',
  pptx: 'ppt',
  xls: 'xls',
  xlsx: 'xls',
  zip: 'zip',
  rar: 'zip',
  '7z': 'zip',
  txt: 'txt',
  log: 'log',
  svg: 'svg',
  sketch: 'sketch',
  exe: 'exe',
  md: 'md',
  ts: 'ts'
}
/**
 * 파일에 해당하는 아이콘 가져오기
 * @param fileName 파일명
 * @returns 아이콘
 */
export const getFileSuffix = (fileName: string): string => {
  if (!fileName) return 'other'

  const suffix = fileName.toLowerCase().split('.').pop()
  if (!suffix) return 'other'

  return fileSuffixMap[suffix] || 'other'
}

/**
 * 파일 경로에서 파일명 추출
 * @param path 파일 경로
 * @returns 파일명
 */
export const extractFileName = (path: string): string => {
  // Unix 및 Windows 경로 구분 기호 모두 처리
  const fileName = path.split(/[/\\]/).pop()
  return fileName || 'file'
}

/**
 * 파일 확장자에 따라 MIME 유형 가져오기
 * @param fileName 파일명
 * @returns MIME 유형
 */
export const getMimeTypeFromExtension = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml'
  }
  return mimeMap[ext] || 'image/png'
}

/**
 * @param fragment 문자열
 * @returns 요소 태그가 제거된 문자열
 */
export const removeTag = (fragment: string) => {
  const sanitizedFragment = DOMPurify.sanitize(fragment)
  const normalizedFragment = sanitizedFragment
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|td|blockquote|h[1-6])>/gi, '')
    .replace(/<(div|p|li|tr|td|blockquote|h[1-6])[^>]*>/gi, '\n')
    .replace(/\r\n|\r/g, '\n')

  const textContent = new DOMParser().parseFromString(normalizedFragment, 'text/html').body.textContent || fragment

  return textContent.replace(/\u00A0/g, ' ')
}

/**
 * 비중문 텍스트가 지정된 공백이 아닌 문자 수를 초과할 경우 생략 부호를 추가하여 자름
 */
export const formatBottomText = (text: string, maxLength = 6, omission = '...') => {
  const pureText = text.replace(/\s/g, '')
  const hasChinese = /[\u4e00-\u9fa5]/.test(pureText)
  if (hasChinese || pureText.length <= maxLength) {
    return text
  }

  const nonSpaceIndexes = compact(Array.from(text).map((char, idx) => (char.trim().length > 0 ? idx : undefined)))
  const cutIndex = nonSpaceIndexes[maxLength - 1] ?? text.length - 1

  return `${text.slice(0, cutIndex + 1).trimEnd()}${omission}`
}
