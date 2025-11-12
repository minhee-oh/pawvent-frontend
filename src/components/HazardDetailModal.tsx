import { useState, useEffect } from 'react'
import { X, MapPin, Calendar, User, AlertTriangle, Edit, Trash2 } from 'lucide-react'
import { hazardApi, authApi } from '../lib/api'

interface HazardData {
  id: number
  category: string
  description: string
  latitude: number
  longitude: number
  imageUrl?: string
  reporterId?: number
  reporterNickname?: string
  createdAt: string
}

interface HazardDetailModalProps {
  hazard: HazardData | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (hazard: HazardData) => void
  onDelete?: () => void
}

const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    LEASH: '목줄 미착용',
    MUZZLE: '입마개 미착용',
    AGGRESSIVE_DOG: '공격적인 개',
    HAZARDOUS_MATERIAL: '위험물질',
    WILDLIFE: '야생동물 출몰',
    LOW_LIGHT: '조명 부족',
    BIKE_CAR: '자전거·차량 위험',
    POOP_LEFT: '배변 미수거',
    OTHER: '기타',
  }
  return labels[category] || category
}

export default function HazardDetailModal({ hazard, isOpen, onClose, onEdit, onDelete }: HazardDetailModalProps) {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  
  // 현재 사용자 ID 가져오기
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await authApi.getCurrentUser()
        if (response.success && response.data) {
          setCurrentUserId(response.data.id)
        }
      } catch (error) {
        console.warn('현재 사용자 정보를 가져올 수 없습니다:', error)
      }
    }
    
    if (isOpen) {
      fetchCurrentUser()
    }
  }, [isOpen])
  
  console.log('HazardDetailModal 렌더링:', { isOpen, hazard: hazard?.id, currentUserId, reporterId: hazard?.reporterId })
  
  if (!isOpen || !hazard) {
    console.log('HazardDetailModal 조건 불만족:', { isOpen, hasHazard: !!hazard })
    return null
  }
  
  const isOwner = currentUserId !== null && hazard.reporterId !== undefined && currentUserId === hazard.reporterId
  
  const handleDelete = async () => {
    if (!confirm('정말로 이 위험 스팟을 삭제하시겠습니까?')) {
      return
    }
    
    try {
      setIsDeleting(true)
      setDeleteError(null)
      
      const response = await hazardApi.delete(hazard.id)
      
      if (response.success) {
        if (onDelete) {
          onDelete()
        }
        onClose()
      } else {
        setDeleteError(response.message || '삭제에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('위험 스팟 삭제 오류:', error)
      setDeleteError(error.response?.data?.message || error.message || '삭제 중 오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }
  
  const handleEdit = () => {
    if (onEdit) {
      onEdit(hazard)
    }
  }

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-500" size={24} />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">위험 스팟</h2>
              <p className="text-sm text-gray-500 mt-1">{getCategoryLabel(hazard.category)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 이미지 */}
        {hazard.imageUrl && (
          <div className="w-full h-64 bg-gray-100 overflow-hidden">
            <img
              src={hazard.imageUrl}
              alt="위험 스팟 이미지"
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
          {hazard.description && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">상세 설명</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{hazard.description}</p>
            </div>
          )}

          {/* 신고자 정보 */}
          {hazard.reporterNickname && (
            <div className="flex items-start gap-3">
              <User className="text-blue-500 mt-1 flex-shrink-0" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">신고자</h3>
                <p className="text-gray-900">{hazard.reporterNickname}</p>
              </div>
            </div>
          )}

          {/* 신고일 */}
          {hazard.createdAt && (
            <div className="flex items-start gap-3">
              <Calendar className="text-gray-400 mt-1 flex-shrink-0" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-1">신고일</h3>
                <p className="text-gray-700">{formatDate(hazard.createdAt)}</p>
              </div>
            </div>
          )}

          {/* 위치 정보 */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-start gap-3">
              <MapPin className="text-red-500 mt-1 flex-shrink-0" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">위치 정보</h3>
                <p className="text-sm text-gray-700">
                  위도: {hazard.latitude.toFixed(6)}, 경도: {hazard.longitude.toFixed(6)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 space-y-3">
          {deleteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {deleteError}
            </div>
          )}
          
          {isOwner && (
            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors font-semibold flex items-center justify-center gap-2"
              >
                <Edit size={18} />
                수정
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    삭제
                  </>
                )}
              </button>
            </div>
          )}
          
          <button
            onClick={onClose}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors font-semibold"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

