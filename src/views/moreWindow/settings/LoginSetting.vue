<template>
  <!-- 로그인 설정 -->
  <n-flex vertical :size="20" data-tauri-drag-region>
    <n-flex :size="12" vertical class="item-box">
      <n-flex align="center" justify="space-between">
        <span>{{ t('setting.login.auto_login_startup') }}</span>
        <n-switch size="small" v-model:value="autoLogin" />
      </n-flex>

      <div class="bg-[--line-color] h-1px w-full"></div>

      <n-flex align="center" justify="space-between">
        <span>{{ t('setting.login.launch_startup') }}</span>
        <n-switch size="small" v-model:value="autoStartup" />
      </n-flex>
    </n-flex>

    <!--    <n-flex align="center" justify="space-between" class="item-box">-->
    <!--      <n-flex vertical>-->
    <!--        <span>비밀번호 초기화</span>-->
    <!--        <span class="text-12px text-#909090">초기화 후 다음 로그인 시 QR 코드 또는 계정/비밀번호를 사용해야 합니다</span>-->
    <!--      </n-flex>-->
    <!--      <n-button secondary type="primary" @click="clearInfo"> 비밀번호 초기화 </n-button>-->
    <!--    </n-flex>-->
  </n-flex>
</template>

<script setup lang="ts">
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { useSettingStore } from '@/stores/setting.ts'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const settingStore = useSettingStore()
const { login } = storeToRefs(settingStore)
const autoLogin = ref(login.value.autoLogin)
const autoStartup = ref(login.value.autoStartup)

watchEffect(() => {
  settingStore.toggleLogin(autoLogin.value, autoStartup.value)
})

// 시작 프로그램 상태 변경 감지
watch(autoStartup, async (val: boolean) => {
  await (val ? enable() : disable())
})

onMounted(async () => {
  // 시작 프로그램 활성화 여부 확인
  autoStartup.value = await isEnabled()
})
</script>

<style scoped lang="scss">
.item-box {
  @apply text-14px text-[--text-color] bg-[--bg-setting-item] rounded-8px p-10px border-(solid 1px [--line-color]) custom-shadow;
}
</style>
