/** 옵션 네임스페이스 */
declare namespace OPT {
  /** 홈 화면 왼쪽 옵션 */
  namespace L {
    /**
     * 상단 옵션
     * @param url 링크
     * @param icon 옵션 아이콘
     * @param title 옵션 이름
     * @param iconAction 옵션 오른쪽 작업 아이콘
     * @param badge 옵션 오른쪽 배지 숫자
     * @param tip 옵션 팁 정보
     * @param size 옵션 크기
     * @param window 옵션 창 속성
     */
    type Common = {
      url: string
      icon: string
      title?: string
      shortTitle?: string
      iconAction?: string
      badge?: number
      tip?: string
      size?: {
        minWidth?: number
        minHeight?: number
        width: number
        height: number
      }
      window?: {
        resizable: boolean
      }
    }

    /**
     * 더 보기 옵션
     * @param label 옵션 이름
     * @param icon 옵션 아이콘
     * @param click 클릭 이벤트
     */
    type MoreList = {
      label: string
      icon: string
      click: () => void
    }

    /**
     * 설정 페이지 사이드바 옵션
     * @param url 링크
     * @param label 옵션 이름
     * @param icon 옵션 아이콘
     * @param versionStatus 버전 상태
     */
    type SettingSide = {
      url: string
      label: string
      icon: string
      versionStatus?: 'Beta' | 'New' | 'alpha' | string
    }
  }

  /**
   * 우클릭 메뉴 옵션
   * @param label 옵션 이름
   * @param icon 옵션 아이콘
   * @param click 클릭 이벤트
   * @param visible 표시 조건
   */
  type RightMenu = {
    label: string | ((...args: any[]) => string)
    icon: string | ((...args: any[]) => string)
    click?: (...args: any[]) => void
    visible?: (...args: any[]) => void
    children?: RightMenu[] | ((...args: any[]) => void)
  } | null

  /**
   * 상세 페이지 옵션
   * @param url 링크
   * @param title 제목
   * @param click 클릭 이벤트
   */
  type Details = {
    url: string
    title: string
    click: (...args: any[]) => void
  }
}
