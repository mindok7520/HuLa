/**
 * 아바타 관련 작업을 처리하기 위한 유틸리티 클래스
 */
export class AvatarUtils {
  private static readonly DEFAULT_AVATAR_RANGE = {
    start: '001',
    end: '022'
  }

  private static readonly RANGE_START = parseInt(AvatarUtils.DEFAULT_AVATAR_RANGE.start, 10)
  private static readonly RANGE_END = parseInt(AvatarUtils.DEFAULT_AVATAR_RANGE.end, 10)

  /**
   * 아바타 문자열이 기본 아바타인지 확인 (001-022)
   * @param avatar - 확인할 아바타 문자열
   * @returns 기본 아바타인지 여부를 나타내는 불린값
   */
  public static isDefaultAvatar(avatar: string): boolean {
    // 빠른 판단: 비어있거나 길이가 3이 아니면 바로 false 반환
    if (!avatar || avatar.length !== 3) return false

    // 모두 숫자인지 확인
    const num = parseInt(avatar, 10)
    if (isNaN(num)) return false

    // 숫자 범위 확인 (001-021)
    return num >= AvatarUtils.RANGE_START && num <= AvatarUtils.RANGE_END
  }

  /**
   * 아바타 값에 따라 아바타 URL 가져오기
   * @param avatar - 아바타 문자열 또는 URL
   * @returns 아바타 문자열 또는 URL
   */
  public static getAvatarUrl(avatar: string): string {
    const DEFAULT = '/logoD.png'

    if (!avatar) return DEFAULT
    const rawAvatar = avatar.trim()
    if (AvatarUtils.isDefaultAvatar(rawAvatar)) {
      return `/avatar/${rawAvatar}.webp`
    }

    try {
      const parsed = new URL(avatar)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString()
      }
    } catch {
      // 자체 사전 설정 파일명인 경우 화이트리스트/정규식 검증 추가 가능
      if (/^[a-z0-9_-]+$/i.test(avatar)) {
        return `/avatar/${avatar}.webp`
      }
    }
    return DEFAULT
  }
}
