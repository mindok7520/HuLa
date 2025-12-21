import type { TransferRenderSourceList, TransferRenderTargetLabel } from 'naive-ui'
import { NAvatar, NCheckbox } from 'naive-ui'
import { useContactStore } from '@/stores/contacts.ts'
import { useGlobalStore } from '@/stores/global.ts'
import { useGroupStore } from '@/stores/group.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { UserType } from '@/enums'

const contactStore = useContactStore()
const groupStore = useGroupStore()
const globalStore = useGlobalStore()

export const options = computed(() => {
  return contactStore.contactsList
    .map((item) => {
      const userInfo = groupStore.getUserInfo(item.uid)
      const contactAccount = (item as any).account
      const isBotAccount =
        (userInfo?.account && userInfo.account.toLowerCase() === UserType.BOT) ||
        (typeof contactAccount === 'string' && contactAccount.toLowerCase() === UserType.BOT)

      if (isBotAccount) {
        return null
      }

      return {
        label: userInfo?.name || item.remark,
        value: item.uid,
        avatar: AvatarUtils.getAvatarUrl(userInfo?.avatar || '/logoD.png')
      }
    })
    .filter(Boolean) as any
})

// 비활성화된 옵션의 값 목록 가져오기
export const getDisabledOptions = () => {
  // 현재 선택된 방 ID
  const currentRoomId = globalStore.currentSessionRoomId

  if (!currentRoomId || !groupStore.userList.length) return []

  // 그룹 내 모든 멤버의 UID를 반환하는지 확인
  const result = groupStore.userList.map((member) => member.uid)
  return result
}

// 필터링된 옵션 목록 가져오기
export const getFilteredOptions = () => {
  // 비활성화된 옵션 목록 가져오기
  const disabledOptions = getDisabledOptions()
  // 현재 선택된 방 ID
  const currentRoomId = globalStore.currentSessionRoomId
  // 방 ID가 없으면 모든 친구 반환
  if (!currentRoomId) return options.value

  // 그룹에 이미 있는 친구 표시
  return options.value.map((option: { value: string; label: string; avatar?: string;[key: string]: any }) => {
    const isInGroup = disabledOptions.includes(option.value)

    if (isInGroup) {
      // 그룹에 이미 있는 친구의 경우 비활성화 표시를 추가하지만 모든 원래 속성은 그대로 유지
      return {
        ...option,
        disabled: true
      }
    } else {
      // 그룹에 없는 친구는 그대로 유지
      return option
    }
  })
}

// 통합 소스 목록 렌더링 함수, 매개변수를 통해 필터링된 옵션 사용 여부 제어
export const renderSourceList = (
  preSelectedFriendId = '',
  enablePreSelection = true,
  placeholder = ''
): TransferRenderSourceList => {
  return ({ onCheck, checkedOptions, pattern }) => {
    // 필터링된 옵션 목록을 사용하여 그룹에 이미 있는 친구가 비활성화로 올바르게 표시되는지 확인
    const baseOptions = getFilteredOptions()

    // 검색 모드에 따라 추가 필터링
    const displayOptions = pattern
      ? baseOptions.filter((option: { label: string }) => option.label?.toLowerCase().includes(pattern.toLowerCase()))
      : baseOptions

    return (
      <div class="select-none">
        {placeholder && <div class="text-(12px [--chat-text-color]) pb-6px">{placeholder}</div>}
        {displayOptions.map((option: any) => {
          // 미리 선택된 친구인지 판단 (미리 선택 활성화 시에만 유효)
          const isPreSelected = enablePreSelection && option.value === preSelectedFriendId
          // 비활성화(이미 그룹에 있음) 여부 판단 (미리 선택 활성화 시에만 유효)
          const isDisabled = enablePreSelection && option.disabled === true
          // 미리 선택된 친구이거나 이미 선택된 경우 선택 상태로 표시
          const checked = isPreSelected || checkedOptions.some((o) => o.value === option.value)

          return (
            <div
              key={option.value}
              style={{
                userSelect: 'none',
                display: 'flex',
                margin: '4px 0',
                padding: '4px 8px',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                alignItems: 'center',
                borderRadius: '3px',
                fontSize: '14px',
                opacity: isDisabled && !isPreSelected ? 0.5 : 1,
                backgroundColor: isPreSelected ? 'var(--n-item-color-pending)' : '',
                transition: 'background-color .3s var(--n-bezier)'
              }}
              class={isDisabled ? '' : 'hover:bg-[var(--n-item-color-pending)]'}
              onClick={() => {
                if (isDisabled) return

                const index = checkedOptions.findIndex((o) => o.value === option.value)
                if (index === -1) {
                  onCheck([...checkedOptions.map((o) => o.value), option.value])
                } else {
                  // 미리 선택된 친구이고 미리 선택이 활성화된 경우 선택 취소 불가
                  if (enablePreSelection && isPreSelected) return
                  const newCheckedOptions = [...checkedOptions]
                  newCheckedOptions.splice(index, 1)
                  onCheck(newCheckedOptions.map((o) => o.value))
                }
              }}>
              <NCheckbox
                checked={checked}
                disabled={isDisabled || (enablePreSelection && isPreSelected && checked)}
                style={{ marginRight: '12px' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                {option.avatar ? (
                  <NAvatar round src={option.avatar || '/logoD.png'} size={24} fallbackSrc="/logoD.png" />
                ) : (
                  <NAvatar round size={24}>
                    {option.label?.slice(0, 1)}
                  </NAvatar>
                )}
                <div style={{ marginLeft: '12px', fontSize: '14px' }}>{option.label}</div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }
}

export const renderLabel: TransferRenderTargetLabel = ({ option }: { option: any }) => {
  return (
    <div class="select-none" style={{ display: 'flex', margin: '6px 0' }}>
      {option.avatar ? (
        <NAvatar round src={option.avatar || '/logoD.png'} size={24} fallbackSrc="/logoD.png" />
      ) : (
        <NAvatar round size={24}>
          {option.label.slice(0, 1)}
        </NAvatar>
      )}
      <div style={{ display: 'flex', marginLeft: '12px', alignSelf: 'center', fontSize: '14px' }}>{option.label}</div>
    </div>
  )
}

// 사용자 정의 대상 목록 렌더링 함수 생성
export const renderTargetList = (
  preSelectedFriendId = '',
  enablePreSelection = true,
  placeholder = '',
  requiredTag = ''
) => {
  return ({
    onCheck,
    checkedOptions,
    pattern
  }: {
    onCheck: (checkedValueList: Array<string | number>) => void
    checkedOptions: any[]
    pattern: string
  }) => {
    // 검색 모드에 따라 옵션 필터링
    const displayOptions = pattern
      ? checkedOptions.filter((option: { label: string }) =>
        option.label?.toLowerCase().includes(pattern.toLowerCase())
      )
      : checkedOptions

    return (
      <div>
        {placeholder && <div class="text-(12px [--chat-text-color]) pb-6px">{placeholder}</div>}
        {displayOptions.map((option: any) => {
          const isPreSelected = enablePreSelection && option.value === preSelectedFriendId

          return (
            <div
              key={option.value}
              style={{
                userSelect: 'none',
                display: 'flex',
                margin: '4px 0',
                padding: '4px 8px',
                alignItems: 'center',
                borderRadius: '3px',
                fontSize: '14px',
                backgroundColor: isPreSelected ? 'var(--n-item-color-pending)' : '',
                position: 'relative'
              }}>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                {option.avatar ? (
                  <NAvatar round src={option.avatar || '/logoD.png'} size={24} fallbackSrc="/logoD.png" />
                ) : (
                  <NAvatar round size={24}>
                    {option.label?.slice(0, 1)}
                  </NAvatar>
                )}
                <div style={{ marginLeft: '12px', fontSize: '14px' }}>{option.label}</div>
              </div>

              {!isPreSelected && (
                <svg
                  style={{
                    width: '12px',
                    height: '12px',
                    cursor: 'pointer',
                    marginLeft: '8px',
                    color: '#909090'
                  }}
                  onClick={() => {
                    const newCheckedOptions = checkedOptions.filter((o: any) => o.value !== option.value)
                    onCheck(newCheckedOptions.map((o: any) => o.value))
                  }}>
                  <use href="#close"></use>
                </svg>
              )}

              {isPreSelected && requiredTag && (
                <div
                  style={{
                    fontSize: '10px',
                    color: '#909090',
                    marginLeft: '8px'
                  }}>
                  {requiredTag}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }
}
