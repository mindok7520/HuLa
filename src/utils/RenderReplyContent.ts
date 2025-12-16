import { MSG_REPLY_TEXT_MAP } from '@/common/message'
import { MsgEnum, RoomTypeEnum } from '@/enums'

// 표시할 답장 메시지의 콘텐츠 계산
export const renderReplyContent = (name?: string, type?: MsgEnum, content?: string, roomType?: RoomTypeEnum) => {
  switch (type) {
    case MsgEnum.SYSTEM:
    case MsgEnum.TEXT: {
      return roomType === RoomTypeEnum.GROUP ? `${name}:${content}` : content
    }
    case MsgEnum.IMAGE: {
      return roomType === RoomTypeEnum.GROUP
        ? `${name}:${MSG_REPLY_TEXT_MAP[MsgEnum.IMAGE]}`
        : MSG_REPLY_TEXT_MAP[MsgEnum.IMAGE]
    }
    case MsgEnum.FILE: {
      // content가 객체인 경우 fileName 추출 시도
      let fileContent = ''
      if (typeof content === 'string') {
        fileContent = content
      } else if (content && typeof content === 'object' && 'fileName' in content) {
        fileContent = (content as any).fileName
      }
      fileContent = fileContent || MSG_REPLY_TEXT_MAP[MsgEnum.FILE]

      return roomType === RoomTypeEnum.GROUP ? `${name}:${fileContent}` : `[파일] ${fileContent}`
    }
    case MsgEnum.VOICE: {
      return roomType === RoomTypeEnum.GROUP
        ? `${name}:${MSG_REPLY_TEXT_MAP[MsgEnum.VOICE]}`
        : MSG_REPLY_TEXT_MAP[MsgEnum.VOICE]
    }
    case MsgEnum.VIDEO: {
      return roomType === RoomTypeEnum.GROUP
        ? `${name}:${MSG_REPLY_TEXT_MAP[MsgEnum.VIDEO]}`
        : MSG_REPLY_TEXT_MAP[MsgEnum.VIDEO]
    }
    case MsgEnum.EMOJI: {
      return roomType === RoomTypeEnum.GROUP
        ? `${name}:${MSG_REPLY_TEXT_MAP[MsgEnum.EMOJI]}`
        : MSG_REPLY_TEXT_MAP[MsgEnum.EMOJI]
    }
    case MsgEnum.NOTICE: {
      return roomType === RoomTypeEnum.GROUP
        ? `${name}:${MSG_REPLY_TEXT_MAP[MsgEnum.NOTICE]}`
        : MSG_REPLY_TEXT_MAP[MsgEnum.NOTICE]
    }
    case MsgEnum.MERGE: {
      return roomType === RoomTypeEnum.GROUP
        ? `${name}:${MSG_REPLY_TEXT_MAP[MsgEnum.MERGE]}`
        : MSG_REPLY_TEXT_MAP[MsgEnum.MERGE]
    }
    case MsgEnum.VIDEO_CALL: {
      return roomType === RoomTypeEnum.GROUP
        ? `${name}:${MSG_REPLY_TEXT_MAP[MsgEnum.VIDEO_CALL]}`
        : MSG_REPLY_TEXT_MAP[MsgEnum.VIDEO_CALL]
    }
    case MsgEnum.AUDIO_CALL: {
      return roomType === RoomTypeEnum.GROUP
        ? `${name}:${MSG_REPLY_TEXT_MAP[MsgEnum.AUDIO_CALL]}`
        : MSG_REPLY_TEXT_MAP[MsgEnum.AUDIO_CALL]
    }
    case MsgEnum.BOT: {
      return roomType === RoomTypeEnum.GROUP ? `${name}:${content}` : MSG_REPLY_TEXT_MAP[MsgEnum.BOT]
    }
    case MsgEnum.LOCATION: {
      return roomType === RoomTypeEnum.GROUP
        ? `${name}:${MSG_REPLY_TEXT_MAP[MsgEnum.LOCATION]}`
        : MSG_REPLY_TEXT_MAP[MsgEnum.LOCATION]
    }
    default: {
      return ''
    }
  }
}
