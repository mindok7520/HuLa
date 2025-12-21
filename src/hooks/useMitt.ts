import type { Emitter, Handler } from 'mitt'
import mitt from 'mitt'
import type { MittEnum } from '@/enums'

const mittInstance: Emitter<any> = mitt()

export const useMitt = {
  on: (event: MittEnum | string, handler: Handler<any>) => {
    mittInstance.on(event, handler)
    // 유효한 반응형 범위 내에 있을 때만 정리 등록
    if (getCurrentScope()) {
      onUnmounted(() => {
        mittInstance.off(event, handler)
      })
    }
  },
  emit: (event: MittEnum | string, data?: any) => {
    mittInstance.emit(event, data)
  },
  off: (event: MittEnum | string, handler: Handler<any>) => {
    mittInstance.off(event, handler)
  }
}
