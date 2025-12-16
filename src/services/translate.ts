import { fetch } from '@tauri-apps/plugin-http'
import { AppException } from '@/common/exception.ts'
import { getSettings } from '@/services/tauriCommand'
import type { TranslateProvider } from './types.ts'

// 입력 매개변수, 번역 플랫폼
interface TranslateResult {
  text: string
  provider: string
}

interface BackendTranslateResponse {
  text: string
  provider: string
}

interface BackendTranslateSegmentsResponse {
  segments: string[]
  provider: string
}

/**
 * 일반 번역 (일회성 반환)
 * @param text 번역할 텍스트
 * @param provider 번역 제공업체 (기본값은 백엔드 구성을 읽으며, 전달되지 않은 경우 tencent)
 */
export const translateText = async (
  text: string,
  provider: TranslateProvider = 'tencent'
): Promise<TranslateResult> => {
  if (!text?.trim()) throw new AppException('번역할 텍스트는 비워둘 수 없습니다')
  const settings = await getSettings()
  const resp = await fetch(`${settings.backend.base_url}/system/anyTenant/translate/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, provider })
  })
  const json = (await resp.json()) as { code?: number; data?: BackendTranslateResponse; msg?: string }
  if (!json || json.code !== 200 || !json.data) throw new AppException(json?.msg || '번역 실패')
  return { text: json.data.text, provider: json.data.provider }
}

/**
 * 스트리밍 번역
 * 최종적으로 모든 세그먼트를 병합하여 전체 번역문 반환
 * @param onSegment 세그먼트 도착 시 콜백 (실시간 렌더링용)
 */
export const translateTextStream = async (
  text: string,
  provider: TranslateProvider = 'tencent',
  onSegment?: (seg: string) => void
): Promise<TranslateResult> => {
  if (!text?.trim()) throw new AppException('번역할 텍스트는 비워둘 수 없습니다')
  const settings = await getSettings()
  const url = `${settings.backend.base_url}/system/anyTenant/translate/stream?text=${encodeURIComponent(text)}&provider=${encodeURIComponent(provider)}`
  return new Promise<TranslateResult>((resolve, reject) => {
    let full = ''
    const es = new EventSource(url)
    es.addEventListener('segment', (ev: MessageEvent) => {
      const chunk = String(ev.data || '')
      full += chunk
      onSegment?.(chunk)
    })
    es.addEventListener('end', () => {
      es.close()
      resolve({ text: full, provider })
    })
    es.addEventListener('error', () => {
      es.close()
      reject(new AppException('스트리밍 번역 실패'))
    })
  })
}

/**
 * 세그먼트 배열 번역 (작성되었으나 당분간 호출되지 않음)
 * @param text 번역할 텍스트
 * @param provider 번역 제공업체 (기본값 tencent)
 */
export const translateTextSegments = async (
  text: string,
  provider: TranslateProvider = 'tencent'
): Promise<{ segments: string[]; provider: string }> => {
  if (!text?.trim()) throw new AppException('번역할 텍스트는 비워둘 수 없습니다')
  const settings = await getSettings()
  const resp = await fetch(`${settings.backend.base_url}/system/anyTenant/translate/segment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, provider })
  })
  const json = (await resp.json()) as { code?: number; data?: BackendTranslateSegmentsResponse; msg?: string }
  if (!json || json.code !== 200 || !json.data) throw new AppException(json?.msg || '번역 실패')
  return { segments: json.data.segments, provider: json.data.provider }
}
