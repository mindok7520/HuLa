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
  // 에러 메시지 표시 여부를 추적하기 위해 정적 플래그 사용
  private static hasShownError = false

  constructor(message: string, errorDetails?: Partial<ErrorDetails>) {
    super(message)
    this.name = 'AppException'
    this.type = errorDetails?.type || ErrorType.Unknown
    this.code = errorDetails?.code
    this.details = errorDetails?.details

    // 명시적으로 에러 표시가 지정된 경우에만 표시
    if (errorDetails?.showError && !AppException.hasShownError) {
      // 재시도 관련 에러인 경우 팝업 메시지 대신 console.log로 출력
      if (errorDetails?.isRetryError) {
        console.log('재시도 에러:', message, this.details)
      } else {
        window.$message.error(message)
        AppException.hasShownError = true

        // 2초 이내에 에러 메시지가 표시되지 않은 경우에만 표시
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
