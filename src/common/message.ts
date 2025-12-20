import { MsgEnum } from '@/enums'

// 메시지 답장 매핑 테이블
export const MSG_REPLY_TEXT_MAP: Record<number, string> = {
  [MsgEnum.UNKNOWN]: '[알 수 없음]',
  [MsgEnum.RECALL]: '[메시지 회수]',
  [MsgEnum.IMAGE]: '[이미지]',
  [MsgEnum.FILE]: '[파일]',
  [MsgEnum.VOICE]: '[음성]',
  [MsgEnum.VIDEO]: '[비디오]',
  [MsgEnum.EMOJI]: '[애니메이션 이모티콘]',
  [MsgEnum.MERGE]: '[채팅 기록]',
  [MsgEnum.NOTICE]: '[공지]',
  [MsgEnum.VIDEO_CALL]: '[영상 통화]',
  [MsgEnum.AUDIO_CALL]: '[음성 통화]',
  [MsgEnum.BOT]: '[관리자]',
  [MsgEnum.LOCATION]: '[위치]'
}
