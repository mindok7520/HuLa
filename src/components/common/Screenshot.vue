<template>
  <div ref="canvasbox" class="canvasbox">
    <canvas ref="drawCanvas" class="draw-canvas"></canvas>
    <canvas ref="maskCanvas" class="mask-canvas"></canvas>
    <canvas ref="imgCanvas" class="img-canvas"></canvas>
    <div ref="magnifier" class="magnifier">
      <canvas ref="magnifierCanvas"></canvas>
    </div>
    <!-- 선택 영역 드래그 영역 -->
    <div ref="selectionArea" class="selection-area" v-show="showButtonGroup" :style="selectionAreaStyle">
      <!-- 내부 드래그 영역 -->
      <div
        :class="['drag-area', currentDrawTool ? 'cannot-drag' : 'can-drag']"
        :title="t('message.screenshot.tooltip_drag')"
        @mousedown="handleSelectionDragStart"
        @mousemove="handleSelectionDragMove"
        @mouseup="handleSelectionDragEnd"
        @dblclick="confirmSelection"></div>

      <!-- resize 컨트롤 포인트 - 네 모서리 -->
      <div
        :class="['resize-handle', 'resize-nw', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'nw')"></div>
      <div
        :class="['resize-handle', 'resize-ne', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'ne')"></div>
      <div
        :class="['resize-handle', 'resize-sw', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'sw')"></div>
      <div
        :class="['resize-handle', 'resize-se', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'se')"></div>

      <!-- resize 컨트롤 포인트 - 네 변의 중앙 -->
      <div
        :class="['resize-handle', 'resize-n', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'n')"></div>
      <div
        :class="['resize-handle', 'resize-e', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'e')"></div>
      <div
        :class="['resize-handle', 'resize-s', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 's')"></div>
      <div
        :class="['resize-handle', 'resize-w', { disabled: currentDrawTool }]"
        :title="t('message.screenshot.tooltip_resize')"
        @mousedown.stop="handleResizeStart($event, 'w')"></div>

      <!-- 테두리 둥글기 컨트롤러 -->
      <div class="border-radius-controller" :style="borderRadiusControllerStyle" @click.stop>
        <label>{{ t('message.screenshot.border_radius') }}:</label>
        <input type="range" :value="borderRadius" @input="handleBorderRadiusChange" min="0" max="100" step="1" />
        <span>{{ borderRadius }}px</span>
      </div>
    </div>

    <div ref="buttonGroup" class="button-group" v-show="showButtonGroup && !isDragging && !isResizing">
      <span
        :class="{ active: currentDrawTool === 'rect' }"
        :title="t('message.screenshot.tool_rect')"
        @click="drawImgCanvas('rect')">
        <svg><use href="#square"></use></svg>
      </span>
      <span
        :class="{ active: currentDrawTool === 'circle' }"
        :title="t('message.screenshot.tool_circle')"
        @click="drawImgCanvas('circle')">
        <svg><use href="#round"></use></svg>
      </span>
      <span
        :class="{ active: currentDrawTool === 'arrow' }"
        :title="t('message.screenshot.tool_arrow')"
        @click="drawImgCanvas('arrow')">
        <svg><use href="#arrow-right-up"></use></svg>
      </span>
      <span
        :class="{ active: currentDrawTool === 'mosaic' }"
        :title="t('message.screenshot.tool_mosaic')"
        @click="drawImgCanvas('mosaic')">
        <svg><use href="#mosaic"></use></svg>
      </span>
      <!-- 다시 실행 -->
      <span :title="t('message.screenshot.redo')" @click="drawImgCanvas('redo')">
        <svg><use href="#refresh"></use></svg>
      </span>
      <!-- 실행 취소: 낙서가 없을 때 비활성화 -->
      <span
        :class="{ disabled: !canUndo }"
        :aria-disabled="!canUndo"
        :title="t('message.screenshot.undo')"
        @click.stop="drawImgCanvas('undo')">
        <svg><use href="#return"></use></svg>
      </span>
      <span :title="t('message.screenshot.confirm')" @click="confirmSelection">
        <svg><use href="#check-small"></use></svg>
      </span>
      <span :title="t('message.screenshot.cancel')" @click="cancelSelection">
        <svg><use href="#close"></use></svg>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { writeImage } from '@tauri-apps/plugin-clipboard-manager'
import type { Ref } from 'vue'
import { useCanvasTool } from '@/hooks/useCanvasTool'
import { isMac } from '@/utils/PlatformConstants'
import { ErrorType, invokeWithErrorHandler } from '@/utils/TauriInvokeHandler.ts'
import { useI18n } from 'vue-i18n'

type ScreenConfig = {
  startX: number
  startY: number
  endX: number
  endY: number
  scaleX: number
  scaleY: number
  isDrawing: boolean
  width: number
  height: number
}

// 현재 윈도우 인스턴스 가져오기
const { t } = useI18n()
const appWindow = WebviewWindow.getCurrent()
const canvasbox: Ref<HTMLDivElement | null> = ref(null)

// 이미지 레이어
const imgCanvas: Ref<HTMLCanvasElement | null> = ref(null)
const imgCtx: Ref<CanvasRenderingContext2D | null> = ref(null)

// 마스크 레이어
const maskCanvas: Ref<HTMLCanvasElement | null> = ref(null)
const maskCtx: Ref<CanvasRenderingContext2D | null> = ref(null)

// 그리기 레이어
const drawCanvas: Ref<HTMLCanvasElement | null> = ref(null)
const drawCtx: Ref<CanvasRenderingContext2D | null> = ref(null)
let drawTools: any
// 실행 취소 가능 여부
const canUndo = ref(false)

// 돋보기
const magnifier: Ref<HTMLDivElement | null> = ref(null)
const magnifierCanvas: Ref<HTMLCanvasElement | null> = ref(null)
const magnifierCtx: Ref<CanvasRenderingContext2D | null> = ref(null)
const magnifierWidth: number = 120 // 돋보기 너비
const magnifierHeight: number = 120 // 돋보기 높이
const zoomFactor: number = 3 // 확대 배율

// 버튼 그룹
const buttonGroup: Ref<HTMLDivElement | null> = ref(null)
const showButtonGroup: Ref<boolean> = ref(false) // 버튼 그룹 표시 제어

// 선택 영역 드래그 영역
const selectionArea: Ref<HTMLDivElement | null> = ref(null)
const selectionAreaStyle: Ref<any> = ref({})
const isDragging: Ref<boolean> = ref(false)
const dragOffset: Ref<{ x: number; y: number }> = ref({ x: 0, y: 0 })

// 테두리 둥글기 컨트롤러 스타일
const borderRadiusControllerStyle: Ref<any> = ref({})

// resize 관련
const isResizing: Ref<boolean> = ref(false)
const resizeDirection: Ref<string> = ref('')
const resizeStartPosition: Ref<{ x: number; y: number; width: number; height: number; left: number; top: number }> =
  ref({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    left: 0,
    top: 0
  })

// 테두리 둥글기 제어
const borderRadius: Ref<number> = ref(0)

// 스크린샷 정보
const screenConfig: Ref<ScreenConfig> = ref({
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
  scaleX: 0,
  scaleY: 0,
  isDrawing: false,
  width: 0,
  height: 0
})

// 스크린샷 이미지
let screenshotImage: HTMLImageElement
let isImageLoaded: boolean = false

// 현재 선택된 그리기 도구
const currentDrawTool: Ref<string | null> = ref(null)

// 성능 최적화: 마우스 이동 이벤트 스로틀링 (macOS 전용)
let mouseMoveThrottleId: number | null = null
const mouseMoveThrottleDelay = 16 // 약 60FPS, 메뉴바 영역에서 빈도 감소

// 윈도우 상태 복구 함수
const restoreWindowState = async () => {
  await appWindow.hide()
}

/**
 * 도형 그리기
 * @param {string} type - 도형 타입
 */
const drawImgCanvas = (type: string) => {
  if (!drawTools) {
    console.warn('그리기 도구가 초기화되지 않음')
    return
  }

  const drawableTypes = ['rect', 'circle', 'arrow', 'mosaic']

  if (drawableTypes.includes(type)) {
    // 이미 활성화된 도구를 클릭한 경우 선택 상태 유지 (취소 불가, 다른 옵션으로만 전환 가능)
    if (currentDrawTool.value === type) {
      return
    }

    // 이전 도구 중지
    if (currentDrawTool.value) {
      drawTools.stopDrawing && drawTools.stopDrawing()
    }

    // 새 그리기 도구 활성화
    currentDrawTool.value = type

    // 그리기 캔버스 이벤트 수신 활성화
    if (drawCanvas.value) {
      drawCanvas.value.style.pointerEvents = 'auto'
    }

    // 모자이크 그릴 때 브러시 너비 설정
    if (type === 'mosaic') {
      drawTools.drawMosaicBrushSize && drawTools.drawMosaicBrushSize(20)
    }

    // 그리기 메서드 호출 및 도구 활성화 확인
    try {
      drawTools.draw(type)
      console.log(`그리기 도구 활성화됨: ${type}`)
    } catch (error) {
      console.error(`그리기 도구 활성화 실패: ${type}`, error)
      currentDrawTool.value = null
      // 활성화 실패 시 이벤트 비활성화
      if (drawCanvas.value) {
        drawCanvas.value.style.pointerEvents = 'none'
      }
    }
  } else if (type === 'redo') {
    // 요구사항: '다시 실행' 클릭 시 캔버스의 모든 낙서 삭제
    if (drawTools.clearAll) {
      drawTools.clearAll()
    }
    // 삭제 후 도구 상태 초기화 및 그리기 이벤트 통과 비활성화
    currentDrawTool.value = null
    drawTools.resetState && drawTools.resetState()
    drawTools.clearEvents && drawTools.clearEvents()
    if (drawCanvas.value) {
      drawCanvas.value.style.pointerEvents = 'none'
      drawCanvas.value.style.zIndex = '5'
    }
    console.log('모든 낙서가 삭제되었습니다 (다시 실행 버튼 이용)')
  } else if (type === 'undo') {
    // 실행 취소할 내용이 없으면 클릭 무시
    if (!canUndo.value) return
    // 진행 중인 그리기를 중지하여 즉시 효과 적용 보장
    drawTools.stopDrawing && drawTools.stopDrawing()
    drawTools.undo && drawTools.undo()
    console.log('실행 취소 수행')
  }
}

// 그리기 도구 상태 초기화
const resetDrawTools = () => {
  currentDrawTool.value = null
  if (drawTools) {
    // 현재 그리기 작업 중지
    drawTools.stopDrawing && drawTools.stopDrawing()
    // 그리기 도구를 기본 상태로 초기화
    drawTools.resetState && drawTools.resetState()
    // 그리기 도구 이벤트 리스너 제거
    drawTools.clearEvents && drawTools.clearEvents()
  }

  // 그리기 캔버스 내용 삭제
  if (drawCtx.value && drawCanvas.value) {
    drawCtx.value.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height)
    console.log('그리기 내용 삭제됨')
  }

  // 초기화 시 그리기 캔버스 이벤트를 비활성화하여 선택 영역으로 통과시킴
  if (drawCanvas.value) {
    drawCanvas.value.style.pointerEvents = 'none'
    drawCanvas.value.style.zIndex = '5'
  }

  console.log('그리기 도구 초기화됨')
}

/**
 * 캔버스 초기화
 */
const initCanvas = async () => {
  // 스샷 전 돋보기를 숨겨 캡처에 포함되지 않도록 함
  if (magnifier.value) {
    magnifier.value.style.display = 'none'
  }
  // 그리기 도구 상태 초기화
  resetDrawTools()

  // 이미지 로딩 상태 초기화
  isImageLoaded = false

  // 기타 상태 초기화
  borderRadius.value = 0
  isDragging.value = false
  isResizing.value = false

  const canvasWidth = screen.width * window.devicePixelRatio
  const canvasHeight = screen.height * window.devicePixelRatio

  const config = {
    x: '0',
    y: '0',
    width: `${canvasWidth}`,
    height: `${canvasHeight}`
  }

  const screenshotData = await invokeWithErrorHandler('screenshot', config, {
    customErrorMessage: '스크린샷 실패',
    errorType: ErrorType.Client
  })

  if (imgCanvas.value && maskCanvas.value) {
    imgCanvas.value.width = canvasWidth
    imgCanvas.value.height = canvasHeight
    drawCanvas.value!.width = canvasWidth
    drawCanvas.value!.height = canvasHeight
    maskCanvas.value.width = canvasWidth
    maskCanvas.value.height = canvasHeight

    imgCtx.value = imgCanvas.value.getContext('2d')
    maskCtx.value = maskCanvas.value.getContext('2d')
    drawCtx.value = drawCanvas.value!.getContext('2d', { willReadFrequently: true })

    // 그리기 캔버스 내용 삭제
    if (drawCtx.value) {
      drawCtx.value.clearRect(0, 0, canvasWidth, canvasHeight)
      console.log('그리기 캔버스 내용 삭제됨')
    }

    // 화면 확대 비율 가져오기
    const { clientWidth: containerWidth, clientHeight: containerHeight } = imgCanvas.value!
    screenConfig.value.scaleX = canvasWidth / containerWidth
    screenConfig.value.scaleY = canvasHeight / containerHeight

    screenshotImage = new Image()

    screenshotImage.onload = () => {
      if (imgCtx.value) {
        try {
          imgCtx.value.drawImage(screenshotImage, 0, 0, canvasWidth, canvasHeight)

          // 전체 화면 초록색 테두리 그리기
          if (maskCtx.value) {
            drawRectangle(
              maskCtx.value,
              screenConfig.value.startX,
              screenConfig.value.startY,
              canvasWidth,
              canvasHeight,
              4
            )
          }

          if (drawCanvas.value && drawCtx.value && imgCtx.value) {
            drawTools = useCanvasTool(drawCanvas, drawCtx, imgCtx, screenConfig)
            // 초기화 시 그리기 캔버스 이벤트를 비활성화하여 선택 영역으로 통과시킴
            drawCanvas.value.style.pointerEvents = 'none'
            drawCanvas.value.style.zIndex = '5'
            // 실행 취소 버튼 비활성화를 위해 canUndo 상태 동기화
            if (drawTools?.canUndo) {
              watch(drawTools.canUndo, (val: boolean) => (canUndo.value = val), { immediate: true })
            }
            console.log('그리기 도구 초기화 완료 (대체 방식)')
          }
          isImageLoaded = true
        } catch (error) {
          console.error('캔버스에 이미지 그리기 실패:', error)
        }
      } else {
        console.error('imgCtx.value가 비어 있음')
      }
    }

    // Image 객체를 사용하지 않고 원본 버퍼를 캔버스에 직접 그리기
    if (screenshotData && imgCtx.value) {
      try {
        // base64 데이터 디코딩
        const binaryString = atob(screenshotData)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        // ImageData 생성 및 캔버스에 그리기
        const imageData = new ImageData(new Uint8ClampedArray(bytes), canvasWidth, canvasHeight)
        imgCtx.value.putImageData(imageData, 0, 0)

        // 전체 화면 초록색 테두리 그리기
        if (maskCtx.value) {
          drawRectangle(
            maskCtx.value,
            screenConfig.value.startX,
            screenConfig.value.startY,
            canvasWidth,
            canvasHeight,
            4
          )
        }

        if (drawCanvas.value && drawCtx.value && imgCtx.value) {
          drawTools = useCanvasTool(drawCanvas, drawCtx, imgCtx, screenConfig)
          // 초기화 시 그리기 캔버스 이벤트를 비활성화하여 선택 영역으로 통과시킴
          drawCanvas.value.style.pointerEvents = 'none'
          drawCanvas.value.style.zIndex = '5'
          // 실행 취소 버튼 비활성화를 위해 canUndo 상태 동기화
          if (drawTools?.canUndo) {
            watch(drawTools.canUndo, (val: boolean) => (canUndo.value = val), { immediate: true })
          }
          console.log('그리기 도구 초기화 완료')
        }
        isImageLoaded = true
      } catch (error) {
        // 직접 그리기가 실패하면 Image 객체 방식으로 대체
        screenshotImage.src = `data:image/png;base64,${screenshotData}`
      }
    } else {
      screenshotImage.src = `data:image/png;base64,${screenshotData}`
    }
  }

  // 마우스 이벤트 리스너 추가
  maskCanvas.value?.addEventListener('mousedown', handleMaskMouseDown)
  maskCanvas.value?.addEventListener('mousemove', handleMaskMouseMove)
  maskCanvas.value?.addEventListener('mouseup', handleMaskMouseUp)
  maskCanvas.value?.addEventListener('contextmenu', handleRightClick)

  // 키보드 이벤트 리스너 추가
  document.addEventListener('keydown', handleKeyDown)

  // 글로벌 우클릭 이벤트 리스너 추가
  document.addEventListener('contextmenu', handleRightClick)

  // 그리기 도구 취소를 위한 글로벌 클릭 리스너 추가
  document.addEventListener('mousedown', handleGlobalMouseDown)
}

const handleMagnifierMouseMove = (event: MouseEvent) => {
  if (!magnifier.value || !imgCanvas.value || !imgCtx.value) return

  // 선택 영역 드래그 시 돋보기를 숨기고, 크기 조정 및 그리기 시에만 표시
  if (isDragging.value) {
    magnifier.value.style.display = 'none'
    return
  }

  // 영역을 이미 선택했지만 드래그나 크기 조정 중이 아니면 돋보기 숨김
  if (showButtonGroup.value && !isDragging.value && !isResizing.value) {
    magnifier.value.style.display = 'none'
    return
  }

  // 이미지 로딩 확인
  if (!isImageLoaded) {
    magnifier.value.style.display = 'none'
    return
  }

  // 돋보기 캔버스 초기화
  if (magnifierCanvas.value && magnifierCtx.value === null) {
    magnifierCanvas.value.width = magnifierWidth
    magnifierCanvas.value.height = magnifierHeight
    magnifierCtx.value = magnifierCanvas.value.getContext('2d')
  }

  if (!magnifierCtx.value) return

  magnifier.value.style.display = 'block'

  // clientX/clientY + 캔버스의 boundingClientRect를 통합 사용하여 캔버스 상대 좌표 계산
  const clientX = (event as MouseEvent).clientX
  const clientY = (event as MouseEvent).clientY
  const rect = imgCanvas.value.getBoundingClientRect()
  const mouseX = clientX - rect.left
  const mouseY = clientY - rect.top

  // 돋보기 위치 설정 (오프셋 방지를 위해 뷰포트 좌표 사용)
  let magnifierTop = clientY + 20
  let magnifierLeft = clientX + 20

  if (magnifierTop + magnifierHeight > window.innerHeight) {
    magnifierTop = clientY - magnifierHeight - 20
  }
  if (magnifierLeft + magnifierWidth > window.innerWidth) {
    magnifierLeft = clientX - magnifierWidth - 20
  }

  magnifier.value.style.top = `${magnifierTop}px`
  magnifier.value.style.left = `${magnifierLeft}px`

  // 원본 이미지 샘플링 영역 계산 (캔버스 상대 좌표에 배율 적용)
  const sourceX = mouseX * screenConfig.value.scaleX - magnifierWidth / zoomFactor / 2
  const sourceY = mouseY * screenConfig.value.scaleY - magnifierHeight / zoomFactor / 2
  const sourceWidth = magnifierWidth / zoomFactor
  const sourceHeight = magnifierHeight / zoomFactor

  // 돋보기 캔버스 초기화
  magnifierCtx.value.clearRect(0, 0, magnifierWidth, magnifierHeight)

  // 확대된 이미지 그리기
  magnifierCtx.value.drawImage(
    imgCanvas.value,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    magnifierWidth,
    magnifierHeight
  )

  // 돋보기 중앙에 십자선 그리기
  magnifierCtx.value.strokeStyle = '#13987f'
  magnifierCtx.value.lineWidth = 1
  magnifierCtx.value.beginPath()
  magnifierCtx.value.moveTo(magnifierWidth / 2, 0)
  magnifierCtx.value.lineTo(magnifierWidth / 2, magnifierHeight)
  magnifierCtx.value.moveTo(0, magnifierHeight / 2)
  magnifierCtx.value.lineTo(magnifierWidth, magnifierHeight / 2)
  magnifierCtx.value.stroke()
}

const handleMaskMouseDown = (event: MouseEvent) => {
  // 버튼 그룹이 이미 표시 중이면 아무 작업도 수행하지 않음
  if (showButtonGroup.value) return
  const offsetEvent = event as any
  screenConfig.value.startX = offsetEvent.offsetX * screenConfig.value.scaleX
  screenConfig.value.startY = offsetEvent.offsetY * screenConfig.value.scaleY
  screenConfig.value.isDrawing = true
  if (!screenConfig.value.isDrawing) {
    drawMask()
  } // 마스크 레이어 먼저 그리기
}

const handleMaskMouseMove = (event: MouseEvent) => {
  handleMagnifierMouseMove(event)
  if (!screenConfig.value.isDrawing || !maskCtx.value || !maskCanvas.value) return

  const offsetEvent = event as any

  // macOS 전용 성능 최적화 적용
  if (isMac()) {
    // 메뉴바 영역(y < 30)에서 카단 현상 감소를 위해 강력한 스로틀링 사용
    const currentY = offsetEvent.offsetY * screenConfig.value.scaleY
    const isInMenuBar = currentY < 30 // 메뉴바 영역
    const throttleDelay = isInMenuBar ? 32 : mouseMoveThrottleDelay // 메뉴바 영역 30FPS로 감소

    if (mouseMoveThrottleId) {
      return
    }

    mouseMoveThrottleId = window.setTimeout(() => {
      mouseMoveThrottleId = null

      if (!screenConfig.value.isDrawing || !maskCtx.value || !maskCanvas.value) return

      const mouseX = offsetEvent.offsetX * screenConfig.value.scaleX
      const mouseY = offsetEvent.offsetY * screenConfig.value.scaleY
      const width = mouseX - screenConfig.value.startX
      const height = mouseY - screenConfig.value.startY

      // 최적화: redraw 비용 감소를 위해 save/restore 사용
      maskCtx.value.save()

      // 이전 사각형 영역 삭제
      maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)

      // 전체 마스크 레이어 다시 그리기
      drawMask()

      // 사각형 영역 내 마스크를 삭제하여 투명 효과 구현
      maskCtx.value.clearRect(screenConfig.value.startX, screenConfig.value.startY, width, height)

      // 사각형 테두리 그리기
      drawRectangle(maskCtx.value, screenConfig.value.startX, screenConfig.value.startY, width, height)

      maskCtx.value.restore()
    }, throttleDelay)
  } else {
    const mouseX = offsetEvent.offsetX * screenConfig.value.scaleX
    const mouseY = offsetEvent.offsetY * screenConfig.value.scaleY
    const width = mouseX - screenConfig.value.startX
    const height = mouseY - screenConfig.value.startY

    // 이전 사각형 영역 삭제
    maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)

    // 전체 마스크 레이어 다시 그리기
    drawMask()

    // 사각형 영역 내 마스크를 삭제하여 투명 효과 구현
    maskCtx.value.clearRect(screenConfig.value.startX, screenConfig.value.startY, width, height)

    // 사각형 테두리 그리기
    drawRectangle(maskCtx.value, screenConfig.value.startX, screenConfig.value.startY, width, height)
  }
}

const handleMaskMouseUp = (event: MouseEvent) => {
  if (!screenConfig.value.isDrawing) return
  screenConfig.value.isDrawing = false
  // 사각형 영역 종료 좌표 기록
  const offsetEvent = event as any
  screenConfig.value.endX = offsetEvent.offsetX * screenConfig.value.scaleX
  screenConfig.value.endY = offsetEvent.offsetY * screenConfig.value.scaleY

  // 사각형 영역 너비/높이 기록
  screenConfig.value.width = Math.abs(screenConfig.value.endX - screenConfig.value.startX)
  screenConfig.value.height = Math.abs(screenConfig.value.endY - screenConfig.value.startY)
  // 사각형 영역 유효성 판단
  if (screenConfig.value.width > 5 && screenConfig.value.height > 5) {
    // 이후 작업 방해를 방지하기 위해 돋보기 숨김
    if (magnifier.value) {
      magnifier.value.style.display = 'none'
    }

    // 마스크 다시 그리기
    redrawSelection()

    showButtonGroup.value = true // 버튼 그룹 표시
    nextTick(() => {
      updateButtonGroupPosition()
    })
  }
}

// 사각형 영역 툴바 위치 계산
const updateButtonGroupPosition = () => {
  if (!buttonGroup.value) return

  // 버튼 그룹이 보이지 않거나 드래그/크기 조정 중일 때는 크기 측정 및 위치 설정을 하지 않음
  if (!showButtonGroup.value || isDragging.value || isResizing.value) {
    updateSelectionAreaPosition()
    return
  }

  const { scaleX, scaleY, startX, startY, endX, endY } = screenConfig.value

  // 사각형 경계
  const minY = Math.min(startY, endY) / scaleY
  const maxX = Math.max(startX, endX) / scaleX
  const maxY = Math.max(startY, endY) / scaleY

  // 사용 가능한 화면 크기
  const availableHeight = window.innerHeight
  const availableWidth = window.innerWidth

  const el = buttonGroup.value
  el.style.flexWrap = 'nowrap'
  el.style.whiteSpace = 'nowrap'
  el.style.width = 'max-content'
  el.style.overflow = 'visible'

  const rect = el.getBoundingClientRect()
  const measuredHeight = rect.height
  const contentWidth = el.scrollWidth || rect.width

  const maxAllowedWidth = availableWidth - 20
  const finalWidth = Math.min(contentWidth, maxAllowedWidth)

  // 선택 영역 아래에 배치 가능한지 판단
  const spaceBelow = availableHeight - maxY
  const canFitBelow = spaceBelow >= measuredHeight + 10 // 10px 버퍼 유지

  let leftPosition: number
  let topPosition: number

  if (canFitBelow) {
    // 선택 영역 아래에 우선 배치
    topPosition = maxY + 4

    // 선택 영역 오른쪽 정렬
    leftPosition = maxX - finalWidth
    leftPosition = Math.max(10, Math.min(leftPosition, availableWidth - finalWidth - 10))
  } else {
    // 선택 영역 아래 공간 부족 시 위쪽에 배치
    topPosition = minY - (measuredHeight + 4)
    if (topPosition < 0) topPosition = 10

    // 선택 영역 오른쪽 정렬
    leftPosition = maxX - finalWidth
    leftPosition = Math.max(10, Math.min(leftPosition, availableWidth - finalWidth - 10))
  }

  // 최종 위치 및 너비 적용
  el.style.top = `${topPosition}px`
  el.style.left = `${leftPosition}px`
  el.style.width = `${finalWidth}px`
  el.style.boxSizing = 'border-box'

  // 선택 영역 드래그 위치 업데이트
  updateSelectionAreaPosition()
}

// 선택 영역 드래그 위치 업데이트
const updateSelectionAreaPosition = () => {
  if (!selectionArea.value) return

  const { scaleX, scaleY, startX, startY, endX, endY } = screenConfig.value

  // 사각형 경계
  const minX = Math.min(startX, endX) / scaleX
  const minY = Math.min(startY, endY) / scaleY
  const maxX = Math.max(startX, endX) / scaleX
  const maxY = Math.max(startY, endY) / scaleY

  selectionAreaStyle.value = {
    left: `${minX}px`,
    top: `${minY}px`,
    width: `${maxX - minX}px`,
    height: `${maxY - minY}px`,
    borderRadius: `${borderRadius.value}px`,
    border: '2px solid #13987f'
  }

  // 테두리 둥글기 컨트롤러 위치 업데이트 및 화면 경계 준수
  updateBorderRadiusControllerPosition(minX, minY)
}

// 테두리 둥글기 컨트롤러 위치 업데이트
const updateBorderRadiusControllerPosition = (selectionLeft: number, selectionTop: number) => {
  const controllerHeight = 35 // 컨트롤러 높이
  const controllerWidth = 120 // 컨트롤러 너비

  let left = selectionLeft
  let top = selectionTop - controllerHeight

  // 컨트롤러가 화면 왼쪽 경계를 벗어나지 않도록 보장
  if (left < 0) {
    left = 0
  }

  // 컨트롤러가 화면 오른쪽 경계를 벗어나지 않도록 보장
  if (left + controllerWidth > window.innerWidth) {
    left = window.innerWidth - controllerWidth - 10
  }

  // 상단 경계를 벗어나면 선택 영역 내부에 표시
  if (top < 0) {
    top = selectionTop + 4 // 상단 경계를 벗어나면 선택 영역 내부에 표시
  }

  borderRadiusControllerStyle.value = {
    left: `${left - selectionLeft}px`, // 선택 영역 기준 위치
    top: `${top - selectionTop}px`
  }
}

// 선택 영역 드래그 시작
const handleSelectionDragStart = (event: MouseEvent) => {
  // 그리기 도구가 활성화된 경우 드래그 금지
  if (currentDrawTool.value) {
    event.preventDefault()
    event.stopPropagation()
    return // 즉시 반환하여 드래그 실행 방지
  }

  // 드래그 기능이 그리기 도구 상태에 영향을 받지 않도록 보장
  event.preventDefault()
  event.stopPropagation()

  isDragging.value = true
  dragOffset.value = {
    x: event.clientX - parseFloat(selectionAreaStyle.value.left),
    y: event.clientY - parseFloat(selectionAreaStyle.value.top)
  }

  // 글로벌 마우스 이벤트 리스너 추가
  document.addEventListener('mousemove', handleSelectionDragMove)
  document.addEventListener('mouseup', handleSelectionDragEnd)

  console.log('드래그 시작, 버튼 그룹 숨김')
}

// 선택 영역 드래그 이동
const handleSelectionDragMove = (event: MouseEvent) => {
  if (!isDragging.value) return

  event.preventDefault()

  // 선택 영역 드래그 시 돋보기를 표시하지 않음
  const newLeft = event.clientX - dragOffset.value.x
  const newTop = event.clientY - dragOffset.value.y

  // 선택 영역이 화면 경계를 벗어나지 않도록 보장
  const selectionWidth = parseFloat(selectionAreaStyle.value.width)
  const selectionHeight = parseFloat(selectionAreaStyle.value.height)
  const maxLeft = window.innerWidth - selectionWidth
  const maxTop = window.innerHeight - selectionHeight

  const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft))
  const constrainedTop = Math.max(0, Math.min(newTop, maxTop))

  selectionAreaStyle.value.left = `${constrainedLeft}px`
  selectionAreaStyle.value.top = `${constrainedTop}px`
  selectionAreaStyle.value.borderRadius = `${borderRadius.value}px`
  selectionAreaStyle.value.border = '2px solid #13987f'

  // screenConfig 업데이트
  const { scaleX, scaleY } = screenConfig.value
  screenConfig.value.startX = constrainedLeft * scaleX
  screenConfig.value.startY = constrainedTop * scaleY
  screenConfig.value.endX = (constrainedLeft + selectionWidth) * scaleX
  screenConfig.value.endY = (constrainedTop + selectionHeight) * scaleY

  // 사각형 다시 그리기
  redrawSelection()
  // 드래그 중에는 버튼 그룹 위치를 조정하지 않음
  if (!isDragging.value) {
    updateButtonGroupPosition()
  }
}

// 선택 영역 드래그 종료
const handleSelectionDragEnd = () => {
  isDragging.value = false

  // 글로벌 마우스 이벤트 리스너 제거
  document.removeEventListener('mousemove', handleSelectionDragMove)
  document.removeEventListener('mouseup', handleSelectionDragEnd)

  // 드래그 종료 후 돋보기 숨김
  if (magnifier.value) {
    magnifier.value.style.display = 'none'
  }

  nextTick(() => {
    updateButtonGroupPosition()
  })

  console.log('드래그 종료, 버튼 그룹 표시')
}

// 크기 조정 시작
const handleResizeStart = (event: MouseEvent, direction: string) => {
  // 그리기 도구가 활성화된 경우 크기 조정 금지
  if (currentDrawTool.value) {
    event.preventDefault()
    event.stopPropagation()
    return // 즉시 반환하여 크기 조정 실행 방지
  }

  event.preventDefault()
  event.stopPropagation()

  isResizing.value = true
  resizeDirection.value = direction

  resizeStartPosition.value = {
    x: event.clientX,
    y: event.clientY,
    width: parseFloat(selectionAreaStyle.value.width),
    height: parseFloat(selectionAreaStyle.value.height),
    left: parseFloat(selectionAreaStyle.value.left),
    top: parseFloat(selectionAreaStyle.value.top)
  }

  // 글로벌 마우스 이벤트 리스너 추가
  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mouseup', handleResizeEnd)
}

// 크기 조정 이동
const handleResizeMove = (event: MouseEvent) => {
  if (!isResizing.value) return

  event.preventDefault()

  // 크기 조정 시에도 정밀한 위치 설정을 위해 돋보기 표시
  handleMagnifierMouseMove(event)

  const deltaX = event.clientX - resizeStartPosition.value.x
  const deltaY = event.clientY - resizeStartPosition.value.y

  let newLeft = resizeStartPosition.value.left
  let newTop = resizeStartPosition.value.top
  let newWidth = resizeStartPosition.value.width
  let newHeight = resizeStartPosition.value.height

  // 크기 조정 방향에 따라 위치 및 크기 조정
  switch (resizeDirection.value) {
    case 'nw': // 왼쪽 상단
      newLeft += deltaX
      newTop += deltaY
      newWidth -= deltaX
      newHeight -= deltaY
      break
    case 'ne': // 오른쪽 상단
      newTop += deltaY
      newWidth += deltaX
      newHeight -= deltaY
      break
    case 'sw': // 왼쪽 하단
      newLeft += deltaX
      newWidth -= deltaX
      newHeight += deltaY
      break
    case 'se': // 오른쪽 하단
      newWidth += deltaX
      newHeight += deltaY
      break
    case 'n': // 위쪽
      newTop += deltaY
      newHeight -= deltaY
      break
    case 'e': // 오른쪽
      newWidth += deltaX
      break
    case 's': // 아래쪽
      newHeight += deltaY
      break
    case 'w': // 왼쪽
      newLeft += deltaX
      newWidth -= deltaX
      break
  }

  // 최소 크기 보장
  const minSize = 20
  if (newWidth < minSize) {
    if (resizeDirection.value.includes('w')) {
      newLeft = resizeStartPosition.value.left + resizeStartPosition.value.width - minSize
    }
    newWidth = minSize
  }
  if (newHeight < minSize) {
    if (resizeDirection.value.includes('n')) {
      newTop = resizeStartPosition.value.top + resizeStartPosition.value.height - minSize
    }
    newHeight = minSize
  }

  // 화면 경계를 벗어나지 않도록 보장
  newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - newWidth))
  newTop = Math.max(0, Math.min(newTop, window.innerHeight - newHeight))

  // 스타일 업데이트
  selectionAreaStyle.value = {
    left: `${newLeft}px`,
    top: `${newTop}px`,
    width: `${newWidth}px`,
    height: `${newHeight}px`,
    borderRadius: `${borderRadius.value}px`,
    border: '2px solid #13987f'
  }

  // screenConfig 업데이트
  const { scaleX, scaleY } = screenConfig.value
  screenConfig.value.startX = newLeft * scaleX
  screenConfig.value.startY = newTop * scaleY
  screenConfig.value.endX = (newLeft + newWidth) * scaleX
  screenConfig.value.endY = (newTop + newHeight) * scaleY

  // 선택 영역 다시 그리기
  redrawSelection()
  if (showButtonGroup.value) {
    updateButtonGroupPosition()
  }
}

// 크기 조정 종료
const handleResizeEnd = () => {
  isResizing.value = false
  resizeDirection.value = ''

  // 글로벌 마우스 이벤트 리스너 제거
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', handleResizeEnd)

  // 조정 종료 후 돋보기 숨김
  if (magnifier.value) {
    magnifier.value.style.display = 'none'
  }

  // 조정 종료 후 버튼 그룹 위치 설정
  nextTick(() => {
    if (showButtonGroup.value) {
      updateButtonGroupPosition()
    }
  })
}

// 테두리 둥글기 변화 처리
const handleBorderRadiusChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  borderRadius.value = parseInt(target.value, 10)

  // 테두리 표시를 포함한 선택 영역 스타일 업데이트
  updateSelectionAreaPosition()
}

/** 사각형 그리기 (테두리 둥글기 지원) */
const drawRectangle = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  lineWidth: number = 2
) => {
  context.strokeStyle = '#13987f'
  context.lineWidth = lineWidth

  // 테두리 둥글기가 있으면 둥근 사각형 그리기
  if (borderRadius.value > 0) {
    const radius = borderRadius.value * screenConfig.value.scaleX // 배율에 따라 테두리 둥글기 크기 조정
    const adjustedRadius = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2)

    context.beginPath()

    // 좌표가 올바른지 확인 (음수 너비/높이 처리)
    const rectX = width >= 0 ? x : x + width
    const rectY = height >= 0 ? y : y + height
    const rectWidth = Math.abs(width)
    const rectHeight = Math.abs(height)

    // 둥근 사각형 경로 그리기
    context.moveTo(rectX + adjustedRadius, rectY)
    context.lineTo(rectX + rectWidth - adjustedRadius, rectY)
    context.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + adjustedRadius)
    context.lineTo(rectX + rectWidth, rectY + rectHeight - adjustedRadius)
    context.quadraticCurveTo(
      rectX + rectWidth,
      rectY + rectHeight,
      rectX + rectWidth - adjustedRadius,
      rectY + rectHeight
    )
    context.lineTo(rectX + adjustedRadius, rectY + rectHeight)
    context.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - adjustedRadius)
    context.lineTo(rectX, rectY + adjustedRadius)
    context.quadraticCurveTo(rectX, rectY, rectX + adjustedRadius, rectY)
    context.closePath()

    context.stroke()
  } else {
    // 일반 사각형
    context.strokeRect(x, y, width, height)
  }

  drawSizeText(context, x, y, width, height)
}

/** 사각형 크기 텍스트 그리기 */
const drawSizeText = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
  if (context) {
    // 너비와 높이를 정수화
    const roundedWidth = Math.round(Math.abs(width))
    const roundedHeight = Math.round(Math.abs(height))
    const sizeText = `${roundedWidth} x ${roundedHeight}`

    // 텍스트가 항상 사각형의 왼쪽 상단에 표시되도록 보장
    const textX = width >= 0 ? x : x + width
    const textY = height >= 0 ? y : y + height

    // 폰트 및 스타일 설정
    context.font = '14px Arial'
    context.fillStyle = 'white'
    // 이미지 보간 품질 설정
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.fillText(sizeText, textX + 5, textY - 10) // 사각형 왼쪽 상단에서 약간 오프셋된 위치에 텍스트 그리기
  }
}

/** 마스크 그리기 */
const drawMask = () => {
  if (maskCtx.value && maskCanvas.value) {
    maskCtx.value.fillStyle = 'rgba(0, 0, 0, 0.4)'
    maskCtx.value.fillRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
  }
}

// 마스크를 투명 선택 영역 + 테두리 없음으로 다시 그려 DOM 선택 영역 테두리와 겹치지 않게 함
const redrawSelection = () => {
  if (!maskCtx.value || !maskCanvas.value) return

  const { startX, startY, endX, endY } = screenConfig.value
  const x = Math.min(startX, endX)
  const y = Math.min(startY, endY)
  const width = Math.abs(endX - startX)
  const height = Math.abs(endY - startY)

  // 마스크 삭제 및 다시 그리기
  maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
  drawMask()

  maskCtx.value.clearRect(x, y, width, height)
}

/** 돋보기 초기화 */
const initMagnifier = () => {
  if (magnifierCanvas.value) {
    magnifierCanvas.value.width = magnifierWidth
    magnifierCanvas.value.height = magnifierHeight
    magnifierCtx.value = magnifierCanvas.value.getContext('2d', { willReadFrequently: true })
  }
}

const confirmSelection = async () => {
  // 즉시 돋보기를 숨겨 캡처되지 않도록 함
  if (magnifier.value) {
    magnifier.value.style.display = 'none'
  }

  // 이미지 로드 여부 확인
  if (!isImageLoaded) {
    console.error('이미지 로드가 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.')
    await resetScreenshot()
    return
  }

  const { startX, startY, endX, endY } = screenConfig.value
  const width = Math.abs(endX - startX)
  const height = Math.abs(endY - startY)

  if (width < 1 || height < 1) {
    console.error('❌ 유효하지 않은 선택 영역 크기:', { width, height })
    await resetScreenshot()
    return
  }

  // 선택 영역의 왼쪽 상단 위치 계산
  const rectX = Math.min(startX, endX)
  const rectY = Math.min(startY, endY)

  // 최종 이미지를 합성하기 위한 임시 캔버스 생성
  const mergedCanvas = document.createElement('canvas')
  const mergedCtx = mergedCanvas.getContext('2d')

  // 합성 캔버스의 크기를 imgCanvas와 동일하게 설정
  mergedCanvas.width = imgCanvas.value!.width
  mergedCanvas.height = imgCanvas.value!.height

  if (mergedCtx) {
    try {
      // 먼저 원본 스크린샷 그리기 (imgCanvas에서)
      mergedCtx.drawImage(imgCanvas.value!, 0, 0)

      // 그런 다음 사용자의 그리기 내용 그리기 (drawCanvas에서), source-over 모드를 사용하여 올바르게 합성되도록 보장
      mergedCtx.globalCompositeOperation = 'source-over'
      mergedCtx.drawImage(drawCanvas.value!, 0, 0)

      // 최종 크롭 캔버스 생성
      const offscreenCanvas = document.createElement('canvas')
      const offscreenCtx = offscreenCanvas.getContext('2d')

      // 임시 캔버스 크기 설정
      offscreenCanvas.width = width
      offscreenCanvas.height = height

      if (offscreenCtx) {
        // 합성된 캔버스에서 선택 영역 크롭
        offscreenCtx.drawImage(
          mergedCanvas,
          rectX,
          rectY,
          width,
          height, // 크롭 영역
          0,
          0,
          width,
          height // 임시 캔버스에 그릴 영역
        )

        // 테두리 둥글기가 설정된 경우 크롭 결과에 둥근 마스크를 적용하여 투명한 둥근 테두리의 PNG 파일로 내보냄
        if (borderRadius.value > 0) {
          const scale = screenConfig.value.scaleX || 1
          const r = Math.min(borderRadius.value * scale, width / 2, height / 2)
          if (r > 0) {
            offscreenCtx.save()
            // 둥근 사각형 내부의 내용만 유지
            offscreenCtx.globalCompositeOperation = 'destination-in'

            offscreenCtx.beginPath()
            // (0,0,width,height)에 둥근 사각형 경로 구축
            offscreenCtx.moveTo(r, 0)
            offscreenCtx.lineTo(width - r, 0)
            offscreenCtx.quadraticCurveTo(width, 0, width, r)
            offscreenCtx.lineTo(width, height - r)
            offscreenCtx.quadraticCurveTo(width, height, width - r, height)
            offscreenCtx.lineTo(r, height)
            offscreenCtx.quadraticCurveTo(0, height, 0, height - r)
            offscreenCtx.lineTo(0, r)
            offscreenCtx.quadraticCurveTo(0, 0, r, 0)
            offscreenCtx.closePath()
            offscreenCtx.fill()

            offscreenCtx.restore()
          }
        }

        // 테스트: canvas 데이터 유효성 확인
        try {
          offscreenCtx.getImageData(0, 0, Math.min(10, width), Math.min(10, height))
        } catch (error) {
          console.error('ImageData 가져오기 실패, 보안 제한일 수 있음:', error)
        }

        offscreenCanvas.toBlob(async (blob) => {
          if (blob && blob.size > 0) {
            try {
              // Blob을 ArrayBuffer로 변환하여 Tauri 이벤트로 전달
              const arrayBuffer = await blob.arrayBuffer()
              const buffer = new Uint8Array(arrayBuffer)

              try {
                await emitTo('home', 'screenshot', {
                  type: 'image',
                  buffer: Array.from(buffer),
                  mimeType: 'image/png'
                })
              } catch (e) {
                console.warn('메인 창으로 스크린샷 전송 실패:', e)
              }

              try {
                await writeImage(buffer)
                window.$message?.success(t('message.screenshot.save_success'))
              } catch (clipboardError) {
                console.error('클립보드에 복사 실패:', clipboardError)
                window.$message?.error(t('message.screenshot.save_failed'))
              }

              await resetScreenshot()
            } catch (error) {
              window.$message?.error(t('message.screenshot.save_failed'))
              await resetScreenshot()
            }
          } else {
            window.$message?.error(t('message.screenshot.save_failed'))
            await resetScreenshot()
          }
        }, 'image/png')
      }
    } catch (error) {
      console.error('Canvas 작업 실패:', error)
      window.$message?.error(t('message.screenshot.save_failed'))
      await resetScreenshot()
    }
  }
}

const resetScreenshot = async () => {
  try {
    // 성능 최적화 관련 타이머 정리 (macOS 전용)
    if (isMac() && mouseMoveThrottleId) {
      clearTimeout(mouseMoveThrottleId)
      mouseMoveThrottleId = null
    }

    // 그리기 도구 상태 초기화
    resetDrawTools()

    // 모든 상태 초기화
    showButtonGroup.value = false
    isImageLoaded = false
    borderRadius.value = 0 // 원형 초기화
    isDragging.value = false
    isResizing.value = false

    screenConfig.value = {
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
      scaleX: 0,
      scaleY: 0,
      isDrawing: false,
      width: 0,
      height: 0
    }

    // 모든 캔버스 내용 지우기
    if (imgCtx.value && imgCanvas.value) {
      imgCtx.value.clearRect(0, 0, imgCanvas.value.width, imgCanvas.value.height)
    }
    if (maskCtx.value && maskCanvas.value) {
      maskCtx.value.clearRect(0, 0, maskCanvas.value.width, maskCanvas.value.height)
    }
    if (drawCtx.value && drawCanvas.value) {
      drawCtx.value.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height)
      // 초기화 시 그리기 캔버스 이벤트 비활성화
      drawCanvas.value.style.pointerEvents = 'none'
    }

    // 돋보기 숨기기
    if (magnifier.value) {
      magnifier.value.style.display = 'none'
    }

    // 창 상태 복원 (macOS는 전체 화면 종료 필요)
    await restoreWindowState()
  } catch (error) {
    // 오류 발생 시에도 창 상태 복원 시도
    await restoreWindowState()
  }
}

// 그리기 도구 취소를 위한 글로벌 마우스 클릭 처리
const handleGlobalMouseDown = (event: MouseEvent) => {
  // 그리기 도구가 활성화되어 있고 버튼 그룹이 표시될 때만 처리 고려
  if (!currentDrawTool.value || !showButtonGroup.value) return

  // 클릭이 버튼 그룹 내에서 발생하면 오작동 방지를 위해 즉시 반환
  if (buttonGroup.value && buttonGroup.value.contains(event.target as Node)) {
    return
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    resetScreenshot()
  }
}

const handleRightClick = (event: MouseEvent) => {
  // 기본 우클릭 메뉴 방지
  event.preventDefault()
  resetScreenshot()
}

const cancelSelection = () => {
  resetScreenshot()
}

// 스크린샷 처리 함수
const handleScreenshot = () => {
  // 스크린샷 시작 시 모든 상태 초기화
  resetDrawTools()
  appWindow.show()
  initCanvas()
  initMagnifier()
}

onMounted(async () => {
  appWindow.listen('capture', () => {
    resetDrawTools()
    initCanvas()
    initMagnifier()
  })

  // 창 숨김 시 초기화 이벤트 리스너
  appWindow.listen('capture-reset', () => {
    resetDrawTools()
    resetScreenshot()
    console.log('📷 Screenshot 컴포넌트가 초기화되었습니다')
  })

  // 사용자 정의 스크린샷 이벤트 리스너
  window.addEventListener('trigger-screenshot', handleScreenshot)
})

onUnmounted(async () => {
  // 성능 최적화 관련 타이머 정리 (macOS 전용)
  if (isMac() && mouseMoveThrottleId) {
    clearTimeout(mouseMoveThrottleId)
    mouseMoveThrottleId = null
  }

  // 키보드 이벤트 리스너 정리
  document.removeEventListener('keydown', handleKeyDown)

  // 글로벌 우클릭 이벤트 리스너 정리
  document.removeEventListener('contextmenu', handleRightClick)

  // 글로벌 클릭 이벤트 리스너 정리
  document.removeEventListener('mousedown', handleGlobalMouseDown)

  // 우클릭 이벤트 리스너 정리
  if (maskCanvas.value) {
    maskCanvas.value.removeEventListener('contextmenu', handleRightClick)
  }

  // 사용자 정의 이벤트 리스너 정리
  window.removeEventListener('trigger-screenshot', handleScreenshot)
})
</script>

<style scoped lang="scss">
.canvasbox {
  width: 100vw;
  height: 100vh;
  position: relative;
  background-color: transparent;
}

canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.magnifier {
  position: absolute;
  pointer-events: none;
  width: 120px;
  height: 120px;
  border: 1px solid #ccc;
  border-radius: 12px;
  overflow: hidden;
  display: none;
  background: white;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.img-canvas {
  z-index: 0;
}

.mask-canvas {
  z-index: 1;
}

.draw-canvas {
  z-index: 5;
  pointer-events: none;
}

.magnifier canvas {
  display: block;
  z-index: 2;
}

.selection-area {
  position: absolute;
  z-index: 2;
  background: transparent;
  box-sizing: border-box;
}

.drag-area {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  bottom: 8px;
  z-index: 10;
  background: transparent;
}

.drag-area.can-drag {
  cursor: move;
}

.drag-area.cannot-drag {
  cursor: not-allowed;
}

.resize-handle {
  position: absolute;
  background: white;
  border: 1px solid #ccc;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  z-index: 4;
  transition: all 0.2s;
}

.resize-handle.disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.5;
}

/* 네 모서리 컨트롤 포인트 */
.resize-nw {
  top: -4px;
  left: -4px;
  cursor: nw-resize;
}

.resize-ne {
  top: -4px;
  right: -4px;
  cursor: ne-resize;
}

.resize-sw {
  bottom: -4px;
  left: -4px;
  cursor: sw-resize;
}

.resize-se {
  bottom: -4px;
  right: -4px;
  cursor: se-resize;
}

/* 네 변 중앙 컨트롤 포인트 */
.resize-n {
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  cursor: n-resize;
}

.resize-e {
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: e-resize;
}

.resize-s {
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  cursor: s-resize;
}

.resize-w {
  left: -6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: w-resize;
}

.button-group {
  position: absolute;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px 8px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  z-index: 999;
  white-space: nowrap;
  overflow: visible;

  span {
    cursor: pointer;
    min-width: 30px;
    height: 30px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    flex: 0 0 auto;

    svg {
      width: 22px;
      height: 22px;
    }

    &:hover svg {
      color: #13987f;
    }

    &.active svg {
      color: #13987f;
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
  }
}

.border-radius-controller {
  position: absolute;
  left: 0;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  z-index: 999;
  white-space: nowrap;

  label {
    margin: 0;
  }

  input[type='range'] {
    width: 60px;
    height: 4px;
    background: #ddd;
    border-radius: 2px;
    outline: none;
    margin: 0;

    &::-webkit-slider-thumb {
      appearance: none;
      width: 12px;
      height: 12px;
      background: white;
      border-radius: 50%;
      cursor: pointer;
    }

    &::-moz-range-thumb {
      width: 12px;
      height: 12px;
      background: white;
      border-radius: 50%;
      border: none;
      cursor: pointer;
    }
  }

  span {
    font-size: 11px;
    min-width: 25px;
  }
}
</style>
