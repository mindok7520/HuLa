import { ref } from 'vue'
import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'

export const useInitialSyncStore = defineStore(StoresEnum.INITIAL_SYNC, () => {
  const syncedUsers = ref<string[]>([])

  /** 지정된 uid가 초기화 동기화를 완료했는지 확인 */
  const isSynced = (uid: string) => {
    if (!uid) {
      return false
    }
    return syncedUsers.value.includes(uid)
  }

  /** 지정된 uid가 초기화 동기화를 완료했음을 표시 */
  const markSynced = (uid: string) => {
    if (!uid) {
      return
    }
    if (!syncedUsers.value.includes(uid)) {
      syncedUsers.value = [...syncedUsers.value, uid]
    }
  }

  return {
    syncedUsers,
    isSynced,
    markSynced
  }
})
