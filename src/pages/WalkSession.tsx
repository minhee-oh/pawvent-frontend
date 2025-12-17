import { useState, useEffect, useMemo, useRef } from 'react'
import { ArrowLeft, Expand, Loader2, Pause, Play, Search, Square, AlertTriangle, X, ChevronRight } from 'lucide-react'
import KakaoMap, { type SpotData } from '../components/KakaoMap'
import HazardReportModal from '../components/HazardReportModal'
import SpotDetailModal from '../components/SpotDetailModal'
import HazardDetailModal from '../components/HazardDetailModal'
import { walkSessionApi, walkRouteApi, type WalkRoute, type WalkSessionResponse } from '../lib/api'
import { addMockWalkSession, getMockRecent } from '../lib/walkSessionMock'
import { isMobile, isSecureContextForGeo } from '../lib/mobileEnv'
import mapHeroMobile from '../../assets/map1.jpg'
import mapHeroDesktop from '../../assets/map2.jpg'

interface Position {
  lat: number
  lng: number
  timestamp: number
}

export default function WalkSession() {
  const [isWalking, setIsWalking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [distance, setDistance] = useState(0)
  const [stepCount, setStepCount] = useState(0)
  const [routes, setRoutes] = useState<WalkRoute[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const [mapRelayoutKey, setMapRelayoutKey] = useState(0)
  const [recentSessions, setRecentSessions] = useState<WalkSessionResponse[]>([])
  const [isLoadingRecent, setIsLoadingRecent] = useState(false)
  const showMobileGeoBanner = useMemo(() => isMobile() && !isSecureContextForGeo(), [])
  
  // 위험 요소 등록 관련
  const [enableHazardReport, setEnableHazardReport] = useState(false)
  const [hazardReportLocation, setHazardReportLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [hazardsRefreshKey, setHazardsRefreshKey] = useState(0)
  
  // 스팟 상세 모달 관련
  const [selectedSpot, setSelectedSpot] = useState<SpotData | null>(null)
  const [isSpotModalOpen, setIsSpotModalOpen] = useState(false)
  
  // 위험 스팟 상세 모달 관련
  const [selectedHazard, setSelectedHazard] = useState<any>(null)
  const [isHazardModalOpen, setIsHazardModalOpen] = useState(false)
  
  // 위험 스팟 수정 모달 관련
  const [isHazardEditModalOpen, setIsHazardEditModalOpen] = useState(false)
  const [editingHazard, setEditingHazard] = useState<any>(null)
  
  // GPS 위치 추적 관련
  const watchIdRef = useRef<number | null>(null)
  const positionsRef = useRef<Position[]>([])
  const lastPositionRef = useRef<Position | null>(null)

  // 두 지점 간 거리 계산 (하버사인 공식)
  const calculateDistance = (pos1: Position, pos2: Position): number => {
    const R = 6371000 // 지구 반지름 (미터)
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // GPS 위치 추적 시작/중지
  useEffect(() => {
    if (!isWalking || isPaused) {
      // 위치 추적 중지
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      return
    }

    if (!navigator.geolocation) {
      console.warn('GPS가 지원되지 않습니다.')
      return
    }

    // 위치 추적 시작
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const timestamp = Date.now()
        const newPosition: Position = { lat: latitude, lng: longitude, timestamp }

        if (lastPositionRef.current) {
          // 이전 위치와의 거리 계산
          const segmentDistance = calculateDistance(lastPositionRef.current, newPosition)
          // 유효한 이동만 기록 (너무 짧은 거리는 노이즈로 간주)
          if (segmentDistance > 5) {
            positionsRef.current.push(newPosition)
            setDistance(prev => Math.round(prev + segmentDistance))
            // 걸음 수 추정 (1걸음 약 0.7m)
            setStepCount(prev => Math.round(prev + segmentDistance / 0.7))
          }
        } else {
          // 첫 위치 기록
          positionsRef.current.push(newPosition)
        }

        lastPositionRef.current = newPosition
      },
      (error) => {
        // 타임아웃(3)은 정상적인 상황일 수 있으므로 조용히 처리
        // 권한 거부(1)와 기타 오류만 로그 출력
        if (error.code !== 3) {
          console.error('GPS 위치 추적 오류:', error)
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000, // 타임아웃 시간 증가 (5초 -> 10초)
        maximumAge: 5000, // 5초 이내의 캐시된 위치 사용 (1초 -> 5초로 증가)
      }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [isWalking, isPaused])

  // 타이머 업데이트
  useEffect(() => {
    let interval: number | null = null
    if (isWalking && !isPaused && startTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000)
        setElapsedTime(elapsed)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isWalking, isPaused, startTime])

  // 산책 경로 로드
  useEffect(() => {
    loadRoutes()
  }, [])

  const loadRoutes = async () => {
    try {
      setIsLoading(true)
      const sharedResponse = await walkRouteApi.getSharedRoutes()
      if (sharedResponse.success && sharedResponse.data) {
        setRoutes(sharedResponse.data)
      }
    } catch (error) {
      console.error('산책 경로 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const startWalk = async () => {
    try {
      setIsLoading(true)
      
      // routeId는 선택사항, petId는 1 사용 (없으면 자동 생성됨)
      const petId = 1
      const routeId = selectedRouteId || (routes.length > 0 ? routes[0].id : null)
      
      const response = await walkSessionApi.start(petId, routeId || undefined)
      
      if (response.success && response.data) {
        setIsWalking(true)
        setIsPaused(false)
        setCurrentSessionId(response.data.id)
        setStartTime(new Date())
        setElapsedTime(0)
        setDistance(0)
        setStepCount(0)
        // 위치 추적 초기화
        positionsRef.current = []
        lastPositionRef.current = null
      } else {
        throw new Error(response.message || '알 수 없는 오류가 발생했습니다.')
      }
    } catch (error: any) {
      console.error('산책 시작 실패:', error)
      console.error('상세 에러 정보:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        request: error.config,
      })
      
      let errorMessage = '산책 시작에 실패했습니다.'
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.response?.data?.data) {
        errorMessage = error.response.data.data
      } else if (error.message) {
        errorMessage = error.message
      }
      
      alert(`산책 시작에 실패했습니다.\n\n${errorMessage}\n\n상태 코드: ${error.response?.status || 'N/A'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const pauseWalk = () => {
    setIsPaused(!isPaused)
  }

  const stopWalk = async () => {
    if (!currentSessionId || !startTime) {
      alert('산책 세션 정보가 없습니다.')
      return
    }
    
    // GPS 추적 중지
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    
    try {
      setIsLoading(true)
      
      // 최종 거리, 시간, 칼로리 계산
      const distanceMeters = Math.round(distance)
      const durationSeconds = elapsedTime
      const calories = Math.round(distanceMeters * 0.05) // 간단한 칼로리 계산 (m당 0.05kcal)
      
      console.log('산책 완료 요청:', {
        sessionId: currentSessionId,
        distance: distanceMeters,
        duration: durationSeconds,
        calories,
      })
      
      const response = await walkSessionApi.complete(
        currentSessionId,
        distanceMeters,
        durationSeconds,
        calories
      )
      
      if (response.success) {
        setIsWalking(false)
        setIsPaused(false)
        setCurrentSessionId(null)
        setStartTime(null)
        setElapsedTime(0)
        setDistance(0)
        setStepCount(0)
        positionsRef.current = []
        lastPositionRef.current = null
        
        alert(`산책이 완료되었습니다!\n거리: ${formatDistance(distanceMeters)}\n시간: ${formatTime(durationSeconds)}`)
        // 완료 후 최근 기록 갱신
        await loadRecentSessions()
      } else {
        throw new Error(response.message || '산책 완료에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('산책 완료 실패:', error)
      // 개발 중 백엔드가 꺼져있는 경우(네트워크 오류)는 로컬 더미 기록으로 저장
      const isNetworkError = !error?.response
      if (isNetworkError) {
        try {
          const now = new Date()
          const distanceMeters = Math.round(distance)
          const durationSeconds = elapsedTime
          const routeName = selectedRouteId
            ? (routes.find(r => r.id === selectedRouteId)?.name ?? null)
            : null

          const userId = Number(localStorage.getItem('userId') || 0)
          const userNickname = localStorage.getItem('userNickname') || '사용자'

          addMockWalkSession({
            id: Date.now(),
            userId,
            userNickname,
            petId: 1,
            petName: '내 반려동물',
            routeId: selectedRouteId ?? null,
            routeName,
            startTime: startTime.toISOString(),
            endTime: now.toISOString(),
            distance: distanceMeters,
            duration: durationSeconds,
            isCompleted: true,
            createdAt: now.toISOString(),
          })

          setIsWalking(false)
          setIsPaused(false)
          setCurrentSessionId(null)
          setStartTime(null)
          setElapsedTime(0)
          setDistance(0)
          setStepCount(0)
          positionsRef.current = []
          lastPositionRef.current = null

          await loadRecentSessions()
          alert(`(개발용) 백엔드 연결이 없어 더미 기록으로 저장했습니다!\n거리: ${formatDistance(distanceMeters)}\n시간: ${formatTime(durationSeconds)}`)
          return
        } catch {
          // fallthrough
        }
      }

      const errorMessage = error.response?.data?.message || error.message || '산책 완료 처리에 실패했습니다.'
      alert(`산책 완료 실패: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters}m`
    }
    return `${(meters / 1000).toFixed(2)} km`
  }

  const formatDurationCompact = (seconds: number | null) => {
    if (!seconds) return '-'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    if (m >= 60) {
      const h = Math.floor(m / 60)
      const mm = m % 60
      return `${h}시간 ${mm}분`
    }
    return `${m}분 ${s}초`
  }

  const loadRecentSessions = async () => {
    try {
      setIsLoadingRecent(true)
      const res = await walkSessionApi.getRecent(5)
      const list = Array.isArray(res.data) ? res.data : []
      setRecentSessions(list)
    } catch {
      setRecentSessions(getMockRecent(5))
    } finally {
      setIsLoadingRecent(false)
    }
  }

  useEffect(() => {
    loadRecentSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return null
    return routes.find(r => r.id === selectedRouteId) ?? null
  }, [routes, selectedRouteId])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {showMobileGeoBanner && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          모바일 브라우저에서 위치 권한은 <b>HTTPS</b>에서만 동작합니다. PC에서 HTTPS로 실행 후
          휴대폰에서 <b>`https://&lt;PC_IP&gt;:3000`</b>로 접속해주세요. (가이드: `docs/MOBILE_SETUP_GUIDE.md`)
        </div>
      )}
      {/* Hero */}
      <section className="mb-6">
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
          <picture>
            <source media="(min-width: 768px)" srcSet={mapHeroDesktop} />
            <img
              src={mapHeroMobile}
              alt="지도 히어로 이미지"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
          <div className="relative min-h-[220px] sm:min-h-[300px] p-6 sm:p-10 flex flex-col justify-end gap-3">
            <span className="inline-flex w-fit items-center rounded-full bg-violet-600/90 px-3 py-1 text-[11px] font-semibold text-white">
              map
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              pawvent와 함께 위험 요소를 확인하세요
            </h1>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center justify-center">
          <div className="w-full max-w-xl">
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="안전한 산책을 위해 주변 위험 요소를 확인해 보세요"
                className="flex-1 bg-transparent px-2 text-sm text-gray-700 placeholder:text-gray-400 outline-none"
              />
              <button
                type="button"
                className="h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors"
                aria-label="검색"
              >
                <Search size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-3 text-xs text-gray-500 mb-4">
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="뒤로가기"
          onClick={() => window.history.back()}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="ml-auto">서비스 &gt; 지도</div>
      </div>

      {/* Main */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="relative">
              {!isMapFullscreen && (
                <KakaoMap 
                  autoLocation={true}
                  showHazards={true}
                  showSpots={true}
                  height="520px"
                  level={3}
                  enableHazardReport={enableHazardReport}
                  draggableLocationMarker={true}
                  onMapClick={(lat, lng) => {
                    setHazardReportLocation({ lat, lng });
                  }}
                  onLocationChange={(_lat, _lng) => {
                    setHazardsRefreshKey(prev => prev + 1);
                  }}
                  onSpotClick={(spot) => {
                    setSelectedSpot(spot);
                    setIsSpotModalOpen(true);
                  }}
                  onMarkerClick={(hazard) => {
                    setSelectedHazard(hazard);
                    setIsHazardModalOpen(true);
                  }}
                  key={hazardsRefreshKey}
                  className="rounded-none"
                  relayoutKey={mapRelayoutKey}
                />
              )}

              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button
                  onClick={() => {
                    setIsMapFullscreen(true)
                    setMapRelayoutKey(prev => prev + 1)
                  }}
                  className="h-10 px-4 rounded-full bg-white text-gray-800 hover:bg-gray-50 shadow-md transition-colors inline-flex items-center gap-2 border border-gray-200"
                  title="전체 화면"
                >
                  <Expand size={18} />
                  전체 화면
                </button>

                <button
                  onClick={() => setEnableHazardReport(!enableHazardReport)}
                  className={`h-10 px-4 rounded-full font-semibold transition-colors inline-flex items-center gap-2 shadow-md border ${
                    enableHazardReport
                      ? 'bg-red-500 text-white hover:bg-red-600 border-red-500'
                      : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <AlertTriangle size={18} />
                  {enableHazardReport ? '신고 모드' : '위험 요소 신고'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-extrabold text-gray-900 mb-4">산책 상태</h3>

            {isWalking ? (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xl font-extrabold text-primary">{formatTime(elapsedTime)}</p>
                    <p className="text-xs text-gray-500 mt-1">시간</p>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-primary">{formatDistance(distance)}</p>
                    <p className="text-xs text-gray-500 mt-1">거리</p>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-primary">{stepCount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">걸음</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={pauseWalk}
                    className={`flex-1 py-2.5 rounded-full font-semibold transition-colors inline-flex items-center justify-center gap-2 ${
                      isPaused
                        ? 'bg-secondary text-white hover:bg-secondary/90'
                        : 'bg-yellow-500 text-white hover:bg-yellow-600'
                    }`}
                  >
                    {isPaused ? <Play size={18} /> : <Pause size={18} />}
                    {isPaused ? '재개' : '일시정지'}
                  </button>
                  <button
                    onClick={stopWalk}
                    className="flex-1 bg-red-500 text-white py-2.5 rounded-full font-semibold hover:bg-red-600 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Square size={18} />
                    종료
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={startWalk}
                disabled={isLoading}
                className="w-full bg-primary text-white py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />}
                {isLoading ? '시작 중...' : '산책 시작하기'}
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-base font-extrabold text-gray-900">추천 산책 경로</h3>
              {selectedRoute && (
                <span className="text-xs text-gray-500 line-clamp-1">
                  선택: {selectedRoute.name}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-primary" size={28} />
              </div>
            ) : routes.length > 0 ? (
              <div className="space-y-3">
                {routes.map((route) => (
                  <RouteCard
                    key={route.id}
                    name={route.name}
                    distance={`${(route.distance / 1000).toFixed(2)} km`}
                    time={`${Math.floor(route.duration / 60)}분`}
                    onClick={() => setSelectedRouteId(route.id)}
                    selected={selectedRouteId === route.id}
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8 text-sm">등록된 산책 경로가 없습니다.</p>
            )}
          </div>

          {/* Recent walk history (start of 기록 기능) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-base font-extrabold text-gray-900">최근 산책 기록</h3>
              <a
                href="/walk/history"
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
              >
                전체보기 <ChevronRight size={14} />
              </a>
            </div>

            {isLoadingRecent ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="animate-spin" size={18} />
                <span className="ml-2 text-sm">불러오는 중...</span>
              </div>
            ) : recentSessions.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8">
                아직 기록이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {recentSessions.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 line-clamp-1">
                          {s.routeName || '산책'}
                          {s.petName ? <span className="text-gray-500 font-semibold"> · {s.petName}</span> : null}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(s.startTime).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-700 font-semibold">{formatDistance(s.distance ?? 0)}</div>
                        <div className="text-[11px] text-gray-500">{formatDurationCompact(s.duration ?? null)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 위험 요소 등록 모달 */}
      {hazardReportLocation && (
        <HazardReportModal
          latitude={hazardReportLocation.lat}
          longitude={hazardReportLocation.lng}
          onClose={() => {
            setHazardReportLocation(null);
            setEnableHazardReport(false);
          }}
          onSuccess={() => {
            setHazardsRefreshKey(prev => prev + 1);
            setHazardReportLocation(null);
            setEnableHazardReport(false);
          }}
        />
      )}
      
      {/* 스팟 상세 모달 */}
      <SpotDetailModal
        spot={selectedSpot}
        isOpen={isSpotModalOpen}
        onClose={() => {
          setIsSpotModalOpen(false);
          setSelectedSpot(null);
        }}
      />
      
      {/* 위험 스팟 상세 모달 */}
      <HazardDetailModal
        hazard={selectedHazard}
        isOpen={isHazardModalOpen}
        onClose={() => {
          setIsHazardModalOpen(false);
          setSelectedHazard(null);
        }}
        onEdit={(hazard) => {
          setEditingHazard(hazard);
          setIsHazardModalOpen(false);
          setIsHazardEditModalOpen(true);
        }}
        onDelete={() => {
          setHazardsRefreshKey(prev => prev + 1);
          setIsHazardModalOpen(false);
          setSelectedHazard(null);
        }}
      />
      
      {/* 위험 스팟 수정 모달 */}
      {isHazardEditModalOpen && editingHazard && (
        <HazardReportModal
          latitude={editingHazard.latitude}
          longitude={editingHazard.longitude}
          hazardId={editingHazard.id}
          initialCategory={editingHazard.category as any}
          initialDescription={editingHazard.description}
          initialImageUrl={editingHazard.imageUrl}
          onClose={() => {
            setIsHazardEditModalOpen(false);
            setEditingHazard(null);
          }}
          onSuccess={() => {
            setHazardsRefreshKey(prev => prev + 1);
            setIsHazardEditModalOpen(false);
            setEditingHazard(null);
          }}
        />
      )}

      {/* Fullscreen map modal */}
      {isMapFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/70 p-3 sm:p-6">
          <div className="h-full w-full max-w-6xl mx-auto">
            <div className="h-full bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-xl flex flex-col">
              <div className="p-3 sm:p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">지도 전체 화면</div>
                <button
                  type="button"
                  className="h-9 w-9 rounded-full hover:bg-gray-100 transition-colors inline-flex items-center justify-center"
                  aria-label="닫기"
                  onClick={() => {
                    setIsMapFullscreen(false)
                    setMapRelayoutKey(prev => prev + 1)
                  }}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 relative">
                <KakaoMap
                  autoLocation={true}
                  showHazards={true}
                  showSpots={true}
                  height="100%"
                  level={3}
                  enableHazardReport={enableHazardReport}
                  draggableLocationMarker={true}
                  onMapClick={(lat, lng) => {
                    setHazardReportLocation({ lat, lng });
                  }}
                  onLocationChange={(_lat, _lng) => {
                    setHazardsRefreshKey(prev => prev + 1);
                  }}
                  onSpotClick={(spot) => {
                    setSelectedSpot(spot);
                    setIsSpotModalOpen(true);
                  }}
                  onMarkerClick={(hazard) => {
                    setSelectedHazard(hazard);
                    setIsHazardModalOpen(true);
                  }}
                  key={`fs-${hazardsRefreshKey}`}
                  className="rounded-none"
                  relayoutKey={mapRelayoutKey}
                />

                <div className="absolute top-4 right-4 flex gap-2 z-10">
                  <button
                    onClick={() => setEnableHazardReport(!enableHazardReport)}
                    className={`h-10 px-4 rounded-full font-semibold transition-colors inline-flex items-center gap-2 shadow-md border ${
                      enableHazardReport
                        ? 'bg-red-500 text-white hover:bg-red-600 border-red-500'
                        : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <AlertTriangle size={18} />
                    {enableHazardReport ? '신고 모드' : '위험 요소 신고'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface RouteCardProps {
  name: string
  distance: string
  time: string
  onClick?: () => void
  selected?: boolean
}

function RouteCard({ name, distance, time, onClick, selected }: RouteCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg transition-colors cursor-pointer ${
        selected
          ? 'bg-primary text-white'
          : 'bg-gray-50 hover:bg-gray-100'
      }`}
    >
      <h4 className="font-semibold mb-2">{name}</h4>
      <div className={`flex gap-4 text-sm ${selected ? 'text-white/90' : 'text-gray-600'}`}>
        <span>거리: {distance}</span>
        <span>예상 시간: {time}</span>
      </div>
    </div>
  )
}


