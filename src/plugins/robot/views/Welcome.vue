<template>
  <n-flex data-tauri-drag-region vertical :size="10" align="center" justify="center" class="flex flex-1">
    <!-- logo -->
    <img data-tauri-drag-region class="w-275px h-125px drop-shadow-2xl" src="/hula.png" alt="" />

    <n-flex data-tauri-drag-region vertical justify="center" :size="16" class="p-[30px_20px]">
      <n-flex justify="space-between" align="center">
        <p class="text-(14px [--chat-text-color])">다음 기능을 사용해 볼 수 있습니다:</p>
        <n-button
          type="primary"
          size="small"
          :disabled="!hasAvailableRoles"
          :loading="roleLoading"
          @click="handleCreateNewChat">
          <template #icon>
            <svg class="size-16px"><use href="#plus"></use></svg>
          </template>
          {{ hasAvailableRoles ? '새 대화' : '먼저 역할을 생성하세요' }}
        </n-button>
      </n-flex>
      <n-scrollbar style="max-height: calc(100vh / var(--page-scale, 1) - 210px)">
        <n-flex style="padding: 6px" align="center" :size="[24, 16]">
          <n-flex
            vertical
            v-for="(item, index) in examplesList"
            :key="index"
            justify="center"
            :size="12"
            class="examples">
            <n-flex align="center" justify="space-between">
              <p class="text-(14px [--chat-text-color]) font-500">{{ item.title }}</p>
              <svg class="size-16px"><use :href="`#${item.icon}`"></use></svg>
            </n-flex>
            <component :is="item.content" />
          </n-flex>
        </n-flex>
      </n-scrollbar>
    </n-flex>
  </n-flex>
</template>
<script setup lang="tsx">
import { NFlex, NImage, NSkeleton } from 'naive-ui'
import type { VNode } from 'vue'
import { useMitt } from '@/hooks/useMitt.ts'
import { conversationCreateMy, chatRolePage } from '@/utils/ImRequestUtils'

type Example = {
  title: string
  icon: string
  content: VNode
}[]

// 역할 관련 상태
const roleList = ref<any[]>([])
const roleLoading = ref(false)
const firstAvailableRole = computed(() => roleList.value[0] || null)
const hasAvailableRoles = computed(() => roleList.value.length > 0)

// 역할 목록 로드
const loadRoleList = async () => {
  roleLoading.value = true
  try {
    const data = await chatRolePage({ pageNo: 1, pageSize: 100 })
    // 사용 가능한 역할만 표시 (status === 0)
    roleList.value = (data.list || []).filter((item: any) => item.status === 0)
  } catch (error) {
    console.error('역할 목록 로드 실패:', error)
    roleList.value = []
  } finally {
    roleLoading.value = false
  }
}

// 새 대화 추가
const handleCreateNewChat = async () => {
  try {
    // 사용 가능한 역할이 있는지 확인
    if (!hasAvailableRoles.value) {
      window.$message.warning('먼저 역할을 생성하세요')
      useMitt.emit('open-role-management')
      return
    }

    // 첫 번째 사용 가능한 역할의 ID 사용
    const data = await conversationCreateMy({
      roleId: firstAvailableRole.value.id,
      knowledgeId: undefined,
      title: '새로운 대화'
    })

    if (data) {
      window.$message.success('대화 생성 성공')
      const newChat = {
        id: data.id || data,
        title: data.title || '새로운 대화',
        createTime: data.createTime ?? Date.now(),
        messageCount: data.messageCount || 0,
        isPinned: data.pinned || false,
        roleId: firstAvailableRole.value.id,
        modelId: data.modelId
      }

      useMitt.emit('add-conversation', newChat)

      // 즉시 새 대화로 전환
      useMitt.emit('chat-active', newChat)

      // 채팅 페이지로 돌아가기 트리거
      useMitt.emit('return-chat')
    }
  } catch (error) {
    console.error('대화 생성 실패:', error)
    window.$message.error('대화 생성 실패')
  }
}

// 컴포넌트 마운트 시 역할 목록 로드
onMounted(() => {
  loadRoleList()

  // 역할 목록 새로고침 이벤트 감지
  useMitt.on('refresh-role-list', () => {
    console.log('Welcome 페이지에서 역할 목록 새로고침 이벤트 수신')
    loadRoleList()
  })
})
const avatars = 'https://picsum.photos/140'
const examplesList: Example = [
  {
    title: 'AI 검색',
    icon: 'search',
    content: (
      <NFlex vertical size={12}>
        {Array.from({ length: 3 }, (_, index) => (
          <NFlex key={index} class={'search-item'}>
            <NImage width={50} height={45} previewDisabled class={'rounded-12px'} src={`${avatars}?${index}1`}>
              {{
                placeholder: () => (
                  <div class="w-50px h-45px rounded-12px bg-[--chat-hover-color]">
                    <NSkeleton height="100%" width="100%" class={'rounded-12px'} />
                  </div>
                )
              }}
            </NImage>
            <NFlex vertical justify="center" class={'text-(12px [--chat-text-color]) truncate flex-1'}>
              <p class="truncate w-full">안녕하세요, 로봇 도우미입니다. 만나서 반갑습니다.</p>
              <p>요즘 어떠신가요?</p>
            </NFlex>

            <svg
              style={{ filter: 'drop-shadow(0 0 0.6em #13987f)' }}
              class="color-#13987f p-[10px_4px] size-26px opacity-0 absolute top-1/2 right-24px transform -translate-x-1/2 -translate-y-1/2">
              <use href="#Up-GPT"></use>
            </svg>
          </NFlex>
        ))}
      </NFlex>
    )
  },
  {
    title: 'PDF 읽기',
    icon: 'notes',
    content: (
      <NFlex vertical size={12} class={'pdf-item'}>
        <NFlex vertical justify="center" class="content">
          <NFlex size={12} align={'center'}>
            <img class="size-24px" src="/file/pdf.svg" alt="" />
            <p class="text-(12px [--chat-text-color]) underline">글로벌 경제 금융 전망 보고서.pdf</p>
          </NFlex>
          <p class="indent-8 text-(12px [--chat-text-color]) text-wrap leading-5">
            2023년 글로벌 경제 성장 동력은 지속적으로 둔화되었으며, 각국의 회복세는 차별화되었습니다. 선진국 경제의 성장 속도는 뚜렷하게 둔화되었으나, 신흥 경제국은 전반적으로 안정적인 모습을 보였습니다.
          </p>
          <ul class="list-disc list-inside indent-4 truncate text-(12px [--chat-text-color]) text-wrap leading-5">
            <li>
              2024년을 전망하면, 글로벌 경제 회복세는 여전히 부진할 것으로 예상되며, 주요 경제국의 성장 추세와 통화 정책 기조는 더욱 차별화될 것입니다. 글로벌 무역 환경의 불확실성 또한 증가할 것이며, 보호무역주의와 기술 변화의 이중 영향으로 공급망 재편 추세가 가속화될 수 있습니다.
            </li>
          </ul>
        </NFlex>

        <NFlex vertical justify="center" align="center" class="foot">
          <svg
            style={{ filter: 'drop-shadow(0 0 0.6em #13987f)' }}
            class="color-#13987f p-[10px_4px] size-26px opacity-0">
            <use href="#Up-GPT"></use>
          </svg>
          <p class="text-(14px [--chat-text-color]) opacity-0">읽으러 가기</p>
        </NFlex>
      </NFlex>
    )
  },
  {
    title: '이미지 생성',
    icon: 'photo',
    content: (
      <NFlex vertical justify="center" size={0} class={'photo-item'}>
        <NFlex align={'center'} size={10} class={'head'}>
          {Array.from({ length: 4 }, (_, index) => (
            <NImage width={128} height={90} previewDisabled class={'rounded-12px'} src={`${avatars}?${index}`}>
              {{
                placeholder: () => (
                  <div class="w-128px h-90px rounded-12px bg-[--chat-hover-color]">
                    <NSkeleton height="100%" width="100%" class={'rounded-12px'} />
                  </div>
                )
              }}
            </NImage>
          ))}
        </NFlex>

        <NFlex justify={'space-between'} align={'center'} class={'foot'}>
          <p class={'text-(14px [--chat-text-color]) font-500 pl-6px opacity-0'}>시도해 보기</p>
          <svg style={{ filter: 'drop-shadow(0 0 0.6em #13987f)' }} class="color-#13987f pr-6px size-26px opacity-0">
            <use href="#Up-GPT"></use>
          </svg>
        </NFlex>
      </NFlex>
    )
  }
]
</script>

<style lang="scss">
.examples {
  @apply w-300px h-fit rounded-12px p-10px box-border cursor-pointer border-(solid 1px [--line-color]) custom-shadow;
  &:hover {
    .search-item:not(:hover) {
      @apply blur-md scale-94;
    }
    @apply outline outline-2 outline-#13987f outline-offset;
  }
}

.search-item {
  @apply relative rounded-12px p-6px box-border cursor-pointer transition-all duration-600 ease-in-out;
  svg {
    @apply transition-all duration-600 ease-in-out;
  }
  &:hover {
    @apply bg-[--chat-hover-color] scale-104;
    svg {
      @apply opacity-100 translate-x-20px;
    }
  }
}

.pdf-item {
  @apply relative;
  .content {
    @apply bg-[--chat-hover-color] h-195px rounded-12px p-10px box-border transition-all duration-600 ease-in-out;
  }
  .foot {
    @apply absolute top-2/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2;
    svg,
    p {
      @apply transition-all duration-600 ease-in-out;
    }
  }
  &:hover .content {
    @apply blur-md;
  }
  &:hover .foot {
    svg,
    p {
      @apply opacity-100 translate-y--30px;
    }
  }
}

.photo-item {
  @apply relative p-6px box-border;
  .foot {
    @apply w-full h-40px absolute bottom--30px left-0 rounded-12px transition-all duration-600 ease-in-out;
  }
  &:hover {
    .head {
      @apply blur-md scale-94 transition-all duration-600 ease-in-out;
    }
    .foot {
      @apply backdrop-blur-xl bg-#F1F1F133 translate-y--30px;
      svg,
      p {
        @apply opacity-100;
      }
    }
  }
}
</style>
