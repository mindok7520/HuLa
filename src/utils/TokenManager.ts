import { TauriCommand } from '@/enums'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'

/**
 * Token 관리 유틸리티 클래스
 * 애플리케이션의 token 정보를 업데이트하는 데 사용
 */
export class TokenManager {
  /**
   * token 업데이트
   * @param token 새로운 액세스 토큰
   * @param refreshToken 새로운 리프레시 토큰
   * @returns Promise<void>
   */
  static async updateToken(token: string, refreshToken: string): Promise<void> {
    try {
      await invokeWithErrorHandler(
        TauriCommand.UPDATE_TOKEN,
        {
          token,
          refresh_token: refreshToken
        },
        {
          customErrorMessage: 'token 업데이트 실패',
          showError: true
        }
      )
      console.log('Token 업데이트 성공')
    } catch (error) {
      console.error('Token 업데이트 실패:', error)
      throw error
    }
  }

  /**
   * 조용히 token 업데이트 (오류 메시지를 표시하지 않음)
   * @param token 새로운 액세스 토큰
   * @param refreshToken 새로운 리프레시 토큰
   * @returns Promise<boolean> 성공하면 true, 실패하면 false 반환
   */
  static async updateTokenSilently(token: string, refreshToken: string): Promise<boolean> {
    try {
      await invokeWithErrorHandler(
        TauriCommand.UPDATE_TOKEN,
        {
          tokenInfo: {
            token,
            refreshToken
          }
        },
        {
          showError: false
        }
      )
      return true
    } catch (error) {
      console.error('조용히 token 업데이트 실패:', error)
      return false
    }
  }
}

/**
 * token 업데이트를 위한 편리 함수
 * @param token 새로운 액세스 토큰
 * @param refreshToken 새로운 리프레시 토큰
 */
export const updateToken = TokenManager.updateToken

/**
 * 조용히 token 업데이트를 위한 편리 함수
 * @param token 새로운 액세스 토큰
 * @param refreshToken 새로운 리프레시 토큰
 */
export const updateTokenSilently = TokenManager.updateTokenSilently
