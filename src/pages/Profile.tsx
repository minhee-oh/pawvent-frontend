import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, Award, Heart, Loader2, X, Plus, Edit, Upload } from 'lucide-react'
import { userApi, UserResponse, petApi, PetResponse, PetCreateRequest, PetUpdateRequest, fileApi } from '../lib/api'

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState<UserResponse | null>(null)
  const [pets, setPets] = useState<PetResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddPetModal, setShowAddPetModal] = useState(false)
  const [editingPet, setEditingPet] = useState<PetResponse | null>(null)

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setIsLoading(true)
        const token = localStorage.getItem('authToken')
        
        if (!token) {
          // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
          navigate('/login')
          return
        }

        const response = await userApi.getMe()
        if (response.success && response.data) {
          setUser(response.data)
          // localStorage에도 최신 정보 저장
          localStorage.setItem('userNickname', response.data.nickname || '')
          localStorage.setItem('userEmail', response.data.email || '')
          if (response.data.profileImageUrl) {
            localStorage.setItem('userProfileImageUrl', response.data.profileImageUrl)
          }
        } else {
          setError(response.message || '사용자 정보를 불러올 수 없습니다.')
        }

        // 반려동물 목록 불러오기
        try {
          const petsResponse = await petApi.getMyPets()
          if (petsResponse.success && petsResponse.data) {
            setPets(petsResponse.data)
          }
        } catch (petErr: any) {
          // 반려동물 목록 로드 실패는 에러로 표시하지 않고 빈 배열로 처리
          console.warn('반려동물 목록 로드 실패:', petErr)
          setPets([])
        }
      } catch (err: any) {
        console.error('프로필 로드 실패:', err)
        if (err.response?.status === 401 || err.response?.status === 403) {
          // 인증 실패 또는 토큰 만료 시 로그인 페이지로 리다이렉트
          localStorage.removeItem('authToken')
          localStorage.removeItem('userId')
          localStorage.removeItem('userNickname')
          localStorage.removeItem('userEmail')
          localStorage.removeItem('userProfileImageUrl')
          navigate('/login')
        } else {
          setError('프로필 정보를 불러오는 중 오류가 발생했습니다.')
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadUserProfile()
  }, [navigate])

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-6">프로필</h2>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          {user.profileImageUrl ? (
            <img 
              src={user.profileImageUrl} 
              alt={user.nickname || '프로필'} 
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center text-2xl">
              {user.nickname?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">{user.nickname || '사용자'}</h3>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Settings size={24} className="text-gray-600" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center pt-6 border-t">
          <div>
            <p className="text-2xl font-bold text-primary">156</p>
            <p className="text-sm text-gray-600">총 산책</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">248 km</p>
            <p className="text-sm text-gray-600">총 거리</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">12</p>
            <p className="text-sm text-gray-600">달성 배지</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Heart className="text-red-500" size={20} />
          내 반려동물
        </h3>
        <div className="space-y-3">
          {pets.length === 0 ? (
            <p className="text-gray-500 text-center py-8">등록된 반려동물이 없습니다.</p>
          ) : (
            pets.map((pet) => (
              <PetCard 
                key={pet.id} 
                pet={pet}
                onEdit={() => setEditingPet(pet)}
                onDelete={async () => {
                  if (window.confirm(`${pet.name}을(를) 삭제하시겠습니까?`)) {
                    try {
                      await petApi.delete(pet.id)
                      setPets(pets.filter(p => p.id !== pet.id))
                    } catch (err) {
                      alert('반려동물 삭제에 실패했습니다.')
                    }
                  }
                }}
              />
            ))
          )}
        </div>
        <button 
          onClick={() => setShowAddPetModal(true)}
          className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          반려동물 추가
        </button>
      </div>

      {/* 반려동물 추가 모달 */}
      {showAddPetModal && (
        <AddPetModal
          onClose={() => setShowAddPetModal(false)}
          onSuccess={async (newPet) => {
            setPets([...pets, newPet])
            setShowAddPetModal(false)
          }}
        />
      )}

      {/* 반려동물 수정 모달 */}
      {editingPet && (
        <EditPetModal
          pet={editingPet}
          onClose={() => setEditingPet(null)}
          onSuccess={async (updatedPet) => {
            setPets(pets.map(p => p.id === updatedPet.id ? updatedPet : p))
            setEditingPet(null)
          }}
        />
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Award className="text-yellow-500" size={20} />
          획득한 배지
        </h3>
        <div className="grid grid-cols-4 gap-4">
          <BadgeItem name="첫 산책" />
          <BadgeItem name="10km 달성" />
          <BadgeItem name="7일 연속" />
          <BadgeItem name="커뮤니티 스타" />
          <div className="flex flex-col items-center gap-2 opacity-40">
            <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
            <p className="text-xs text-center text-gray-500">잠김</p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface PetCardProps {
  pet: PetResponse
  onEdit: () => void
  onDelete: () => void
}

function PetCard({ pet, onEdit, onDelete }: PetCardProps) {
  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null
    const birth = new Date(birthDate)
    const today = new Date()
    const years = today.getFullYear() - birth.getFullYear()
    const months = today.getMonth() - birth.getMonth()
    if (months < 0) {
      return `${years - 1}살`
    }
    return years > 0 ? `${years}살` : `${months}개월`
  }

  const age = calculateAge(pet.birthDate)
  const displayInfo = [pet.species, pet.breed, age].filter(Boolean).join(' • ')

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
      {pet.imageUrl ? (
        <img 
          src={pet.imageUrl} 
          alt={pet.name}
          className="w-16 h-16 rounded-full object-cover"
        />
      ) : (
        <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center text-xl">
          {pet.name[0]}
        </div>
      )}
      <div className="flex-1">
        <h4 className="font-semibold">{pet.name}</h4>
        <p className="text-sm text-gray-600">{displayInfo || '정보 없음'}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-500"
          title="수정"
        >
          <Edit size={18} />
        </button>
        <button
          onClick={onDelete}
          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500"
          title="삭제"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

interface BadgeItemProps {
  name: string
}

function BadgeItem({ name }: BadgeItemProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
        <Award className="text-yellow-500" size={32} />
      </div>
      <p className="text-xs text-center">{name}</p>
    </div>
  )
}

interface AddPetModalProps {
  onClose: () => void
  onSuccess: (pet: PetResponse) => void
}

function AddPetModal({ onClose, onSuccess }: AddPetModalProps) {
  const [formData, setFormData] = useState<PetCreateRequest>({
    name: '',
    species: '',
    breed: '',
    birthDate: '',
    gender: '',
    weight: undefined,
    imageUrl: '',
    description: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 파일 크기 검증 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('파일 크기는 10MB를 초과할 수 없습니다.')
        return
      }
      
      // 이미지 파일 검증
      if (!file.type.startsWith('image/')) {
        setError('이미지 파일만 업로드 가능합니다.')
        return
      }
      
      setSelectedFile(file)
      setError(null)
      
      // 미리보기 생성
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('이름을 입력해주세요.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      // 파일이 있으면 먼저 업로드 (파일 업로드만 지원)
      let imageUrl: string | undefined = undefined
      if (selectedFile) {
        setIsUploading(true)
        try {
          imageUrl = await fileApi.uploadPetImage(selectedFile)
        } catch (uploadErr: any) {
          setError(uploadErr.message || '이미지 업로드에 실패했습니다.')
          setIsSubmitting(false)
          setIsUploading(false)
          return
        } finally {
          setIsUploading(false)
        }
      } else if (formData.imageUrl && formData.imageUrl.trim()) {
        // 기존 이미지 URL 유지 (수정 시 기존 이미지가 있는 경우)
        imageUrl = formData.imageUrl.trim()
      }

      const requestData: PetCreateRequest = {
        name: formData.name.trim(),
        ...(formData.species && formData.species.trim() && { species: formData.species.trim() }),
        ...(formData.breed && formData.breed.trim() && { breed: formData.breed.trim() }),
        ...(formData.birthDate && { birthDate: formData.birthDate }),
        ...(formData.gender && formData.gender.trim() && { gender: formData.gender.trim() }),
        ...(formData.weight !== undefined && formData.weight !== null && formData.weight > 0 && { weight: formData.weight }),
        ...(imageUrl && imageUrl.trim() && { imageUrl: imageUrl.trim() }),
        ...(formData.description && formData.description.trim() && { description: formData.description.trim() }),
      }

      const response = await petApi.create(requestData)
      if (response.success && response.data) {
        // 성공 시 폼 초기화
        setFormData({
          name: '',
          species: '',
          breed: '',
          birthDate: '',
          gender: '',
          weight: undefined,
          imageUrl: '',
          description: '',
        })
        setSelectedFile(null)
        setPreviewUrl(null)
        onSuccess(response.data)
      } else {
        setError(response.message || '반려동물 등록에 실패했습니다.')
      }
    } catch (err: any) {
      console.error('반려동물 등록 실패:', err)
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          err.message || 
                          '반려동물 등록 중 오류가 발생했습니다.'
      setError(errorMessage)
      
      // 상세 에러 정보 로깅
      if (err.response?.data) {
        console.error('서버 응답:', err.response.data)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">반려동물 추가</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="반려동물 이름"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종류</label>
            <select
              value={formData.species}
              onChange={(e) => setFormData({ ...formData, species: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">선택하세요</option>
              <option value="개">개</option>
              <option value="고양이">고양이</option>
              <option value="기타">기타</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">품종</label>
            <input
              type="text"
              value={formData.breed}
              onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="예: 골든 리트리버, 코리안 숏헤어"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">생년월일</label>
            <input
              type="date"
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">성별</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">선택하세요</option>
              <option value="남">남</option>
              <option value="여">여</option>
              <option value="중성">중성</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">체중 (kg)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={formData.weight || ''}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="예: 5.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">프로필 이미지</label>
            <div className="space-y-2">
              {previewUrl ? (
                <div className="relative">
                  <img 
                    src={previewUrl} 
                    alt="미리보기" 
                    className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null)
                      setPreviewUrl(null)
                    }}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg">
                  {formData.imageUrl ? (
                    <img 
                      src={formData.imageUrl} 
                      alt="현재 이미지" 
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Upload className="text-gray-400" size={32} />
                  )}
                </div>
              )}
              <div>
                <label className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <Upload size={18} className="mr-2" />
                  <span className="text-sm">파일 선택</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading || isSubmitting}
                  />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="반려동물에 대한 설명을 입력하세요"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || isUploading}
            >
              {isUploading ? '업로드 중...' : isSubmitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface EditPetModalProps {
  pet: PetResponse
  onClose: () => void
  onSuccess: (pet: PetResponse) => void
}

function EditPetModal({ pet, onClose, onSuccess }: EditPetModalProps) {
  const [formData, setFormData] = useState<PetUpdateRequest>({
    name: pet.name,
    species: pet.species || '',
    breed: pet.breed || '',
    birthDate: pet.birthDate || '',
    gender: pet.gender || '',
    weight: pet.weight || undefined,
    imageUrl: pet.imageUrl || '',
    description: pet.description || '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 파일 크기 검증 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('파일 크기는 10MB를 초과할 수 없습니다.')
        return
      }
      
      // 이미지 파일 검증
      if (!file.type.startsWith('image/')) {
        setError('이미지 파일만 업로드 가능합니다.')
        return
      }
      
      setSelectedFile(file)
      setError(null)
      
      // 미리보기 생성
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name?.trim()) {
      setError('이름을 입력해주세요.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      // 파일이 있으면 먼저 업로드 (파일 업로드만 지원)
      let imageUrl: string | undefined = undefined
      if (selectedFile) {
        setIsUploading(true)
        try {
          imageUrl = await fileApi.uploadPetImage(selectedFile)
        } catch (uploadErr: any) {
          setError(uploadErr.message || '이미지 업로드에 실패했습니다.')
          setIsSubmitting(false)
          setIsUploading(false)
          return
        } finally {
          setIsUploading(false)
        }
      } else if (formData.imageUrl && formData.imageUrl.trim()) {
        // 기존 이미지 URL 유지 (수정 시 기존 이미지가 있는 경우)
        imageUrl = formData.imageUrl.trim()
      }

      const requestData: PetUpdateRequest = {
        ...(formData.name && formData.name.trim() && { name: formData.name.trim() }),
        ...(formData.species && formData.species.trim() && { species: formData.species.trim() }),
        ...(formData.breed && formData.breed.trim() && { breed: formData.breed.trim() }),
        ...(formData.birthDate && { birthDate: formData.birthDate }),
        ...(formData.gender && formData.gender.trim() && { gender: formData.gender.trim() }),
        ...(formData.weight !== undefined && formData.weight !== null && formData.weight > 0 && { weight: formData.weight }),
        ...(imageUrl && imageUrl.trim() && { imageUrl: imageUrl.trim() }),
        ...(formData.description && formData.description.trim() && { description: formData.description.trim() }),
      }

      const response = await petApi.update(pet.id, requestData)
      if (response.success && response.data) {
        onSuccess(response.data)
      } else {
        setError(response.message || '반려동물 수정에 실패했습니다.')
      }
    } catch (err: any) {
      console.error('반려동물 수정 실패:', err)
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          err.message || 
                          '반려동물 수정 중 오류가 발생했습니다.'
      setError(errorMessage)
      
      if (err.response?.data) {
        console.error('서버 응답:', err.response.data)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">반려동물 수정</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="반려동물 이름"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종류</label>
            <select
              value={formData.species || ''}
              onChange={(e) => setFormData({ ...formData, species: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">선택하세요</option>
              <option value="개">개</option>
              <option value="고양이">고양이</option>
              <option value="기타">기타</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">품종</label>
            <input
              type="text"
              value={formData.breed || ''}
              onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="예: 골든 리트리버, 코리안 숏헤어"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">생년월일</label>
            <input
              type="date"
              value={formData.birthDate || ''}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">성별</label>
            <select
              value={formData.gender || ''}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">선택하세요</option>
              <option value="남">남</option>
              <option value="여">여</option>
              <option value="중성">중성</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">체중 (kg)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={formData.weight || ''}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="예: 5.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">프로필 이미지</label>
            <div className="space-y-2">
              {previewUrl ? (
                <div className="relative">
                  <img 
                    src={previewUrl} 
                    alt="미리보기" 
                    className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null)
                      setPreviewUrl(null)
                    }}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg">
                  {formData.imageUrl ? (
                    <img 
                      src={formData.imageUrl} 
                      alt="현재 이미지" 
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Upload className="text-gray-400" size={32} />
                  )}
                </div>
              )}
              <div>
                <label className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <Upload size={18} className="mr-2" />
                  <span className="text-sm">파일 선택</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading || isSubmitting}
                  />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="반려동물에 대한 설명을 입력하세요"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || isUploading}
            >
              {isUploading ? '업로드 중...' : isSubmitting ? '수정 중...' : '수정'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}




