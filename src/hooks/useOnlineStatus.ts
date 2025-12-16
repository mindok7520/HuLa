import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { OnlineEnum } from '@/enums'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { useUserStatusStore } from '@/stores/userStatus'

// 온라인 상태 관리(온라인 및 오프라인만 해당)
export const useOnlineStatus = (uid?: ComputedRef<string | undefined> | Ref<string | undefined>) => {
  const { t } = useI18n()
  const userStore = useUserStore()
  const groupStore = useGroupStore()
  const userStatusStore = useUserStatusStore()
  const { currentState } = storeToRefs(userStatusStore)

  // uid 매개변수가 전달되면 해당 uid에 해당하는 사용자 정보를 사용하고, 그렇지 않으면 현재 로그인한 사용자 정보를 사용
  const currentUser = uid
    ? computed(() => (uid.value ? groupStore.getUserInfo(uid.value) : undefined))
    : computed(() => {
      // uid가 전달되지 않은 경우 groupStore에서 현재 사용자 정보를 가져와 activeStatus 획득
      const currentUid = userStore.userInfo?.uid
      return currentUid ? groupStore.getUserInfo(currentUid) : undefined
    })

  // userStateId는 userStore에서 우선적으로 가져오고(반응형 업데이트 보장), 없으면 currentUser에서 가져옴
  const userStateId = uid
    ? computed(() => currentUser.value?.userStateId)
    : computed(() => userStore.userInfo?.userStateId)

  const activeStatus = computed(() => currentUser.value?.activeStatus ?? OnlineEnum.OFFLINE)

  const hasCustomState = computed(() => {
    const stateId = userStateId.value
    // '0'은 상태 지우기(사용자 정의 상태 없음)를 나타내며, 그 외에는 모두 사용자 정의 상태임
    return !!stateId && stateId !== '0'
  })

  // 사용자 상태 정보 가져오기
  const userStatus = computed(() => {
    if (!userStateId.value) return null
    return userStatusStore.stateList.find((state: { id: string }) => state.id === userStateId.value)
  })

  const isOnline = computed(() => activeStatus.value === OnlineEnum.ONLINE)

  const statusIcon = computed(() => {
    if (hasCustomState.value && userStatus.value?.url) {
      return userStatus.value.url
    }
    return isOnline.value ? '/status/online.png' : '/status/offline.png'
  })

  const statusTitle = computed(() => {
    if (hasCustomState.value && userStatus.value?.title) {
      const key = `auth.onlineStatus.states.${userStatus.value.title}`
      const translated = t(key)
      return translated === key ? userStatus.value.title : translated
    }
    return isOnline.value ? t('home.profile_card.status.online') : t('home.profile_card.status.offline')
  })

  const statusBgColor = computed(() => {
    if (hasCustomState.value && userStatus.value?.bgColor) {
      return userStatus.value.bgColor
    }
    return isOnline.value ? 'rgba(26, 178, 146, 0.4)' : 'rgba(144, 144, 144, 0.4)'
  })

  return {
    currentState,
    activeStatus,
    statusIcon,
    statusTitle,
    statusBgColor,
    isOnline,
    hasCustomState,
    userStatus
  }
}
