<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    title="API 키 관리"
    style="width: 900px"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }">
    <template #header-extra>
      <n-button type="primary" size="small" @click="handleAdd">
        <template #icon>
          <Icon icon="mdi:plus" />
        </template>
        키 추가
      </n-button>
    </template>

    <!-- 키 목록 -->
    <n-spin :show="loading">
      <div v-if="apiKeyList.length === 0" class="empty-container">
        <n-empty description="API 키 없음" size="large">
          <template #icon>
            <Icon icon="mdi:key-variant" class="text-48px color-#909090" />
          </template>
          <template #extra>
            <n-button type="primary" @click="handleAdd">첫 번째 키 추가</n-button>
          </template>
        </n-empty>
      </div>

      <div v-else class="api-key-list">
        <div v-for="apiKey in apiKeyList" :key="apiKey.id" class="api-key-card">
          <div class="api-key-card-header">
            <n-flex align="center" :size="12">
              <Icon icon="mdi:key-variant" class="text-32px color-primary" />
              <div class="flex-1">
                <n-flex align="center" :size="8">
                  <span class="api-key-name">{{ apiKey.name }}</span>
                  <n-tag :type="apiKey.status === 0 ? 'success' : 'error'" size="small">
                    {{ apiKey.status === 0 ? '사용 가능' : '사용 불가' }}
                  </n-tag>
                  <n-tag v-if="apiKey.publicStatus" type="info" size="small">공개</n-tag>
                  <n-tag v-else type="warning" size="small">비공개</n-tag>
                </n-flex>
                <div class="api-key-meta">
                  <span class="meta-item">플랫폼: {{ apiKey.platform }}</span>
                  <span class="meta-item">키: {{ maskApiKey(apiKey.apiKey) }}</span>
                </div>
              </div>
            </n-flex>
            <n-flex :size="8">
              <!-- 잔액 조회 버튼 -->
              <n-button
                size="small"
                type="info"
                :loading="balanceLoadingMap[apiKey.id]"
                @click="handleQueryBalance(apiKey.id)">
                <template #icon>
                  <Icon icon="mdi:cash-multiple" />
                </template>
                잔액 조회
              </n-button>
              <!-- 비공개 키만 편집 버튼 표시 -->
              <n-button v-if="!apiKey.publicStatus" size="small" @click="handleEdit(apiKey)">
                <template #icon>
                  <Icon icon="mdi:pencil" />
                </template>
                편집
              </n-button>
              <!-- 비공개 키만 삭제 버튼 표시 -->
              <n-popconfirm
                v-if="!apiKey.publicStatus"
                @positive-click="handleDelete(apiKey.id)"
                positive-text="삭제"
                negative-text="취소">
                <template #trigger>
                  <n-button size="small" type="error">
                    <template #icon>
                      <Icon icon="mdi:delete" />
                    </template>
                    삭제
                  </n-button>
                </template>
                <p>키 "{{ apiKey.name }}"를 삭제하시겠습니까?</p>
                <p class="text-red-500">삭제 후에는 복구할 수 없습니다!</p>
              </n-popconfirm>
            </n-flex>
          </div>

          <div v-if="apiKey.url || balanceMap[apiKey.id]" class="api-key-card-body">
            <n-descriptions :column="1" size="small" bordered>
              <n-descriptions-item v-if="apiKey.url" label="API 주소">
                {{ apiKey.url }}
              </n-descriptions-item>
              <n-descriptions-item v-if="balanceMap[apiKey.id]" label="계정 잔액">
                <n-flex align="center" :size="8">
                  <span class="text-primary font-600 text-16px">
                    {{ balanceMap[apiKey.id].balanceInfos[0].totalBalance || '0' }}
                  </span>
                  <span class="text-gray-500">{{ balanceMap[apiKey.id].balanceInfos[0].currency || 'USD' }}</span>
                </n-flex>
              </n-descriptions-item>
            </n-descriptions>
          </div>
        </div>
      </div>
    </n-spin>

    <!-- 페이지네이션 -->
    <n-flex v-if="pagination.total > pagination.pageSize" justify="center" class="mt-16px">
      <n-pagination
        v-model:page="pagination.pageNo"
        :page-size="pagination.pageSize"
        :page-count="Math.ceil(pagination.total / pagination.pageSize)"
        @update:page="handlePageChange" />
    </n-flex>
  </n-modal>

  <!-- 키 추가/편집 팝업 -->
  <n-modal
    v-model:show="showEditModal"
    preset="card"
    :title="editingApiKey ? '키 편집' : '키 추가'"
    style="width: 600px"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }">
    <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="left" label-width="100px">
      <n-form-item label="키 이름" path="name">
        <n-input v-model:value="formData.name" placeholder="키 이름을 입력하세요 (예: OpenAI 메인 계정)" />
      </n-form-item>

      <n-form-item label="API 키" path="apiKey">
        <n-input
          v-model:value="formData.apiKey"
          type="password"
          show-password-on="click"
          placeholder="API 키를 입력하세요" />
      </n-form-item>

      <n-form-item label="플랫폼" path="platform">
        <n-select v-model:value="formData.platform" :options="platformOptions" placeholder="플랫폼을 선택하세요" />
      </n-form-item>

      <n-form-item label="API 주소" path="url">
        <n-input v-model:value="formData.url" placeholder="선택 사항 (예: https://api.openai.com/v1)" />
      </n-form-item>

      <n-form-item label="상태" path="status">
        <n-select v-model:value="formData.status" :options="statusOptions" placeholder="상태를 선택하세요" />
      </n-form-item>
    </n-form>

    <template #footer>
      <n-flex justify="end" :size="12">
        <n-button @click="showEditModal = false">취소</n-button>
        <n-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ editingApiKey ? '저장' : '생성' }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { FormRules, FormInst } from 'naive-ui'
import {
  apiKeyPage,
  apiKeyCreate,
  apiKeyUpdate,
  apiKeyDelete,
  apiKeyBalance,
  platformList
} from '@/utils/ImRequestUtils'

const showModal = defineModel<boolean>({ default: false })
const emit = defineEmits<{
  refresh: []
}>()

// 키 목록
const loading = ref(false)
const apiKeyList = ref<any[]>([])
const pagination = ref({
  pageNo: 1,
  pageSize: 10,
  total: 0
})

// 잔액 관련
const balanceMap = ref<Record<string, any>>({}) // 각 키의 잔액 정보 저장
const balanceLoadingMap = ref<Record<string, boolean>>({}) // 각 키의 잔액 로딩 상태 저장

// 편집 관련
const showEditModal = ref(false)
const editingApiKey = ref<any>(null)
const submitting = ref(false)
const formRef = ref<FormInst>()

// 폼 데이터
const formData = ref({
  name: '',
  apiKey: '',
  platform: '',
  url: '',
  status: 0
})

// 플랫폼 옵션
const platformOptions = ref<Array<{ label: string; value: string }>>([])

// 플랫폼 목록 로드
const loadPlatformList = async () => {
  try {
    const data = await platformList()

    if (data && Array.isArray(data)) {
      platformOptions.value = data.map((item: any) => ({
        label: item.label,
        value: item.platform
      }))
    } else {
      console.warn('플랫폼 목록 데이터 형식이 올바르지 않습니다:', data)
      platformOptions.value = []
    }
  } catch (error) {
    // 로드 실패 시 기본값 사용
    platformOptions.value = [
      { label: 'SiliconFlow (硅基流动)', value: 'SiliconFlow' },
      { label: 'Gitee AI', value: 'GiteeAI' }
    ]
  }
}

// 상태 옵션
const statusOptions = [
  { label: '사용 가능', value: 0 },
  { label: '사용 불가', value: 1 }
]

// 폼 검증 규칙
const formRules: FormRules = {
  name: [{ required: true, message: '키 이름을 입력하세요', trigger: 'blur' }],
  apiKey: [{ required: true, message: 'API 키를 입력하세요', trigger: 'blur' }],
  platform: [{ required: true, message: '플랫폼을 선택하세요', trigger: 'change' }],
  status: [
    {
      required: true,
      type: 'number',
      message: '상태를 선택하세요',
      trigger: 'change',
      validator: (_rule: any, value: any) => {
        return value !== undefined && value !== null && value !== ''
      }
    }
  ]
}

// API 키 마스킹 처리
const maskApiKey = (key: string) => {
  if (!key) return ''
  if (key.length <= 8) return '***'
  return key.substring(0, 4) + '***' + key.substring(key.length - 4)
}

// 키 목록 로드
const loadApiKeyList = async () => {
  loading.value = true
  try {
    const data = await apiKeyPage({
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize
    })
    apiKeyList.value = data.list || []
    pagination.value.total = data.total || 0
  } catch (error) {
    console.error('API 키 목록 로드 실패:', error)
    window.$message.error('API 키 목록 로드 실패')
  } finally {
    loading.value = false
  }
}

// 페이지 변경
const handlePageChange = (page: number) => {
  pagination.value.pageNo = page
  loadApiKeyList()
}

// 키 추가
const handleAdd = () => {
  editingApiKey.value = null
  formData.value = {
    name: '',
    apiKey: '',
    platform: '',
    url: '',
    status: 0
  }
  showEditModal.value = true
}

// 키 편집
const handleEdit = (apiKey: any) => {
  editingApiKey.value = apiKey
  formData.value = {
    name: apiKey.name,
    apiKey: apiKey.apiKey,
    platform: apiKey.platform,
    url: apiKey.url || '',
    status: apiKey.status ?? 0
  }
  showEditModal.value = true
}

// 폼 제출
const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    submitting.value = true

    const submitData: any = {
      name: formData.value.name,
      apiKey: formData.value.apiKey,
      platform: formData.value.platform,
      status: formData.value.status
    }

    if (formData.value.url) {
      submitData.url = formData.value.url
    }

    if (editingApiKey.value) {
      // 업데이트
      submitData.id = editingApiKey.value.id
      await apiKeyUpdate(submitData)
      window.$message.success('키 업데이트 성공')
    } else {
      // 생성
      await apiKeyCreate(submitData)
      window.$message.success('키 생성 성공')
    }

    showEditModal.value = false
    loadApiKeyList()
    // 부모 컴포넌트에 새로고침 알림
    emit('refresh')
  } catch (error: any) {
    if (error?.errors) {
      return
    }
    console.error('키 저장 실패:', error)
    window.$message.error('키 저장 실패')
  } finally {
    submitting.value = false
  }
}

// 키 삭제
const handleDelete = async (id: string) => {
  try {
    await apiKeyDelete({ id })
    window.$message.success('키 삭제 성공')
    loadApiKeyList()
    emit('refresh')
  } catch (error) {
    console.error('키 삭제 실패:', error)
    window.$message.error('키 삭제 실패')
  }
}

// 잔액 조회
const handleQueryBalance = async (id: string) => {
  try {
    balanceLoadingMap.value[id] = true
    const data = await apiKeyBalance({ id })
    balanceMap.value[id] = data
    window.$message.success('잔액 조회 성공')
  } catch (error) {
    console.error('잔액 조회 실패:', error)
    window.$message.error('잔액 조회 실패')
  } finally {
    balanceLoadingMap.value[id] = false
  }
}

// 팝업 표시 상태 감지
watch(showModal, (val) => {
  if (val) {
    loadApiKeyList()
    loadPlatformList()
  }
})

// 컴포넌트 마운트 시 플랫폼 목록 로드
onMounted(() => {
  loadPlatformList()
})
</script>

<style scoped lang="scss">
.empty-container {
  padding: 40px 0;
}

.api-key-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.api-key-card {
  border: 1px solid var(--line-color);
  border-radius: 8px;
  padding: 16px;
  background: var(--bg-color);
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .api-key-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .api-key-name {
      font-size: 16px;
      font-weight: 500;
      color: var(--text-color);
    }

    .api-key-meta {
      display: flex;
      gap: 12px;
      margin-top: 4px;

      .meta-item {
        font-size: 12px;
        color: #909090;
      }
    }
  }

  .api-key-card-body {
    margin-top: 12px;
  }
}
</style>
