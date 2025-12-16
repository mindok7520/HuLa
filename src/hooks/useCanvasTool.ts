export function useCanvasTool(drawCanvas: any, drawCtx: any, imgCtx: any, screenConfig: any) {
  const drawConfig = ref({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    scaleX: 1,
    scaleY: 1,
    lineWidth: 2, // 선 너비
    color: 'red', // 색상
    isDrawing: false, // 그리기 중 여부
    brushSize: 10, // 모자이크 크기
    actions: [], // 그리기 동작 저장
    undoStack: []
  })

  const currentTool = ref('')
  // 현재 그리기 과정에서 실제로 그리기가 발생했는지 표시
  const hasDrawn = ref(false)
  // 실행 취소 가능 여부 (저장된 그리기 동작이 있을 때)
  const canUndo = computed(() => drawConfig.value.actions.length > 0)

  const draw = (type: string) => {
    const { clientWidth: containerWidth, clientHeight: containerHeight } = drawCanvas.value
    drawConfig.value.scaleX = (screen.width * window.devicePixelRatio) / containerWidth
    drawConfig.value.scaleY = (screen.height * window.devicePixelRatio) / containerHeight
    currentTool.value = type
    startListen()
  }

  onUnmounted(() => {
    closeListen()
  })

  const handleMouseDown = (event: MouseEvent) => {
    const { offsetX, offsetY } = event
    drawConfig.value.isDrawing = true
    hasDrawn.value = false

    // 시작 좌표를 선택 사각형 영역 내로 제한
    drawConfig.value.startX = Math.min(
      Math.max(offsetX * drawConfig.value.scaleX, screenConfig.value.startX),
      screenConfig.value.endX
    )
    drawConfig.value.startY = Math.min(
      Math.max(offsetY * drawConfig.value.scaleY, screenConfig.value.startY),
      screenConfig.value.endY
    )
  }

  const handleMouseMove = (event: MouseEvent) => {
    const { offsetX, offsetY } = event
    if (!drawConfig.value.isDrawing || !drawCtx.value) return

    // 그리기 영역을 선택 사각형 영역 내로 제한
    let limitedX = Math.min(
      Math.max(offsetX * drawConfig.value.scaleX, screenConfig.value.startX),
      screenConfig.value.endX
    )
    let limitedY = Math.min(
      Math.max(offsetY * drawConfig.value.scaleY, screenConfig.value.startY),
      screenConfig.value.endY
    )

    // 모자이크 도구의 경우 테두리 너비와 브러시 반경 오프셋을 고려하여 선택 영역 테두리에 칠해지지 않도록 함
    if (currentTool.value === 'mosaic') {
      const borderWidth = 2
      const halfBrushSize = drawConfig.value.brushSize / 2
      const safeMargin = borderWidth + halfBrushSize

      limitedX = Math.min(
        Math.max(offsetX * drawConfig.value.scaleX, screenConfig.value.startX + safeMargin),
        screenConfig.value.endX - safeMargin
      )
      limitedY = Math.min(
        Math.max(offsetY * drawConfig.value.scaleY, screenConfig.value.startY + safeMargin),
        screenConfig.value.endY - safeMargin
      )
    }

    drawConfig.value.endX = limitedX
    drawConfig.value.endY = limitedY

    // 모자이크가 아닌 경우 지우고 다시 그리기
    if (currentTool.value !== 'mosaic') {
      drawCtx.value.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height)
      drawConfig.value.actions.forEach((action) => {
        drawCtx.value.putImageData(action, 0, 0)
      })
    }

    const x = Math.min(drawConfig.value.startX, drawConfig.value.endX)
    const y = Math.min(drawConfig.value.startY, drawConfig.value.endY)

    const width = Math.abs(drawConfig.value.startX - drawConfig.value.endX)
    const height = Math.abs(drawConfig.value.startY - drawConfig.value.endY)

    switch (currentTool.value) {
      case 'rect':
        drawRectangle(drawCtx.value, x, y, width, height)
        hasDrawn.value = true
        break
      case 'circle':
        drawCircle(
          drawCtx.value,
          drawConfig.value.startX,
          drawConfig.value.startY,
          drawConfig.value.endX,
          drawConfig.value.endY
        )
        hasDrawn.value = true
        break
      case 'arrow':
        drawArrow(
          drawCtx.value,
          drawConfig.value.startX,
          drawConfig.value.startY,
          drawConfig.value.endX,
          drawConfig.value.endY
        )
        hasDrawn.value = true
        break
      case 'mosaic':
        drawMosaic(drawCtx.value, limitedX, limitedY, drawConfig.value.brushSize)
        hasDrawn.value = true
        break
      default:
        break
    }
  }

  const handleMouseUp = () => {
    // const { offsetX, offsetY } = event;
    drawConfig.value.isDrawing = false

    // 실제 그리기가 없을 때는 동작을 저장하지 않아 오작동 방지 (예: 도구 모음 버튼 클릭 시)
    if (!hasDrawn.value) {
      return
    }

    drawCtx.value.drawImage(drawCanvas.value!, 0, 0, drawCanvas.value.width, drawCanvas.value.height)

    saveAction()
  }

  const drawRectangle = (context: any, x: any, y: any, width: any, height: any) => {
    context.strokeStyle = drawConfig.value.color
    context.lineWidth = drawConfig.value.lineWidth
    context.strokeRect(x, y, width, height)
  }

  const drawCircle = (context: any, startX: any, startY: any, endX: any, endY: any) => {
    // 원형 그리기 범위를 선택 사각형 영역 내로 제한
    const limitedEndX = Math.min(Math.max(endX, screenConfig.value.startX), screenConfig.value.endX)
    const limitedEndY = Math.min(Math.max(endY, screenConfig.value.startY), screenConfig.value.endY)

    // 반경 계산, 반경이 제한 사각형의 경계를 초과하지 않도록 보장
    const deltaX = limitedEndX - startX
    const deltaY = limitedEndY - startY

    // 원형이 사각형 영역의 경계를 초과하는지 확인
    const maxRadiusX = Math.min(startX - screenConfig.value.startX, screenConfig.value.endX - startX)
    const maxRadiusY = Math.min(startY - screenConfig.value.startY, screenConfig.value.endY - startY)
    const maxRadius = Math.min(maxRadiusX, maxRadiusY)

    // min 함수를 사용하여 반경이 제한 범위를 초과하지 않도록 함
    const radius = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), maxRadius)

    // 원형 그리기
    context.strokeStyle = drawConfig.value.color
    context.lineWidth = drawConfig.value.lineWidth
    context.beginPath()
    context.arc(startX, startY, radius, 0, Math.PI * 2)
    context.stroke()
  }

  const drawArrow = (context: any, fromX: any, fromY: any, toX: any, toY: any) => {
    const headLength = 15 // 화살표 길이
    const angle = Math.atan2(toY - fromY, toX - fromX) // 화살표 각도 계산

    context.strokeStyle = drawConfig.value.color
    context.lineWidth = drawConfig.value.lineWidth

    // 화살표 주 선 그리기
    context.beginPath()
    context.moveTo(fromX, fromY)
    context.lineTo(toX, toY)
    context.stroke()

    // 화살표 삼각형의 세 모서리 계산
    context.beginPath()
    context.moveTo(toX, toY)
    context.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6))
    context.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6))
    context.closePath()

    // 화살표 삼각형 채우기
    context.fillStyle = drawConfig.value.color
    context.fill()
  }

  // 모자이크 브러시 크기 설정
  const drawMosaicBrushSize = (size: any) => {
    drawConfig.value.brushSize = size
  }

  // 실시간 모자이크 칠하기
  const drawMosaic = (context: any, x: any, y: any, size: any) => {
    // 모자이크 그리기 영역이 선택 영역 경계를 초과하지 않도록 보장 (테두리와 브러시 반경 고려)
    const borderWidth = 2
    const halfSize = size / 2

    // 브러시 반경의 안전 여백을 고려하여 브러시 가장자리가 테두리에 칠해지지 않도록 함
    const safeMargin = borderWidth + halfSize

    // 실제 그리기 영역 계산, 선택 영역 내용 내에 완전히 포함되도록 함
    const drawX = Math.max(x - halfSize, screenConfig.value.startX + safeMargin)
    const drawY = Math.max(y - halfSize, screenConfig.value.startY + safeMargin)
    const maxDrawX = Math.min(x + halfSize, screenConfig.value.endX - safeMargin)
    const maxDrawY = Math.min(y + halfSize, screenConfig.value.endY - safeMargin)

    // 실제 그리기 크기 계산
    const drawWidth = Math.max(0, maxDrawX - drawX)
    const drawHeight = Math.max(0, maxDrawY - drawY)

    if (drawWidth > 0 && drawHeight > 0) {
      const imageData = imgCtx.value.getImageData(drawX, drawY, drawWidth, drawHeight)
      const blurredData = blurImageData(imageData, Math.min(drawWidth, drawHeight))
      context.putImageData(blurredData, drawX, drawY)
    }
  }

  const blurImageData = (imageData: ImageData, size: any): ImageData => {
    const data = imageData.data
    const width = imageData.width
    const height = imageData.height

    const radius = size / 2 // 흐림 반경
    const tempData = new Uint8ClampedArray(data) // 원본 이미지 데이터 저장용

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4

        let r = 0,
          g = 0,
          b = 0,
          a = 0
        let count = 0

        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const newX = x + kx
            const newY = y + ky

            if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
              const newIndex = (newY * width + newX) * 4
              r += tempData[newIndex]
              g += tempData[newIndex + 1]
              b += tempData[newIndex + 2]
              a += tempData[newIndex + 3]
              count++
            }
          }
        }

        data[index] = r / count
        data[index + 1] = g / count
        data[index + 2] = b / count
        data[index + 3] = a / count
      }
    }

    return imageData
  }

  const saveAction = () => {
    const imageData = drawCtx.value.getImageData(0, 0, drawCanvas.value.width, drawCanvas.value.height)
    drawConfig.value.actions.push(imageData as never)
    drawConfig.value.undoStack = [] // 실행 취소 스택 비우기
  }

  const undo = () => {
    closeListen()
    if (drawConfig.value.actions.length > 0) {
      drawConfig.value.undoStack.push(drawConfig.value.actions.pop() as never)
      drawCtx.value.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height)
      if (drawConfig.value.actions.length > 0) {
        drawCtx.value.putImageData(drawConfig.value.actions[drawConfig.value.actions.length - 1], 0, 0)
      }
    }
  }

  const redo = () => {
    closeListen()
    if (drawConfig.value.undoStack.length > 0) {
      const imageData = drawConfig.value.undoStack.pop()
      drawConfig.value.actions.push(imageData as never)
      drawCtx.value.putImageData(imageData, 0, 0)
    }
  }

  // 모든 그리기 내용 일괄 지우기
  const clearAll = () => {
    closeListen()
    drawConfig.value.actions = []
    drawConfig.value.undoStack = []
    if (drawCtx.value && drawCanvas.value) {
      drawCtx.value.clearRect(0, 0, drawCanvas.value.width, drawCanvas.value.height)
    }
  }

  // 그리기 상태 초기화, 모든 그리기 기록 지우기
  const resetState = () => {
    drawConfig.value.actions = []
    drawConfig.value.undoStack = []
    drawConfig.value.isDrawing = false
    currentTool.value = ''
    console.log('그리기 상태가 초기화되었으며 기록이 지워졌습니다')
  }

  // 현재 그리기 작업 중지
  const stopDrawing = () => {
    drawConfig.value.isDrawing = false
    currentTool.value = ''
    closeListen()
    console.log('그리기 작업이 중지되었습니다')
  }

  // 이벤트 리스너 지우기
  const clearEvents = () => {
    closeListen()
    console.log('그리기 이벤트 리스너가 지워졌습니다')
  }

  const startListen = () => {
    const el = drawCanvas.value
    if (!el) return
    // 그리기 캔버스에서만 누름 및 이동을 수신하여 도구 모음 클릭 시 그리기 프로세스가 트리거되는 것을 방지
    el.addEventListener('mousedown', handleMouseDown)
    el.addEventListener('mousemove', handleMouseMove)
    // mouseup은 document에 배치하여 캔버스 밖으로 드래그해도 그리기가 종료되도록 함
    document.addEventListener('mouseup', handleMouseUp)
  }

  const closeListen = () => {
    const el = drawCanvas.value
    if (el) {
      el.removeEventListener('mousedown', handleMouseDown)
      el.removeEventListener('mousemove', handleMouseMove)
    }
    document.removeEventListener('mouseup', handleMouseUp)
  }

  return {
    draw,
    drawMosaicBrushSize,
    drawRectangle,
    drawCircle,
    drawArrow,
    undo,
    redo,
    clearAll,
    resetState,
    stopDrawing,
    clearEvents,
    canUndo
  }
}
