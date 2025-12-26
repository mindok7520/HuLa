import { MsgEnum } from '@/enums'

/**
 * 다중 선택 시 제외해야 할 메시지 유형을 나타냅니다.
 */
export const MULTI_SELECT_BLOCKED_TYPES = new Set<MsgEnum>([MsgEnum.NOTICE, MsgEnum.BOT, MsgEnum.RECALL])

export const isMessageMultiSelectEnabled = (type: MsgEnum | number): boolean => {
  return !MULTI_SELECT_BLOCKED_TYPES.has(type as MsgEnum)
}
