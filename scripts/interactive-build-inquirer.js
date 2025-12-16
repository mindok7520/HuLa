#!/usr/bin/env node

import { select } from '@inquirer/prompts'
import { spawn } from 'child_process'
import os from 'os'

// 현재 플랫폼 감지
function getCurrentPlatform() {
  const platform = os.platform()
  switch (platform) {
    case 'darwin':
      return { platform: 'macos', name: 'macOS' }
    case 'win32':
      return { platform: 'windows', name: 'Windows' }
    case 'linux':
      return { platform: 'linux', name: 'Linux' }
    default:
      return { platform: 'unknown', name: '알 수 없는 플랫폼' }
  }
}

// 플랫폼 선택 옵션 가져오기
function getPlatformOptions() {
  const currentPlatform = getCurrentPlatform()

  // 현재 운영체제에 따라 지원되는 플랫폼 정의
  const supportedPlatforms = {
    macos: ['macos', 'ios', 'android'], // macOS, iOS, Android 패키징 가능
    windows: ['windows', 'android'], // Windows, Android 패키징 가능
    linux: ['linux', 'android'] // Linux, Android 패키징 가능
  }

  const allPlatforms = [
    {
      name: `MacOS${currentPlatform.platform === 'macos' ? ' (현재 플랫폼)' : ''}`,
      value: 'macos',
      description: 'macOS 앱 패키징',
      isCurrent: currentPlatform.platform === 'macos'
    },
    {
      name: `Windows${currentPlatform.platform === 'windows' ? ' (현재 플랫폼)' : ''}`,
      value: 'windows',
      description: 'Windows 앱 패키징',
      isCurrent: currentPlatform.platform === 'windows'
    },
    {
      name: `Linux${currentPlatform.platform === 'linux' ? ' (현재 플랫폼)' : ''}`,
      value: 'linux',
      description: 'Linux 앱 패키징',
      isCurrent: currentPlatform.platform === 'linux'
    },
    {
      name: 'Android',
      value: 'android',
      description: 'Android APK 패키징',
      isCurrent: false
    },
    {
      name: 'IOS',
      value: 'ios',
      description: 'IOS 앱 패키징',
      isCurrent: false
    },
    {
      name: '취소',
      value: 'cancel',
      description: '패키징 종료',
      isCurrent: false
    }
  ]

  // 현재 시스템이 지원하는 플랫폼 목록 가져오기
  const supported = supportedPlatforms[currentPlatform.platform] || []

  // 지원되는 플랫폼 필터링, 취소 옵션 유지
  const platforms = allPlatforms.filter((platform) => supported.includes(platform.value) || platform.value === 'cancel')

  // 현재 플랫폼을 첫 번째로 정렬
  return platforms.sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1
    if (!a.isCurrent && b.isCurrent) return 1
    return 0
  })
}

// 패키지 형식 옵션 가져오기
function getBundleOptions(platform) {
  switch (platform) {
    case 'macos':
      return [
        {
          name: '📦  dmg 디스크 이미지',
          value: 'dmg',
          description: '.dmg 설치 패키지 생성 (권장)',
          command: 'tauri build --bundles dmg'
        },
        {
          name: '📁  app 애플리케이션 패키지',
          value: 'app',
          description: '.app 애플리케이션 패키지 생성',
          command: 'tauri build --bundles app'
        },
        {
          name: '📦  모든 형식',
          value: 'all',
          description: '지원되는 모든 형식 생성 (.app, .dmg)',
          command: 'tauri build'
        },
        {
          name: '🔙  이전 단계로 돌아가기',
          value: 'back',
          description: '플랫폼 선택으로 돌아가기',
          command: null
        }
      ]

    case 'windows':
      return [
        {
          name: '📦  msi 설치 패키지',
          value: 'msi',
          description: '.msi 설치 패키지 생성 (권장)',
          command: 'tauri build --bundles msi'
        },
        {
          name: '📦  nsis 설치 프로그램',
          value: 'nsis',
          description: 'NSIS 설치 프로그램 생성',
          command: 'tauri build --bundles nsis'
        },
        {
          name: '📦  모든 형식',
          value: 'all',
          description: '지원되는 모든 형식 생성',
          command: 'tauri build'
        },
        {
          name: '🔙  이전 단계로 돌아가기',
          value: 'back',
          description: '플랫폼 선택으로 돌아가기',
          command: null
        }
      ]

    case 'linux':
      return [
        {
          name: '📦  deb 소프트웨어 패키지',
          value: 'deb',
          description: '.deb 소프트웨어 패키지 생성 (Ubuntu/Debian)',
          command: 'tauri build --bundles deb'
        },
        {
          name: '📁  AppImage',
          value: 'appimage',
          description: '.AppImage 휴대용 애플리케이션 생성',
          command: 'tauri build --bundles appimage'
        },
        {
          name: '📦  rpm 소프트웨어 패키지',
          value: 'rpm',
          description: '.rpm 소프트웨어 패키지 생성 (RedHat/CentOS)',
          command: 'tauri build --bundles rpm'
        },
        {
          name: '📦  모든 형식',
          value: 'all',
          description: '지원되는 모든 형식 생성',
          command: 'tauri build'
        },
        {
          name: '🔙  이전 단계로 돌아가기',
          value: 'back',
          description: '플랫폼 선택으로 돌아가기',
          command: null
        }
      ]

    case 'android':
      return [
        {
          name: '📱  apk 설치 패키지',
          value: 'apk',
          description: 'Android APK 설치 패키지 생성',
          command: 'tauri android build'
        },
        {
          name: '🔙  이전 단계로 돌아가기',
          value: 'back',
          description: '플랫폼 선택으로 돌아가기',
          command: null
        }
      ]

    case 'ios':
      return [
        {
          name: '📱  IOS 애플리케이션',
          value: 'ios',
          description: 'IOS 애플리케이션 패키지 생성',
          command: 'tauri ios build --export-method app-store-connect'
        },
        {
          name: '🔙  이전 단계로 돌아가기',
          value: 'back',
          description: '플랫폼 선택으로 돌아가기',
          command: null
        }
      ]

    default:
      return []
  }
}

// 디버그 모드 옵션 가져오기
function getDebugOptions() {
  return [
    {
      name: '🚀  정식 버전',
      value: 'release',
      description: '정식 버전 생성',
      isDebug: false
    },
    {
      name: '🔧  디버그 버전',
      value: 'debug',
      description: '디버그 버전 생성 (콘솔 팝업 가능)',
      isDebug: true
    },
    {
      name: '🔙  이전 단계로 돌아가기',
      value: 'back',
      description: '패키지 형식 선택으로 돌아가기',
      isDebug: null
    }
  ]
}

// 패키징 명령어 실행
async function executeBuild(command, isDebug = false) {
  // 디버그 모드인 경우 --debug 매개변수 추가
  const finalCommand = isDebug ? `${command} --debug` : command
  const [cmd, ...args] = finalCommand.split(' ')

  const child = spawn(cmd, args, {
    stdio: 'inherit', // 부모 프로세스의 stdio를 직접 상속하여 색상 출력 유지
    shell: true
  })

  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        console.log('\n🎉 패키징 완료')
        resolve(code)
      } else {
        console.log(`\n❌ 패키징 실패, 종료 코드: ${code}`)
        resolve(code)
      }
    })

    child.on('error', (error) => {
      console.error(`\n❌ 실행 오류: ${error.message}`)
      reject(error)
    })
  })
}

// 플랫폼 선택 함수
async function selectPlatform() {
  const platformOptions = getPlatformOptions()

  const selectedPlatform = await select({
    message: '패키징할 플랫폼을 선택하세요:',
    choices: platformOptions.map((option) => ({
      name: option.name,
      value: option.value,
      description: `\x1b[90m${option.description}\x1b[0m`
    })),
    pageSize: 8,
    loop: false
  })

  if (selectedPlatform === 'cancel') {
    console.log('\n👋 패키징 취소됨')
    process.exit(0)
  }

  return { selectedPlatform, platformOptions }
}

// 디버그 모드 선택 함수
async function selectDebugMode() {
  const debugOptions = getDebugOptions()

  const selectedDebug = await select({
    message: '3단계: 버전 유형을 선택하세요:',
    choices: debugOptions.map((option) => ({
      name: option.name,
      value: option.value,
      description: `\x1b[90m${option.description}\x1b[0m`
    })),
    pageSize: 4,
    loop: false
  })

  if (selectedDebug === 'back') {
    return 'back'
  }

  const selectedOption = debugOptions.find((option) => option.value === selectedDebug)
  return selectedOption.isDebug
}

// 패키지 형식 선택 함수
async function selectBundle(selectedPlatform) {
  const bundleOptions = getBundleOptions(selectedPlatform)

  if (bundleOptions.length === 0) {
    console.log('\n❌ 해당 플랫폼은 아직 지원되지 않습니다')
    return 'back' // 플랫폼 선택으로 돌아가기
  }

  const selectedBundle = await select({
    message: `${selectedPlatform}의 패키징 형식을 선택하세요:`,
    choices: bundleOptions.map((option) => ({
      name: option.name,
      value: option.value,
      description: `\x1b[90m${option.description}\x1b[0m`
    })),
    pageSize: 6,
    loop: false
  })

  if (selectedBundle === 'back') {
    return 'back' // 이전 단계로 돌아가기
  }

  // 선택된 옵션 찾기
  const selectedOption = bundleOptions.find((option) => option.value === selectedBundle)

  if (!selectedOption || !selectedOption.command) {
    console.log('\n👋 패키징 작업 취소됨')
    process.exit(0)
  }

  return selectedOption
}

async function main() {
  try {
    // 메인 루프
    while (true) {
      // 1단계: 플랫폼 선택
      const { selectedPlatform } = await selectPlatform()

      // 2단계: 패키지 형식 선택
      while (true) {
        const bundleResult = await selectBundle(selectedPlatform)

        // 'back' 반환 시 플랫폼 선택으로 돌아가기
        if (bundleResult === 'back') {
          break
        }

        // 모바일 플랫폼(iOS 및 Android)은 정식 버전을 직접 패키징하며 디버그 모드를 선택할 필요가 없음
        const isMobilePlatform = selectedPlatform === 'ios' || selectedPlatform === 'android'

        if (isMobilePlatform) {
          const exitCode = await executeBuild(bundleResult.command, false)
          process.exit(exitCode)
        } else {
          // 데스크톱 플랫폼은 디버그 모드 선택 필요
          // 3단계: 디버그 모드 선택
          while (true) {
            const debugResult = await selectDebugMode()

            // 'back' 반환 시 패키지 형식 선택으로 돌아가기
            if (debugResult === 'back') {
              break
            }

            const exitCode = await executeBuild(bundleResult.command, debugResult)
            process.exit(exitCode)
          }
        }
      }
    }
  } catch (error) {
    if (error.name === 'ExitPromptError') {
      // 사용자가 Ctrl+C를 누름
      console.log('\n👋 작업 취소됨')
      process.exit(0)
    } else {
      console.error('오류 발생:', error)
      process.exit(1)
    }
  }
}

main()
