<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white"
        style="border-bottom: 1px solid; border-color: #dfdfdf"
        :hidden-right="true"
        room-name="설정" />
    </template>

    <template #container>
      <img src="@/assets/mobile/chat-home/background.webp" class="w-100% absolute top-0 -z-1" alt="hula" />

      <div class="flex flex-col z-1">
        <div class="flex flex-col p-20px gap-20px">
          <!-- 설정 항목 -->
          <div
            v-for="item in settings"
            :key="item.key"
            class="flex justify-between items-center bg-white p-12px rounded-lg shadow-sm">
            <div class="text-base">{{ item.label }}</div>
            <div>
              <!-- type에 따라 해당 컴포넌트 렌더링 -->
              <n-switch v-if="item.type === 'switch'" v-model:value="item.value" />
              <n-input v-else-if="item.type === 'input'" v-model="item.value" placeholder="입력하세요" class="w-40" />
              <n-select
                v-else-if="item.type === 'select'"
                v-model="item.value"
                :options="item.options"
                placeholder="선택하세요"
                class="w-40" />
            </div>
          </div>

          <!-- 로그아웃 버튼 -->
          <div class="mt-auto flex justify-center mb-20px">
            <n-button type="error" @click="handleLogout" :disabled="isLoggingOut" :loading="isLoggingOut">
              로그아웃
            </n-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { info } from '@tauri-apps/plugin-log'
import { ThemeEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global'
import { useSettingStore } from '@/stores/setting.ts'
import { useUserStore } from '@/stores/user'
import { useLogin } from '@/hooks/useLogin'
import { showDialog } from 'vant'
import * as ImRequestUtils from '@/utils/ImRequestUtils'
import router from '@/router'

const globalStore = useGlobalStore()
const { isTrayMenuShow } = storeToRefs(globalStore)
const settingStore = useSettingStore()
const userStore = useUserStore()

// 설정 항목 정의
const settings = reactive([
  {
    key: 'notifications',
    label: '메시지 알림',
    type: 'switch',
    value: computed({
      get: () => true,
      set: () => {
        /* 알림 설정 업데이트 */
      }
    })
  },
  {
    key: 'username',
    label: '닉네임',
    type: 'input',
    value: computed({
      get: () => userStore.userInfo?.name || '',
      set: () => {}
    })
  },
  {
    key: 'theme',
    label: '인터페이스 테마',
    type: 'select',
    value: computed({
      get: () => settingStore.themes.content,
      set: (val) => settingStore.toggleTheme(val)
    }),
    options: [
      { label: '라이트', value: ThemeEnum.LIGHT },
      { label: '다크', value: ThemeEnum.DARK }
    ]
  },
  {
    key: 'language',
    label: '앱 언어',
    type: 'select',
    value: computed({
      get: () => 'zh',
      set: () => {}
    }),
    options: [
      { label: '중국어', value: 'zh' },
      { label: '영어', value: 'en' },
      { label: '일본어', value: 'ja' }
    ]
  }
])

const { logout, resetLoginState } = useLogin()

// 로그아웃 처리 상태 플래그
const isLoggingOut = ref(false)

// 로그아웃 로직
async function handleLogout() {
  // 중복 클릭 방지
  if (isLoggingOut.value) return
  isLoggingOut.value = true

  let logoutSuccess = false

  showDialog({
    title: '로그아웃',
    message: '로그아웃 하시겠습니까?',
    showCancelButton: true,
    confirmButtonText: '확인',
    cancelButtonText: '취소'
  })
    .then(async () => {
      try {
        await ImRequestUtils.logout({ autoLogin: true })
        logoutSuccess = true
      } catch (error) {
        console.error('서버 로그아웃 실패:', error)
        // 서버 로그아웃이 실패하더라도 로컬 정리를 계속 수행하지만 경고를 표시함
        window.$message.warning('서버 로그아웃 실패, 하지만 로컬 로그인 상태는 삭제되었습니다')
      }

      // 서버 로그아웃 성공 여부와 관계없이 로컬 상태 정리 수행
      try {
        // 2. 로그인 상태 초기화
        await resetLoginState()
        // 3. 마지막으로 로그아웃 메서드 호출 (로그인 창 생성 또는 로그아웃 이벤트 전송)
        await logout()

        settingStore.toggleLogin(false, false)
        info('계정 로그아웃')
        isTrayMenuShow.value = false

        if (logoutSuccess) {
          window.$message.success('로그아웃 성공')
        }
        await router.push('/mobile/login')
      } catch (localError) {
        console.error('로컬 로그아웃 정리 실패:', localError)
        window.$message.error('로컬 로그아웃 정리 실패, 앱을 다시 시작해주세요')
      }
    })
    .catch(() => {
      info('사용자가 취소 클릭')
    })
    .finally(() => {
      // 성공 여부와 관계없이 플래그 초기화
      isLoggingOut.value = false
    })
}

// 필요에 따라 settings 데이터를 내보내거나 조작할 수 있습니다
</script>

<style lang="scss" scoped></style>
