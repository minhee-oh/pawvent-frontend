import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { communityApi, CommunityPostResponse, PostCategory, CommunityPostCreateRequest, CommunityPostUpdateRequest, fileApi, userApi, UserResponse } from '../lib/api'
import { ArrowLeft, Edit, X, Upload } from 'lucide-react'

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

export default function CommunityDetail() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const [post, setPost] = useState<CommunityPostResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [authorProfile, setAuthorProfile] = useState<UserResponse | null>(null)

  const loadPost = async () => {
    if (!postId) return
    try {
      setIsLoading(true)
      setError(null)
      const res = await communityApi.getById(Number(postId))
      if (res.success && res.data) {
        setPost(res.data)
        
        // 작성자의 프로필 정보 가져오기
        try {
          const userRes = await userApi.getById(res.data.authorId)
          if (userRes.success && userRes.data) {
            console.log('작성자 프로필:', userRes.data)
            console.log('작성자 프로필 이미지 URL:', userRes.data.profileImageUrl)
            setAuthorProfile(userRes.data)
          } else {
            console.warn('작성자 프로필 조회 실패:', userRes)
          }
        } catch (e: any) {
          console.error('작성자의 프로필 정보를 가져오지 못했습니다:', e)
          console.error('에러 상세:', {
            message: e.message,
            response: e.response?.data,
            status: e.response?.status,
            statusText: e.response?.statusText
          })
        }
      } else {
        setError('게시글을 찾을 수 없습니다.')
      }
    } catch (e: any) {
      console.error('게시글 로드 오류:', e)
      setError(e.message || '게시글을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }
  

  useEffect(() => {
    loadPost()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  const handleDelete = async () => {
    if (!postId || !window.confirm('이 게시글을 삭제하시겠습니까?')) return
    try {
      const res = await communityApi.delete(Number(postId))
      if (res.success) {
        navigate('/community')
      }
    } catch {
      alert('삭제에 실패했습니다.')
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center text-gray-500 py-16">불러오는 중...</div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate('/community')}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} /> 목록으로
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error || '게시글을 찾을 수 없습니다.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate('/community')}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={20} /> 목록으로
      </button>

      <article className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  {post.category === 'WALK_CERTIFICATION' ? '산책 인증' : post.category === 'FREE' ? '자유' : '안전하개'}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(post.createdAt).toLocaleString()}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">{post.title}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {(() => {
                  const profileImageUrl = authorProfile?.profileImageUrl
                  const nickname = authorProfile?.nickname || post.authorNickname || '사용자'
                  
                  if (profileImageUrl && profileImageUrl.trim() !== '') {
                    return (
                      <img 
                        src={profileImageUrl} 
                        alt="프로필" 
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          console.error('프로필 이미지 로드 실패:', profileImageUrl)
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                    )
                  }
                  return (
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm text-gray-600">
                      {nickname[0]}
                    </div>
                  )
                })()}
                <span>작성자: {authorProfile?.nickname || post.authorNickname || '사용자'}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditor(true)}
                className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-500"
                title="수정"
              >
                <Edit size={20} />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500"
                title="삭제"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6">
          {/* 이미지 */}
          {post.imageUrl && (
            <div className="mb-6">
              <img
                src={post.imageUrl}
                alt="게시글 이미지"
                className="w-full max-w-2xl mx-auto rounded-lg border border-gray-200"
              />
            </div>
          )}

          {/* 비디오 */}
          {post.videoUrl && (
            <div className="mb-6">
              {post.videoUrl.includes('youtube.com') || post.videoUrl.includes('youtu.be') ? (
                (() => {
                  const embedUrl = convertToYoutubeEmbedUrl(post.videoUrl)
                  if (embedUrl) {
                    return (
                      <div className="w-full max-w-2xl mx-auto aspect-video rounded-lg overflow-hidden border border-gray-200">
                        <iframe
                          src={embedUrl}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title="YouTube video player"
                        />
                      </div>
                    )
                  }
                  return (
                    <div className="w-full max-w-2xl mx-auto aspect-video rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-500">
                      유튜브 링크 형식이 올바르지 않습니다
                    </div>
                  )
                })()
              ) : (
                <video
                  src={post.videoUrl}
                  controls
                  className="w-full max-w-2xl mx-auto rounded-lg border border-gray-200"
                />
              )}
            </div>
          )}

          {/* 내용 */}
          <div className="prose max-w-none">
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{post.content}</p>
          </div>
        </div>
      </article>

      {/* 수정 모달 */}
      {showEditor && post && (
        <EditorModal
          defaultValues={{
            title: post.title,
            content: post.content,
            category: post.category,
            imageUrl: post.imageUrl,
            videoUrl: post.videoUrl,
          }}
          onClose={() => setShowEditor(false)}
          onSuccess={async () => {
            setShowEditor(false)
            await loadPost()
          }}
          onSubmit={async (values) => {
            return await communityApi.update(post.id, values as CommunityPostUpdateRequest)
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
      const res = await onSubmit(payload)
      if (res?.success && res?.data) {
        onSuccess(res.data)
      } else {
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
          <h3 className="text-xl font-bold">게시글 수정</h3>
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

