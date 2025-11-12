import { Trophy, Target } from 'lucide-react'

export default function Challenges() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-6">챌린지</h2>

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">진행 중인 챌린지</h3>
        <div className="space-y-4">
          <ChallengeCard
            title="이번 주 30km 걷기"
            progress={65}
            current="19.5 km"
            target="30 km"
            status="진행중"
          />
          <ChallengeCard
            title="7일 연속 산책"
            progress={85}
            current="6일"
            target="7일"
            status="진행중"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">새로운 챌린지</h3>
        <div className="space-y-4">
          <NewChallengeCard
            title="이번 달 100km 달성"
            description="한 달 동안 총 100km를 걸어보세요"
            reward="배지 + 500 포인트"
          />
          <NewChallengeCard
            title="아침 산책 루틴"
            description="7일 연속 오전 산책 완료하기"
            reward="배지 + 300 포인트"
          />
          <NewChallengeCard
            title="새로운 경로 탐험가"
            description="5개의 다른 경로에서 산책하기"
            reward="배지 + 400 포인트"
          />
        </div>
      </div>
    </div>
  )
}

interface ChallengeCardProps {
  title: string
  progress: number
  current: string
  target: string
  status: string
}

function ChallengeCard({ title, progress, current, target, status }: ChallengeCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-semibold text-lg mb-1">{title}</h4>
          <p className="text-sm text-gray-600">{current} / {target}</p>
        </div>
        <Trophy className="text-yellow-500" size={24} />
      </div>
      
      <div className="mb-2">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-primary h-3 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
      
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{progress}% 완료</span>
        <span className="text-primary font-semibold">{status}</span>
      </div>
    </div>
  )
}

interface NewChallengeCardProps {
  title: string
  description: string
  reward: string
}

function NewChallengeCard({ title, description, reward }: NewChallengeCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Target className="text-primary" size={24} />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold mb-1">{title}</h4>
          <p className="text-sm text-gray-600 mb-2">{description}</p>
          <p className="text-sm text-secondary font-semibold">보상: {reward}</p>
        </div>
        <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
          시작
        </button>
      </div>
    </div>
  )
}










