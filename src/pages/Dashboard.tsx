import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { walkSessionApi, type WalkSessionResponse } from '../lib/api'

export default function Dashboard() {
  const [stats, setStats] = useState<{
    totalTime: number
    totalDistance: number
    totalSessions: number
  } | null>(null)
  const [recentSessions, setRecentSessions] = useState<WalkSessionResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setIsLoading(true)
      
      // 이번 주 날짜 범위 계산
      const today = new Date()
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - 7)
      
      const startDate = startOfWeek.toISOString().split('T')[0]
      const endDate = today.toISOString().split('T')[0]
      
      // 통계 조회
      const statsResponse = await walkSessionApi.getStats(startDate, endDate)
      if (statsResponse.success && statsResponse.data) {
        const data = statsResponse.data
        setStats({
          totalTime: data.totalDuration || 0,
          totalDistance: data.totalDistance || 0,
          totalSessions: data.totalSessions || 0,
        })
      }
      
      // 최근 산책 기록 조회
      const recentResponse = await walkSessionApi.getRecent(5)
      if (recentResponse.success && recentResponse.data) {
        setRecentSessions(recentResponse.data)
      }
    } catch (error) {
      console.error('대시보드 데이터 로드 실패:', error)
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
    return `${(meters / 1000).toFixed(1)} km`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) {
      return '오늘'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return '어제'
    } else {
      const diff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
      return `${diff}일 전`
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold mb-6">대시보드</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-6">대시보드</h2>
      
      <div className="grid gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">이번 주 활동</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">총 산책 시간</span>
              <span className="text-2xl font-bold text-primary">
                {stats ? formatDuration(stats.totalTime) : '0분'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">총 이동 거리</span>
              <span className="text-2xl font-bold text-primary">
                {stats ? formatDistance(stats.totalDistance) : '0 km'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">산책 횟수</span>
              <span className="text-2xl font-bold text-primary">
                {stats ? `${stats.totalSessions}회` : '0회'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">최근 산책 기록</h3>
          {recentSessions.length > 0 ? (
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <WalkRecord
                  key={session.id}
                  date={formatDate(session.startTime)}
                  time={session.duration ? formatDuration(session.duration) : '-'}
                  distance={session.distance ? formatDistance(session.distance) : '-'}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">산책 기록이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface WalkRecordProps {
  date: string
  time: string
  distance: string
}

function WalkRecord({ date, time, distance }: WalkRecordProps) {
  return (
    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
      <div>
        <p className="font-semibold">{date}</p>
        <p className="text-sm text-gray-600">{time}</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-primary">{distance}</p>
      </div>
    </div>
  )
}



