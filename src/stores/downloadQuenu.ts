import { save } from '@tauri-apps/plugin-dialog'
import { defineStore } from 'pinia'
import { useDownload } from '@/hooks/useDownload.ts'

type DownloadObjType = {
  url: string
  isDownloading: boolean
  process: number | undefined
}

// 다운로드 큐 스토어 정의
export const useDownloadQuenuStore = defineStore('downloadQuenu', () => {
  // 동시에 실행할 수 있는 최대 다운로드 작업 수
  const maxDownloadCount = 1
  // 다운로드 큐
  const quenu = reactive<string[]>([])
  // 다운로드 객체
  const downloadObjMap = reactive<Record<string, DownloadObjType>>({})

  // 다운로드 큐에 추가
  const addQuenuAction = (url: string) => {
    quenu.push(url)
  }

  // 다운로드 큐에서 제거
  const removeQuenuAction = (url: string) => {
    const index = quenu.indexOf(url)
    if (index > -1) {
      quenu.splice(index, 1)
    }
  }

  // 큐에서 꺼내기
  const dequeue = () => {
    if (!quenu.length || Object.keys(downloadObjMap).length >= maxDownloadCount) {
      return
    }
    const url = quenu.shift()
    if (url) {
      downloadAction(url)
    }
  }

  // 다운로드
  const downloadAction = async (url: string) => {
    const { downloadFile, isDownloading, process, onLoaded } = useDownload()

    try {
      // 사용자에게 저장 경로 선택 요청
      const savePath = (await save({
        filters: [
          {
            name: '모든 파일',
            extensions: ['*']
          }
        ]
      })) as string // savePath가 string 타입인지 확인

      if (!savePath) {
        // 사용자가 저장 대화상자를 취소함
        removeQuenuAction(url)
        return
      }

      const stopWatcher = watch(process, () => {
        // 다운로드 진행률 업데이트
        downloadObjMap[url] = { url, isDownloading: isDownloading.value, process: process.value }
      })

      onLoaded(() => {
        stopWatcher() // watcher 지우기
        delete downloadObjMap[url] // 다운로드 완료 후 다운로드 객체 삭제
        dequeue()
      })

      await downloadFile(url, savePath)
    } catch (error) {
      console.error('저장 실패:', error)
      window.$message.error('저장 실패')
      removeQuenuAction(url)
    }
  }

  const download = (url: string) => {
    addQuenuAction(url)
    dequeue()
  }

  // 다운로드 취소
  const cancelDownload = (url: string) => {
    if (quenu.includes(url)) {
      removeQuenuAction(url)
    }
  }

  return {
    quenu,
    addQuenuAction,
    removeQuenuAction,
    dequeue,
    downloadObjMap,
    download,
    cancelDownload
  }
})
