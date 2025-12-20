<template>
  <div class="min-w-0 cursor-default select-none flex-1 flex flex-col bg-[--right-bg-color] overflow-hidden">
    <!-- 컨텐츠 헤더 -->
    <div class="flex-shrink-0 px-20px py-16px border-b border-solid border-[--line-color]">
      <div class="flex items-center justify-between gap-32px">
        <n-flex vertical class="flex-shrink-0">
          <h2 class="text-18px font-600 text-[--text-color] m-0">
            {{ getContentTitle() }}
          </h2>
          <p class="text-14px text-[--text-color] opacity-60 m-0 mt-4px">
            {{ getContentSubtitle() }}
          </p>
        </n-flex>

        <!-- 검색창 -->
        <n-input
          v-model:value="fileSearchKeyword"
          :placeholder="getFileSearchPlaceholder()"
          :input-props="{ spellcheck: false }"
          clearable
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          style="width: 200px"
          class="rounded-6px border-(solid 1px [--line-color])"
          size="small">
          <template #prefix>
            <svg class="size-16px text-[--text-color] opacity-60">
              <use href="#search"></use>
            </svg>
          </template>
        </n-input>
      </div>
    </div>

    <!-- 파일 목록 영역 -->
    <div class="relative overflow-hidden flex-1">
      <!-- 파일 목록 -->
      <n-scrollbar v-if="displayedTimeGroupedFiles.length > 0">
        <div class="p-20px flex flex-col gap-24px">
          <!-- 시간별 그룹화 -->
          <div v-for="timeGroup in displayedTimeGroupedFiles" :key="timeGroup.date" class="flex flex-col gap-12px">
            <div class="time-group">
              <span class="text-14px font-600">{{ timeGroup.displayDate || timeGroup.date }}</span>
              <span class="text-12px">{{ t('fileManager.list.fileCount', { count: timeGroup.files.length }) }}</span>
            </div>
            <!-- 파일 목록 -->
            <div class="flex flex-col gap-15px">
              <ContextMenu
                v-for="file in timeGroup.files"
                :key="file.id"
                :menu="fileContextMenu"
                :content="file"
                class="flex flex-col gap-8px"
                @select="handleFileMenuSelect($event, file)">
                <File :body="convertToFileBody(file)" :search-keyword="fileSearchKeyword" />
                <!-- 파일 메타 정보 -->
                <div class="file-meta-info">
                  <div class="flex-center gap-4px">
                    <p>{{ t('fileManager.list.meta.from') }}</p>
                    <p class="file-sender">{{ getUserDisplayName(file.sender?.id) }}</p>
                  </div>
                  <p class="opacity-80">{{ file.uploadTime }}</p>
                </div>
              </ContextMenu>
            </div>
          </div>
        </div>
      </n-scrollbar>

      <!-- 빈 상태 -->
      <EmptyState v-else :icon="getEmptyStateIcon()" :title="getEmptyStateTitle()">
        <template #actions>
          <n-button v-if="hasActiveSearch" @click="clearSearch" secondary type="primary" size="small">
            {{ t('fileManager.search.clear') }}
          </n-button>

          <n-button v-if="selectedUser" @click="clearUserFilter" ghost color="#13987f" size="small">
            {{ t('fileManager.search.showAllUsers') }}
          </n-button>
        </template>
      </EmptyState>
    </div>
  </div>
</template>

<script setup lang="ts">
import { sumBy } from 'es-toolkit'
import { useI18n } from 'vue-i18n'
import ContextMenu from '@/components/common/ContextMenu.vue'
import { useDownload } from '@/hooks/useDownload'
import type { FileBody } from '@/services/types'
import { useGroupStore } from '@/stores/group'
import { saveFileAttachmentAs, saveVideoAttachmentAs } from '@/utils/AttachmentSaver'
import EmptyState from './EmptyState.vue'

type TimeGroup = {
  date: string
  displayDate: string
  files: any[]
}

type User = {
  id: string
  name: string
}

type FileManagerState = {
  timeGroupedFiles: Ref<TimeGroup[]>
  loading: Ref<boolean>
  searchKeyword: Ref<string>
  activeNavigation: Ref<string>
  selectedUser: Ref<string>
  userList: Ref<User[]>
  setSearchKeyword: (keyword: string) => void
  setSelectedUser: (userId: string) => void
}

const groupStore = useGroupStore()
const { t } = useI18n()
const fileManagerState = inject<FileManagerState>('fileManagerState')!
const { timeGroupedFiles, searchKeyword, activeNavigation, selectedUser, userList, setSearchKeyword, setSelectedUser } =
  fileManagerState

const fileSearchKeyword = computed({
  get: () => searchKeyword.value,
  set: (value: string) => {
    if (value === searchKeyword.value) {
      return
    }
    setSearchKeyword(value)
  }
})

const normalizedFileSearchKeyword = computed(() => fileSearchKeyword.value.trim().toLowerCase())
const hasActiveSearch = computed(() => normalizedFileSearchKeyword.value.length > 0)

// 파일이 검색 키워드와 일치하는지 확인
const matchesFileByKeyword = (file: any, keyword: string) => {
  if (!keyword) {
    return true
  }

  const candidates = [
    file.fileName,
    file.name,
    file.originalName,
    file.title,
    file.sender?.name,
    file.fileType,
    file.downloadUrl,
    file.url
  ]

  return candidates.some((candidate) => {
    if (candidate == null) {
      return false
    }
    return String(candidate).toLowerCase().includes(keyword)
  })
}

// 표시되는 시간별 그룹화 파일 필터링
const displayedTimeGroupedFiles = computed(() => {
  const keyword = normalizedFileSearchKeyword.value
  if (!keyword) {
    return timeGroupedFiles.value
  }

  return timeGroupedFiles.value
    .map((group) => {
      const matchedFiles = group.files.filter((file: any) => matchesFileByKeyword(file, keyword))
      if (matchedFiles.length === 0) {
        return null
      }

      const filteredGroup: TimeGroup = {
        ...group,
        files: matchedFiles
      }

      return filteredGroup
    })
    .filter((group): group is TimeGroup => group !== null)
})

// 필터링된 총 파일 수 계산
const totalDisplayedFiles = computed(() => sumBy(displayedTimeGroupedFiles.value, (group) => group.files.length))

const { downloadFile } = useDownload()

const fileContextMenu = computed<OPT.RightMenu[]>(() => [
  {
    label: t('menu.save_as'),
    icon: 'Importing',
    click: async (targetFile: any) => {
      const downloadUrl = targetFile.downloadUrl || targetFile.url
      const defaultName = targetFile.fileName ? String(targetFile.fileName) : undefined
      const isVideo = targetFile.fileType === 'video'
      const saveParams = {
        url: downloadUrl,
        downloadFile,
        defaultFileName: defaultName,
        successMessage: isVideo
          ? t('fileManager.notifications.saveVideoSuccess')
          : t('fileManager.notifications.saveFileSuccess'),
        errorMessage: isVideo
          ? t('fileManager.notifications.saveVideoFail')
          : t('fileManager.notifications.saveFileFail')
      }
      try {
        if (isVideo) {
          await saveVideoAttachmentAs(saveParams)
        } else {
          await saveFileAttachmentAs(saveParams)
        }
      } catch (error) {
        console.error('파일 다른 이름으로 저장 실패:', error)
      }
    }
  }
])

const handleFileMenuSelect = async (menuItem: OPT.RightMenu | null, file: any) => {
  if (!menuItem || typeof menuItem.click !== 'function') {
    return
  }

  try {
    await menuItem.click(file)
  } catch (error) {
    console.error('파일 메뉴 작업 실행 실패:', error)
  }
}

// uid를 기반으로 사용자 표시 이름 가져오기
const getUserDisplayName = (uid: string) => {
  const groupName = groupStore.getUserDisplayName(uid)
  if (groupName) {
    return groupName
  }
  return t('fileManager.common.unknownUser')
}

// 파일 검색 플레이스홀더 가져오기
const getFileSearchPlaceholder = () => {
  switch (activeNavigation.value) {
    case 'myFiles':
      return t('fileManager.search.placeholder.myFiles')
    case 'senders':
      return t('fileManager.search.placeholder.senders')
    case 'sessions':
      return t('fileManager.search.placeholder.sessions')
    case 'groups':
      return t('fileManager.search.placeholder.groups')
    default:
      return t('fileManager.search.placeholder.default')
  }
}

// 컨텐츠 제목 가져오기
const getContentTitle = () => {
  const navigationTitles: { [key: string]: string } = {
    myFiles: t('fileManager.header.titles.myFiles'),
    senders: t('fileManager.header.titles.senders'),
    sessions: t('fileManager.header.titles.sessions'),
    groups: t('fileManager.header.titles.groups')
  }

  return navigationTitles[activeNavigation.value] || t('fileManager.header.titles.default')
}

// 컨텐츠 부제목 가져오기
const getContentSubtitle = () => {
  const totalFiles = totalDisplayedFiles.value

  if (selectedUser.value) {
    const user = userList.value.find((u: User) => u.id === selectedUser.value)
    if (user) {
      return t('fileManager.header.subtitle.userFiles', { name: user.name, total: totalFiles })
    }
  }

  const keyword = fileSearchKeyword.value.trim()
  if (keyword) {
    return t('fileManager.header.subtitle.search', { total: totalFiles })
  }

  return t('fileManager.header.subtitle.total', { total: totalFiles })
}

const getEmptyStateIcon = () => {
  if (hasActiveSearch.value) {
    return 'search'
  }

  const navigationIcons: { [key: string]: string } = {
    myFiles: 'folder',
    senders: 'user',
    sessions: 'message',
    groups: 'group'
  }

  return navigationIcons[activeNavigation.value] || 'folder'
}

const getEmptyStateTitle = () => {
  if (hasActiveSearch.value) {
    return t('fileManager.empty.search')
  }

  if (selectedUser.value) {
    const user = userList.value.find((u: User) => u.id === selectedUser.value)
    return user ? t('fileManager.empty.userHasNoFiles', { name: user.name }) : t('fileManager.empty.default')
  }

  const navigationTitles: { [key: string]: string } = {
    myFiles: t('fileManager.empty.default'),
    senders: t('fileManager.empty.senders'),
    sessions: t('fileManager.empty.sessions'),
    groups: t('fileManager.empty.groups')
  }

  return navigationTitles[activeNavigation.value] || t('fileManager.empty.default')
}

// 검색 초기화
const clearSearch = () => {
  setSearchKeyword('')
}

// 사용자 필터 초기화
const clearUserFilter = () => {
  setSelectedUser('')
}

// 파일 데이터를 FileBody 형식으로 변환
const convertToFileBody = (file: any): FileBody => {
  return {
    fileName: file.fileName || '',
    size: file.fileSize || 0,
    url: file.url || file.downloadUrl || ''
  }
}
</script>

<style scoped lang="scss">
.time-group {
  @apply sticky top-10px z-10 flex items-center justify-between p-12px rounded-6px text-[--text-color] bg-#e3e3e380 dark:bg-#30303080 backdrop-blur-md;
}

.file-meta-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px;
  font-size: 12px;
  color: #909090;
}

.file-sender {
  color: #13987f;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}
</style>
