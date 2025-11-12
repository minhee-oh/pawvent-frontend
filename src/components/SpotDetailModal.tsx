import { X, MapPin, Phone, Star, Calendar } from 'lucide-react'
import { SpotData } from './KakaoMap'

interface SpotDetailModalProps {
  spot: SpotData | null
  isOpen: boolean
  onClose: () => void
}

export default function SpotDetailModal({ spot, isOpen, onClose }: SpotDetailModalProps) {
  console.log('SpotDetailModal 렌더링:', { isOpen, spot: spot?.name });
  
  if (!isOpen || !spot) {
    console.log('SpotDetailModal 조건 불만족:', { isOpen, hasSpot: !!spot });
    return null;
  }

  const getSpotTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      CAFE: '카페',
      HOSPITAL: '병원',
      PARK: '공원',
      STORE: '매장',
      RESTAURANT: '식당',
      OTHER: '기타',
    }
    return labels[type] || '기타'
  }

  const formatDate = (dateString?: string): string => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{spot.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{getSpotTypeLabel(spot.type)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 이미지 */}
        {spot.imageUrl && (
          <div className="w-full h-64 bg-gray-100 overflow-hidden">
            <img
              src={spot.imageUrl}
              alt={spot.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
          </div>
        )}

        {/* 내용 */}
        <div className="px-6 py-4 space-y-4">
          {/* 설명 */}
          {spot.description && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">설명</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{spot.description}</p>
            </div>
          )}

          {/* 주소 */}
          {spot.address && (
            <div className="flex items-start gap-3">
              <MapPin className="text-blue-500 mt-1 flex-shrink-0" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">주소</h3>
                <p className="text-gray-900">{spot.address}</p>
              </div>
            </div>
          )}

          {/* 전화번호 */}
          {spot.phone && (
            <div className="flex items-start gap-3">
              <Phone className="text-green-500 mt-1 flex-shrink-0" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">전화번호</h3>
                <a
                  href={`tel:${spot.phone}`}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {spot.phone}
                </a>
              </div>
            </div>
          )}

          {/* 평점 */}
          {spot.rating !== undefined && spot.rating !== null && (
            <div className="flex items-center gap-2">
              <Star className="text-yellow-500 fill-yellow-500" size={20} />
              <span className="text-gray-900 font-semibold">{spot.rating.toFixed(1)}</span>
              <span className="text-gray-500">/ 5.0</span>
            </div>
          )}

          {/* 등록일 */}
          {spot.createdAt && (
            <div className="flex items-start gap-3">
              <Calendar className="text-gray-400 mt-1 flex-shrink-0" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">등록일</h3>
                <p className="text-gray-700">{formatDate(spot.createdAt)}</p>
              </div>
            </div>
          )}

          {/* 위치 정보 */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">위치 정보</h3>
            <p className="text-sm text-gray-700">
              위도: {spot.latitude.toFixed(6)}, 경도: {spot.longitude.toFixed(6)}
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-semibold"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

