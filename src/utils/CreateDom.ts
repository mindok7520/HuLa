import { formatBytes } from '@/utils/Formatting.ts'

/**
 * SVG 아이콘이 포함된 img 태그 생성
 * @param {File} file 파일 객체
 */
export const createFileOrVideoDom = (file: File) => {
  // 파일 이름과 크기 가져오기
  const fileName = file.name
  // 파일 또는 비디오 크기 계산
  const fileSize = formatBytes(file.size)

  return new Promise((resolve, reject) => {
    // 둥근 모서리와 SVG 아이콘이 포함된 canvas 요소 생성
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    // 장치 픽셀 비율 가져오기
    const dpr = window.devicePixelRatio || 1

    // canvas의 실제 크기
    const actualWidth = 225
    const actualHeight = 85

    // canvas의 표시 크기 설정
    canvas.style.width = `${actualWidth}px`
    canvas.style.height = `${actualHeight}px`

    // canvas의 버퍼 크기 설정
    canvas.width = actualWidth * dpr
    canvas.height = actualHeight * dpr

    // dpr에 따라 컨텍스트 크기 조정
    ctx.scale(dpr, dpr)
    const extension = file.name.split('.').pop()?.toLowerCase() || 'file'
    // SVG 파일을 로드하여 canvas에 그리기, 파일 유형에 따라 SVG 아이콘 설정
    loadSVG(`/file/${extension}.svg`)
      .then((svgImage: any) => {
        // 둥근 사각형의 배경과 테두리, 필요에 따라 스타일 조정 가능
        ctx.fillStyle = '#fdfdfd' // 배경색
        ctx.strokeStyle = '#ccc' // 테두리 색상
        ctx.lineWidth = 2 // 테두리 너비
        const selectedBgColor = '#e4e4e4' // 클릭 시 배경색
        const unselectedBgColor = '#fdfdfd' // 미클릭 시 배경색
        let isImgSelected = false // 이미지 선택 여부 표시
        const maxTextWidth = 160 // 파일 이름의 최대 너비

        // 둥근 사각형 배경 그리기
        roundRect(ctx, 0, 0, actualWidth, actualHeight, 8)
        ctx.fill()

        // 둥근 사각형 테두리 그리기
        roundRect(ctx, 0, 0, actualWidth, actualHeight, 8)
        ctx.stroke()

        /** 텍스트가 너무 길면 잘라내고 생략 부호로 대체 */
        function truncateText(text: string, maxWidth: number) {
          const ellipsis = '...'
          const ellipsisWidth = ctx.measureText(ellipsis).width

          if (ctx.measureText(text).width <= maxWidth || maxWidth <= ellipsisWidth) {
            return text
          }

          let left = 0
          let right = text.length
          let currentText
          let currentWidth

          while (left < right - 1) {
            const middle = Math.floor((left + right) / 2)
            currentText = text.substring(0, middle) + ellipsis + text.substring(text.length - middle, text.length)
            currentWidth = ctx.measureText(currentText).width

            if (currentWidth < maxWidth) {
              left = middle
            } else {
              right = middle
            }
          }

          currentText = text.substring(0, left) + ellipsis + text.substring(text.length - left, text.length)
          return currentText
        }

        /** canvas의 배경색과 테두리 업데이트 */
        function updateCanvasBackground(
          canvas: HTMLCanvasElement,
          ctx: CanvasRenderingContext2D,
          isImgSelected: boolean
        ) {
          // 이전 내용 지우기
          ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

          // canvas의 배경색과 테두리 업데이트
          ctx.fillStyle = isImgSelected ? selectedBgColor : unselectedBgColor
          ctx.strokeStyle = '#ccc'
          ctx.lineWidth = 2

          // 둥근 사각형 다시 그리기
          roundRect(ctx, 0, 0, actualWidth, actualHeight, 8)
          ctx.fill()
          roundRect(ctx, 0, 0, actualWidth, actualHeight, 8)
          ctx.stroke()

          // 기존 텍스트 그리기 부분 수정, truncateText 함수를 사용하여 텍스트 잘라내기
          ctx.fillStyle = '#333' // 텍스트 색상
          ctx.font = 'bold 14px Arial' // 텍스트 스타일
          const truncatedFileName = truncateText(fileName, maxTextWidth)
          ctx.fillText(truncatedFileName, 15, 25)

          ctx.fillStyle = '#909090' // 텍스트 색상
          ctx.font = 'normal 12px Arial' // 텍스트 스타일
          ctx.fillText(fileSize, 15, actualHeight - 15)

          // 오른쪽에 SVG 아이콘 그리기, dpr에 따라 위치 조정 필요
          ctx.drawImage(svgImage, actualWidth - svgImage.width / dpr - 25, (actualHeight - svgImage.height / dpr) / 2)

          return canvas.toDataURL('image/png')
        }

        // Canvas를 Data URL로 변환
        const dataURL = updateCanvasBackground(canvas, ctx, isImgSelected)
        const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'wmv', 'mkv', 'flv']
        const imgStyle = 'border-radius: 8px; margin-right: 6px; cursor: pointer;'
        const isVideo = VIDEO_EXTENSIONS.includes(extension)
        if (isVideo) {
          // video 요소 생성
          const video = document.createElement('video')
          try {
            // 1. 먼저 파일 객체 유효성 검사
            if (!(file instanceof File) || file.size === 0) {
              throw new Error('유효하지 않은 비디오 파일')
            }
            video.src = URL.createObjectURL(file)
            video.dataset.type = 'video'
            video.poster = dataURL
            video.style.cssText = imgStyle
            video.width = actualWidth
            video.height = actualHeight
            // video 요소가 커서 표시를 방해하지 않도록 함
            video.setAttribute('contenteditable', 'false')
            video.setAttribute('draggable', 'false')
            video.onloadeddata = () => resolve(video)
            video.onerror = reject
          } catch (error) {
            reject(error)
            window.$message.error('비디오 처리 실패: ' + error)
          }
        } else {
          // Image DOM 요소를 생성하고 src를 canvas의 data url로 지정
          const img = new Image()
          img.src = dataURL
          img.dataset.type = 'file-canvas'
          img.style.cssText = imgStyle
          img.width = actualWidth
          img.height = actualHeight
          img.onload = () => resolve(img)
          img.onerror = reject

          // img 요소 클릭 이벤트 리스너
          img.addEventListener('click', (e) => {
            e.stopPropagation()
            isImgSelected = !isImgSelected
            img.src = updateCanvasBackground(canvas, ctx, isImgSelected)
          })

          // document 클릭 이벤트 리스너
          document.addEventListener(
            'click',
            () => {
              if (isImgSelected) {
                isImgSelected = false
                img.src = updateCanvasBackground(canvas, ctx, isImgSelected)
              }
            },
            true
          )
        }
      })
      .catch((error) => {
        reject(error)
        window.$message.error('이 유형의 파일은 아직 지원되지 않습니다.')
      })
  })
}

/**
 * 로컬 SVG 파일을 로드하고 완료 후 콜백
 * @param {string} path SVG 파일 경로
 * @example
 * loadSVG('public/file/file.svg').then((svgImage) => {}
 * 사용 시 SVG 파일을 public/file 폴더에 넣고 파일 유형을 svg 이름으로 사용합니다.
 */
const loadSVG = (path: string) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = path
  })
}

/**
 * 둥근 모서리가 있는 사각형 그리기
 * @param {CanvasRenderingContext2D} ctx Canvas 드로잉 컨텍스트
 * @param {number} x 사각형 왼쪽 상단 x 좌표
 * @param {number} y 사각형 왼쪽 상단 y 좌표
 * @param {number} width 사각형 너비
 * @param {number} height 사각형 높이
 * @param {number} radius 둥근 모서리의 반지름
 */
const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  if (width < 2 * radius) radius = width / 2
  if (height < 2 * radius) radius = height / 2
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}
