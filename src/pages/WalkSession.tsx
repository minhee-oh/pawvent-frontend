import { useState, useEffect, useRef } from 'react'
import { Play, Pause, Square, Loader2, AlertTriangle } from 'lucide-react'
import KakaoMap, { type SpotData } from '../components/KakaoMap'
import HazardReportModal from '../components/HazardReportModal'
import SpotDetailModal from '../components/SpotDetailModal'
import HazardDetailModal from '../components/HazardDetailModal'
import { walkSessionApi, walkRouteApi, type WalkRoute } from '../lib/api'

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
        console.error('GPS 위치 추적 오류:', error)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 1000,
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
    let interval: NodeJS.Timeout | null = null
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
      } else {
        throw new Error(response.message || '산책 완료에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('산책 완료 실패:', error)
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-6">산책 세션</h2>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="mb-6 overflow-hidden rounded-lg relative">
          <KakaoMap 
            autoLocation={true}
            showHazards={true}
            showSpots={true}
            height="400px"
            level={3}
            enableHazardReport={enableHazardReport}
            draggableLocationMarker={true}
            onMapClick={(lat, lng) => {
              setHazardReportLocation({ lat, lng });
            }}
            onLocationChange={(lat, lng) => {
              // 위치가 변경되면 위험 스팟 목록 새로고침
              setHazardsRefreshKey(prev => prev + 1);
            }}
            onSpotClick={(spot) => {
              console.log('WalkSession onSpotClick 호출:', spot);
              setSelectedSpot(spot);
              setIsSpotModalOpen(true);
              console.log('모달 상태 업데이트:', { selectedSpot: spot, isOpen: true });
            }}
            onMarkerClick={(hazard) => {
              console.log('WalkSession onMarkerClick 호출:', hazard);
              setSelectedHazard(hazard);
              setIsHazardModalOpen(true);
            }}
            key={hazardsRefreshKey}
          />
          <button
            onClick={() => setEnableHazardReport(!enableHazardReport)}
            className={`absolute top-4 right-4 px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 z-10 ${
              enableHazardReport
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md'
            }`}
          >
            <AlertTriangle size={20} />
            {enableHazardReport ? '신고 모드 (지도 클릭)' : '위험 요소 신고'}
          </button>
        </div>

        {isWalking ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-primary">{formatTime(elapsedTime)}</p>
                <p className="text-sm text-gray-600">시간</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">{formatDistance(distance)}</p>
                <p className="text-sm text-gray-600">거리</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">{stepCount.toLocaleString()}</p>
                <p className="text-sm text-gray-600">걸음</p>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={pauseWalk}
                className={`flex-1 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                  isPaused
                    ? 'bg-secondary text-white hover:bg-secondary/90'
                    : 'bg-yellow-500 text-white hover:bg-yellow-600'
                }`}
              >
                {isPaused ? <Play size={20} /> : <Pause size={20} />}
                {isPaused ? '재개' : '일시정지'}
              </button>
              <button
                onClick={stopWalk}
                className="flex-1 bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                <Square size={20} />
                종료
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={startWalk}
            disabled={isLoading}
            className="w-full bg-primary text-white py-4 rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Play size={24} />}
            {isLoading ? '시작 중...' : '산책 시작하기'}
          </button>
        )}
      </div>

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

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">추천 산책 경로</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={32} />
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
          <p className="text-gray-500 text-center py-4">등록된 산책 경로가 없습니다.</p>
        )}
      </div>
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


