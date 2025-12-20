import { defineStore } from 'pinia'
import { ref } from 'vue'
import { StoresEnum } from '@/enums'
import type { SessionItem } from '@/services/types'

type UnreadCache = Record<string, number>
type CacheStore = Record<string, UnreadCache>
type LastReadActiveTimeCache = Record<string, Record<string, number>>

/**
 * 「계정 -> 세션 읽지 않음 수」의 로컬 캐시 관리 담당
 */
export const useSessionUnreadStore = defineStore(StoresEnum.SESSION_UNREAD, () => {
  // cacheStore 구조는 { [uid]: { [roomId]: unreadCount } }
  const cacheStore = ref<CacheStore>({})
  // lastReadActiveTime 구조는 { [uid]: { [roomId]: activeTime } }
  const lastReadActiveTimeStore = ref<LastReadActiveTimeCache>({})

  // 들어오는 읽지 않은 수에 대한 백업 처리, 음수나 NaN 방지
  const sanitizeCount = (count?: number) => {
    if (typeof count !== 'number' || Number.isNaN(count)) {
      return 0
    }
    return Math.max(0, Math.floor(count))
  }

  // uid에 따라 해당 세션의 읽지 않은 캐시를 가져옵니다. 없으면 빈 객체 초기화
  const ensureUserCache = (uid?: string): UnreadCache | null => {
    if (!uid) {
      return null
    }
    if (!cacheStore.value[uid]) {
      cacheStore.value[uid] = {}
    }
    return cacheStore.value[uid]
  }

  // uid에 따라 해당 읽음 활성 시간 캐시를 가져옵니다.
  const ensureLastReadCache = (uid?: string): Record<string, number> | null => {
    if (!uid) return null
    if (!lastReadActiveTimeStore.value[uid]) {
      lastReadActiveTimeStore.value[uid] = {}
    }
    return lastReadActiveTimeStore.value[uid]
  }

  /** 캐시의 읽지 않은 수를 세션 목록에 적용하고 누락된 캐시 보충 */
  const apply = (uid: string | undefined, sessions: SessionItem[]) => {
    if (!uid || sessions.length === 0) {
      return
    }
    const cache = ensureUserCache(uid)
    const lastReadCache = ensureLastReadCache(uid)
    if (!cache) {
      return
    }

    sessions.forEach((session) => {
      const activeTime = session.activeTime || 0
      const lastReadTime = lastReadCache?.[session.roomId] || 0
      const currentUnread = sanitizeCount(session.unreadCount)

      // 로컬에 기록된 마지막 읽음 활성 시간이 현재 세션 활성 시간보다 작지 않으면, 오래된 읽지 않은 것으로 간주하고 0으로 초기화
      if (lastReadTime > 0 && (activeTime === 0 || activeTime <= lastReadTime) && currentUnread > 0) {
        console.log('[SessionUnread][apply] lastRead로 인한 오래된 읽지 않음 정리', session.roomId, {
          activeTime,
          lastReadTime,
          serverUnread: currentUnread
        })
        session.unreadCount = 0
        cache[session.roomId] = 0
        return
      }

      const cached = cache[session.roomId]
      const serverCount = sanitizeCount(session.unreadCount)
      if (typeof cached === 'number') {
        const cachedCount = sanitizeCount(cached)
        const finalCount = Math.max(cachedCount, serverCount)
        if (session.unreadCount !== finalCount) {
          session.unreadCount = finalCount
        }
        if (cachedCount !== finalCount) {
          cache[session.roomId] = finalCount
        }
      } else {
        const finalCount = serverCount
        session.unreadCount = finalCount
        cache[session.roomId] = finalCount
      }
    })
  }

  /** 단일 세션의 읽지 않은 수를 업데이트하고 캐시 맵에 동기화 */
  const set = (uid: string | undefined, roomId: string, count: number) => {
    const cache = ensureUserCache(uid)
    if (!cache) {
      return
    }

    const normalized = sanitizeCount(count)
    if (cache[roomId] === normalized) {
      return
    }
    cache[roomId] = normalized
  }

  /** 특정 세션을 마지막으로 읽었을 때의 활성 시간 기록 */
  const setLastRead = (uid: string | undefined, roomId: string, activeTime: number) => {
    const cache = ensureLastReadCache(uid)
    if (!cache) return
    if (!activeTime) return
    cache[roomId] = Math.max(activeTime, cache[roomId] || 0)
  }

  /** 세션이 제거되거나 계정 전환 시 호출하여 특정 세션의 읽지 않은 캐시 삭제 */
  const remove = (uid: string | undefined, roomId: string) => {
    const cache = ensureUserCache(uid)
    const lastReadCache = ensureLastReadCache(uid)
    if (!cache || !(roomId in cache)) {
      return
    }
    delete cache[roomId]
    if (lastReadCache && roomId in lastReadCache) {
      delete lastReadCache[roomId]
    }
    if (Object.keys(cache).length === 0 && uid) {
      delete cacheStore.value[uid]
      delete lastReadActiveTimeStore.value[uid]
    }
  }

  return {
    cacheStore,
    lastReadActiveTimeStore,
    apply,
    set,
    setLastRead,
    remove
  }
})
