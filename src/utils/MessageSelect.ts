import { MsgEnum } from '@/enums'

/**
 * 다중 선택 흐름에서 제외해야 할 메시지 타입 지정
 */
export const MULTI_SELECT_BLOCKED_TYPES = new Set<MsgEnum>([MsgEnum.NOTICE, MsgEnum.BOT, MsgEnum.RECALL])

export const isMessageMultiSelectEnabled = (type: MsgEnum | number): boolean => {
  return !MULTI_SELECT_BLOCKED_TYPES.has(type as MsgEnum)
}
