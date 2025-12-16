import { NFlex } from 'naive-ui'
import type { VNode } from 'vue'
import { MacOsKeyEnum, WinKeyEnum } from '@/enums'
import { isWindows } from '@/utils/PlatformConstants'
import pkg from '~/package.json'
import { Button, Input, InputNumber, Select, Slider, Switch } from './model.tsx'

const key = computed(() => {
  return `${isWindows() ? WinKeyEnum.CTRL : MacOsKeyEnum['⌘']}`
})

type ConfigItemType = 'system' | 'record' | 'identity' | 'cueWords' | 'APIAddress' | 'model' | 'clear'
type ChatConfig = {
  [key in ConfigItemType]: {
    title: string
    description?: string
    features: VNode
  }[]
}

/** chat 설정 패널 구성 */
export const content: ChatConfig = {
  system: [
    {
      title: `현재 버전: v${pkg.version}`,
      description: '최신 버전입니다',
      features: <Button title={'업데이트 확인'} icon={'refresh'} />
    },
    {
      title: '전송 키',
      features: (
        <Select
          content={[
            { label: 'Enter', value: 'Enter' },
            { label: `${key.value} + Enter`, value: `${key.value}+Enter` }
          ]}
        />
      )
    },
    {
      title: '테마',
      features: (
        <Select
          content={[
            { label: '라이트 모드', value: 'light' },
            { label: '다크 모드', value: 'dark' },
            { label: '시스템 설정 따름', value: 'auto' }
          ]}
        />
      )
    },
    {
      title: '글꼴 크기',
      description: '채팅 내용의 글꼴 크기',
      features: <Slider min={12} max={20} value={14} />
    },
    {
      title: '제목 자동 생성',
      description: '대화 내용에 따라 적절한 제목 생성',
      features: <Switch active={false} />
    }
  ],
  record: [
    {
      title: '클라우드 데이터',
      description: '동기화되지 않음',
      features: <Button title={'구성'} icon={'setting-config'} />
    },
    {
      title: '로컬 데이터',
      description: '대화 1개, 메시지 0개, 프롬프트 0개, 신원 0개',
      features: (
        <NFlex align={'center'}>
          <Button title={'가져오기'} icon={'Export'} />
          <Button title={'내보내기'} icon={'Importing'} />
        </NFlex>
      )
    }
  ],
  identity: [
    {
      title: '신원 시작 페이지',
      description: '새 채팅 시작 시 신원 시작 페이지 표시',
      features: <Switch active={true} />
    },
    {
      title: '내장 신원 숨기기',
      description: '모든 신원 목록에서 내장 신원 숨기기',
      features: <Switch active={false} />
    }
  ],
  cueWords: [
    {
      title: '프롬프트 자동 완성 비활성화',
      description: '입력 상자 시작 부분에 /를 입력하여 자동 완성 트리거',
      features: <Switch active={false} />
    },
    {
      title: '사용자 정의 프롬프트 목록',
      description: '내장 285개, 사용자 정의 0개',
      features: <Button title={'편집'} icon={'edit'} />
    }
  ],
  APIAddress: [
    {
      title: '모델 서비스 제공자',
      description: '다른 서비스 제공자로 전환',
      features: (
        <Select
          content={[
            { label: 'openAi', value: 'openAi' },
            { label: 'Azure', value: 'Azure' },
            { label: 'Google', value: 'Google' }
          ]}
        />
      )
    },
    {
      title: 'API 주소',
      description: '기본 주소 외에 http(s)://를 포함해야 합니다',
      features: <Input value={'www.baidu.com'} />
    },
    {
      title: 'API 키',
      description: '사용자 정의 OpenAI 키를 사용하여 비밀번호 액세스 제한 통과',
      features: <Input value={'123456'} isPassword={true} />
    }
  ],
  model: [
    {
      title: '모델(model)',
      features: (
        <Select
          content={[
            { label: 'gpt-3.5-turbo', value: 'gpt-3.5-turbo' },
            { label: 'gpt-4o', value: 'gpt-4o' },
            { label: 'gpt-4-32k', value: 'gpt-4-32k' },
            { label: 'gpt-4-turbo', value: 'gpt-4-turbo' }
          ]}
        />
      )
    },
    {
      title: '무작위성(temperature)',
      description: '값이 클수록 응답이 더 무작위가 됩니다',
      features: <Slider min={0} max={10} value={5} />
    },
    {
      title: '핵 샘플링(top_p)',
      description: '무작위성과 유사하지만 무작위성과 함께 변경하지 마십시오',
      features: <Slider min={0} max={10} value={5} />
    },
    {
      title: '단일 응답 제한(max_tokens)',
      description: '단일 상호 작용에 사용되는 최대 토큰 수',
      features: <InputNumber value={4000} min={2000} max={10000} />
    },
    {
      title: '주제 신선도(presence_penalty)',
      description: '값이 클수록 새로운 주제로 확장될 가능성이 높습니다',
      features: <Slider min={0} max={10} value={5} />
    },
    {
      title: '빈도 페널티(frequency_penalty)',
      description: '값이 클수록 반복되는 단어를 줄일 가능성이 높습니다',
      features: <Slider min={0} max={10} value={5} />
    },
    {
      title: '시스템 수준 프롬프트 정보 주입',
      description: '각 요청의 메시지 목록 시작 부분에 ChatGPT를 모방하는 시스템 프롬프트를 강제로 추가',
      features: <Switch active={false} />
    },
    {
      title: '사용자 입력 전처리',
      description: '사용자의 최신 메시지가 이 템플릿에 채워집니다',
      features: <Input value={'input'} />
    },
    {
      title: '포함된 기록 메시지 수',
      description: '각 요청에 포함되는 기록 메시지 수',
      features: <Slider min={0} max={10} value={5} />
    },
    {
      title: '기록 메시지 길이 압축 임계값',
      description: '압축되지 않은 기록 메시지가 이 값을 초과하면 압축됩니다',
      features: <InputNumber value={1000} min={0} max={5000} />
    },
    {
      title: '기록 요약',
      description: '채팅 기록을 자동으로 압축하여 컨텍스트로 전송',
      features: <Switch active={true} />
    }
  ],
  clear: [
    {
      title: '모든 설정 초기화',
      description: '모든 설정 항목을 기본값으로 초기화',
      features: <Button title={'즉시 초기화'} isSecondary={true} />
    },
    {
      title: '모든 데이터 지우기',
      description: '모든 채팅 및 설정 데이터 지우기',
      features: <Button title={'즉시 지우기'} isSecondary={true} />
    }
  ]
}
