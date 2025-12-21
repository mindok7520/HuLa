import { MittEnum, NotificationTypeEnum, RoomTypeEnum, SessionOperateEnum, UserType } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import type { SessionItem } from '@/services/types.ts'
import { useChatStore } from '@/stores/chat.ts'
import { useContactStore } from '@/stores/contacts.ts'
import { useGlobalStore } from '@/stores/global.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { exitGroup, notification, setSessionTop, shield, markMsgRead } from '@/utils/ImRequestUtils'
import { invokeWithErrorHandler } from '../utils/TauriInvokeHandler'
import { useI18n } from 'vue-i18n'

const msgBoxShow = ref(false)
const shrinkStatus = ref(false)

// 모듈 수준에서 이벤트 리스너 등록, 훅이 여러 번 호출될 때 중복 등록 방지
let isShrinkListenerRegistered = false
const registerShrinkListener = () => {
  if (isShrinkListenerRegistered) return
  isShrinkListenerRegistered = true
  useMitt.on(MittEnum.SHRINK_WINDOW, async (event: any) => {
    shrinkStatus.value = event as boolean
  })
}

export const useMessage = () => {
  const { t } = useI18n()
  const globalStore = useGlobalStore()
  const chatStore = useChatStore()
  const settingStore = useSettingStore()
  const { chat } = storeToRefs(settingStore)
  const contactStore = useContactStore()
  const groupStore = useGroupStore()
  const userStore = useUserStore()
  const BOT_ALLOWED_MENU_INDEXES = new Set([0, 1, 2, 3])

  // 리스너가 한 번만 등록되도록 보장
  registerShrinkListener()

  /**
   * 선택된 메시지 클릭 처리
   * 로컬 캐시에서 자신을 찾을 수 없으면 서버 데이터가 아직 동기화되지 않은 것이므로, 이때 그룹 멤버 정보를 강제로 새로 고침함.
   */
  const ensureGroupMembersSynced = async (roomId: string, sessionType: RoomTypeEnum) => {
    if (sessionType !== RoomTypeEnum.GROUP) return

    const currentUid = userStore.userInfo?.uid
    if (!currentUid) return

    const memberList = groupStore.getUserListByRoomId(roomId)
    const alreadyHasCurrentUser = memberList.some((member) => member.uid === currentUid)

    if (!alreadyHasCurrentUser) {
      await groupStore.getGroupUserList(roomId, true)
    }
  }

  const handleMsgClick = async (item: SessionItem) => {
    msgBoxShow.value = true
    // 현재 세션 정보 업데이트
    const roomId = item.roomId
    console.log('[handleMsgClick] 세션 클릭:', roomId, '전달된 읽지 않음 수:', item.unreadCount)

    globalStore.updateCurrentSessionRoomId(roomId)

    // 로컬 읽지 않음 표시를 먼저 지우고(UI 즉시 업데이트), 읽음 상태를 비동기로 보고(차단 방지)하여,
    // 이후 그룹 멤버 동기화 실패로 인해 읽지 않음 배지가 남는 것을 방지함
    const currentSession = chatStore.getSession(roomId)
    console.log('[handleMsgClick] 가져온 세션 읽지 않음 수:', currentSession?.unreadCount)

    if (currentSession?.unreadCount && currentSession.unreadCount > 0) {
      console.log('[handleMsgClick] 읽지 않음 수 지우기 시작:', roomId)
      chatStore.markSessionRead(roomId)
      markMsgRead(roomId).catch((err) => console.error('[useMessage] 읽음 보고 실패:', err))
    }

    // 자신이 멤버에 포함되어 있는지 확인하여 한 번 더 새로 고침, 계정 일괄 전환 후 이전 데이터가 보이는 것을 방지
    try {
      await ensureGroupMembersSynced(roomId, item.type)
    } catch (error) {
      console.error('[useMessage] 그룹 멤버 동기화 실패:', error)
    }
  }

  /**
   * 채팅방 미리 로드
   * @param roomId
   */
  const preloadChatRoom = (roomId: string = '1') => {
    globalStore.updateCurrentSessionRoomId(roomId)
  }

  /**
   * 세션 삭제
   * @param roomId 세션 정보
   */
  const handleMsgDelete = async (roomId: string) => {
    const currentSessions = chatStore.sessionList
    const currentIndex = currentSessions.findIndex((session) => session.roomId === roomId)

    // 현재 선택된 세션인지 확인
    const isCurrentSession = roomId === globalStore.currentSessionRoomId

    chatStore.removeSession(roomId)
    // TODO: 세션 숨기기 인터페이스 사용
    // const res = await apis.hideSession({ roomId, hide: true })
    await invokeWithErrorHandler('hide_contact_command', { data: { roomId, hide: true } })
    // console.log(res, roomId)

    // 현재 선택된 세션이 아니면 바로 반환
    if (!isCurrentSession) {
      return
    }

    const updatedSessions = chatStore.sessionList

    // 다음 또는 이전 세션 선택
    const nextIndex = Math.min(currentIndex, updatedSessions.length - 1)
    const nextSession = updatedSessions[nextIndex]
    if (nextSession) {
      await handleMsgClick(nextSession)
    }
  }

  /** 더블 클릭 이벤트 처리 */
  const handleMsgDblclick = (item: SessionItem) => {
    if (!chat.value.isDouble) return
    console.log(item)
  }

  const menuList = ref<OPT.RightMenu[]>([
    {
      label: (item: SessionItem) => (item.top ? t('menu.unpin') : t('menu.pin')),
      icon: (item: SessionItem) => (item.top ? 'to-bottom' : 'to-top'),
      click: (item: SessionItem) => {
        setSessionTop({ roomId: item.roomId, top: !item.top })
          .then(() => {
            // 로컬 세션 상태 업데이트
            chatStore.updateSession(item.roomId, { top: !item.top })
            window.$message.success(
              item.top ? t('message.message_menu.unpin_success') : t('message.message_menu.pin_success')
            )
          })
          .catch(() => {
            window.$message.error(item.top ? t('message.message_menu.unpin_fail') : t('message.message_menu.pin_fail'))
          })
      }
    },
    {
      label: () => t('menu.copy_account'),
      icon: 'copy',
      click: (item: any) => {
        navigator.clipboard.writeText(item.account)
        window.$message.success(t('message.message_menu.copy_success', { account: item.account }))
      }
    },
    {
      label: () => t('menu.mark_unread'),
      icon: 'message-unread'
    },
    {
      label: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.GROUP) {
          return t('menu.group_message_setting')
        }

        return item.muteNotification === NotificationTypeEnum.RECEPTION
          ? t('menu.set_do_not_disturb')
          : t('menu.unset_do_not_disturb')
      },
      icon: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.GROUP) {
          return 'peoples-two'
        }
        return item.muteNotification === NotificationTypeEnum.RECEPTION ? 'close-remind' : 'remind'
      },
      children: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.SINGLE) return null

        return [
          {
            label: () => t('menu.allow_notifications'),
            icon: !item.shield && item.muteNotification === NotificationTypeEnum.RECEPTION ? 'check-small' : '',
            click: async () => {
              // 현재 차단 상태인 경우 차단 해제 필요
              if (item.shield) {
                await shield({
                  roomId: item.roomId,
                  state: false
                })
                chatStore.updateSession(item.roomId, { shield: false })
              }
              await handleNotificationChange(item, NotificationTypeEnum.RECEPTION)
            }
          },
          {
            label: () => t('menu.receive_silently'),
            icon: !item.shield && item.muteNotification === NotificationTypeEnum.NOT_DISTURB ? 'check-small' : '',
            click: async () => {
              // 현재 차단 상태인 경우 차단 해제 필요
              if (item.shield) {
                await shield({
                  roomId: item.roomId,
                  state: false
                })
                chatStore.updateSession(item.roomId, { shield: false })
              }
              await handleNotificationChange(item, NotificationTypeEnum.NOT_DISTURB)
            }
          },
          {
            label: () => t('menu.block_group_messages'),
            icon: item.shield ? 'check-small' : '',
            click: async () => {
              await shield({
                roomId: item.roomId,
                state: !item.shield
              })

              // 로컬 세션 상태 업데이트
              chatStore.updateSession(item.roomId, {
                shield: !item.shield
              })

              window.$message.success(
                item.shield ? t('message.message_menu.unshield_success') : t('message.message_menu.shield_success')
              )
            }
          }
        ]
      },
      click: async (item: SessionItem) => {
        if (item.type === RoomTypeEnum.GROUP) return // 그룹 채팅은 클릭 이벤트 실행 안 함

        const newType =
          item.muteNotification === NotificationTypeEnum.RECEPTION
            ? NotificationTypeEnum.NOT_DISTURB
            : NotificationTypeEnum.RECEPTION

        await handleNotificationChange(item, newType)
      }
    }
  ])

  const specialMenuList = ref<OPT.RightMenu[]>([
    {
      label: (item: SessionItem) => (item.shield ? t('menu.unblock_user_messages') : t('menu.block_user_messages')),
      icon: (item: SessionItem) => (item.shield ? 'message-success' : 'people-unknown'),
      click: async (item: SessionItem) => {
        await shield({
          roomId: item.roomId,
          state: !item.shield
        })

        // 로컬 세션 상태 업데이트
        chatStore.updateSession(item.roomId, {
          shield: !item.shield
        })

        window.$message.success(
          item.shield ? t('message.message_menu.unshield_success') : t('message.message_menu.shield_success')
        )
      },
      // 단일 채팅일 때만 표시
      visible: (item: SessionItem) => item.type === RoomTypeEnum.SINGLE
    },
    {
      label: () => t('menu.remove_from_list'),
      icon: 'delete',
      click: async (item: SessionItem) => {
        await handleMsgDelete(item.roomId)
      }
    },
    {
      label: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.SINGLE) return t('menu.delete_friend')
        if (item.operate === SessionOperateEnum.DISSOLUTION_GROUP) return t('menu.dissolve_group')
        return t('menu.leave_group')
      },
      icon: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.SINGLE) return 'forbid'
        if (item.operate === SessionOperateEnum.DISSOLUTION_GROUP) return 'logout'
        return 'logout'
      },
      click: async (item: SessionItem) => {
        console.log('친구 삭제 또는 그룹 나가기 실행')
        // 단일 채팅: 친구 삭제
        if (item.type === RoomTypeEnum.SINGLE) {
          await contactStore.onDeleteFriend(item.detailId)
          await handleMsgDelete(item.roomId)
          window.$message.success(t('message.message_menu.delete_friend_success'))
          return
        }

        // 그룹 채팅: 채널인지 확인
        if (item.roomId === '1') {
          window.$message.warning(
            item.operate === SessionOperateEnum.DISSOLUTION_GROUP
              ? t('message.message_menu.cannot_dissolve_channel')
              : t('message.message_menu.cannot_quit_channel')
          )
          return
        }

        // 그룹 채팅: 해산 또는 나가기
        await exitGroup({ roomId: item.roomId })
        await handleMsgDelete(item.roomId)
        window.$message.success(
          item.operate === SessionOperateEnum.DISSOLUTION_GROUP
            ? t('message.message_menu.dissolve_group_success')
            : t('message.message_menu.quit_group_success')
        )
      },
      visible: (item: SessionItem) => {
        // 단일 채팅: operate가 DELETE_FRIEND일 때만 표시
        if (item.type === RoomTypeEnum.SINGLE) {
          return item.operate === SessionOperateEnum.DELETE_FRIEND
        }

        // 그룹 채팅: 채널 옵션 표시 안 함
        if (item.roomId === '1') return false

        // 그룹 채팅: 나가기 옵션 항상 표시, 방장인 경우 해산 옵션 표시
        return true
      }
    }
  ])

  // 알림 설정 변경 처리 함수 추가
  const handleNotificationChange = async (item: SessionItem, newType: NotificationTypeEnum) => {
    await notification({
      roomId: item.roomId,
      type: newType
    })

    // 로컬 세션 상태 업데이트
    chatStore.updateSession(item.roomId, {
      muteNotification: newType
    })

    // 방해 금지에서 알림 허용으로 전환하는 경우 전역 읽지 않은 메시지 수를 다시 계산해야 함
    if (item.muteNotification === NotificationTypeEnum.NOT_DISTURB && newType === NotificationTypeEnum.RECEPTION) {
      chatStore.updateTotalUnreadCount()
    }

    // 显示操作成功提示
    let message = ''
    switch (newType) {
      case NotificationTypeEnum.RECEPTION:
        message = t('message.message_menu.notification_allowed')
        break
      case NotificationTypeEnum.NOT_DISTURB:
        message = t('message.message_menu.notification_silent')
        // 设置免打扰时也需要更新全局未读数，因为该会话的未读数将不再计入
        chatStore.updateTotalUnreadCount()
        break
    }
    window.$message.success(message)
  }

  const visibleMenu = (item: SessionItem) => {
    if (item.account === UserType.BOT) {
      return menuList.value.filter((_, index) => BOT_ALLOWED_MENU_INDEXES.has(index))
    }
    return menuList.value
  }

  const visibleSpecialMenu = (item: SessionItem) => {
    if (item.account === UserType.BOT) {
      return []
    }
    return specialMenuList.value
  }

  return {
    msgBoxShow,
    handleMsgClick,
    handleMsgDelete,
    handleMsgDblclick,
    menuList,
    specialMenuList,
    visibleMenu,
    visibleSpecialMenu,
    preloadChatRoom
  }
}
