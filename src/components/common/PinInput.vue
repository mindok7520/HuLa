<template>
  <div class="flex justify-center">
    <div class="flex space-x-2">
      <input
        v-for="(_, index) in digits"
        :key="index"
        type="text"
        maxlength="1"
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        :class="[
          'text-center rounded-8px',
          'border-(2px solid transparent)',
          'focus:border-(2px solid #13987f)',
          'focus:outline-none',
          'box-border',
          inputClass
        ]"
        :style="{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          maxWidth: size,
          maxHeight: size
        }"
        v-model="digits[index]"
        @input="handleInput(index)"
        @keydown="handleKeydown($event, index)"
        @paste="handlePaste($event, index)"
        ref="pinInputs" />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  /** PIN 코드 길이 */
  length: {
    type: Number,
    default: 6
  },
  /** 사용자 정의 입력창 스타일 */
  inputClass: {
    type: String,
    default: ''
  },
  /** 초기값 */
  modelValue: {
    type: String,
    default: ''
  },
  /** 입력창 크기 */
  size: {
    type: String,
    default: '42px'
  }
})

const emit = defineEmits(['update:modelValue', 'complete'])

// PIN 입력 배열
const digits = ref<string[]>(Array(props.length).fill(''))
// 입력창 참조
const pinInputs = ref<HTMLInputElement[]>([])

// 모든 입력창이 채워졌는지 계산
const isComplete = computed(() => digits.value.every((digit) => digit !== ''))

// 배열을 문자열로 변환
const pinValue = computed(() => digits.value.join(''))

// 입력 변화 감지, modelValue 업데이트
watch(pinValue, (newValue) => {
  emit('update:modelValue', newValue)
  if (isComplete.value) {
    emit('complete', newValue)
  }
})

// modelValue 변화 감지, digits 업데이트
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      const chars = newValue.split('')
      digits.value = Array(props.length)
        .fill('')
        .map((_, i) => chars[i] || '')
    } else {
      digits.value = Array(props.length).fill('')
    }
  },
  { immediate: true }
)

/** PIN 입력 처리 */
const handleInput = (index: number) => {
  // 한 글자만 입력되도록 보장
  if (digits.value[index].length > 1) {
    digits.value[index] = digits.value[index].slice(0, 1)
  }

  // 다음 입력창으로 자동 이동
  if (digits.value[index] && index < props.length - 1) {
    nextTick(() => {
      pinInputs.value[index + 1].focus()
    })
  }
}

/** PIN 키보드 이벤트 처리 */
const handleKeydown = (event: KeyboardEvent, index: number) => {
  // 백스페이스 키 처리
  if (event.key === 'Backspace') {
    if (!digits.value[index] && index > 0) {
      digits.value[index - 1] = ''
      pinInputs.value[index - 1].focus()
    }
  }
}

/** 붙여넣기 이벤트 처리 */
const handlePaste = (event: ClipboardEvent, index: number) => {
  // 기본 붙여넣기 동작 차단
  event.preventDefault()

  // 붙여넣은 텍스트 가져오기
  const pastedText = event.clipboardData?.getData('text') || ''

  // 숫자와 영문 추출 (인증번호는 보통 이 문자들로 구성됨)
  const validChars = pastedText.replace(/[^0-9a-zA-Z]/g, '')

  // 현재 인덱스부터 채우기
  for (let i = 0; i < validChars.length && i + index < props.length; i++) {
    digits.value[i + index] = validChars[i]
  }

  // 채우기가 끝났고 빈 입력창이 남았다면, 다음 빈 입력창으로 포커스 이동
  const nextEmptyIndex = digits.value.findIndex((digit, idx) => digit === '' && idx >= index)
  if (nextEmptyIndex !== -1) {
    nextTick(() => {
      pinInputs.value[nextEmptyIndex].focus()
    })
  }
}

// 초기화 메서드 제공
const clear = () => {
  digits.value = Array(props.length).fill('')
  pinInputs.value[0]?.focus()
}

// 포커스 메서드 제공
const focus = () => {
  pinInputs.value[0]?.focus()
}

// 부모 컴포넌트에 메서드 노출
defineExpose({
  clear,
  focus
})
</script>
