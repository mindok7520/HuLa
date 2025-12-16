<template>
  <div style="background: var(--left-bg-color)" class="h-full">
    <div style="background: var(--left-bg-color)" class="h-30px"></div>
    <main class="left min-w-64px h-full p-[0_6px_40px] box-border flex-col-center select-none" data-tauri-drag-region>
      <p class="text-(16px [--left-text-color]) cursor-default select-none m-[4px_0_16px_0]">HuLa</p>
      <!-- 프로필 사진 모듈 -->
      <LeftAvatar />
      <!-- 네비게이션 옵션 버튼 모듈 -->
      <ActionList />
      <!-- 프로필 편집 팝업 -->
      <InfoEdit />

      <!-- 팝업 창 -->
      <component :is="componentMap" v-bind="componentProps" />
    </main>
  </div>
</template>
<script lang="ts" setup>
import type { Component } from 'vue'
import { MittEnum, ModalEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import ActionList from './components/ActionList.vue'
import InfoEdit from './components/InfoEdit.vue'
import LeftAvatar from './components/LeftAvatar.vue'
import { CheckUpdate, LockScreen, modalShow } from './model.tsx'

const componentMap = shallowRef<Component>()
// 컴포넌트에 전달할 props 저장
const componentProps = shallowRef<Record<string, any>>({})
/** 팝업 컴포넌트 콘텐츠 매핑 */
const componentMapping: Record<number, Component> = {
  [ModalEnum.LOCK_SCREEN]: LockScreen,
  [ModalEnum.CHECK_UPDATE]: CheckUpdate
}

onMounted(() => {
  useMitt.on(MittEnum.LEFT_MODAL_SHOW, (event: { type: ModalEnum; props?: Record<string, any> }) => {
    componentMap.value = componentMapping[event.type]
    // 전달된 props 저장
    componentProps.value = event.props || {}
    nextTick(() => {
      modalShow.value = true
    })
  })
})
</script>

<style lang="scss" scoped>
@use 'style';
</style>
