<template>
  <div class="size-full bg-[--bg-popover] select-none cursor-default">
    <!--상단 작업 표시줄-->
    <ActionBar :is-drag="false" :max-w="false" :min-w="false" :shrink="false" />

    <n-flex v-if="loading" vertical justify="center" class="mt-6px box-border px-12px">
      <n-skeleton text :repeat="1" class="rounded-8px h-30px w-120px" />
      <n-skeleton text :repeat="1" class="rounded-8px h-300px" />
      <n-skeleton text :repeat="1" class="rounded-8px w-80px h-30px m-[0_0_0_auto]" />
    </n-flex>
    <n-flex v-else vertical justify="center" class="p-14px box-border select-none">
      <n-flex justify="space-between" align="center">
        <n-flex align="center">
          <n-flex align="center">
            <p class="text-[--text-color]">{{ t('message.check_update.current_version') }}:</p>
            <p class="text-(20px #909090) font-500">{{ currentVersion }}</p>
          </n-flex>

          <n-flex v-if="newVersion" align="center" class="relative">
            <svg class="w-24px h-24px select-none color-#ccc">
              <use href="#RightArrow"></use>
            </svg>

            <p class="relative text-(20px #13987f) font-500">{{ newVersion }}</p>

            <span class="absolute top--10px right--44px p-[4px_8px] bg-#f6dfe3ff rounded-6px text-(12px #ce304f)">
              {{ t('message.check_update.new_tag') }}
            </span>
          </n-flex>
        </n-flex>
        <n-flex align="center" size="medium">
          <div v-if="newVersionTime">
            <span class="text-(12px #909090)">{{ t('message.check_update.new_release_date') }}</span>
            <span class="text-(12px #13987f)">{{ handRelativeTime(newVersionTime) }}</span>
          </div>

          <div v-else>
            <span class="text-(12px #909090)">{{ t('message.check_update.release_date') }}</span>
            <span class="text-(12px #13987f)">{{ handRelativeTime(versionTime) }}</span>
          </div>
        </n-flex>
      </n-flex>
      <n-flex justify="space-between" align="center" class="mb-2px">
        <p class="text-(14px #909090)">{{ t('message.check_update.log_title') }}</p>
        <n-button text @click="toggleLogVisible">
          <n-flex align="center">
            <span class="text-(12px #13987f)">
              {{ logVisible ? t('message.check_update.collapse') : t('message.check_update.expand') }}
            </span>
            <svg
              class="w-16px h-16px select-none color-#13987f ml-2px transition-transform duration-300"
              :class="{ 'rotate-180': !logVisible }">
              <use href="#ArrowDown"></use>
            </svg>
          </n-flex>
        </n-button>
      </n-flex>
      <div
        v-show="logVisible"
        class="overflow-hidden transition-all duration-300"
        :class="logVisible ? 'h-460px' : 'h-0'">
        <n-scrollbar class="p-[0_10px] box-border">
          <div v-if="newCommitLog.length > 0">
            <div class="p-[4px_8px] mt-4px w-fit bg-#f6dfe3ff rounded-6px text-(12px #ce304f)">
              {{ newVersion }}
            </div>

            <n-timeline class="p-16px box-border">
              <n-timeline-item v-for="(log, index) in newCommitLog" :key="index" :content="log.message">
                <template #icon>
                  <n-icon :size="32">
                    <img class="size-32px" :src="`/emoji/${log.icon}.webp`" alt="" />
                  </n-icon>
                </template>
              </n-timeline-item>
            </n-timeline>

            <n-flex>
              <n-flex vertical :size="20">
                <svg class="m-[4px_40px] w-24px h-24px select-none rotate-270 color-#ccc">
                  <use href="#RightArrow"></use>
                </svg>

                <span class="p-[4px_8px] w-fit bg-#f1f1f1 rounded-6px text-(12px #999)">{{ currentVersion }}</span>
              </n-flex>
            </n-flex>
          </div>

          <n-timeline class="p-16px box-border">
            <n-timeline-item v-for="(log, index) in commitLog" :key="index" :content="log.message">
              <template #icon>
                <n-icon :size="32">
                  <img class="size-32px" :src="`/emoji/${log.icon}.webp`" alt="" />
                </n-icon>
              </template>
            </n-timeline-item>
          </n-timeline>
        </n-scrollbar>
      </div>
      <n-flex justify="end" class="mt-10px">
        <n-button :onclick="dismissUpdate" secondary>{{ t('message.check_update.ignore') }}</n-button>
        <n-button :onclick="doUpdate" secondary type="primary">{{ t('message.check_update.update_now') }}</n-button>
      </n-flex>
    </n-flex>
  </div>
</template>
<script setup lang="ts">
import { getVersion } from '@tauri-apps/api/app'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { currentMonitor, PhysicalPosition } from '@tauri-apps/api/window'
import { confirm } from '@tauri-apps/plugin-dialog'
import { check } from '@tauri-apps/plugin-updater'
import { useWindow } from '@/hooks/useWindow.ts'
import { useSettingStore } from '@/stores/setting.ts'
import { handRelativeTime } from '@/utils/ComputedTime'
import { isMac } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler.ts'
import { useI18n } from 'vue-i18n'

const settingStore = useSettingStore()
const { t } = useI18n()
const { createWebviewWindow, resizeWindow, setResizable } = useWindow()
/** 프로젝트 커밋 로그 기록 */
const commitLog = ref<{ message: string; icon: string }[]>([])
const newCommitLog = ref<{ message: string; icon: string }[]>([])
const text = ref(t('message.check_update.update_now'))
const currentVersion = ref('')
const newVersion = ref('')
const loading = ref(false)
/** 로그 표시 여부 제어 */
const logVisible = ref(false)
/** 버전 업데이트 날짜 */
const versionTime = ref('')
const newVersionTime = ref('')

const commitTypeMap: { [key: string]: string } = {
  feat: 'comet',
  fix: 'bug',
  docs: 'memo',
  style: 'lipstick',
  refactor: 'recycling-symbol',
  perf: 'rocket',
  test: 'test-tube',
  build: 'package',
  ci: 'gear',
  revert: 'right-arrow-curving-left',
  chore: 'hammer-and-wrench'
}

const mapCommitType = (commitMessage: string) => {
  for (const type in commitTypeMap) {
    if (new RegExp(`^${type}`, 'i').test(commitMessage)) {
      return commitTypeMap[type]
    }
  }
}

/* 업데이트 확인 버전 기록 */
//let lastVersion: string | null = null

const getCommitLog = async (url: string, isNew = false) => {
  fetch(url).then((res) => {
    if (!res.ok) {
      commitLog.value = [{ message: t('message.check_update.fetch_log_failed'), icon: 'cloudError' }]
      loading.value = false
      return
    }
    res.json().then(async (data) => {
      isNew ? (newVersionTime.value = data.created_at) : (versionTime.value = data.created_at)
      await nextTick(() => {
        // 정규식을 사용하여 * 뒤의 내용 추출
        const regex = /\* (.+)/g
        let match
        const logs = []
        while ((match = regex.exec(data.body)) !== null) {
          logs.push(match[1])
        }
        const processedLogs = logs.map((commit) => {
          // 마지막 : 위치 가져오기
          const lastColonIndex = commit.lastIndexOf(':')
          // 마지막 : 뒤의 내용 잘라내기
          const message = lastColonIndex !== -1 ? commit.substring(lastColonIndex + 1).trim() : commit
          return {
            message: message,
            icon: mapCommitType(commit) || 'alien-monster'
          }
        })
        isNew ? (newCommitLog.value = processedLogs) : (commitLog.value = processedLogs)
        loading.value = false
      })
    })
  })
}

const doUpdate = async () => {
  if (!(await confirm(t('message.check_update.confirm_update')))) {
    return
  }
  await createWebviewWindow('\uc5c5\ub370\uc774\ud2b8', 'update', 490, 335, '', false, 490, 335, false, true)
  const windows = await WebviewWindow.getAll()
  windows.forEach((window) => {
    if (window.label === 'login' || window.label === 'home' || window.label === 'checkupdate') {
      window.close()
    }
  })
}

const dismissUpdate = async () => {
  if (!(await confirm(t('message.check_update.confirm_ignore')))) {
    return
  }
  settingStore.update.dismiss = newVersion.value
  const checkUpdateWindow = await WebviewWindow.getByLabel('checkupdate')
  checkUpdateWindow?.close()
}

const checkUpdate = async () => {
  await check()
    .then(async (e) => {
      if (!e?.available) {
        return
      }
      newVersion.value = e.version
      // 버전 간의 다른 커밋 메시지와 커밋 날짜 확인
      const url = `https://gitee.com/api/v5/repos/HuLaSpark/HuLa/releases/tags/v${newVersion.value}?access_token=${import.meta.env.VITE_GITEE_TOKEN}`
      await getCommitLog(url, true)
      text.value = t('message.check_update.update_now')
    })
    .catch(() => {
      window.$message.error(t('message.check_update.update_error'))
    })
}

// 운영 체제 유형에 따라 창 위치 설정 (macOS는 오른쪽 상단, 기타는 오른쪽 하단)
const moveWindowToBottomRight = async () => {
  try {
    const checkUpdateWindow = await WebviewWindow.getByLabel('checkupdate')
    if (!checkUpdateWindow) return

    // 현재 모니터 정보 가져오기
    const monitor = await currentMonitor()
    if (!monitor) return

    // 창 크기 가져오기
    const size = await checkUpdateWindow.outerSize()

    // 창 위치 계산 (여백 확보)
    let y = 0
    let x = 0

    if (isMac()) {
      // macOS - 오른쪽 상단에 배치
      y = 50 // 상단 메뉴바 공간 확보
      x = Math.floor(monitor.size.width - size.width - 10)
    } else {
      // Windows/Linux - 오른쪽 하단에 배치 (기존 로직 유지)
      y = Math.floor(monitor.size.height - size.height - 50)
      x = Math.floor(monitor.size.width - size.width)
    }

    // 계산된 위치로 창 이동
    await checkUpdateWindow.setPosition(new PhysicalPosition(x, y))
  } catch (error) {
    console.error('창 이동 실패:', error)
  }
}

const toggleLogVisible = async () => {
  logVisible.value = !logVisible.value

  // 현재 창 인스턴스 가져오기
  const checkUpdateWindow = await WebviewWindow.getByLabel('checkupdate')
  if (!checkUpdateWindow) return

  // 창 높이를 조정할 수 있도록 창 크기 조정 가능 설정
  await setResizable('checkupdate', true)

  // 로그 표시 상태에 따라 창 높이 조정
  if (logVisible.value) {
    // 로그 펼치기, 창 높이를 600px로 조정
    await resizeWindow('checkupdate', 500, 620)
  } else {
    // 로그 접기, 창 높이를 420px로 조정
    await resizeWindow('checkupdate', 500, 150)
  }
  await setResizable('checkupdate', false)
  // 창 위치를 오른쪽 하단으로 조정, 오른쪽 하단 위치 유지
  await moveWindowToBottomRight()
}

const init = async () => {
  await moveWindowToBottomRight()
  loading.value = true
  currentVersion.value = await getVersion()
  if (isMac()) {
    // 제목 표시줄 버튼 숨기기
    try {
      await invokeSilently('hide_title_bar_buttons', { windowLabel: 'checkupdate' })
    } catch (error) {
      console.error('제목 표시줄 버튼 숨기기 실패:', error)
    }
  }
}

onMounted(async () => {
  await init()
  const url = `https://gitee.com/api/v5/repos/HuLaSpark/HuLa/releases/tags/v${currentVersion.value}?access_token=${import.meta.env.VITE_GITEE_TOKEN}`
  await getCommitLog(url)
  await checkUpdate()
})
</script>
