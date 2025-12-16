<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    title="역할 관리"
    style="width: 1000px"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }">
    <template #header-extra>
      <n-button type="primary" size="small" @click="handleAdd">
        <template #icon>
          <Icon icon="mdi:plus" />
        </template>
        역할 추가
      </n-button>
    </template>

    <!-- 역할 목록 - 스크롤 컨테이너 추가 -->
    <n-scrollbar style="max-height: calc(80vh - 140px)">
      <n-spin :show="loading">
        <div v-if="roleList.length === 0" class="empty-container">
          <n-empty description="역할 없음" size="large">
            <template #icon>
              <Icon icon="mdi:account-circle" class="text-48px color-#909090" />
            </template>
            <template #extra>
              <n-button type="primary" @click="handleAdd">첫 번째 역할 추가</n-button>
            </template>
          </n-empty>
        </div>

        <div v-else class="role-list">
          <div v-for="role in roleList" :key="role.id" class="role-card">
            <div class="role-card-header">
              <n-flex align="center" :size="12">
                <n-avatar :src="role.avatar" :size="48" round />
                <div class="flex-1">
                  <n-flex align="center" :size="8">
                    <span class="role-name">{{ role.name }}</span>
                    <n-tag :type="role.status === 0 ? 'success' : 'error'" size="small">
                      {{ role.status === 0 ? '사용 가능' : '사용 불가' }}
                    </n-tag>
                    <n-tag v-if="role.publicStatus" type="info" size="small">공개</n-tag>
                    <n-tag v-else type="warning" size="small">비공개</n-tag>
                  </n-flex>
                  <div class="role-meta">
                    <span class="meta-item">카테고리: {{ role.category }}</span>
                    <span class="meta-item">정렬: {{ role.sort }}</span>
                  </div>
                </div>
              </n-flex>
              <n-flex :size="8">
                <!-- 생성자만 편집 버튼 표시 -->
                <n-button v-if="isRoleCreator(role)" size="small" @click="handleEdit(role)">
                  <template #icon>
                    <Icon icon="mdi:pencil" />
                  </template>
                  편집
                </n-button>
                <!-- 생성자만 삭제 버튼 표시 -->
                <n-popconfirm
                  v-if="isRoleCreator(role)"
                  @positive-click="handleDelete(role.id)"
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
                  <p>역할 "{{ role.name }}"을(를) 삭제하시겠습니까?</p>
                  <p class="text-red-500">삭제 후에는 복구할 수 없습니다!</p>
                </n-popconfirm>
              </n-flex>
            </div>

            <div class="role-card-body">
              <n-descriptions :column="1" size="small" bordered>
                <n-descriptions-item label="역할 설명">
                  {{ role.description }}
                </n-descriptions-item>
                <n-descriptions-item label="역할 설정">
                  {{ role.systemMessage }}
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
    </n-scrollbar>
  </n-modal>

  <n-modal
    v-model:show="showEditModal"
    preset="card"
    :title="editingRole ? '역할 편집' : '역할 추가'"
    style="width: 700px"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }">
    <n-scrollbar style="max-height: calc(80vh - 140px)">
      <n-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-placement="left"
        label-width="100px"
        style="padding-right: 12px">
        <n-form-item label="역할 이름" path="name">
          <n-input v-model:value="formData.name" placeholder="역할 이름을 입력하세요 (예: 일반 AI 도우미)" />
        </n-form-item>

        <n-form-item label="역할 프로필" path="avatar">
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
          <!-- 숨겨진 파일 입력 -->
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="handleFileChange" />
        </n-form-item>

        <n-form-item label="역할 카테고리" path="category">
          <n-select
            v-model:value="formData.category"
            :options="categoryOptions"
            placeholder="역할 카테고리를 선택하세요"
            filterable
            tag />
        </n-form-item>

        <n-form-item label="모델" path="modelId">
          <n-select
            v-model:value="formData.modelId"
            :options="modelOptions"
            placeholder="선택 사항, 선택하지 않으면 기본 모델 사용"
            clearable />
        </n-form-item>

        <n-form-item label="정렬 값" path="sort">
          <n-input-number v-model:value="formData.sort" :min="0" placeholder="값이 작을수록 앞에 표시됨" style="width: 100%" />
        </n-form-item>

        <n-form-item label="상태" path="status">
          <n-select v-model:value="formData.status" :options="statusOptions" placeholder="상태를 선택하세요" />
        </n-form-item>

        <n-form-item label="공개 여부" path="publicStatus">
          <n-switch v-model:value="formData.publicStatus">
            <template #checked>공개</template>
            <template #unchecked>비공개</template>
          </n-switch>
        </n-form-item>

        <n-form-item label="역할 설명" path="description">
          <n-input
            v-model:value="formData.description"
            type="textarea"
            :rows="3"
            placeholder="역할 설명을 입력하세요 (예: 다양한 문제를 해결해 주는 일반 AI 도우미)" />
        </n-form-item>

        <n-form-item label="역할 설정" path="systemMessage">
          <n-input
            v-model:value="formData.systemMessage"
            type="textarea"
            :rows="5"
            placeholder="역할 설정을 입력하세요 (예: 당신은 친절하고 전문적인 AI 도우미이며, 항상 긍정적인 태도로 사용자의 문제 해결을 돕습니다...)" />
        </n-form-item>
      </n-form>
    </n-scrollbar>

    <template #footer>
      <n-flex justify="end" :size="12">
        <n-button @click="showEditModal = false">취소</n-button>
        <n-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ editingRole ? '저장' : '생성' }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>

  <!-- 프로필 자르기 컴포넌트 -->
  <AvatarCropper ref="cropperRef" v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" />
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { FormRules, FormInst } from 'naive-ui'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { useMitt } from '@/hooks/useMitt'
import { useUserStore } from '@/stores/user'
import {
  chatRolePage,
  chatRoleCreate,
  chatRoleUpdate,
  chatRoleDelete,
  chatRoleCategoryList,
  modelPage
} from '@/utils/ImRequestUtils'

const showModal = defineModel<boolean>({ default: false })
const emit = defineEmits<{
  refresh: []
}>()

const userStore = useUserStore()

// 현재 사용자가 역할 생성자인지 확인
const isRoleCreator = (role: any) => {
  return userStore.userInfo?.uid === role.userId
}

// 역할 목록
const loading = ref(false)
const roleList = ref<any[]>([])
const pagination = ref({
  pageNo: 1,
  pageSize: 10,
  total: 0
})

// 편집 관련
const showEditModal = ref(false)
const editingRole = ref<any>(null)
const submitting = ref(false)
const formRef = ref<FormInst>()

// 폼 데이터
const formData = ref({
  modelId: '',
  name: '',
  avatar: '',
  category: 'AI 도우미',
  sort: 0,
  description: '',
  systemMessage: '',
  publicStatus: false,
  status: 0
})

// 카테고리 옵션 (기본 옵션)
const categoryOptions = ref<any[]>([
  { label: 'AI 도우미', value: 'AI 도우미' },
  { label: '글쓰기', value: '글쓰기' },
  { label: '프로그래밍 개발', value: '프로그래밍 개발' },
  { label: '학습 및 교육', value: '학습 및 교육' },
  { label: '생활 및 엔터테인먼트', value: '생활 및 엔터테인먼트' },
  { label: '비즈니스 사무', value: '비즈니스 사무' },
  { label: '창의적 디자인', value: '창의적 디자인' },
  { label: '데이터 분석', value: '데이터 분석' },
  { label: '번역', value: '번역' },
  { label: '기타', value: '기타' }
])

// 모델 옵션
const modelOptions = ref<any[]>([])

// 상태 옵션
const statusOptions = [
  { label: '사용 가능', value: 0 },
  { label: '사용 불가', value: 1 }
]

// 폼 검증 규칙
const formRules: FormRules = {
  name: [{ required: true, message: '역할 이름을 입력하세요', trigger: 'blur' }],
  avatar: [{ required: true, message: '역할 프로필을 업로드하세요', trigger: 'blur' }],
  category: [{ required: true, message: '역할 카테고리를 선택하세요', trigger: 'change' }],
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
  description: [{ required: true, message: '역할 설명을 입력하세요', trigger: 'blur' }],
  systemMessage: [{ required: true, message: '역할 설정을 입력하세요', trigger: 'blur' }],
  publicStatus: [
    {
      required: true,
      type: 'boolean',
      message: '공개 여부를 선택하세요',
      trigger: 'change',
      validator: (_rule: any, value: any) => {
        return value !== undefined && value !== null
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

// 프로필 업로드
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

// 카테고리 목록 로드
const loadCategoryList = async () => {
  try {
    const data = await chatRoleCategoryList()
    if (data && data.length > 0) {
      categoryOptions.value = data
    }
  } catch (error) {
    console.error('역할 카테고리 목록 로드 실패:', error)
  }
}

// 모델 목록 로드
const loadModelList = async () => {
  try {
    const data = await modelPage({ pageNo: 1, pageSize: 100 })
    modelOptions.value = (data.list || []).map((item: any) => ({
      label: item.name,
      value: item.id
    }))
  } catch (error) {
    console.error('모델 목록 로드 실패:', error)
  }
}

// 역할 목록 로드
const loadRoleList = async () => {
  loading.value = true
  try {
    const data = await chatRolePage({
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize
    })
    roleList.value = data.list || []
    pagination.value.total = data.total || 0
  } catch (error) {
    console.error('역할 목록 로드 실패:', error)
    window.$message.error('역할 목록 로드 실패')
  } finally {
    loading.value = false
  }
}

// 페이지 변경
const handlePageChange = (page: number) => {
  pagination.value.pageNo = page
  loadRoleList()
}

// 역할 추가
const handleAdd = () => {
  editingRole.value = null
  formData.value = {
    modelId: '',
    name: '',
    avatar: '',
    category: '',
    sort: 0,
    description: '',
    systemMessage: '',
    publicStatus: false,
    status: 0
  }
  showEditModal.value = true
}

// 역할 편집
const handleEdit = (role: any) => {
  editingRole.value = role
  formData.value = {
    modelId: role.modelId || '',
    name: role.name,
    avatar: role.avatar,
    category: role.category,
    sort: role.sort ?? 0,
    description: role.description,
    systemMessage: role.systemMessage,
    publicStatus: role.publicStatus ?? false,
    status: role.status ?? 0
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
      avatar: formData.value.avatar,
      category: formData.value.category,
      sort: formData.value.sort,
      description: formData.value.description,
      systemMessage: formData.value.systemMessage,
      publicStatus: formData.value.publicStatus,
      status: formData.value.status
    }

    if (formData.value.modelId) {
      submitData.modelId = formData.value.modelId
    }

    if (editingRole.value) {
      // 업데이트
      submitData.id = editingRole.value.id
      await chatRoleUpdate(submitData)
      window.$message.success('역할 업데이트 성공')
    } else {
      // 생성
      await chatRoleCreate(submitData)
      window.$message.success('역할 생성 성공')
    }

    showEditModal.value = false
    // 폼 초기화
    resetForm()
    loadRoleList()
    emit('refresh')
    // 왼쪽 사이드바 역할 상태 새로고침 알림
    useMitt.emit('refresh-roles')
  } catch (error: any) {
    if (error?.errors) {
      return
    }
    console.error('역할 저장 실패:', error)
    window.$message.error('역할 저장 실패')
  } finally {
    submitting.value = false
  }
}

// 폼 초기화
const resetForm = () => {
  formData.value = {
    modelId: '',
    name: '',
    avatar: '',
    category: '',
    sort: 0,
    description: '',
    systemMessage: '',
    publicStatus: false,
    status: 0
  }
  editingRole.value = null
  formRef.value?.restoreValidation()
}

// 역할 삭제
const handleDelete = async (id: string) => {
  try {
    await chatRoleDelete({ id })
    window.$message.success('역할 삭제 성공')
    loadRoleList()
    emit('refresh')
    // 왼쪽 사이드바 역할 상태 새로고침 알림
    useMitt.emit('refresh-roles')
  } catch (error) {
    console.error('역할 삭제 실패:', error)
    window.$message.error('역할 삭제 실패')
  }
}

// 팝업 표시 상태 감지
watch(showModal, (val) => {
  if (val) {
    loadCategoryList()
    loadModelList()
    loadRoleList()
  }
})

// 편집 팝업 열기/닫기 감지
watch(showEditModal, (val) => {
  if (val) {
    loadCategoryList()
    loadModelList()
  } else {
    // 닫기 애니메이션 시 데이터가 지워지는 것을 방지하기 위해 지연 초기화
    setTimeout(() => {
      resetForm()
    }, 300)
  }
})
</script>

<style scoped lang="scss">
.empty-container {
  padding: 40px 0;
}

.role-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.role-card {
  border: 1px solid var(--line-color);
  border-radius: 8px;
  padding: 16px;
  background: var(--bg-color);
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .role-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .role-name {
      font-size: 16px;
      font-weight: 500;
      color: var(--text-color);
    }

    .role-meta {
      display: flex;
      gap: 12px;
      margin-top: 4px;

      .meta-item {
        font-size: 12px;
        color: #909090;
      }
    }
  }

  .role-card-body {
    margin-top: 12px;
  }
}
</style>
