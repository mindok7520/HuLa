import * as lamejs from '@breezystack/lamejs'

/**
 * 오디오 압축 설정 인터페이스
 */
export interface AudioCompressionConfig {
  /** 채널 수: 1은 모노, 2는 스테레오 */
  channels?: number
  /** 샘플링 레이트 (Hz) */
  sampleRate?: number
  /** MP3 비트레이트 (kbps) */
  bitRate?: number
}

/**
 * 기본 오디오 압축 설정
 */
const DEFAULT_CONFIG: Required<AudioCompressionConfig> = {
  channels: 1, // 모노는 파일 크기를 줄일 수 있음
  sampleRate: 22050, // 샘플링 레이트를 낮춰 파일 크기 감소
  bitRate: 64 // 낮은 비트레이트로 파일 크기 감소
}

/**
 * WAV 오디오 데이터를 압축된 MP3 형식으로 변환
 * @param audioBuffer - 오디오 버퍼 데이터
 * @param config - 압축 설정
 * @returns 압축된 MP3 Blob
 */
export async function compressAudioToMp3(audioBuffer: ArrayBuffer, config: AudioCompressionConfig = {}): Promise<Blob> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  try {
    // AudioContext를 생성하여 오디오 데이터 처리
    const audioContext = new AudioContext()
    const decodedAudio = await audioContext.decodeAudioData(audioBuffer.slice())

    // 목표 샘플링 레이트로 리샘플링
    const resampledBuffer = await resampleAudio(decodedAudio, finalConfig.sampleRate)

    // Int16Array 형식으로 변환
    const samples = convertToInt16Array(resampledBuffer, finalConfig.channels)

    // lamejs를 사용하여 MP3 인코딩
    const mp3Data = encodeToMp3(samples, finalConfig)

    // MP3 Blob 생성 - Int8Array를 Uint8Array로 변환
    const uint8Arrays = mp3Data.map((data) => new Uint8Array(data))
    const blob = new Blob(uint8Arrays, { type: 'audio/mp3' })

    // AudioContext 정리
    await audioContext.close()

    return blob
  } catch (error) {
    console.error('오디오 압축 실패:', error)
    throw new Error('오디오 압축 실패')
  }
}

/**
 * 오디오를 목표 샘플링 레이트로 리샘플링
 */
async function resampleAudio(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
  if (audioBuffer.sampleRate === targetSampleRate) {
    return audioBuffer
  }

  const audioContext = new AudioContext({ sampleRate: targetSampleRate })
  const resampledBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    Math.floor((audioBuffer.length * targetSampleRate) / audioBuffer.sampleRate),
    targetSampleRate
  )

  // 간단한 선형 보간 리샘플링
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel)
    const outputData = resampledBuffer.getChannelData(channel)
    const ratio = inputData.length / outputData.length

    for (let i = 0; i < outputData.length; i++) {
      const index = i * ratio
      const indexFloor = Math.floor(index)
      const indexCeil = Math.min(indexFloor + 1, inputData.length - 1)
      const fraction = index - indexFloor

      outputData[i] = inputData[indexFloor] * (1 - fraction) + inputData[indexCeil] * fraction
    }
  }

  await audioContext.close()
  return resampledBuffer
}

/**
 * AudioBuffer를 Int16Array 형식으로 변환
 */
function convertToInt16Array(audioBuffer: AudioBuffer, targetChannels: number): Int16Array {
  const length = audioBuffer.length
  const samples = new Int16Array(length * targetChannels)
  const AMPLIFY = 10 // 10배 음량

  if (targetChannels === 1) {
    // 모노로 변환
    const channelData = audioBuffer.numberOfChannels > 1 ? mixToMono(audioBuffer) : audioBuffer.getChannelData(0)

    for (let i = 0; i < length; i++) {
      const sample = channelData[i] * AMPLIFY
      samples[i] = Math.max(-1, Math.min(1, sample)) * 0x7fff
    }
  } else {
    // 스테레오 유지
    const leftChannel = audioBuffer.getChannelData(0)
    const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel

    for (let i = 0; i < length; i++) {
      const l = leftChannel[i] * AMPLIFY
      const r = rightChannel[i] * AMPLIFY
      samples[i * 2] = Math.max(-1, Math.min(1, l)) * 0x7fff
      samples[i * 2 + 1] = Math.max(-1, Math.min(1, r)) * 0x7fff
    }
  }

  return samples
}

/**
 * 다중 채널 오디오를 모노로 믹싱
 */
function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const length = audioBuffer.length
  const monoData = new Float32Array(length)
  const numberOfChannels = audioBuffer.numberOfChannels

  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let channel = 0; channel < numberOfChannels; channel++) {
      sum += audioBuffer.getChannelData(channel)[i]
    }
    monoData[i] = sum / numberOfChannels
  }

  return monoData
}

/**
 * lamejs를 사용하여 오디오 데이터를 MP3로 인코딩
 */
function encodeToMp3(samples: Int16Array, config: Required<AudioCompressionConfig>): Int8Array[] {
  const mp3encoder = new lamejs.Mp3Encoder(config.channels, config.sampleRate, config.bitRate)
  const mp3Data: Int8Array[] = []
  const sampleBlockSize = 1152 // lamejs 권장 블록 크기

  // 블록별 인코딩
  for (let i = 0; i < samples.length; i += sampleBlockSize * config.channels) {
    let sampleChunk: Int16Array

    if (config.channels === 1) {
      // 모노
      sampleChunk = samples.subarray(i, i + sampleBlockSize)
      const mp3buf = mp3encoder.encodeBuffer(sampleChunk)
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf as any)
      }
    } else {
      // 스테레오
      const leftChunk = new Int16Array(sampleBlockSize)
      const rightChunk = new Int16Array(sampleBlockSize)

      for (let j = 0; j < sampleBlockSize && i + j * 2 + 1 < samples.length; j++) {
        leftChunk[j] = samples[i + j * 2]
        rightChunk[j] = samples[i + j * 2 + 1]
      }

      const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk)
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf as any)
      }
    }
  }

  // 인코딩 완료
  const mp3buf = mp3encoder.flush()
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf as any)
  }

  return mp3Data
}

/**
 * 오디오 파일의 기본 정보 가져오기
 */
export async function getAudioInfo(audioBuffer: ArrayBuffer): Promise<{
  duration: number
  sampleRate: number
  channels: number
  size: number
}> {
  const audioContext = new AudioContext()
  const decodedAudio = await audioContext.decodeAudioData(audioBuffer.slice())

  const info = {
    duration: decodedAudio.duration,
    sampleRate: decodedAudio.sampleRate,
    channels: decodedAudio.numberOfChannels,
    size: audioBuffer.byteLength
  }

  await audioContext.close()
  return info
}

/**
 * 압축비 계산
 */
export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  return Math.round((1 - compressedSize / originalSize) * 100)
}
