import { info } from '@tauri-apps/plugin-log'
import { useTimeoutFn } from '@vueuse/core'
import { IsYesEnum, MittEnum, ThemeEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import { useWindow } from '@/hooks/useWindow.ts'
import router from '@/router'
import type { BadgeType, UserInfoType } from '@/services/types.ts'
import { useGroupStore } from '@/stores/group'
import { useLoginHistoriesStore } from '@/stores/loginHistory.ts'
import { useMenuTopStore } from '@/stores/menuTop.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { useUserStore } from '@/stores/user.ts'
import { useUserStatusStore } from '@/stores/userStatus.ts'
import { ModifyUserInfo, setUserBadge } from '@/utils/ImRequestUtils'
import { storeToRefs } from 'pinia'

export const leftHook = () => {
  const prefers = matchMedia('(prefers-color-scheme: dark)')
  const { createWebviewWindow } = useWindow()
  const settingStore = useSettingStore()
  const { menuTop } = storeToRefs(useMenuTopStore())
  const loginHistoriesStore = useLoginHistoriesStore()
  const userStore = useUserStore()
  const { themes } = settingStore
  const userStatusStore = useUserStatusStore()
  const { currentState } = storeToRefs(userStatusStore)
  const activeUrl = ref<string>(menuTop.value?.[0]?.url || 'message')
  const settingShow = ref(false)
  const shrinkStatus = ref(false)
  const groupStore = useGroupStore()
  /** 개인 정보 부동 창 표시 여부 */
  const infoShow = ref(false)
  /** 상단 작업 표시줄의 팁 표시 여부 */
  const tipShow = ref(true)
  const themeColor = ref(themes.content === ThemeEnum.DARK ? 'rgba(63,63,63, 0.2)' : 'rgba(241,241,241, 0.2)')
  /** 열린 창 목록 */
  const openWindowsList = ref(new Set())
  /** 프로필 편집 팝업 */
  const editInfo = ref<{
    show: boolean
    content: Partial<UserInfoType>
    badgeList: BadgeType[]
  }>({
    show: false,
    content: {},
    badgeList: []
  })
  /** 현재 사용자가 착용한 뱃지 */
  const currentBadge = computed(() =>
    editInfo.value.badgeList.find((item) => item.obtain === IsYesEnum.YES && item.wearing === IsYesEnum.YES)
  )

  /* =================================== 메서드 =============================================== */

  /** 시스템 테마 모드를 따라 테마 전환 */
  const followOS = () => {
    themeColor.value = prefers.matches ? 'rgba(63,63,63, 0.2)' : 'rgba(241,241,241, 0.2)'
  }

  watchEffect(() => {
    /** 시스템 테마 따르기 여부 판단 */
    if (themes.pattern === ThemeEnum.OS) {
      followOS()
      prefers.addEventListener('change', followOS)
    } else {
      prefers.removeEventListener('change', followOS)
    }
  })

  /** 캐시 내 사용자 정보 업데이트 */
  const updateCurrentUserCache = (key: 'name' | 'wearingItemId' | 'avatar', value: any) => {
    const currentUser = userStore.userInfo!.uid && groupStore.getUserInfo(userStore.userInfo!.uid)
    if (currentUser) {
      currentUser[key] = value // 캐시 내 사용자 정보 업데이트
    }
  }

  /** 사용자 정보 저장 */
  const saveEditInfo = (localUserInfo: any) => {
    if (!localUserInfo.name || localUserInfo.name.trim() === '') {
      window.$message.error('닉네임은 비워둘 수 없습니다')
      return
    }
    if (localUserInfo.modifyNameChance === 0) {
      window.$message.error('이름 변경 횟수 부족')
      return
    }
    ModifyUserInfo(localUserInfo).then(() => {
      // 로컬 캐시의 사용자 정보 업데이트
      userStore.userInfo!.name = localUserInfo.name!
      loginHistoriesStore.updateLoginHistory(<UserInfoType>userStore.userInfo) // 로그인 기록 업데이트
      updateCurrentUserCache('name', localUserInfo.name) // 캐시 내 사용자 정보 업데이트
      if (!editInfo.value.content.modifyNameChance) return
      editInfo.value.content.modifyNameChance -= 1
      window.$message.success('저장 성공')
    })
  }

  /** 뱃지 착용 */
  const toggleWarningBadge = async (badge: BadgeType) => {
    if (!badge?.id) return
    try {
      await setUserBadge({ badgeId: badge.id })
      // 로컬 캐시의 사용자 뱃지 정보 업데이트
      const currentUser = userStore.userInfo!.uid && groupStore.getUserInfo(userStore.userInfo!.uid)
      if (currentUser) {
        // 현재 착용 중인 뱃지 ID 업데이트
        currentUser.wearingItemId = badge.id
        // 사용자 정보의 착용 뱃지 ID 업데이트
        userStore.userInfo!.wearingItemId = badge.id
        // 뱃지 목록의 착용 상태 업데이트
        editInfo.value.badgeList = editInfo.value.badgeList.map((item) => ({
          ...item,
          wearing: item.id === badge.id ? IsYesEnum.YES : IsYesEnum.NO,
          obtain: item.obtain // 기존 obtain 상태 유지
        }))
      }
      // 상태 업데이트 후 성공 메시지 표시 확인
      nextTick(() => {
        window.$message.success('착용 성공')
      })
    } catch (_error) {
      window.$message.error('착용 실패, 잠시 후 다시 시도해 주세요')
    }
  }

  /* 모달 열기 및 생성 */
  const handleEditing = () => {
    // TODO 당분간 mitt를 사용하여 매개변수 전달, 그렇지 않으면 하위 컴포넌트의 반응성 손실 됨 (nyh -> 2024-06-25 09:53:43)
    useMitt.emit(MittEnum.OPEN_EDIT_INFO)
  }

  /**
   * 사이드바 부분 창 라우팅 이동 이벤트
   * @param url 이동할 라우트
   * @param title 창 생성 시 제목
   * @param size 창 크기
   * @param window 창 매개변수
   * */
  const pageJumps = (
    url: string,
    title?: string,
    size?: { width: number; height: number; minWidth?: number; minHeight?: number },
    window?: { resizable: boolean }
  ) => {
    if (window) {
      useTimeoutFn(async () => {
        info(`창 열기: ${title}`)
        const webview = await createWebviewWindow(
          title!,
          url,
          <number>size?.width,
          <number>size?.height,
          '',
          window?.resizable,
          <number>size?.minWidth,
          <number>size?.minHeight
        )
        openWindowsList.value.add(url)

        const unlisten = await webview?.onCloseRequested(() => {
          openWindowsList.value.delete(url)
          if (unlisten) unlisten()
        })
      }, 300)
    } else {
      activeUrl.value = url
      router.push(`/${url}`)
    }
  }

  /**
   * 내용에 해당하는 창 열기
   * @param title 창 제목
   * @param label 창 식별자
   * @param w 창 너비
   * @param h 창 높이
   * */
  const openContent = (title: string, label: string, w = 840, h = 600) => {
    useTimeoutFn(async () => {
      await createWebviewWindow(title, label, w, h)
    }, 300)
    infoShow.value = false
  }

  const closeMenu = (event: any) => {
    if (!event.target.matches('.setting-item, .more, .more *')) {
      settingShow.value = false
    }
  }

  onMounted(async () => {
    /** 페이지 로드 시 기본적으로 메시지 목록 표시 */
    pageJumps(activeUrl.value)
    window.addEventListener('click', closeMenu, true)

    useMitt.on(MittEnum.SHRINK_WINDOW, (event: any) => {
      shrinkStatus.value = event as boolean
    })
    useMitt.on(MittEnum.CLOSE_INFO_SHOW, () => {
      infoShow.value = false
    })
    useMitt.on(MittEnum.TO_SEND_MSG, (event: any) => {
      activeUrl.value = event.url
    })
  })

  onUnmounted(() => {
    window.removeEventListener('click', closeMenu, true)
  })

  return {
    currentState,
    activeUrl,
    settingShow,
    shrinkStatus,
    infoShow,
    tipShow,
    themeColor,
    openWindowsList,
    editInfo,
    currentBadge,
    handleEditing,
    pageJumps,
    openContent,
    saveEditInfo,
    toggleWarningBadge,
    updateCurrentUserCache,
    followOS
  }
}
