<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    title="모델 관리"
    style="width: 800px"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }">
    <template #header-extra>
      <n-button type="primary" size="small" @click="handleAdd">
        <template #icon>
          <Icon icon="mdi:plus" />
        </template>
        모델 추가
      </n-button>
    </template>

    <!-- 모델 목록 -->
    <n-spin :show="loading">
      <div v-if="modelList.length === 0" class="empty-container">
        <n-empty description="모델 데이터 없음" size="large">
          <template #icon>
            <Icon icon="mdi:package-variant-closed" class="text-48px color-#909090" />
          </template>
          <template #extra>
            <n-button type="primary" @click="handleAdd">첫 번째 모델 추가</n-button>
          </template>
        </n-empty>
      </div>

      <div v-else class="model-list">
        <div v-for="model in modelList" :key="model.id" class="model-card">
          <div class="model-card-header">
            <n-flex align="center" :size="12">
              <n-avatar round :size="48" :src="getModelAvatar(model)" :fallback-src="getDefaultAvatar()" />
              <div class="flex-1">
                <n-flex align="center" :size="8">
                  <span class="model-name">{{ model.name }}</span>
                  <n-tag :type="model.status === 0 ? 'success' : 'error'" size="small">
                    {{ model.status === 0 ? '사용 가능' : '사용 불가' }}
                  </n-tag>
                  <n-tag v-if="model.publicStatus === 0" type="info" size="small">공개</n-tag>
                  <n-tag v-else type="warning" size="small">비공개</n-tag>
                  <n-tag v-if="model.type === 1" type="info" size="small">대화</n-tag>
                  <n-tag v-else-if="model.type === 2" type="success" size="small">이미지</n-tag>
                  <n-tag v-else-if="model.type === 3" type="primary" size="small">오디오</n-tag>
                  <n-tag v-else-if="model.type === 4" type="warning" size="small">비디오</n-tag>
                  <n-tag v-else-if="model.type === 5" type="default" size="small">벡터</n-tag>
                  <n-tag v-else-if="model.type === 6" type="default" size="small">재정렬</n-tag>
                  <n-tag v-else-if="model.type === 7" type="warning" size="small">텍스트 투 비디오</n-tag>
                  <n-tag v-else-if="model.type === 8" type="error" size="small">이미지 투 비디오</n-tag>
                </n-flex>
                <div class="model-meta">
                  <span class="meta-item">플랫폼: {{ model.platform }}</span>
                  <span class="meta-item">모델: {{ model.model }}</span>
                </div>
              </div>
            </n-flex>
            <n-flex :size="8">
              <!-- 생성자만 편집 버튼 표시 (공개 및 비공개 모델 모두 편집 가능) -->
              <n-button v-if="isModelCreator(model)" size="small" @click="handleEdit(model)">
                <template #icon>
                  <Icon icon="mdi:pencil" />
                </template>
                편집
              </n-button>
              <!-- 생성자만 삭제 버튼 표시 (공개 및 비공개 모델 모두 삭제 가능) -->
              <n-popconfirm
                v-if="isModelCreator(model)"
                @positive-click="handleDelete(model.id)"
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
                <p>모델 "{{ model.name }}"을(를) 삭제하시겠습니까?</p>
                <p class="text-red-500">삭제 후에는 복구할 수 없습니다!</p>
              </n-popconfirm>
            </n-flex>
          </div>

          <div class="model-card-body">
            <n-descriptions :column="3" size="small" bordered>
              <n-descriptions-item label="온도 매개변수">
                {{ model.temperature ?? '-' }}
              </n-descriptions-item>
              <n-descriptions-item label="최대 토큰">
                {{ model.maxTokens ?? '-' }}
              </n-descriptions-item>
              <n-descriptions-item label="최대 컨텍스트">
                {{ model.maxContexts ?? '-' }}
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

  <!-- 모델 추가/편집 팝업 -->
  <n-modal
    v-model:show="showEditModal"
    preset="card"
    :title="editingModel ? '모델 편집' : '모델 추가'"
    style="width: 750px"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }">
    <n-scrollbar style="max-height: calc(80vh - 140px)">
      <n-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-placement="left"
        label-width="120px"
        style="padding-right: 12px">
        <n-form-item label="API 키" path="keyId">
          <n-flex :size="8" style="width: 100%">
            <n-select
              v-model:value="formData.keyId"
              :options="apiKeyOptions"
              placeholder="API 키를 선택하세요"
              style="flex: 1"
              @update:value="handleKeyIdChange" />
            <n-button @click="handleOpenApiKeyManagement">
              <template #icon>
                <Icon icon="mdi:cog" />
              </template>
              관리
            </n-button>
          </n-flex>
        </n-form-item>

        <n-form-item label="플랫폼" path="platform">
          <n-input v-model:value="formData.platform" placeholder="API 키에 따라 자동 설정됨" disabled />
        </n-form-item>

        <n-form-item label="모델 프로필" path="avatar">
          <n-flex :size="12" align="center" style="width: 100%">
            <n-avatar :key="formData.avatar" :src="formData.avatar" :size="60" round fallback-src="">
              <Icon v-if="!formData.avatar" icon="mdi:account-circle" :size="40" />
            </n-avatar>
            <n-flex vertical :size="8" style="flex: 1">
              <n-button size="small" @click="openAvatarCropper">
                <template #icon>
                  <Icon icon="mdi:upload" />
                </template>
                {{ formData.avatar ? '프로필 변경' : '프로필 업로드' }}
              </n-button>
              <span v-if="formData.avatar" class="text-(12px #909090)">
                업로드됨
                <n-button text type="error" size="tiny" @click="formData.avatar = ''">지우기</n-button>
              </span>
            </n-flex>
          </n-flex>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="handleFileChange" />
        </n-form-item>

        <n-form-item label="모델 유형" path="type">
          <n-flex :size="8" style="flex-wrap: wrap">
            <n-button :type="formData.type === 1 ? 'primary' : 'default'" size="small" @click="formData.type = 1">
              <template #icon>
                <Icon icon="mdi:message-text" />
              </template>
              대화
            </n-button>
            <n-button :type="formData.type === 2 ? 'primary' : 'default'" size="small" @click="formData.type = 2">
              <template #icon>
                <Icon icon="mdi:image" />
              </template>
              이미지
            </n-button>
            <n-button :type="formData.type === 3 ? 'primary' : 'default'" size="small" @click="formData.type = 3">
              <template #icon>
                <Icon icon="mdi:microphone" />
              </template>
              오디오
            </n-button>
            <n-button :type="formData.type === 7 ? 'primary' : 'default'" size="small" @click="formData.type = 7">
              <template #icon>
                <Icon icon="mdi:video-outline" />
              </template>
              텍스트 투 비디오
            </n-button>
            <n-button :type="formData.type === 8 ? 'primary' : 'default'" size="small" @click="formData.type = 8">
              <template #icon>
                <Icon icon="mdi:video-image" />
              </template>
              이미지 투 비디오
            </n-button>
          </n-flex>
        </n-form-item>

        <n-form-item label="모델 이름" path="name">
          <n-input
            v-model:value="formData.name"
            placeholder="모델 이름을 입력하세요 (예: GPT-4)"
            @update:value="handleNameChange" />
        </n-form-item>

        <n-form-item label="모델 식별자" path="model">
          <n-flex vertical :size="4" style="width: 100%">
            <n-flex :size="8" style="width: 100%">
              <n-select
                v-if="modelExamples.length > 0"
                v-model:value="formData.model"
                :options="modelExamples"
                :placeholder="modelPlaceholder"
                :disabled="!formData.platform"
                filterable
                tag
                style="flex: 1" />
              <n-input
                v-else
                v-model:value="formData.model"
                :placeholder="modelPlaceholder"
                :disabled="!formData.platform"
                style="flex: 1" />
              <n-button v-if="modelDocsUrl" text tag="a" :href="modelDocsUrl" target="_blank" type="info">
                <template #icon>
                  <Icon icon="mdi:open-in-new" />
                </template>
                문서
              </n-button>
            </n-flex>
            <n-text depth="3" style="font-size: 12px">
              {{ modelHint }}
            </n-text>
            <n-text v-if="modelDocsUrl" depth="3" style="font-size: 12px">
              문서 링크:
              <n-a :href="modelDocsUrl" target="_blank" style="font-size: 12px">
                {{ modelDocsUrl }}
              </n-a>
            </n-text>
          </n-flex>
        </n-form-item>

        <n-form-item label="상태" path="status">
          <n-select v-model:value="formData.status" :options="statusOptions" placeholder="상태를 선택하세요" />
        </n-form-item>

        <n-form-item label="정렬 값" path="sort">
          <n-input-number v-model:value="formData.sort" :min="0" placeholder="값이 작을수록 앞에 표시됨" style="width: 100%" />
        </n-form-item>

        <n-form-item label="온도 매개변수" path="temperature">
          <n-input-number
            v-model:value="formData.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            placeholder="0-2 사이, 무작위성 제어 (선택 사항)"
            style="width: 100%" />
        </n-form-item>

        <n-form-item label="최대 토큰 수" path="maxTokens">
          <n-input-number
            v-model:value="formData.maxTokens"
            :min="1"
            placeholder="단일 응답의 최대 토큰 수 (선택 사항)"
            style="width: 100%" />
        </n-form-item>

        <n-form-item label="최대 컨텍스트 수" path="maxContexts">
          <n-input-number
            v-model:value="formData.maxContexts"
            :min="1"
            placeholder="컨텍스트의 최대 메시지 수 (선택 사항)"
            style="width: 100%" />
        </n-form-item>

        <n-form-item label="공개 여부" path="publicStatus">
          <n-switch :value="formData.publicStatus === 0" @update:value="handlePublicStatusChange">
            <template #checked>공개</template>
            <template #unchecked>비공개</template>
          </n-switch>
        </n-form-item>
      </n-form>
    </n-scrollbar>

    <template #footer>
      <n-flex justify="end" :size="12">
        <n-button @click="showEditModal = false">취소</n-button>
        <n-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ editingModel ? '저장' : '생성' }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>

  <!-- API 키 관리 팝업 -->
  <ApiKeyManagement v-model="showApiKeyManagement" @refresh="handleApiKeyManagementRefresh" />
  <!-- 프로필 자르기 컴포넌트 -->
  <AvatarCropper ref="cropperRef" v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" />
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { FormRules, FormInst } from 'naive-ui'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { useUserStore } from '@/stores/user'
import {
  modelPage,
  modelUpdate,
  modelDelete,
  apiKeySimpleList,
  platformList,
  platformAddModel
} from '@/utils/ImRequestUtils'
import ApiKeyManagement from './ApiKeyManagement.vue'

const showModal = defineModel<boolean>({ default: false })
const emit = defineEmits<{
  refresh: []
}>()

const userStore = useUserStore()

// 현재 사용자가 모델 생성자인지 확인
const isModelCreator = (model: any) => {
  return userStore.userInfo?.uid === model.userId
}

// 모델 목록
const loading = ref(false)
const modelList = ref<any[]>([])
const pagination = ref({
  pageNo: 1,
  pageSize: 10,
  total: 0
})

// API 키 관리
const showApiKeyManagement = ref(false)
const apiKeyOptions = ref<any[]>([])
const apiKeyMap = ref<Map<string, any>>(new Map())

// 편집 관련
const showEditModal = ref(false)
const editingModel = ref<any>(null)
const submitting = ref(false)
const formRef = ref<FormInst>()

// 폼 데이터
const formData = ref({
  keyId: '',
  name: '',
  model: '',
  platform: '',
  avatar: '',
  type: 1,
  sort: 0,
  status: 0,
  temperature: 0.8,
  maxTokens: 4096,
  maxContexts: 10,
  publicStatus: 1 // 0=공개, 1=비공개
})

// 플랫폼 옵션 및 모델 정보
const platformOptions = ref<Array<{ label: string; value: string }>>([])
const platformModelInfo = ref<Record<string, { examples: string; docs: string; hint: string }>>({})

// 플랫폼 목록 로드
const loadPlatformList = async () => {
  try {
    const data = await platformList()
    if (data && Array.isArray(data)) {
      platformOptions.value = data.map((item: any) => ({
        label: item.label,
        value: item.platform
      }))

      // 플랫폼 모델 정보 매핑 구축
      const infoMap: Record<string, { examples: string; docs: string; hint: string }> = {}
      data.forEach((item: any) => {
        infoMap[item.platform] = {
          examples: item.examples || '',
          docs: item.docs || '',
          hint: item.hint || ''
        }
      })
      platformModelInfo.value = infoMap
    }
  } catch (error) {
    // 로드 실패 시 기본값 사용
    platformOptions.value = [
      { label: 'OpenAI', value: 'OpenAI' },
      { label: 'DeepSeek', value: 'DeepSeek' }
    ]
    platformModelInfo.value = {
      OpenAI: {
        examples: 'gpt-4, gpt-4-turbo, gpt-3.5-turbo',
        docs: 'https://platform.openai.com/docs/models',
        hint: 'OpenAI 공식 웹사이트에서 사용 가능한 모델 목록을 확인하세요'
      },
      DeepSeek: {
        examples: 'deepseek-chat, deepseek-reasoner, deepseek-coder',
        docs: 'https://platform.deepseek.com/api-docs',
        hint: 'DeepSeek 공식 웹사이트에서 사용 가능한 모델 목록을 확인하세요'
      }
    }
  }
}

// 계산된 속성: 모델 예시 목록 (드롭다운 선택용)
const modelExamples = computed(() => {
  if (!formData.value.platform) {
    return []
  }
  const info = platformModelInfo.value[formData.value.platform]
  if (!info || !info.examples) {
    return []
  }
  // examples 문자열을 쉼표로 분할, 중복 제거 및 옵션 형식으로 변환
  const models = info.examples
    .split(',')
    .map((model) => model.trim())
    .filter((model) => model.length > 0)

  // Set을 사용하여 중복 제거, 순서 유지
  const uniqueModels = Array.from(new Set(models))

  return uniqueModels.map((model) => ({
    label: model,
    value: model
  }))
})

// 계산된 속성: 모델 문서 링크
const modelDocsUrl = computed(() => {
  if (!formData.value.platform) {
    return ''
  }
  const info = platformModelInfo.value[formData.value.platform]
  return info ? info.docs : ''
})

// 계산된 속성: 모델 입력 상자의 플레이스홀더
const modelPlaceholder = computed(() => {
  if (!formData.value.platform) {
    return '플랫폼을 먼저 선택하세요'
  }
  const info = platformModelInfo.value[formData.value.platform]
  if (modelExamples.value.length > 0) {
    return '모델 식별자를 선택하거나 입력하세요'
  }
  return info ? `예: ${info.examples}` : '모델 식별자를 입력하세요'
})

// 계산된 속성: 모델 입력 힌트
const modelHint = computed(() => {
  if (!formData.value.platform) {
    return '플랫폼을 선택한 후 모델 식별자를 입력하세요'
  }
  const info = platformModelInfo.value[formData.value.platform]
  return info ? info.hint : '올바른 모델 식별자를 입력하세요'
})

// 모델 입력 변경 감지, 백엔드에 자동 저장
let saveModelTimeout: NodeJS.Timeout | null = null
watch(
  () => formData.value.model,
  async (newModel, _oldModel) => {
    // 이전 타이머 지우기
    if (saveModelTimeout) {
      clearTimeout(saveModelTimeout)
    }

    // 모델이 비어 있거나 플랫폼이 선택되지 않은 경우 처리 안 함
    if (!newModel || !formData.value.platform) {
      return
    }

    // 모델이 이미 예시 목록에 있는 경우 저장할 필요 없음
    const existingModels = modelExamples.value.map((item) => item.value)
    if (existingModels.includes(newModel)) {
      return
    }

    // 디바운스: 사용자가 입력을 멈춘 후 1초 뒤에 저장
    saveModelTimeout = setTimeout(async () => {
      try {
        await platformAddModel(formData.value.platform, newModel)
        // 플랫폼 목록 다시 로드, 예시 업데이트
        await loadPlatformList()
        window.$message?.success('모델이 예시 목록에 추가되었습니다')
      } catch (error) {
        console.error('모델 저장 실패:', error)
        // 조용히 실패, 사용자 작업에 영향 없음
      }
    }, 1000)
  }
)

// 상태 옵션
const statusOptions = [
  { label: '사용 가능', value: 0 },
  { label: '사용 불가', value: 1 }
]

// 폼 검증 규칙
const formRules: FormRules = {
  keyId: [{ required: true, message: 'API 키를 선택하세요', trigger: 'change' }],
  name: [{ required: true, message: '모델 이름을 입력하세요', trigger: 'blur' }],
  model: [{ required: true, message: '모델 식별자를 입력하세요', trigger: 'blur' }],
  platform: [{ required: true, message: '플랫폼을 선택하세요', trigger: 'change' }],
  type: [
    {
      required: true,
      type: 'number',
      message: '모델 유형을 선택하세요',
      trigger: 'change',
      validator: (_rule: any, value: any) => {
        return value !== undefined && value !== null && value !== ''
      }
    }
  ],
  sort: [
    {
      required: true,
      type: 'number',
      message: '정렬 값을 입력하세요',
      trigger: 'blur',
      validator: (_rule: any, value: any) => {
        return value !== undefined && value !== null && value !== ''
      }
    }
  ],
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

// 기본 프로필 가져오기
const getDefaultAvatar = () => {
  return 'https://img1.baidu.com/it/u=3613958228,3522035000&fm=253&fmt=auto&app=120&f=JPEG?w=500&h=500'
}

// 모델 프로필 가져오기
const getModelAvatar = (model: any) => {
  if (!model) return getDefaultAvatar()
  if (model.avatar) return model.avatar
  return getDefaultAvatar()
}

// API 키 옵션 로드
const loadApiKeyOptions = async () => {
  try {
    const data = await apiKeySimpleList()
    apiKeyOptions.value = (data || []).map((item: any) => ({
      label: item.platform ? `${item.name} (${item.platform})` : item.name,
      value: item.id
    }))
    apiKeyMap.value = new Map((data || []).map((item: any) => [item.id, item]))
  } catch (error) {
    console.error('API 키 목록 로드 실패:', error)
  }
}

// 모델 목록 로드
const loadModelList = async () => {
  loading.value = true
  try {
    const data = await modelPage({
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize
    })
    modelList.value = data.list || []
    pagination.value.total = data.total || 0
  } catch (error) {
    console.error('모델 목록 로드 실패:', error)
    window.$message.error('모델 목록 로드 실패')
  } finally {
    loading.value = false
  }
}

// 페이지 변경
const handlePageChange = (page: number) => {
  pagination.value.pageNo = page
  loadModelList()
}

// API 키 전환 처리
const handleKeyIdChange = (keyId: string) => {
  if (keyId) {
    const apiKeyInfo = apiKeyMap.value.get(keyId)
    if (apiKeyInfo && apiKeyInfo.platform) {
      // 플랫폼 자동 채우기
      formData.value.platform = apiKeyInfo.platform
      // 모델 식별자 지우기, 사용자가 다시 입력하도록 함
      formData.value.model = ''
    }
  }
}

// 모델 이름 변경 처리 - 모델 식별자에 단방향 동기화
const handleNameChange = (value: string) => {
  // 모델 이름을 모델 식별자에 동기화 (단방향 바인딩)
  if (value) {
    formData.value.model = value
  }
}

// 공개 상태 변경 처리
const handlePublicStatusChange = (checked: boolean) => {
  formData.value.publicStatus = checked ? 0 : 1
}

// 모델 추가
const handleAdd = () => {
  editingModel.value = null
  formData.value = {
    keyId: '',
    name: '',
    model: '',
    platform: '',
    avatar: '',
    type: 1,
    sort: 0,
    status: 0,
    temperature: 0.8,
    maxTokens: 4096,
    maxContexts: 10,
    publicStatus: 1 // 0=공개, 1=비공개
  }
  showEditModal.value = true
}

const {
  fileInput,
  localImageUrl,
  showCropper,
  cropperRef,
  openAvatarCropper,
  handleFileChange,
  handleCrop: onCrop
} = useAvatarUpload({
  onSuccess: async (downloadUrl) => {
    formData.value.avatar = ''
    await nextTick()
    formData.value.avatar = downloadUrl
    await nextTick()
    window.$message.success('프로필 업로드 성공')
  }
})

const handleCrop = async (cropBlob: Blob) => {
  await onCrop(cropBlob)
}

// 모델 편집
const handleEdit = (model: any) => {
  editingModel.value = model
  formData.value = {
    keyId: model.keyId || '',
    name: model.name,
    model: model.model,
    platform: model.platform,
    avatar: model.avatar || '',
    type: model.type ?? 1,
    sort: model.sort ?? 0,
    status: model.status ?? 0,
    temperature: model.temperature ?? 0.8,
    maxTokens: model.maxTokens ?? 4096,
    maxContexts: model.maxContexts ?? 10,
    publicStatus: model.publicStatus ?? 0 // 0=공개, 1=비공개
  }
  showEditModal.value = true
}

// 폼 제출
const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    submitting.value = true

    const submitData: any = {
      keyId: formData.value.keyId,
      name: formData.value.name,
      model: formData.value.model,
      platform: formData.value.platform,
      avatar: formData.value.avatar,
      type: formData.value.type,
      sort: formData.value.sort,
      status: formData.value.status,
      temperature: formData.value.temperature,
      maxTokens: formData.value.maxTokens,
      maxContexts: formData.value.maxContexts,
      publicStatus: formData.value.publicStatus
    }
    if (editingModel.value) {
      submitData.id = editingModel.value.id
      await modelUpdate(submitData)
      window.$message.success('모델 업데이트 성공')
    } else {
      await modelUpdate(submitData)
      window.$message.success('모델 생성 성공')
    }

    showEditModal.value = false
    loadModelList()
    // 通知父组件刷新
    emit('refresh')
  } catch (error: any) {
    if (error?.errors) {
      // 폼 검증 오류
      return
    }
    console.error('모델 저장 실패:', error)
    window.$message.error('모델 저장 실패')
  } finally {
    submitting.value = false
  }
}

// 모델 삭제
const handleDelete = async (id: string) => {
  try {
    await modelDelete({ id })
    window.$message.success('모델 삭제 성공')
    loadModelList()
    // 부모 컴포넌트에 새로고침 알림
    emit('refresh')
  } catch (error) {
    console.error('모델 삭제 실패:', error)
    window.$message.error('모델 삭제 실패')
  }
}

// API 키 관리 열기
const handleOpenApiKeyManagement = () => {
  showApiKeyManagement.value = true
}

// API 키 관리 새로고침 후 콜백
const handleApiKeyManagementRefresh = () => {
  loadApiKeyOptions()
}

// 팝업 표시 상태 감지
watch(showModal, (val) => {
  if (val) {
    loadApiKeyOptions()
    loadModelList()
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

.model-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.model-card {
  border: 1px solid var(--line-color);
  border-radius: 8px;
  padding: 16px;
  background: var(--bg-color);
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .model-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .model-name {
      font-size: 16px;
      font-weight: 500;
      color: var(--text-color);
    }

    .model-meta {
      display: flex;
      gap: 12px;
      margin-top: 4px;

      .meta-item {
        font-size: 12px;
        color: #909090;
      }
    }
  }

  .model-card-body {
    margin-top: 12px;
  }
}
</style>
