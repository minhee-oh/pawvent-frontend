import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { communityApi, CommunityPostResponse, PostCategory, CommunityPostCreateRequest, CommunityPostUpdateRequest, fileApi, userApi, UserResponse } from '../lib/api'
import { Plus, Edit, X, Upload, ChevronLeft, ChevronRight } from 'lucide-react'

const CATEGORY_TABS: { key: PostCategory | 'ALL'; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'WALK_CERTIFICATION', label: '산책 인증' },
  { key: 'FREE', label: '자유게시판' },
  { key: 'SAFETY', label: '안전하개' },
]

const POSTS_PER_PAGE = 6

// 유튜브 URL을 embed URL로 변환하는 함수
const convertToYoutubeEmbedUrl = (url: string): string | null => {
  if (!url || typeof url !== 'string') return null
  
  const trimmedUrl = url.trim()
  if (!trimmedUrl) return null
  
  // 이미 embed URL인 경우 - video ID 추출
  const embedMatch = trimmedUrl.match(/youtube\.com\/embed\/([^?&]+)/)
  if (embedMatch) {
    return `https://www.youtube.com/embed/${embedMatch[1]}`
  }
  
  // youtube.com/watch?v= 형식
  const watchMatch = trimmedUrl.match(/youtube\.com\/watch\?v=([^&]+)/)
  if (watchMatch && watchMatch[1]) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`
  }
  
  // youtu.be/ 형식
  const shortMatch = trimmedUrl.match(/youtu\.be\/([^?&]+)/)
  if (shortMatch && shortMatch[1]) {
    return `https://www.youtube.com/embed/${shortMatch[1]}`
  }
  
  // youtube.com/v/ 형식
  const vMatch = trimmedUrl.match(/youtube\.com\/v\/([^?&]+)/)
  if (vMatch && vMatch[1]) {
    return `https://www.youtube.com/embed/${vMatch[1]}`
  }
  
  // m.youtube.com/watch?v= 형식 (모바일)
  const mobileMatch = trimmedUrl.match(/m\.youtube\.com\/watch\?v=([^&]+)/)
  if (mobileMatch && mobileMatch[1]) {
    return `https://www.youtube.com/embed/${mobileMatch[1]}`
  }
  
  // youtube.com/shorts/ 형식 (유튜브 쇼츠)
  const shortsMatch = trimmedUrl.match(/youtube\.com\/shorts\/([^?&]+)/)
  if (shortsMatch && shortsMatch[1]) {
    return `https://www.youtube.com/embed/${shortsMatch[1]}`
  }
  
  // 변환 실패
  console.warn('유튜브 URL 변환 실패:', trimmedUrl)
  return null
}

export default function Community() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<PostCategory | 'ALL'>('ALL')
  const [posts, setPosts] = useState<CommunityPostResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editingPost, setEditingPost] = useState<CommunityPostResponse | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [authorProfilesMap, setAuthorProfilesMap] = useState<Map<number, UserResponse>>(new Map())

  const loadPosts = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const params = activeTab === 'ALL' ? {} : { category: activeTab }
      const res = await communityApi.list(params)
      if (res.success && res.data) {
        // res.data가 배열인지 확인
        const postsArray = Array.isArray(res.data) ? res.data : []
        setPosts(postsArray)
        
        // 각 작성자의 프로필 정보 가져오기
        const uniqueAuthorIds = [...new Set(postsArray.map(post => post.authorId).filter((id): id is number => id !== undefined && id !== null && id > 0))]
        const profilesMap = new Map<number, UserResponse>()
        
        await Promise.all(
          uniqueAuthorIds.map(async (authorId) => {
            try {
              const userRes = await userApi.getById(authorId)
              console.log(`작성자 ${authorId} API 응답 전체:`, userRes)
              if (userRes.success && userRes.data) {
                console.log(`작성자 ${authorId} 프로필:`, userRes.data)
                console.log(`작성자 ${authorId} 프로필 이미지 URL:`, userRes.data.profileImageUrl)
                console.log(`작성자 ${authorId} 프로필 이미지 URL 타입:`, typeof userRes.data.profileImageUrl)
                console.log(`작성자 ${authorId} 프로필 이미지 URL 길이:`, userRes.data.profileImageUrl?.length)
                profilesMap.set(authorId, userRes.data)
              } else {
                console.warn(`작성자 ${authorId} 프로필 조회 실패:`, userRes)
              }
            } catch (e: any) {
              console.error(`작성자 ${authorId}의 프로필 정보를 가져오지 못했습니다:`, e)
              console.error('에러 상세:', e.response?.data || e.message)
            }
          })
        )
        
        console.log('프로필 맵:', profilesMap)
        console.log('프로필 맵 상세:', Array.from(profilesMap.entries()).map(([id, profile]) => ({
          id,
          nickname: profile.nickname,
          profileImageUrl: profile.profileImageUrl
        })))
        setAuthorProfilesMap(profilesMap)
      } else {
        setPosts([])
      }
    } catch (e: any) {
      console.error('게시글 로드 오류:', e)
      setError(e.message || '게시글을 불러오지 못했습니다.')
      setPosts([])
    } finally {
      setIsLoading(false)
    }
  }
  

  useEffect(() => {
    loadPosts()
    setCurrentPage(1) // 카테고리 변경 시 첫 페이지로 리셋
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // 페이지네이션 계산
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE)
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE
  const endIndex = startIndex + POSTS_PER_PAGE
  const currentPosts = posts.slice(startIndex, endIndex)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">커뮤니티</h2>
        <button
          onClick={() => { setEditingPost(null); setShowEditor(true) }}
          className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus size={18} /> 글쓰기
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 rounded-lg border ${activeTab === tab.key ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-gray-500 py-16">불러오는 중...</div>
      ) : posts.length === 0 ? (
        <div className="text-center text-gray-500 py-16">게시글이 없습니다.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentPosts.map(post => (
            <article key={post.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col cursor-pointer" onClick={() => navigate(`/community/${post.id}`)}>
              {/* 이미지 섹션 */}
              {post.imageUrl && (
                <div className="relative w-full h-48 overflow-hidden bg-gray-100" onClick={(e) => e.stopPropagation()}>
                  <img 
                    src={post.imageUrl} 
                    alt="게시글 이미지" 
                    className="w-full h-full object-cover" 
                  />
                </div>
              )}
              {post.videoUrl && !post.imageUrl && (
                <div className="relative w-full h-48 overflow-hidden bg-gray-100" onClick={(e) => e.stopPropagation()}>
                  {post.videoUrl.includes('youtube.com') || post.videoUrl.includes('youtu.be') ? (
                    (() => {
                      const embedUrl = convertToYoutubeEmbedUrl(post.videoUrl)
                      if (embedUrl) {
                        return (
                          <iframe
                            src={embedUrl}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title="YouTube video player"
                          />
                        )
                      }
                      return (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 text-sm">
                          유튜브 링크 형식이 올바르지 않습니다
                        </div>
                      )
                    })()
                  ) : (
                    <video src={post.videoUrl} controls className="w-full h-full object-cover" />
                  )}
                </div>
              )}

              {/* 카드 내용 */}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    {post.category === 'WALK_CERTIFICATION' ? '산책 인증' : post.category === 'FREE' ? '자유' : '안전하개'}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingPost(post)
                        setShowEditor(true)
                      }}
                      className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors text-blue-500"
                      title="수정"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (window.confirm('이 게시글을 삭제하시겠습니까?')) {
                          try {
                            const res = await communityApi.delete(post.id)
                            if (res.success) {
                              setPosts(posts.filter(p => p.id !== post.id))
                            }
                          } catch {
                            alert('삭제에 실패했습니다.')
                          }
                        }
                      }}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-red-500"
                      title="삭제"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{post.title}</h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-3 flex-1">{post.content}</p>

                {/* 비디오가 있고 이미지가 없는 경우는 이미 위에서 표시됨 */}
                {post.videoUrl && post.imageUrl && (
                  <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                    {post.videoUrl.includes('youtube.com') || post.videoUrl.includes('youtu.be') ? (
                      (() => {
                        const embedUrl = convertToYoutubeEmbedUrl(post.videoUrl)
                        if (embedUrl) {
                          return (
                            <iframe
                              src={embedUrl}
                              className="w-full h-32 rounded-lg"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              title="YouTube video player"
                            />
                          )
                        }
                        return (
                          <div className="w-full h-32 flex items-center justify-center bg-gray-200 text-gray-500 text-xs rounded-lg">
                            유튜브 링크 형식이 올바르지 않습니다
                          </div>
                        )
                      })()
                    ) : (
                      <video src={post.videoUrl} controls className="w-full h-32 rounded-lg" />
                    )}
                  </div>
                )}

                <div className="mt-auto pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const profile = authorProfilesMap.get(post.authorId)
                        const profileImageUrl = profile?.profileImageUrl
                        const nickname = profile?.nickname || post.authorNickname || '사용자'
                        
                        console.log(`게시글 ${post.id} 작성자 ${post.authorId} 프로필:`, {
                          profile,
                          profileImageUrl,
                          nickname,
                          hasProfile: !!profile
                        })
                        
                        if (profileImageUrl && profileImageUrl.trim() !== '' && profileImageUrl !== 'null') {
                          return (
                            <>
                              <img 
                                src={profileImageUrl} 
                                alt="프로필" 
                                className="w-6 h-6 rounded-full object-cover"
                                onError={(e) => {
                                  console.error('프로필 이미지 로드 실패:', profileImageUrl, '작성자 ID:', post.authorId)
                                  e.currentTarget.style.display = 'none'
                                  const fallback = e.currentTarget.nextElementSibling as HTMLElement
                                  if (fallback) {
                                    fallback.style.display = 'flex'
                                  }
                                }}
                              />
                              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600 hidden">
                                {nickname[0]}
                              </div>
                            </>
                          )
                        }
                        return (
                          <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-gray-600">
                            {nickname[0]}
                          </div>
                        )
                      })()}
                      <p className="text-xs text-gray-500">
                        {authorProfilesMap.get(post.authorId)?.nickname || post.authorNickname || '사용자'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </article>
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      currentPage === page
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}

      {showEditor && (
        <EditorModal
          defaultValues={editingPost ? { title: editingPost.title, content: editingPost.content, category: editingPost.category, imageUrl: editingPost.imageUrl, videoUrl: editingPost.videoUrl } : undefined}
          onClose={() => setShowEditor(false)}
          onSuccess={async () => {
            setShowEditor(false)
            await loadPosts()
          }}
          onSubmit={async (values) => {
            if (editingPost) {
              return await communityApi.update(editingPost.id, values as CommunityPostUpdateRequest)
            } else {
              return await communityApi.create(values as CommunityPostCreateRequest)
            }
          }}
        />
      )}
    </div>
  )
}

type EditorModalProps = {
  defaultValues?: { title: string; content: string; category: PostCategory; imageUrl?: string | null; videoUrl?: string | null }
  onClose: () => void
  onSuccess: (post: CommunityPostResponse) => void
  onSubmit: (values: CommunityPostCreateRequest | CommunityPostUpdateRequest) => Promise<any>
}

function EditorModal({ defaultValues, onClose, onSuccess, onSubmit }: EditorModalProps) {
  const [title, setTitle] = useState(defaultValues?.title ?? '')
  const [content, setContent] = useState(defaultValues?.content ?? '')
  const [category, setCategory] = useState<PostCategory>(defaultValues?.category ?? 'FREE')
  const [videoUrl, setVideoUrl] = useState(defaultValues?.videoUrl ?? '')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaultValues?.imageUrl ?? null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('파일 크기는 10MB를 초과할 수 없습니다.')
        return
      }
      if (!file.type.startsWith('image/')) {
        setError('이미지 파일만 업로드 가능합니다.')
        return
      }
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('제목을 입력해 주세요.'); return }
    if (!content.trim()) { setError('내용을 입력해 주세요.'); return }
    try {
      setIsSubmitting(true)
      setError(null)
      
      let finalImageUrl: string | null = null
      
      // 파일이 선택된 경우 업로드
      if (selectedFile) {
        setIsUploading(true)
        try {
          finalImageUrl = await fileApi.uploadPetImage(selectedFile)
        } catch (uploadError: any) {
          setError('이미지 업로드에 실패했습니다: ' + (uploadError.message || '알 수 없는 오류'))
          setIsSubmitting(false)
          setIsUploading(false)
          return
        } finally {
          setIsUploading(false)
        }
      } else if (defaultValues?.imageUrl) {
        // 수정 시 기존 이미지 유지
        finalImageUrl = defaultValues.imageUrl
      }
      
      const payload: CommunityPostCreateRequest = {
        title: title.trim(),
        content: content.trim(),
        category,
        imageUrl: finalImageUrl,
        videoUrl: videoUrl.trim() || null,
      }
      console.log('게시글 생성 요청 데이터:', payload)
      const res = await onSubmit(payload)
      if (res?.success && res?.data) {
        onSuccess(res.data)
      } else {
        // onSubmit이 ApiResponse를 반환하지 않는 경우도 있어 안전 처리
        onSuccess({
          id: 0, title: payload.title, content: payload.content, category: payload.category,
          imageUrl: payload.imageUrl || null,
          videoUrl: payload.videoUrl || null,
          authorId: 0, authorNickname: null, createdAt: new Date().toISOString(), updatedAt: null
        })
      }
    } catch (e: any) {
      setError(e.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">{defaultValues ? '게시글 수정' : '게시글 작성'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PostCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="WALK_CERTIFICATION">산책 인증 게시판</option>
              <option value="FREE">자유 게시판</option>
              <option value="SAFETY">안전하개</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="제목을 입력하세요"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              rows={8}
              placeholder="내용을 입력하세요"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이미지 (파일 업로드만 가능)</label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <label className="flex-1 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                  <Upload size={18} />
                  <span>파일 선택</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isSubmitting || isUploading}
                  />
                </label>
              </div>
              {previewUrl && (
                <div className="relative">
                  <img src={previewUrl} alt="미리보기" className="w-full h-48 object-cover rounded-lg border border-gray-300" />
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrl(null)
                      setSelectedFile(null)
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    disabled={isSubmitting || isUploading}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">동영상/유튜브 링크</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="유튜브 링크 또는 동영상 URL을 입력하세요"
              disabled={isSubmitting || isUploading}
            />
          </div>
          <div className="flex gap-3 pt-2">
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
              disabled={isSubmitting}
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}








