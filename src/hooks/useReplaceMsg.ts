import { MsgEnum, RoomTypeEnum } from '@/enums'
import type { MessageType } from '@/services/types'
import { useChatStore } from '@/stores/chat'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { renderReplyContent } from '@/utils/RenderReplyContent.ts'

/**
 * 메시지 내용 표시를 처리하는 훅, @멘션 및 메시지 회수 처리 포함
 */
export const useReplaceMsg = () => {
  const userStore = useUserStore()
  const chatStore = useChatStore()
  const groupStore = useGroupStore()

  /**
   * 단일 메시지가 현재 사용자를 @멘션했는지 확인
   * @param message 메시지 객체
   * @returns 현재 사용자 @멘션 여부
   */
  const checkMessageAtMe = (message: MessageType) => {
    const currentUid = userStore.userInfo?.uid
    if (!message?.message?.body?.atUidList || !currentUid) {
      return false
    }

    // 타입 일치 비교 확인
    return message.message.body.atUidList.some((atUid: string) => String(atUid) === String(currentUid))
  }

  /**
   * 메시지가 현재 사용자를 @멘션했는지, 그리고 읽지 않은 범위 내에 있는지 확인
   * @param roomId 방 ID
   * @param roomType 방 유형
   * @param currentRoomId 현재 활성화된 방 ID
   * @param messages 메시지 목록
   * @param unreadCount 읽지 않은 메시지 수
   * @returns 누군가 현재 사용자를 @멘션했는지 여부
   */
  const checkRoomAtMe = (
    roomId: string,
    roomType: RoomTypeEnum,
    currentRoomId: string,
    messages: MessageType[],
    unreadCount: number = 0
  ) => {
    // 그룹 채팅이면서 현재 세션이 아닐 때만 @멘션 고려
    if (roomType !== RoomTypeEnum.GROUP || roomId === currentRoomId) {
      return false
    }

    // 현재 사용자를 @멘션한 메시지 필터링
    const messagesWithAt = messages.filter(checkMessageAtMe)

    // 나를 @멘션한 메시지가 있고 읽지 않은 범위 내에 있는지 확인
    return messagesWithAt.some((msg) => messages.indexOf(msg) >= messages.length - (unreadCount || 0))
  }

  /**
   * 회수된 메시지 표시 로직 처리
   * @param message 메시지 객체
   * @param roomType 방 유형
   * @param userName 메시지 보낸 사용자 이름
   * @returns 포맷된 회수 메시지 텍스트
   */
  const formatRecallMessage = (message: MessageType, roomType: RoomTypeEnum, userName: string) => {
    const currentUid = userStore.userInfo?.uid
    const content = message.message?.body?.content
    if (typeof content === 'string' && content.trim().length > 0) {
      return content
    }

    if (roomType === RoomTypeEnum.GROUP) {
      return `${userName}:메시지를 회수했습니다`
    } else {
      return message.fromUser.uid === currentUid ? '메시지를 회수했습니다' : '상대방이 메시지를 회수했습니다'
    }
  }

  /**
   * 메시지 보낸 사람의 사용자 이름 가져오기
   * @param message 메시지 객체
   * @param defaultName 기본 이름 (선택 사항)
   * @returns 보낸 사람 사용자 이름
   */
  const getMessageSenderName = (
    message: MessageType,
    defaultName: string = '',
    roomId?: string,
    roomTypeHint?: RoomTypeEnum
  ) => {
    if (!message?.fromUser?.uid) {
      return defaultName
    }

    const resolvedRoomId = roomId || message.message?.roomId || ''
    const fallbackName = message.fromUser?.username || defaultName || message.fromUser?.uid || ''
    const session = chatStore.getSession(resolvedRoomId)
    const resolvedRoomType = roomTypeHint ?? session?.type

    const globalUser = groupStore.getUserInfo(message.fromUser.uid, resolvedRoomId)

    if (resolvedRoomType === RoomTypeEnum.GROUP) {
      const user = groupStore.getUser(resolvedRoomId, message.fromUser.uid)
      const resolvedName = user?.myName || user?.name || globalUser?.name || fallbackName
      return resolvedName
    }

    const resolvedName = globalUser?.name || fallbackName
    return resolvedName
  }

  /**
   * 메시지 내용 처리, 회수 메시지 포함
   * @param message 메시지 객체
   * @param roomType 방 유형
   * @param userName 메시지 보낸 사용자 이름 (선택 사항, 제공되지 않으면 메시지에서 자동 추출)
   * @returns 포맷된 메시지 내용
   */
  const formatMessageContent = (
    message: MessageType,
    roomType: RoomTypeEnum,
    userName: string = '',
    roomId?: string
  ) => {
    const resolvedRoomId = roomId ?? message.message?.roomId ?? ''
    const senderName = userName || getMessageSenderName(message, '', resolvedRoomId, roomType)
    // 회수된 메시지인지 확인
    if (message.message?.type === MsgEnum.RECALL) {
      return formatRecallMessage(message, roomType, senderName)
    }

    // 일반 메시지, 내용 처리
    return renderReplyContent(
      senderName,
      message.message?.type,
      message.message?.body?.content || message.message?.body,
      roomType
    ) as string
  }

  return {
    checkMessageAtMe,
    checkRoomAtMe,
    formatRecallMessage,
    formatMessageContent,
    getMessageSenderName
  }
}
