/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** 백엔드 프로젝트 주소 */
  readonly VITE_SERVICE_URL: string
  /** 클라이언트 프로젝트 주소 */
  readonly VITE_PC_URL: string
  /** 프로젝트 이름 */
  readonly VITE_APP_NAME: string
  /** giteeToken */
  readonly VITE_GITEE_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import { defineComponent } from 'vue'
  const Component: ReturnType<typeof defineComponent>
  export default component
}
/** window.$message를 사용하여 Message 컴포넌트의 메서드를 호출합니다. TypeScript 컴파일러가 전역 변수 $message의 유형을 인식할 수 없으므로,
우리는 if (window.$message)를 사용하여 판단함으로써 유형 오류를 방지할 수 있습니다. */
declare interface Window {
  $message: ReturnType<typeof useMessage>
  $notification: ReturnType<typeof useNotification>
  $loadingBar: ReturnType<typeof useLoadingBar>
  $dialog: ReturnType<typeof useDialog>
  $modal: ReturnType<typeof useModal>
}
