import { invoke } from '@tauri-apps/api/core'
import { AppException, ErrorType } from '@/common/exception'

/**
 * Tauri invoke 호출을 위한 통합 오류 처리 래퍼
 * @param command Tauri 명령 이름
 * @param args 명령 매개변수
 * @param options 오류 처리 옵션
 * @returns Promise<T>
 */
export async function invokeWithErrorHandler<T = any>(
  command: string,
  args?: Record<string, any>,
  options?: {
    /** 오류 메시지 표시 여부, 기본값은 true */
    showError?: boolean
    /** 사용자 정의 오류 메시지 */
    customErrorMessage?: string
    /** 재시도 관련 오류 여부, 기본값은 false */
    isRetryError?: boolean
    /** 오류 유형, 기본값은 Unknown */
    errorType?: ErrorType
  }
): Promise<T> {
  const { showError = true, customErrorMessage, isRetryError = false, errorType = ErrorType.Unknown } = options || {}

  try {
    const result = await invoke<T>(command, args)
    return result
  } catch (error) {
    console.error(`[Tauri Invoke Error] 명령: ${command}`, error)

    // 오류 메시지 구성
    let errorMessage = customErrorMessage
    if (!errorMessage) {
      if (typeof error === 'string') {
        errorMessage = error
      } else if (error instanceof Error) {
        errorMessage = error.message
      } else {
        errorMessage = `${command} 명령 호출 실패`
      }
    }

    // AppException을 사용하여 오류를 통합 처리
    throw new AppException(errorMessage, {
      type: errorType,
      showError,
      isRetryError,
      details: {
        command,
        args,
        originalError: error
      }
    })
  }
}

/**
 * Tauri 명령 자동 호출 (오류 메시지 미표시)
 * @param command Tauri 명령 이름
 * @param args 명령 매개변수
 * @returns Promise<T | null> 성공 시 결과 반환, 실패 시 null 반환
 */
export async function invokeSilently<T = any>(command: string, args?: Record<string, any>): Promise<T | null> {
  try {
    return await invokeWithErrorHandler<T>(command, args, { showError: false })
  } catch {
    return null
  }
}

/**
 * 재시도 메커니즘을 포함한 Tauri 호출
 * @param command Tauri 명령 이름
 * @param args 명령 매개변수
 * @param options 재시도 옵션
 * @returns Promise<T>
 */
export async function invokeWithRetry<T = any>(
  command: string,
  args?: Record<string, any>,
  options?: {
    /** 최대 재시도 횟수, 기본값은 3 */
    maxRetries?: number
    /** 재시도 간격(밀리초), 기본값은 1000 */
    retryDelay?: number
    /** 오류 메시지 표시 여부, 기본값은 true */
    showError?: boolean
    /** 사용자 정의 오류 메시지 */
    customErrorMessage?: string
  }
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000, showError = true, customErrorMessage } = options || {}

  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await invokeWithErrorHandler<T>(command, args, {
        showError: attempt === maxRetries ? showError : false,
        customErrorMessage: attempt === maxRetries ? customErrorMessage : undefined,
        isRetryError: attempt < maxRetries,
        errorType: ErrorType.Network
      })
    } catch (error) {
      lastError = error

      if (attempt < maxRetries) {
        console.log(`${command} 명령 재시도 중 (${attempt}/${maxRetries})...`)
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
      }
    }
  }

  throw lastError
}

export { ErrorType }
