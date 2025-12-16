import chalk from 'chalk'
import { execFileSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * 단일 검사 스크립트 실행
 * @param {string} scriptPath - 스크립트 경로
 * @param {string} description - 검사 설명
 */
async function runScript(scriptPath, description) {
  const startTime = performance.now()
  console.log(chalk.blue(`\n[HuLa ${new Date().toLocaleTimeString()}] ${description} 시작...\n`))

  try {
    execFileSync('node', [scriptPath], { stdio: 'inherit' })
    const duration = ((performance.now() - startTime) / 1000).toFixed(2)
    console.log(chalk.green(`\n✅ ${description} 완료 (${duration}s)\n`))
    return true
  } catch (_error) {
    console.error(chalk.red(`\n❌ ${description} 실패`))
    return false
  }
}

async function main() {
  console.log(chalk.cyan('HuLa에 필요한 환경 구성을 확인하는 중...\n'))

  /** @type {CheckItem[]} */
  const checks = [
    {
      script: join(__dirname, 'check-local.js'),
      description: '설정 파일 검사'
    },
    {
      script: join(__dirname, 'check-dependencies.js'),
      description: '환경 검사'
    }
  ]

  const startTime = performance.now()

  for (const check of checks) {
    const success = await runScript(check.script, check.description)
    if (!success) {
      console.error(chalk.red(`\n${check.description} 통과 실패, 검사 프로세스 종료\n`))
      process.exit(1)
    }
  }

  const totalDuration = ((performance.now() - startTime) / 1000).toFixed(2)
  console.log(chalk.green(`\n✨ 모든 검사 통과! 총 소요 시간: ${totalDuration}s\n`))
}

main().catch((error) => {
  console.error(chalk.red('\n검사 과정 중 오류 발생:'))
  console.error(chalk.yellow(error.stack || error))
  process.exit(1)
})
