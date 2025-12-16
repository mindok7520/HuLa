import { MsgEnum } from '@/enums'

// 메시지 답장 매핑 테이블
export const MSG_REPLY_TEXT_MAP: Record<number, string> = {
  [MsgEnum.UNKNOWN]: '[알 수 없음]',
  [MsgEnum.RECALL]: '[메시지 취소]',
  [MsgEnum.IMAGE]: '[사진]',
  [MsgEnum.FILE]: '[파일]',
  [MsgEnum.VOICE]: '[음성]',
  [MsgEnum.VIDEO]: '[동영상]',
  [MsgEnum.EMOJI]: '[이모티콘]',
  [MsgEnum.MERGE]: '[채팅 기록]',
  [MsgEnum.NOTICE]: '[공지]',
  [MsgEnum.VIDEO_CALL]: '[영상 통화]',
  [MsgEnum.AUDIO_CALL]: '[음성 통화]',
  [MsgEnum.BOT]: '[챗봇]',
  [MsgEnum.LOCATION]: '[위치]'
}
