<template>
  <n-tabs @update:value="onUpdate" :default-value="props.activeTabName" animated>
    <n-tab-pane display-directive="show:lazy" v-for="i in props.options" :key="i.name" :name="i.name" :tab="i.tab">
      <!-- 여기 높이를 고정해도 아래 높이 수정에 영향을 주지 않음, TabBar보다 높게 설정하여 사용자 폰이 느려서 갑작스러운 높이 수정 효과를 보는 것을 방지 -->
      <div
        :ref="bindDynamicAreaRef(i.name)"
        :style="{ height: props.customHeight ? customHeight + 'px' : defaultHeight }"
        @scroll="handleScroll"
        class="flex flex-col gap-4 overflow-y-auto">
        <!-- 동적 메시지 -->
        <slot :name="i.name"></slot>
        <!-- 자리 표시 요소, 마지막 동적 메시지가 tabbar에 붙는 것을 방지 -->
        <div class="w-full" style="height: 1px"></div>
      </div>
    </n-tab-pane>
  </n-tabs>
</template>

<script setup lang="ts">
import { type PropType, ref, type VNodeRef } from 'vue'

const emit = defineEmits(['update', 'scroll'])

const defaultHeight = ref('90vh')

const handleScroll = (event: any) => {
  emit('scroll', event)
}

type DynamicRefs = Record<string, HTMLDivElement | null>
const dynamicAreaRefs = ref<DynamicRefs>({})

/** 각 tab의 DOM 요소를 바인딩하기 위해 사용 */
const bindDynamicAreaRef = (name: string) => {
  return ((el: Element | ComponentPublicInstance | null) => {
    if (el instanceof Element) {
      dynamicAreaRefs.value[name] = el as HTMLDivElement
    } else {
      dynamicAreaRefs.value[name] = null // 또는 더 복잡한 처리
    }
  }) as VNodeRef
}

const props = defineProps({
  options: {
    type: Array as PropType<Array<{ name: string; tab: string }>>,
    required: false
  },
  activeTabName: {
    type: String,
    required: true
  },
  customHeight: {
    type: Number,
    required: false
  }
})

const currentTab = ref<string>(props.activeTabName)

const onUpdate = (newTab: string) => {
  console.log('컴포넌트 내에서 트리거됨 →', newTab)

  currentTab.value = newTab
  emit('update', newTab) // 부모 컴포넌트에 알림
}
</script>

<style scoped></style>
