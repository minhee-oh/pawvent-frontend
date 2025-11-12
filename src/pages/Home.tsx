import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Map, Users, Trophy, Heart, Loader2 } from 'lucide-react'
import { walkSessionApi } from '../lib/api'

export default function Home() {
  const [todayStats, setTodayStats] = useState<{
    time: number
    distance: number
    sessions: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadTodayStats()
  }, [])

  const loadTodayStats = async () => {
    try {
      setIsLoading(true)
      const today = new Date().toISOString().split('T')[0]
      const response = await walkSessionApi.getStats(today, today)
      
      if (response.success && response.data) {
        const data = response.data
        setTodayStats({
          time: data.totalDuration || 0,
          distance: data.totalDistance || 0,
          sessions: data.totalSessions || 0,
        })
      }
    } catch (error) {
      console.error('오늘의 통계 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`
    }
    return `${minutes}분`
  }

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters}m`
    }
    return `${(meters / 1000).toFixed(1)}km`
  }

  // 걸음 수 추정 (거리 기반)
  const estimateSteps = (meters: number) => {
    return Math.round(meters * 1.3).toLocaleString()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <section className="mb-8">
        <h2 className="text-3xl font-bold mb-4">안녕하세요! 🐕</h2>
        <p className="text-gray-600 mb-6">
          오늘도 반려동물과 즐거운 산책 시간을 가지세요
        </p>
        
        <Link
          to="/walk"
          className="inline-block w-full bg-primary text-white px-6 py-4 rounded-lg text-center font-semibold hover:bg-primary/90 transition-colors"
        >
          산책 시작하기
        </Link>
      </section>

      <section className="mb-8">
        <h3 className="text-xl font-bold mb-4">빠른 메뉴</h3>
        <div className="grid grid-cols-2 gap-4">
          <QuickMenuCard
            icon={<Map size={32} />}
            title="산책 경로"
            description="추천 산책 경로 보기"
            to="/walk"
          />
          <QuickMenuCard
            icon={<Users size={32} />}
            title="커뮤니티"
            description="이웃과 소통하기"
            to="/community"
          />
          <QuickMenuCard
            icon={<Trophy size={32} />}
            title="챌린지"
            description="목표 달성하기"
            to="/challenges"
          />
          <QuickMenuCard
            icon={<Heart size={32} />}
            title="건강 기록"
            description="반려동물 관리"
            to="/profile"
          />
        </div>
      </section>

      <section>
        <h3 className="text-xl font-bold mb-4">오늘의 통계</h3>
        <div className="bg-white rounded-lg shadow p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center">
              <StatCard
                label="산책 시간"
                value={todayStats ? formatDuration(todayStats.time) : '0분'}
              />
              <StatCard
                label="이동 거리"
                value={todayStats ? formatDistance(todayStats.distance) : '0km'}
              />
              <StatCard
                label="걸음 수"
                value={todayStats ? estimateSteps(todayStats.distance) : '0'}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

interface QuickMenuCardProps {
  icon: React.ReactNode
  title: string
  description: string
  to: string
}

function QuickMenuCard({ icon, title, description, to }: QuickMenuCardProps) {
  return (
    <Link
      to={to}
      className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
    >
      <div className="text-primary mb-3">{icon}</div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </Link>
  )
}

interface StatCardProps {
  label: string
  value: string
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div>
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  )
}



