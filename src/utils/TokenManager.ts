import { TauriCommand } from '@/enums'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'

/**
 * Token 관리 유틸리티 클래스
 * 애플리케이션 내의 토큰 정보 업데이트에 사용됨
 */
export class TokenManager {
  /**
   * 토큰 업데이트
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
          customErrorMessage: '토큰 업데이트 실패',
          showError: true
        }
      )
      console.log('토큰 업데이트 성공')
    } catch (error) {
      console.error('토큰 업데이트 실패:', error)
      throw error
    }
  }

  /**
   * 토큰 자동 업데이트(오류 메시지 미표시)
   * @param token 새로운 액세스 토큰
   * @param refreshToken 새로운 리프레시 토큰
   * @returns Promise<boolean> 성공 시 true, 실패 시 false 반환
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
      console.error('토큰 자동 업데이트 실패:', error)
      return false
    }
  }
}

/**
 * 토큰 업데이트를 위한 편의 함수
 * @param token 새로운 액세스 토큰
 * @param refreshToken 새로운 리프레시 토큰
 */
export const updateToken = TokenManager.updateToken

/**
 * 토큰 자동 업데이트를 위한 편의 함수
 * @param token 새로운 액세스 토큰
 * @param refreshToken 새로운 리프레시 토큰
 */
export const updateTokenSilently = TokenManager.updateTokenSilently
