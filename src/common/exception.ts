export enum ErrorType {
  Network = 'Network',
  Server = 'Server',
  Client = 'Client',
  Validation = 'Validation',
  Authentication = 'Authentication',
  Unknown = 'Unknown',
  TokenExpired = 'TokenExpired',
  TokenInvalid = 'TokenInvalid'
}

export interface ErrorDetails {
  type: ErrorType
  code?: number
  details?: Record<string, any>
  showError?: boolean
  isRetryError?: boolean
}

export class AppException extends Error {
  public readonly type: ErrorType
  public readonly code?: number
  public readonly details?: Record<string, any>
  // 정적 플래그를 사용하여 오류 메시지가 이미 표시되었는지 추적
  private static hasShownError = false

  constructor(message: string, errorDetails?: Partial<ErrorDetails>) {
    super(message)
    this.name = 'AppException'
    this.type = errorDetails?.type || ErrorType.Unknown
    this.code = errorDetails?.code
    this.details = errorDetails?.details

    // 오류 표시가 명시적으로 지정된 경우에만 표시
    if (errorDetails?.showError && !AppException.hasShownError) {
      // 재시도 관련 오류인 경우 팝업 대신 console.log를 사용하여 출력
      if (errorDetails?.isRetryError) {
        console.log('재시도 오류:', message, this.details)
      } else {
        window.$message.error(message)
        AppException.hasShownError = true

        // 2초 내에 오류 메시지가 표시되지 않은 경우에만 표시
        setTimeout(() => {
          AppException.hasShownError = false
        }, 2000)
      }
    }
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      code: this.code,
      details: this.details
    }
  }
}
