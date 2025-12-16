/// <reference lib="webworker" />

// 브라우저 특징 감지
const detectBrowserFeatures = async (): Promise<Record<string, boolean>> => {
  const features: Record<string, boolean> = {}

  const checks = {
    webgl: async () => {
      try {
        const canvas = new OffscreenCanvas(1, 1)
        return !!(canvas as any).getContext('webgl')
      } catch {
        return false
      }
    },
    canvas: async () => {
      try {
        const canvas = new OffscreenCanvas(1, 1)
        return !!(canvas as any).getContext('2d')
      } catch {
        return false
      }
    },
    audio: async () => {
      try {
        return !!(self.AudioContext || (self as any).webkitAudioContext)
      } catch {
        return false
      }
    }
  }

  const results = await Promise.all(
    Object.entries(checks).map(async ([key, check]) => {
      try {
        const result = await check()
        return [key, result]
      } catch {
        return [key, false]
      }
    })
  )

  results.forEach(([key, value]) => {
    features[key as string] = value as boolean
  })

  return features
}

// 디바이스 지문 생성
const generateFingerprint = async (data: { deviceInfo: any; browserFingerprint: string }): Promise<string> => {
  try {
    const totalStart = performance.now()

    // 2. 브라우저 특징 감지
    const featureStart = performance.now()
    const browserFeatures = await detectBrowserFeatures()
    const featureTime = performance.now() - featureStart
    console.log(`Worker: 특징 감지 소요 시간: ${featureTime.toFixed(2)}ms`)

    // 3. 모든 특징 결합
    const hashStart = performance.now()
    const combinedFingerprint = JSON.stringify({
      browserFingerprint: data.browserFingerprint,
      deviceInfo: data.deviceInfo,
      browserFeatures,
      timestamp: Date.now()
    })

    // 4. SHA-256을 사용하여 최종 지문 생성
    const fingerprintBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combinedFingerprint))

    const fingerprint = Array.from(new Uint8Array(fingerprintBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const hashTime = performance.now() - hashStart
    console.log(`Worker: SHA-256 계산 소요 시간: ${hashTime.toFixed(2)}ms`)

    const totalTime = performance.now() - totalStart
    console.log(`Worker: 지문 생성 총 소요 시간: ${totalTime.toFixed(2)}ms`)

    return fingerprint
  } catch (error) {
    console.error('Worker: ❌ 디바이스 지문 생성 실패:', error)
    return ''
  }
}

// 메인 스레드 메시지 수신 대기
self.onmessage = async (e) => {
  const { type, deviceInfo, browserFingerprint } = e.data

  if (type === 'generateFingerprint') {
    const fingerprint = await generateFingerprint({ deviceInfo, browserFingerprint })
    self.postMessage({ type: 'fingerprintGenerated', fingerprint })
  }
}
