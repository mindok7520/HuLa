import 'uno.css'
import '@unocss/reset/eric-meyer.css' // unocss에서 제공하는 브라우저 기본 스타일 초기화
import TlbsMap from 'tlbs-map-vue'
import { setupI18n } from '@/services/i18n'
import { AppException } from '@/common/exception.ts'
import vResize from '@/directives/v-resize'
import vSlide from '@/directives/v-slide.ts'
import router from '@/router'
import { pinia } from '@/stores'
import { initializePlatform } from '@/utils/PlatformConstants'
import { startWebVitalObserver } from '@/utils/WebVitalsObserver'
import { invoke } from '@tauri-apps/api/core'
import { isMobile } from '@/utils/PlatformConstants'
import App from '@/App.vue'

initializePlatform()
startWebVitalObserver()
import('@/services/webSocketAdapter')

if (process.env.NODE_ENV === 'development') {
  import('@/utils/Console.ts').then((module) => {
    /**! 콘솔에 프로젝트 버전 정보 출력 (필요하지 않은 경우 수동으로 끌 수 있음)*/
    module.consolePrint()
  })
}

export const forceUpdateMessageTop = (topValue: number) => {
  // 조건에 맞는 모든 요소 가져오기
  const messages = document.querySelectorAll('.n-message-container.n-message-container--top')

  messages.forEach((el) => {
    const dom = el as HTMLElement
    dom.style.top = `${topValue}px`
  })
}

if (isMobile()) {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', setup)
  } else {
    setup()
  }
}

async function setup() {
  await invoke('set_complete', { task: 'frontend' })
}

const app = createApp(App)
app
  .use(router)
  .use(pinia)
  .use(TlbsMap)
  .use(setupI18n)
  .directive('resize', vResize)
  .directive('slide', vSlide)
  .mount('#app')
app.config.errorHandler = (err) => {
  if (err instanceof AppException) {
    window.$message.error(err.message)
    return
  }
  throw err
}
