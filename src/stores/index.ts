import { createPersistedState } from 'pinia-plugin-persistedstate'
import { PiniaSharedState } from 'pinia-shared-state' // 탭 간 공유 저장소 상태

export const pinia = createPinia()
// 기본적으로 지속성 저장소 활성화
pinia
  .use(
    createPersistedState({
      auto: true
    })
  )
  .use(
    PiniaSharedState({
      // 모든 저장소에 대해 플러그인을 활성화합니다. 기본값은 true입니다.
      enable: false,
      // true로 설정하면 이 탭은 다른 탭에서 공유 상태를 즉시 복구하려고 시도합니다. 기본값은 true입니다.
      initialize: false,
      // 유형을 강제합니다. native, idb, localstorage, node 중 하나. 기본값은 localstorage입니다.
      // native는 브로드캐스트 통신을 위해 new BroadcastChannel을 사용합니다.
      type: 'native'
    })
  )
