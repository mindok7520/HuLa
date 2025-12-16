import { join } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import { copyFile, readFile } from '@tauri-apps/plugin-fs'
import type { FilesMeta } from '@/services/types'
import { extractFileName } from '@/utils/Formatting'
import { useUserStore } from '../stores/user'
import { getFilesMeta } from './PathUtil'

class FileUtil {
  private static _userStore: ReturnType<typeof useUserStore> | null = null

  private static get userStore() {
    if (!FileUtil._userStore) {
      FileUtil._userStore = useUserStore()
    }
    return FileUtil._userStore
  }
  /**
   * 파일 선택기를 열고 사용자가 여러 파일을 선택할 수 있도록 하며, 선택한 파일을 사용자 리소스 디렉토리에 복사합니다
   * 부작용: 선택한 파일을 사용자 리소스 디렉토리에 복사합니다
   * @returns
   * files: 선택한 파일 목록
   * filesMeta: 선택한 파일 메타데이터 목록
   */
  static async openAndCopyFile(): Promise<{
    files: File[]
    filesMeta: FilesMeta
  } | null> {
    // 파일 경로 목록 가져오기
    const selected = await open({
      multiple: true
      // filters를 설정하지 않아 모든 파일 타입 선택 허용
    })

    if (!selected) {
      return null
    }
    const filesMeta = await getFilesMeta<FilesMeta>(selected)
    await FileUtil.copyUploadFile(selected, filesMeta)

    return {
      files: await FileUtil.map2File(selected, filesMeta),
      filesMeta: filesMeta
    }
  }

  /**
   * 선택한 파일을 사용자 리소스 디렉토리에 복사합니다
   * 부작용: 선택한 파일을 사용자 리소스 디렉토리에 복사합니다
   * @param files 선택한 파일 경로 목록
   * @param filesMeta 선택한 파일 메타데이터 목록
   */
  static async copyUploadFile(files: string[], filesMeta: FilesMeta) {
    const userResourceDir = await FileUtil.userStore.getUserRoomAbsoluteDir()
    for (const filePathStr of files) {
      const fileMeta = filesMeta.find((f) => f.path === filePathStr)
      if (fileMeta) {
        copyFile(filePathStr, await join(userResourceDir, fileMeta.name))
      }
    }
  }

  /**
   * 선택한 파일 경로 목록과 파일 메타데이터 목록을 File 객체 목록으로 변환합니다
   * @param files 선택한 파일 경로 목록
   * @param filesMeta 선택한 파일 메타데이터 목록
   * @returns File 객체 목록
   */
  static async map2File(files: string[], filesMeta: FilesMeta): Promise<File[]> {
    return await Promise.all(
      files.map(async (path) => {
        const fileData = await readFile(path)
        const fileName = extractFileName(path)
        const blob = new Blob([new Uint8Array(fileData)])

        // 해당 경로의 파일을 찾고 타입을 가져옵니다
        const fileMeta = filesMeta.find((f) => f.path === path)
        const fileType = fileMeta?.mime_type || fileMeta?.file_type

        // blob은 파일 타입을 자동으로 판단할 수 없으므로 마지막에 수동으로 전달합니다
        return new File([blob], fileName, { type: fileType })
      })
    )
  }
}

export default FileUtil
