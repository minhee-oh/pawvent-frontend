import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Calendar, Loader2, Database, Trash2 } from 'lucide-react'
import { walkSessionApi, type WalkSessionResponse } from '../lib/api'
import { clearMockWalkSessions, getMockSessionsByRange, seedMockWalkSessions } from '../lib/walkSessionMock'

function formatDistance(meters: number | null) {
  if (!meters) return '-'
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(2)} km`
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}시간 ${m}분`
  if (m > 0) return `${m}분 ${s}초`
  return `${s}초`
}

function ymd(date: Date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function WalkHistory() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return ymd(d)
  })
  const [endDate, setEndDate] = useState(() => ymd(new Date()))

  const [sessions, setSessions] = useState<WalkSessionResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUsingMock, setIsUsingMock] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        setError(null)
        setIsUsingMock(false)
        const res = await walkSessionApi.getMySessionsByRange(startDate, endDate)
        const list = Array.isArray(res.data) ? res.data : []
        setSessions(list)
      } catch (e: any) {
        // 백엔드가 꺼져있는 개발 상황을 고려해 더미 데이터로 폴백
        setIsUsingMock(true)
        setError('백엔드 연결이 없어 더미 데이터로 표시 중입니다.')
        setSessions(getMockSessionsByRange(startDate, endDate))
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [startDate, endDate])

  const sorted = useMemo(() => {
    return [...sessions].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  }, [sessions])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="뒤로가기"
          onClick={() => window.history.back()}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="text-lg font-extrabold text-gray-900">산책 기록</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              seedMockWalkSessions(10)
              setIsUsingMock(true)
              setSessions(getMockSessionsByRange(startDate, endDate))
              setError('더미 데이터를 생성했습니다.')
            }}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            title="더미 데이터 생성"
          >
            <Database size={14} />
            더미 생성
          </button>
          <button
            type="button"
            onClick={() => {
              clearMockWalkSessions()
              setIsUsingMock(false)
              setSessions([])
              setError('더미 데이터를 초기화했습니다.')
            }}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            title="더미 데이터 초기화"
          >
            <Trash2 size={14} />
            초기화
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
          <Calendar size={16} />
          기간 선택
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm text-gray-700">
            <div className="text-xs text-gray-500 mb-1">시작일</div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white"
            />
          </label>
          <label className="text-sm text-gray-700">
            <div className="text-xs text-gray-500 mb-1">종료일</div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
          <p className="text-red-700 text-sm">
            {error}
            {isUsingMock ? <span className="ml-2 text-red-600/80">(더미)</span> : null}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-14 text-gray-500">
          <Loader2 className="animate-spin" size={22} />
          <span className="ml-2 text-sm">불러오는 중...</span>
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center text-sm text-gray-500 py-14">
          해당 기간의 산책 기록이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold text-gray-900 line-clamp-1">
                  {s.routeName || '산책'}
                  {s.petName ? <span className="text-gray-500 font-semibold"> · {s.petName}</span> : null}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(s.startTime).toLocaleString()} {s.endTime ? `~ ${new Date(s.endTime).toLocaleTimeString()}` : ''}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-sm font-extrabold text-primary">{formatDistance(s.distance)}</div>
                  <div className="text-[11px] text-gray-500 mt-1">거리</div>
                </div>
                <div>
                  <div className="text-sm font-extrabold text-primary">{formatDuration(s.duration)}</div>
                  <div className="text-[11px] text-gray-500 mt-1">시간</div>
                </div>
                <div>
                  <div className="text-sm font-extrabold text-primary">{s.isCompleted ? '완료' : '진행중'}</div>
                  <div className="text-[11px] text-gray-500 mt-1">상태</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


