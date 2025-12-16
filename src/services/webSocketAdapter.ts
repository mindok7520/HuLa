/**
 * WebSocket 어댑터
 *
 * 이 파일은 JavaScript WebSocket Worker와 Rust WebSocket 구현 간 전환을 위한 통합 인터페이스를 제공합니다.
 * 환경 변수 또는 구성을 통해 사용할 구현을 제어할 수 있습니다.
 */

import { info } from '@tauri-apps/plugin-log'

info('🦀 Rust WebSocket 구현 사용')
const webSocketService: any = import('./webSocketRust').then((module) => module.default)

export default webSocketService
