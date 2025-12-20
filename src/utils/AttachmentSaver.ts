import { save } from '@tauri-apps/plugin-dialog'
import type { useDownload } from '@/hooks/useDownload'
import { extractFileName } from './Formatting'

const VIDEO_FILE_EXTENSIONS = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'] as const

type DownloadFileFn = ReturnType<typeof useDownload>['downloadFile']

type SaveAttachmentOptions = {
  url?: string
  downloadFile: DownloadFileFn
  defaultFileName?: string
  filters?: Array<{ name: string; extensions: string[] }>
  successMessage?: string
  errorMessage?: string
}

const normalizeSavePath = (path: string) => path.replace(/\\/g, '/')

const saveAttachmentAs = async ({
  url,
  downloadFile,
  defaultFileName,
  filters,
  successMessage,
  errorMessage
}: SaveAttachmentOptions) => {
  if (!url) {
    window.$message.error('다운로드 링크를 찾을 수 없습니다.')
    return
  }

  const filename = defaultFileName || extractFileName(url)

  try {
    const savePath = await save({
      defaultPath: filename,
      filters
    })

    if (!savePath) return

    const normalizedPath = normalizeSavePath(savePath)
    await downloadFile(url, normalizedPath)

    if (successMessage) {
      window.$message.success(successMessage)
    }
  } catch (error) {
    console.error(errorMessage || '파일 저장 실패:', error)
    if (errorMessage) {
      window.$message.error(errorMessage)
    }
  }
}

export const saveVideoAttachmentAs = async (options: SaveAttachmentOptions) => {
  await saveAttachmentAs({
    filters: options.filters || [
      {
        name: 'Video',
        extensions: [...VIDEO_FILE_EXTENSIONS]
      }
    ],
    successMessage: options.successMessage || '비디오 저장 성공',
    errorMessage: options.errorMessage || '비디오 저장 실패',
    ...options
  })
}

export const saveFileAttachmentAs = async (options: SaveAttachmentOptions) => {
  await saveAttachmentAs({
    successMessage: options.successMessage || '파일 다운로드 성공',
    errorMessage: options.errorMessage || '파일 저장 실패',
    ...options
  })
}
