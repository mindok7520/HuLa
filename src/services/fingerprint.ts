import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { getOSType } from '@/utils/PlatformConstants'

const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24시간 캐시

// Worker 인스턴스 생성
const worker = new Worker(new URL('../workers/fingerprint.worker.ts', import.meta.url), {
  type: 'module'
})

// 진행 중인 지문 생성을 추적하기 위한 Promise 추가
let fingerprintPromise: Promise<string> | null = null

/**
 * 성능 최적화된 크로스 플랫폼 장치 지문 가져오기
 */
export const getEnhancedFingerprint = async (): Promise<string> => {
  // 이미 진행 중인 요청이 있으면 해당 Promise 반환
  if (fingerprintPromise) {
    return fingerprintPromise
  }

  // 새 Promise 생성 및 참조 저장
  fingerprintPromise = (async () => {
    const totalStart = performance.now()

    try {
      // 캐시 유효성 검사
      const cachedData = localStorage.getItem('deviceFingerprint')
      if (cachedData) {
        const { fingerprint, timestamp } = JSON.parse(cachedData)
        if (Date.now() - timestamp < CACHE_DURATION) {
          const totalTime = performance.now() - totalStart
          console.log(`캐시된 장치 지문 사용, 총 소요 시간: ${totalTime.toFixed(2)}ms`)
          return fingerprint
        }
      }

      // 장치 정보 수집
      const deviceInfoStart = performance.now()
      const deviceInfo = {
        platform: getOSType(),
        screenSize: `${window.screen.width}x${window.screen.height}`,
        pixelRatio: window.devicePixelRatio,
        colorDepth: window.screen.colorDepth,
        hardwareConcurrency: navigator.hardwareConcurrency || undefined,
        deviceMemory: (navigator as any).deviceMemory,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
      const deviceInfoTime = performance.now() - deviceInfoStart
      console.log(`장치 정보 수집 소요 시간: ${deviceInfoTime.toFixed(2)}ms`)

      // 메인 스레드에서 기본 브라우저 지문 가져오기
      const fpStart = performance.now()
      const fp = await FingerprintJS.load()
      const fpResult = await fp.get({
        debug: false
      })
      const fpTime = performance.now() - fpStart
      console.log(`기본 지문 생성 소요 시간: ${fpTime.toFixed(2)}ms`)

      // Worker 처리
      const workerStart = performance.now()
      const fingerprint = await new Promise<string>((resolve) => {
        const handleMessage = (e: MessageEvent) => {
          const { type, fingerprint } = e.data
          if (type === 'fingerprintGenerated') {
            worker.removeEventListener('message', handleMessage)
            resolve(fingerprint)
          }
        }

        worker.addEventListener('message', handleMessage)
        worker.postMessage({
          type: 'generateFingerprint',
          deviceInfo,
          browserFingerprint: fpResult.visitorId
        })
      })
      const workerTime = performance.now() - workerStart
      console.log(`Worker 지문 생성 소요 시간: ${workerTime.toFixed(2)}ms`)

      // 결과 캐시
      if (fingerprint) {
        localStorage.setItem(
          'deviceFingerprint',
          JSON.stringify({
            fingerprint,
            timestamp: Date.now()
          })
        )
      }

      const totalTime = performance.now() - totalStart
      console.log(`장치 지문 획득 총 소요 시간: ${totalTime.toFixed(2)}ms`)
      return fingerprint
    } catch (error) {
      const totalTime = performance.now() - totalStart
      console.error(`장치 지문 획득 실패, 총 소요 시간: ${totalTime.toFixed(2)}ms`, error)
      return ''
    } finally {
      fingerprintPromise = null
    }
  })()

  return fingerprintPromise
}
