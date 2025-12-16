import chalk from 'chalk'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { platform } from 'os'

// 환경 설치 가이드
const INSTALL_GUIDES = {
  'Node.js': 'https://nodejs.org/zh-cn/download/',
  pnpm: 'https://pnpm.io/zh/installation',
  Rust: 'https://www.rust-lang.org/tools/install',
  'WebView2 Runtime': 'https://developer.microsoft.com/microsoft-edge/webview2/'
}

// 업데이트 가이드
const UPDATE_GUIDES = {
  Rust: '`rustup update` 명령어를 실행하여 Rust 버전을 업데이트하세요'
}

// Windows 특정 검사 경로
const WINDOWS_PATHS = {
  'WebView2 Runtime': [
    'C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application',
    'C:\\Program Files\\Microsoft\\EdgeWebView\\Application',
    'C:\\Windows\\SystemApps\\Microsoft.Win32WebViewHost_cw5n1h2txyewy'
  ]
}

// 오류 메시지 매핑
const ERROR_MESSAGES = {
  ENOENT: '명령어를 찾을 수 없음',
  EPERM: '권한 부족',
  EACCES: '접근 거부됨'
}

const checks = [
  {
    name: 'Node.js',
    command: 'node --version',
    versionExtractor: (output) => output.replace('v', ''),
    minVersion: '^20.19.0 || >=22.12.0',
    isRequired: true
  },
  {
    name: 'pnpm',
    command: 'pnpm --version',
    versionExtractor: (output) => output.trim(),
    minVersion: '10.0.0',
    isRequired: true
  },
  {
    name: 'Rust',
    command: 'rustc --version',
    versionExtractor: (output) => output.split(' ')[1],
    minVersion: '1.88.0',
    isRequired: true
  }
]

/**
 * WebView2 설치 여부 확인
 * @returns {boolean}
 */
const checkWebView2 = () => {
  try {
    // 레지스트리 확인
    const regQuery =
      'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv'
    execSync(regQuery, { stdio: 'ignore' })
    return true
  } catch {
    // 레지스트리 조회 실패 시 파일 경로 확인
    return WINDOWS_PATHS['WebView2 Runtime'].some((path) => existsSync(path))
  }
}

// Windows 특정 검사
const windowsChecks = [
  {
    name: 'WebView2 Runtime',
    checkInstalled: checkWebView2,
    isRequired: true
  }
]

/**
 * 친절한 오류 메시지 가져오기
 * @param {Error} error 오류 객체
 * @returns {string} 오류 힌트
 */
const getFriendlyErrorMessage = (error) => {
  const code = error.code || ''
  return ERROR_MESSAGES[code] || error.message || '알 수 없는 오류'
}

/**
 * 버전 번호 비교
 * @param {string} version1 현재 버전
 * @param {string} version2 필요 버전
 * @returns {number} 1: version1 큼, -1: version2 큼, 0: 같음
 */
const compareVersions = (version1, version2) => {
  const v1 = version1.replace(/[^0-9.]/g, '').split('.')
  const v2 = version2.replace(/[^0-9.]/g, '').split('.')

  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = parseInt(v1[i] || '0', 10)
    const num2 = parseInt(v2[i] || '0', 10)
    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }
  return 0
}

/**
 * 버전이 ^ 범위를 만족하는지 확인 (메이저 버전 동일, 마이너 및 패치 버전은 더 높을 수 있음)
 * @param {string} version 현재 버전
 * @param {string} requiredVersion 요구 버전
 * @returns {boolean}
 */
const satisfiesCaretRange = (version, requiredVersion) => {
  const [vMajor, vMinor, vPatch] = version.split('.').map(Number)
  const [rMajor, rMinor, rPatch] = requiredVersion.split('.').map(Number)

  // 메이저 버전은 반드시 같아야 함
  if (vMajor !== rMajor) return false

  // 마이너 및 패치 버전은 요구 버전보다 >= 이어야 함
  if (vMinor > rMinor) return true
  if (vMinor < rMinor) return false
  return vPatch >= rPatch
}

/**
 * 버전이 범위 요구 사항을 만족하는지 확인 (||, ^, >= 구문 지원)
 * @param {string} version 현재 버전
 * @param {string} range 버전 범위 (예: '^20.19.0 || >=22.12.0')
 * @returns {boolean}
 */
const satisfiesVersionRange = (version, range) => {
  // || 로 구분된 여러 조건 처리
  const conditions = range.split('||').map((s) => s.trim())

  // 하나의 조건이라도 만족하면 됨
  return conditions.some((condition) => {
    if (condition.startsWith('^')) {
      // ^ 구문 처리: 메이저 버전 동일, 마이너 및 패치 버전은 더 높을 수 있음
      const requiredVersion = condition.slice(1).trim()
      return satisfiesCaretRange(version, requiredVersion)
    } else if (condition.startsWith('>=')) {
      // >= 구문 처리
      const requiredVersion = condition.slice(2).trim()
      return compareVersions(version, requiredVersion) >= 0
    }
    // 기본적으로 >= 비교 사용
    return compareVersions(version, condition) >= 0
  })
}

function checkDependency(check) {
  try {
    const output = execSync(check.command).toString().trim()
    const version = check.versionExtractor(output)

    // 버전 유효성 판단
    let isVersionValid
    if (check.minVersion.includes('||') || check.minVersion.startsWith('^')) {
      // || 또는 ^ 포함 시 새로운 버전 범위 판단 로직 사용
      isVersionValid = satisfiesVersionRange(version, check.minVersion)
    } else {
      // 그렇지 않으면 간단한 버전 비교 사용
      isVersionValid = compareVersions(version, check.minVersion) >= 0
    }

    if (isVersionValid) {
      console.log(chalk.green(`✅ ${check.name} 버전 ${output} 설치됨\n`))
      return true
    } else {
      console.log(chalk.yellow(`⚠️ ${check.name} 버전이 너무 낮음`))
      console.log(chalk.yellow(`  현재 버전: ${output}`))
      console.log(chalk.yellow(`  필요 버전: ${check.minVersion}`))

      // Rust에 대한 특수 처리, rustup update 사용 힌트
      if (check.name === 'Rust') {
        console.log(chalk.yellow(`  ${UPDATE_GUIDES[check.name]}`))
      }

      console.log(chalk.gray(`  👉 업그레이드 가이드: ${INSTALL_GUIDES[check.name]}`))
      return false
    }
  } catch (error) {
    const errorMessage = getFriendlyErrorMessage(error)
    console.log(chalk.red(`❌ ${check.name} 설치되지 않음`))
    console.log(chalk.red(`  원인: ${errorMessage}`))
    console.log(chalk.gray(`  👉 설치 가이드: ${INSTALL_GUIDES[check.name]}`))
    return false
  }
}

/**
 * Windows 특정 의존성 확인
 * @param {Object} check 검사 항목
 * @returns {boolean} 검사 통과 여부
 */
function checkWindowsDependency(check) {
  try {
    const isInstalled = check.checkInstalled()
    if (isInstalled) {
      console.log(chalk.green(`✅ ${check.name} 설치됨`))
      return true
    } else {
      console.log(chalk.red(`❌ ${check.name} 설치되지 않음`))
      console.log(chalk.gray(`  👉 설치 가이드: ${INSTALL_GUIDES[check.name]}`))
      return false
    }
  } catch (error) {
    const errorMessage = getFriendlyErrorMessage(error)
    console.log(chalk.red(`❌ ${check.name} 검사 실패`))
    console.log(chalk.red(`  원인: ${errorMessage}`))
    return false
  }
}

function main() {
  const isWindows = platform() === 'win32'

  // 기본 검사 실행
  const results = checks.map(checkDependency)

  // Windows에서 추가 검사 실행
  if (isWindows) {
    console.log(chalk.blue(`\n[HuLa ${new Date().toLocaleTimeString()}] Windows 개발 환경을 확인하는 중...\n`))
    const windowsResults = windowsChecks.map(checkWindowsDependency)
    results.push(...windowsResults)
  }

  if (results.every(Boolean)) {
    console.log(chalk.green('\n✅ 모든 환경 검사 통과!'))
    process.exit(0)
  } else {
    console.log(chalk.red('\n❌ 환경 의존성 검사 실패, 위 힌트에 따라 의존성을 설치하거나 업데이트하세요.'))
    process.exit(1)
  }
}

main()
