import { BaseDirectory, create, exists, mkdir, readFile, remove } from '@tauri-apps/plugin-fs'
import { startRecording, stopRecording } from 'tauri-plugin-mic-recorder-api'
import { useUserStore } from '@/stores/user'
import { calculateCompressionRatio, compressAudioToMp3, getAudioInfo } from '@/utils/AudioCompression'
import { getImageCache } from '@/utils/PathUtil.ts'
import { isMobile } from '@/utils/PlatformConstants'
import { UploadSceneEnum } from '../enums'
import { useUpload } from './useUpload'

// worker 타이머 가져오기
let timerWorker: Worker | null = null

type VoiceRecordRustOptions = {
  onStart?: () => void
  onStop?: (audioBlob: Blob, duration: number, localPath: string) => void
  onError?: (error: string) => void
}

export const useVoiceRecordRust = (options: VoiceRecordRustOptions = {}) => {
  // 사용자 스토어
  const userStore = useUserStore()
  const isRecording = ref(false)
  const recordingTime = ref(0)
  const audioLevel = ref(0)
  const startTime = ref(0)
  const audioMonitor = ref<NodeJS.Timeout | null>(null)
  const timerMsgId = 'voiceRecordTimer' // worker 타이머 메시지 ID
  const { generateHashKey } = useUpload()

  /** 녹음 시작 */
  const startRecordingAudio = async () => {
    try {
      // 진행 중인 녹음이 있으면 먼저 중지하고 새 녹음 시작
      if (isRecording.value) {
        await stopRecordingAudio()
      }

      // Rust 백엔드를 호출하여 녹음 시작
      await startRecording()

      isRecording.value = true
      startTime.value = Date.now()
      recordingTime.value = 0

      // worker 타이머 초기화
      if (!timerWorker) {
        timerWorker = new Worker(new URL('../workers/timer.worker.ts', import.meta.url))

        // worker 메시지 수신 대기
        timerWorker.onmessage = (e) => {
          const { type, msgId } = e.data

          if (type === 'timeout' && msgId === timerMsgId) {
            // 매초 녹음 시간 업데이트
            if (isRecording.value) {
              const currentTime = Math.floor((Date.now() - startTime.value) / 1000)
              recordingTime.value = currentTime

              // 60초 제한 도달 여부 확인
              if (currentTime === 59) {
                // 60초 도달, 자동으로 녹음 중지
                stopRecordingAudio()
                return
              }

              // 1초 타이머 다시 시작
              timerWorker?.postMessage({
                type: 'startTimer',
                msgId: timerMsgId,
                duration: 1000
              })
            }
          }
        }

        timerWorker.onerror = (error) => {
          console.error('[VoiceRecord Worker Error]', error)
        }
      }

      // worker 타이머 시작
      timerWorker.postMessage({
        type: 'startTimer',
        msgId: timerMsgId,
        duration: 1000
      })

      options.onStart?.()
    } catch (error) {
      console.error('녹음 시작 실패:', error)
      window.$message?.error('녹음 실패')
      options.onError?.('녹음 실패')
    }
  }

  /** 녹음 중지 */
  const stopRecordingAudio = async () => {
    try {
      if (!isRecording.value) return

      // Rust 백엔드를 호출하여 녹음 중지
      const audioPath = await stopRecording()

      isRecording.value = false
      const duration = (Date.now() - startTime.value) / 1000

      // worker 타이머 정리
      if (timerWorker) {
        timerWorker.postMessage({
          type: 'clearTimer',
          msgId: timerMsgId
        })
      }

      if (audioMonitor.value) {
        clearInterval(audioMonitor.value)
        audioMonitor.value = null
      }

      // 오디오 파일 경로가 있으면 즉시 처리하고 녹음 결과 표시
      if (audioPath) {
        // 녹음 파일 읽기
        const audioData = await readFile(audioPath)

        // 원본 오디오 정보 가져오기
        const originalInfo = await getAudioInfo(audioData.buffer as any)
        console.log('원본 오디오 정보:', {
          duration: `${originalInfo.duration.toFixed(2)}초`,
          sampleRate: `${originalInfo.sampleRate}Hz`,
          channels: originalInfo.channels,
          size: `${(originalInfo.size / 1024 / 1024).toFixed(2)}MB`
        })

        // 오디오를 MP3 형식으로 압축
        const compressedBlob = await compressAudioToMp3(audioData.buffer as any, {
          channels: 1, // 모노
          sampleRate: 22050, // 샘플링 속도 낮춤
          bitRate: 64 // 낮은 비트 전송률
        })

        // 압축률 계산
        const compressionRatio = calculateCompressionRatio(originalInfo.size, compressedBlob.size)
        console.log('오디오 압축 완료:', {
          originalSize: `${(originalInfo.size / 1024 / 1024).toFixed(2)}MB`,
          compressedSize: `${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB`,
          compressionRatio: `${compressionRatio}%`
        })

        // 즉시 콜백하여 녹음 결과 표시, 압축된 오디오 전달
        options.onStop?.(compressedBlob, duration, audioPath)

        // 비동기 캐시 처리, UI 업데이트 차단 안 함
        saveAudioToCache(compressedBlob, duration).catch((error) => {
          console.error('오디오 파일 캐싱 실패:', error)
          // 캐싱 실패는 주요 기능에 영향을 주지 않으므로 오류만 기록
        })

        // 원본 wav 파일 삭제, 디스크 공간 확보
        try {
          await remove(audioPath)
          console.log('원본 녹음 파일 삭제됨:', audioPath)
        } catch (deleteError) {
          console.warn('원본 녹음 파일 삭제 실패:', deleteError)
        }
      }
    } catch (error) {
      console.error('녹음 중지 또는 압축 실패:', error)

      // 녹음 상태가 올바르게 재설정되었는지 확인
      isRecording.value = false

      // worker 타이머 정리
      if (timerWorker) {
        timerWorker.postMessage({
          type: 'clearTimer',
          msgId: timerMsgId
        })
      }

      if (audioMonitor.value) {
        clearInterval(audioMonitor.value)
        audioMonitor.value = null
      }
      options.onError?.('녹음 중지 실패')
    }
  }

  /** 녹음 취소 */
  const cancelRecordingAudio = async () => {
    try {
      if (!isRecording.value) return

      // Rust 백엔드를 호출하여 녹음 중지, 반환된 오디오 파일 처리 안 함
      await stopRecording()
      console.log('녹음 취소')

      isRecording.value = false

      // worker 타이머 정리
      if (timerWorker) {
        timerWorker.postMessage({
          type: 'clearTimer',
          msgId: timerMsgId
        })
      }

      if (audioMonitor.value) {
        clearInterval(audioMonitor.value)
        audioMonitor.value = null
      }
    } catch (error) {
      console.error('녹음 취소 실패:', error)
      // 상태가 재설정되었는지 확인
      isRecording.value = false
      options.onError?.('녹음 취소 실패')
    }
  }

  /** 오디오를 로컬 캐시에 저장 */
  const saveAudioToCache = async (audioBlob: Blob, duration: number) => {
    const getFileHashName = async (tempFileName: string) => {
      const audioFile = new File([audioBlob], tempFileName)
      // 파일의 실제 리소스 해시 파일 이름 계산
      const resourceFileName = await generateHashKey(
        { scene: UploadSceneEnum.CHAT, enableDeduplication: true }, // 여기서 UploadSceneEnum은 임의로 선택, 해시값 파일 이름만 필요함
        audioFile,
        tempFileName
      )

      return resourceFileName.split('/').pop() as string
    }

    try {
      const userUid = userStore.userInfo!.uid
      if (!userUid) {
        throw new Error('사용자 로그인 안 됨')
      }

      // 파일 이름 생성
      const timestamp = Date.now()
      const fileName = `voice_${timestamp}.mp3`

      // 캐시 경로 가져오기
      const audioFolder = 'audio'
      const cachePath = getImageCache(audioFolder, userUid.toString())

      const fileHashName = await getFileHashName(fileName)
      const fullPath = cachePath + fileHashName

      // 디렉토리 존재 확인
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      const dirExists = await exists(cachePath, { baseDir })
      if (!dirExists) {
        await mkdir(cachePath, { baseDir, recursive: true })
      }

      // Blob을 ArrayBuffer로 변환
      const arrayBuffer = await audioBlob.arrayBuffer()

      // 로컬 파일에 저장
      const file = await create(fullPath, { baseDir })
      await file.write(new Uint8Array(arrayBuffer))
      await file.close()

      console.log('오디오 파일 저장됨:', fullPath)

      // 콜백 호출, 로컬 경로 전달
      options.onStop?.(audioBlob, duration, fullPath)
    } catch (error) {
      console.error('오디오 파일 저장 실패:', error)
      window.$message?.error('오디오 저장 실패')
      options.onError?.('오디오 저장 실패')
    }
  }

  // 녹음 시간 포맷팅
  const formatTime = (seconds: number) => {
    const roundedSeconds = Math.round(seconds)
    const mins = Math.floor(roundedSeconds / 60)
    const secs = roundedSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 리소스 정리
  onUnmounted(() => {
    cancelRecordingAudio()
    // worker 정리
    if (timerWorker) {
      timerWorker.postMessage({
        type: 'clearTimer',
        msgId: timerMsgId
      })
      timerWorker.terminate()
      timerWorker = null
    }
  })

  return {
    isRecording: readonly(isRecording),
    recordingTime: readonly(recordingTime),
    audioLevel: readonly(audioLevel),
    startRecording: startRecordingAudio,
    stopRecording: stopRecordingAudio,
    cancelRecording: cancelRecordingAudio,
    formatTime
  }
}
