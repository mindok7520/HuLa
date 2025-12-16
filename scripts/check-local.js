import chalk from 'chalk'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// src-tauri/configuration/local.yaml 설정 파일 확인 및 생성
const configDir = join(process.cwd(), 'src-tauri', 'configuration')
const localConfigPath = join(configDir, 'local.yaml')
const productionConfigPath = join(configDir, 'production.yaml')

try {
  if (existsSync(localConfigPath)) {
    console.log(chalk.green('✅ local.yaml이 이미 존재함, 생성 건너뜀'))
    process.exit(0)
  }

  let content = ''

  // 더 완전한 설정을 포함하고 있으므로 production.yaml을 템플릿으로 우선 사용
  if (existsSync(productionConfigPath)) {
    content = readFileSync(productionConfigPath, 'utf8')
    console.log(chalk.blue('📋 production.yaml을 템플릿으로 사용'))
  } else {
    console.log(chalk.red('❌ 설정 파일 템플릿을 찾을 수 없음'))
    process.exit(1)
  }

  writeFileSync(localConfigPath, content, 'utf8')
  console.log(chalk.green('✨ local.yaml 설정 파일 생성됨'))
} catch (error) {
  console.log(chalk.red('\n❌ local.yaml 파일 처리 실패:'), error.message)
  process.exit(1)
}
