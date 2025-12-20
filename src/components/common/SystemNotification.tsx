import { NAvatar, NButton } from 'naive-ui'
import { useNoticeStore } from '@/stores/notice.ts'
import { handRelativeTime } from '@/utils/ComputedTime'

const { systemNotice } = storeToRefs(useNoticeStore())
const SysNTF = null
if (!systemNotice.value) {
  const SysNTF = window.$notification.create({
    title: () => <p class="text-14px pl-10px">시스템 알림</p>,
    content: () => (
      <p class="text-12px pl-10px">현재 시스템이 아직 완성되지 않았으므로 중요한 정보를 여기에 저장하지 마십시오.</p>
    ),
    meta: () => <p class="text-12px pl-10px">{handRelativeTime('2024/11/28 16:48:32')}</p>,
    closable: false,
    avatar: () => <NAvatar class="flex-shrink-0" size={44} src="/logo.png" round />,
    action: () => (
      <NButton
        text
        type="primary"
        onClick={() => {
          systemNotice.value = true
          SysNTF.destroy()
        }}>
        <p class="text-(12px #13987f)">읽음</p>
      </NButton>
    )
  })
}

export default SysNTF
