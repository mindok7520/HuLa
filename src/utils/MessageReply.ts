import { MsgEnum } from '@/enums'
import type { MsgType } from '@/services/types'

/**
 * 메시지 타입에 따라 답장 내용 가져오기
 * @param message 메시지 객체
 * @returns 포맷팅된 답장 내용
 */
export const getReplyContent = (message: MsgType): string => {
  let content: string

  // 메시지 타입에 따라 답장 내용 결정
  switch (message.type) {
    case MsgEnum.TEXT: {
      // 텍스트 메시지: 원본 내용 표시, &nbsp; 처리
      content = message.body.content || ''
      if (typeof content === 'string') {
        content = content.replace(/&nbsp;/g, ' ')
      }
      break
    }

    case MsgEnum.VIDEO: {
      // 비디오 메시지: 썸네일 URL 사용 또는 [비디오] 표시
      content = message.body.thumbUrl || '[비디오]'
      break
    }

    case MsgEnum.VOICE: {
      // 음성 메시지: "[음성] X초" 표시
      const seconds = message.body.second || 0
      content = `[음성] ${seconds}초`
      break
    }

    case MsgEnum.FILE: {
      // 파일 메시지: 파일명 표시
      content = `[파일] ${message.body.fileName || ''}`
      break
    }

    case MsgEnum.IMAGE: {
      // 이미지 메시지: 이미지 URL 사용
      content = message.body.url || '[이미지]'
      break
    }

    case MsgEnum.NOTICE: {
      // 공지 메시지: 내용 표시
      content = `[공지] ${message.body.content || ''}`
      break
    }

    case MsgEnum.SYSTEM: {
      // 시스템 메시지
      content = '[시스템 메시지]'
      break
    }

    case MsgEnum.MERGE: {
      // 채팅 기록
      content = '[채팅 기록]'
      break
    }

    case MsgEnum.AI: {
      // AI 메시지
      content = `'[AI 메시지]'${message.body.content || ''}`
      if (typeof content === 'string') {
        content = content.replace(/&nbsp;/g, ' ')
      }
      break
    }

    default: {
      // 기타 타입: content 또는 url 가져오기 시도
      content = message.body.content || message.body.url || '[알 수 없는 메시지]'
      if (typeof content === 'string') {
        content = content.replace(/&nbsp;/g, ' ')
      }
      break
    }
  }

  return content
}
