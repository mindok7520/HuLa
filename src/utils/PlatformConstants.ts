import { type, version } from '@tauri-apps/plugin-os'

/**
 * 플랫폼 타입 열거형
 */
export type PlatformType = 'desktop' | 'mobile'

/**
 * 운영 체제 타입
 */
export type OSType = 'windows' | 'macos' | 'linux' | 'android' | 'ios'

/**
 * 플랫폼 감지 결과 - 애플리케이션 시작 시 한 번 실행, 전역 공유
 */
class PlatformDetector {
  private static _osType: OSType
  private static _platformType: PlatformType
  private static _osVersion: string | undefined
  private static _isWindows10 = false
  private static _initialized = false

  /**
   * 플랫폼 감지 초기화 (한 번만 실행)
   */
  static initialize(): void {
    if (PlatformDetector._initialized) return

    try {
      const detectedType = type()
      PlatformDetector._osType = PlatformDetector.normalizeOSType(detectedType)
      PlatformDetector._platformType = PlatformDetector.isDesktopOS(PlatformDetector._osType) ? 'desktop' : 'mobile'
      PlatformDetector._osVersion = PlatformDetector.detectVersion()
      PlatformDetector._isWindows10 =
        PlatformDetector._osType === 'windows' && PlatformDetector.isWindows10Version(PlatformDetector._osVersion)

      if (import.meta.env.DEV) {
        console.log(`Platform detected: ${PlatformDetector._osType} (${PlatformDetector._platformType})`)
      }
    } catch (error) {
      console.warn('Failed to detect platform type, defaulting to desktop:', error)
    }

    PlatformDetector._initialized = true
  }

  private static normalizeOSType(osType: string): OSType {
    switch (osType) {
      case 'windows':
        return 'windows'
      case 'macos':
        return 'macos'
      case 'linux':
        return 'linux'
      case 'android':
        return 'android'
      case 'ios':
        return 'ios'
      default:
        throw new Error(`Unsupported OS type: ${osType}`)
    }
  }

  private static isDesktopOS(osType: OSType): boolean {
    return osType === 'windows' || osType === 'linux' || osType === 'macos'
  }

  private static detectVersion(): string | undefined {
    try {
      return version()
    } catch (error) {
      console.warn('Failed to detect platform version:', error)
      return undefined
    }
  }

  private static isWindows10Version(osVersion?: string): boolean {
    if (!osVersion) return false
    const numbers = osVersion
      .match(/\d+/g)
      ?.map((num) => Number.parseInt(num, 10))
      .filter((num) => !Number.isNaN(num))
    if (!numbers || numbers.length === 0) return false
    const [major, minor, patch] = numbers
    const buildNumber = typeof patch === 'number' ? patch : typeof minor === 'number' ? minor : undefined
    return major === 10 && typeof buildNumber === 'number' && buildNumber < 22000
  }

  static get osType(): OSType {
    return PlatformDetector._osType
  }

  static get osVersion(): string | undefined {
    return PlatformDetector._osVersion
  }

  static get isWindows10(): boolean {
    return PlatformDetector._isWindows10
  }

  static get platformType(): PlatformType {
    return PlatformDetector._platformType
  }
}

export const initializePlatform = () => PlatformDetector.initialize()

/**
 * 운영 체제 타입 가져오기
 * @returns 'windows' | 'macos' | 'linux' | 'android' | 'ios'
 */
export const getOSType = (): OSType => PlatformDetector.osType

/**
 * 플랫폼 타입 가져오기
 * @returns 'desktop' | 'mobile'
 */
export const getPlatformType = (): PlatformType => PlatformDetector.platformType

/**
 * 시스템 버전 번호 가져오기
 */
export const getOSVersion = (): string | undefined => PlatformDetector.osVersion

/**
 * 데스크톱인지 여부
 */
export const isDesktop = (): boolean => PlatformDetector.platformType === 'desktop'

/**
 * 모바일인지 여부
 */
export const isMobile = (): boolean => PlatformDetector.platformType === 'mobile'

/**
 * Windows 시스템인지 여부
 */
export const isWindows = (): boolean => PlatformDetector.osType === 'windows'

/**
 * Windows 10인지 여부
 */
export const isWindows10 = (): boolean => PlatformDetector.isWindows10

/**
 * macOS 시스템인지 여부
 */
export const isMac = (): boolean => PlatformDetector.osType === 'macos'

/**
 * Linux 시스템인지 여부
 */
export const isLinux = (): boolean => PlatformDetector.osType === 'linux'

/**
 * Android 시스템인지 여부
 */
export const isAndroid = (): boolean => PlatformDetector.osType === 'android'

/**
 * iOS 시스템인지 여부
 */
export const isIOS = (): boolean => PlatformDetector.osType === 'ios'

/**
 * 호환 플랫폼인지 여부 (Windows 또는 Linux)
 */
export const isCompatibility = (): boolean => isWindows() || isLinux()

/**
 * 플랫폼 유틸리티 모음 - 모든 플랫폼 판단 함수 통합 내보내기
 */
export const Platform = {
  // 정보 가져오기
  getOSType,
  getPlatformType,
  getOSVersion,

  // 플랫폼 판단
  isDesktop,
  isMobile,

  // 시스템 판단
  isWindows,
  isWindows10,
  isMac,
  isLinux,
  isAndroid,
  isIOS,
  isCompatibility
} as const
