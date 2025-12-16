import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import type { FriendItem, NoticeItem } from '@/services/types'
import { RequestNoticeAgreeStatus } from '@/services/types'
import { useGlobalStore } from '@/stores/global'
import { useFeedStore } from '@/stores/feed'
import { useGroupStore } from '@/stores/group'
import {
  deleteFriend,
  getFriendPage,
  getNoticeUnreadCount,
  handleInvite,
  requestNoticePage
} from '@/utils/ImRequestUtils'
import { unreadCountManager } from '@/utils/UnreadCountManager'
// 페이지 크기 상수 정의
export const pageSize = 20
export const useContactStore = defineStore(StoresEnum.CONTACTS, () => {
  const globalStore = useGlobalStore()
  const feedStore = useFeedStore()
  const groupStore = useGroupStore()

  /** 연락처 목록 */
  const contactsList = ref<FriendItem[]>([])
  /** 친구 요청 목록 */
  const requestFriendsList = ref<NoticeItem[]>([])

  /** 연락처 목록 페이징 옵션 */
  const contactsOptions = ref({ isLast: false, isLoading: false, cursor: '' })
  /** 친구 요청 목록 페이징 옵션 */
  const applyPageOptions = ref({ isLast: false, cursor: '', pageNo: 1 })

  /**
   * 연락처 목록 가져오기
   * @param isFresh 목록 새로 고침 여부, true이면 다시 로드, false이면 더 보기 로드
   */
  const getContactList = async (isFresh = false) => {
    // 비-새로 고침 모드에서 이미 로드가 완료되었거나 로드 중인 경우 바로 반환
    if (!isFresh) {
      if (contactsOptions.value.isLast || contactsOptions.value.isLoading) return
    }
    contactsOptions.value.isLoading = true
    const res = await getFriendPage()
    if (!res) return
    const data = res
    // 새로 고침 모드에서는 전체 목록 교체, 그렇지 않으면 목록 끝에 추가
    isFresh
      ? contactsList.value.splice(0, contactsList.value.length, ...data.list)
      : contactsList.value.push(...data.list)
    contactsOptions.value.cursor = data.cursor
    contactsOptions.value.isLast = data.isLast
    contactsOptions.value.isLoading = false

    // 데이터 가져온 후 연락처 목록 업데이트
    contactsList.value.splice(0, contactsList.value.length, ...contactsList.value)
  }

  /**
   * 친구 신청 읽지 않은 수 가져오기
   * 전역 store의 읽지 않은 카운트 업데이트
   */
  const getApplyUnReadCount = async () => {
    const res: any = await getNoticeUnreadCount()
    if (!res) return
    // 전역 store의 읽지 않은 카운트 업데이트
    globalStore.unReadMark.newFriendUnreadCount = res.unReadCount4Friend
    globalStore.unReadMark.newGroupUnreadCount = res.unReadCount4Group

    unreadCountManager.refreshBadge(globalStore.unReadMark, feedStore.unreadCount)
  }

  /**
   * 친구 신청 목록 가져오기
   * @param isFresh 목록 새로 고침 여부, true이면 다시 로드, false이면 더 보기 로드
   * @param click 새로 고침 클릭 여부, true이면 알림 읽지 않음 지우기, false이면 알림 목록만 요청
   */
  const getApplyPage = async (applyType: string, isFresh = false, click = false) => {
    // 비-새로 고침 모드에서 이미 로드가 완료되었거나 로드 중인 경우 바로 반환
    if (!isFresh) {
      if (applyPageOptions.value.isLast) return
    }

    // 새로 고침 시 페이지 번호 초기화
    if (isFresh) {
      applyPageOptions.value.pageNo = 1
      applyPageOptions.value.cursor = ''
    }

    try {
      const res = await requestNoticePage({
        pageNo: applyPageOptions.value.pageNo,
        pageSize: 30,
        click: click,
        applyType,
        cursor: isFresh ? '' : applyPageOptions.value.cursor
      })
      if (!res) return
      // 새로 고침 모드에서는 전체 목록 교체, 그렇지 않으면 목록 끝에 추가
      if (isFresh) {
        requestFriendsList.value.splice(0, requestFriendsList.value.length, ...res.list)
      } else {
        requestFriendsList.value.push(...res.list)
      }

      // 페이징 정보 업데이트
      applyPageOptions.value.cursor = res.cursor
      applyPageOptions.value.isLast = res.isLast

      // pageNo가 반환되면 서버에서 반환된 pageNo 사용, 그렇지 않으면 페이지 번호 증가
      if (res.pageNo) {
        applyPageOptions.value.pageNo = res.pageNo + 1
      } else {
        applyPageOptions.value.pageNo++
      }
    } catch (error) {
      console.error('친구 신청 목록 가져오기 실패:', error)
    }
  }

  const deleteContact = (uid: string) => {
    contactsList.value = contactsList.value.filter((item) => item.uid !== uid)
  }

  /**
   * 친구/그룹 신청 처리
   * @param apply 친구 신청 정보
   * @param state 처리 상태 0 거절 2 수락 3 무시
   */
  const resolveApplyType = (applyType?: 'friend' | 'group', type?: number): 'friend' | 'group' => {
    if (applyType === 'friend' || applyType === 'group') return applyType
    // 백엔드 type: 1 그룹 채팅 알림, 2 친구 알림
    return type === 2 ? 'friend' : 'group'
  }

  const onHandleInvite = async (apply: {
    applyId: string
    state: number
    roomId?: string
    type?: number
    applyType?: 'friend' | 'group'
    markAsRead?: boolean
  }) => {
    const targetApplyType = resolveApplyType(apply.applyType, apply.type)
    const markAsRead = apply.markAsRead ?? false

    try {
      await handleInvite({ applyId: apply.applyId, state: apply.state })

      // 친구 신청 목록 새로 고침
      await getApplyPage(targetApplyType, true, markAsRead)
      if (markAsRead) {
        targetApplyType === 'friend'
          ? (globalStore.unReadMark.newFriendUnreadCount = 0)
          : (globalStore.unReadMark.newGroupUnreadCount = 0)
        unreadCountManager.refreshBadge(globalStore.unReadMark, feedStore.unreadCount)
      }
      // 친구 목록 새로 고침
      await getContactList(true)
      // 최신 읽지 않은 수 가져오기
      await getApplyUnReadCount()

      // 그룹 초대/신청 수락인 경우 그룹 정보 및 멤버 목록 새로 고침
      const isGroupApply =
        apply.state === RequestNoticeAgreeStatus.ACCEPTED &&
        targetApplyType === 'group' &&
        apply.roomId &&
        Number(apply.roomId) > 0

      if (isGroupApply) {
        try {
          await groupStore.addGroupDetail(apply.roomId!)
          await groupStore.getGroupUserList(apply.roomId!, true)
        } catch (error) {
          console.error('그룹 멤버 정보 새로고침 실패:', error)
        }
      }

      // 현재 선택된 연락처 상태 업데이트
      if (globalStore.currentSelectedContact) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        globalStore.currentSelectedContact.status = RequestNoticeAgreeStatus.ACCEPTED
      }
    } catch (error) {
      console.error('친구/그룹 신청 처리 실패:', error)
      throw error
    }
  }

  /**
   * 친구 삭제
   * @param uid 삭제할 친구 사용자 ID
   * 처리 프로세스:
   * 1. 친구 삭제 인터페이스 호출
   * 2. 친구 목록 새로 고침
   */
  const onDeleteFriend = async (uid: string) => {
    if (!uid) return
    // 친구 삭제
    await deleteFriend({ targetUid: uid })
    // 친구 목록 새로 고침
    await getContactList(true)
  }

  return {
    getContactList,
    getApplyPage,
    getApplyUnReadCount,
    contactsList,
    requestFriendsList,
    contactsOptions,
    applyPageOptions,
    onDeleteFriend,
    onHandleInvite,
    deleteContact
  }
})
