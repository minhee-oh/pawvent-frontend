import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { authApi } from '../lib/api'

declare global {
  interface Window {
    Kakao: any
  }
}

export default function Login() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  // 이미 로그인한 경우 홈으로 리다이렉트
  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (token) {
      navigate('/')
    }
  }, [navigate])

  // 백엔드 연결 테스트 (개발용)
  useEffect(() => {
    const testBackend = async () => {
      try {
        const response = await authApi.test()
        console.log('✅ 백엔드 연결 성공:', response.message)
      } catch (error: any) {
        console.warn('⚠️ 백엔드 연결 실패:', error.response?.status || '연결 불가')
        console.warn('백엔드 서버(localhost:8081)가 실행 중인지 확인하세요.')
      }
    }
    
    // 개발 환경에서만 테스트 실행
    if (process.env.NODE_ENV === 'development') {
      testBackend()
    }
  }, [])

  // 카카오 SDK 초기화
  useEffect(() => {
    const kakaoScript = document.createElement('script')
    kakaoScript.src = 'https://developers.kakao.com/sdk/js/kakao.js'
    kakaoScript.async = true
    document.head.appendChild(kakaoScript)

    kakaoScript.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        // 카카오 JavaScript 키 (REST API 키와 다름)
        // 실제 JavaScript 키로 교체 필요
        window.Kakao.init('84fb23777189235395b06fb9a1b1dafd')
      }
    }

    return () => {
      document.head.removeChild(kakaoScript)
    }
  }, [])

  const handleKakaoLogin = async () => {
    if (!window.Kakao) {
      alert('카카오 SDK가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.')
      return
    }

    try {
      setIsLoading(true)

      // 카카오 로그인 (동의 항목 포함)
      window.Kakao.Auth.login({
        success: async (authObj: any) => {
          try {
            // 카카오 액세스 토큰으로 백엔드에 로그인 요청
            const response = await authApi.kakaoLogin(authObj.access_token)

            if (response.success && response.data) {
              // JWT 토큰 저장
              localStorage.setItem('authToken', response.data.token)
              localStorage.setItem('userId', String(response.data.userId))
              localStorage.setItem('userNickname', response.data.nickname || '')
              if (response.data.profileImageUrl) {
                localStorage.setItem('userProfileImageUrl', response.data.profileImageUrl)
              }
              
              // 메인 페이지로 이동
              navigate('/')
              window.location.reload() // 상태 갱신을 위해 리로드
            } else {
              throw new Error(response.message || '로그인에 실패했습니다.')
            }
          } catch (error: any) {
            console.error('카카오 로그인 처리 실패:', error)
            alert(error.response?.data?.message || error.message || '로그인 처리에 실패했습니다.')
          } finally {
            setIsLoading(false)
          }
        },
        fail: (err: any) => {
          console.error('카카오 로그인 실패:', err)
          
          // KOE004 오류 특별 처리
          if (err.error === 'KOE004' || err.error_description?.includes('KOE004')) {
            alert(
              '카카오 개발자 콘솔 설정 오류입니다.\n\n' +
              '다음 사항을 확인해주세요:\n' +
              '1. 플랫폼 > Web 플랫폼에 http://localhost:3000 등록\n' +
              '2. 카카오 로그인 > Redirect URI에 http://localhost:3000 등록\n' +
              '3. 동의 항목에서 이메일, 닉네임 필수 동의 설정\n' +
              '4. 제품 설정에서 카카오 로그인 활성화'
            )
          } else {
            alert(`카카오 로그인에 실패했습니다.\n오류: ${err.error || err.error_description || '알 수 없는 오류'}`)
          }
          setIsLoading(false)
        },
      })
    } catch (error) {
      console.error('카카오 로그인 오류:', error)
      alert('로그인 중 오류가 발생했습니다.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">🐾 Pawvent</h1>
          <p className="text-gray-600">반려동물과 함께하는 즐거운 산책</p>
        </div>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-gray-700 mb-6">
              간편하게 카카오 계정으로<br />
              로그인하여 서비스를 이용하세요
            </p>
          </div>

          <button
            onClick={handleKakaoLogin}
            disabled={isLoading}
            className="w-full bg-[#FEE500] text-black py-4 rounded-lg font-semibold hover:bg-[#FDD835] transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-lg"
          >
            {isLoading ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                <span>로그인 중...</span>
              </>
            ) : (
              <>
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z" />
                </svg>
                <span>카카오로 로그인</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 mb-1">
            계정이 없으신가요?
          </p>
          <p className="text-xs text-gray-500">
            카카오 로그인으로 간편하게 시작하세요!
          </p>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-blue-700 leading-relaxed">
            💡 <strong>안내사항</strong>
            <br />
            • 카카오 로그인 시 이메일과 닉네임 정보가 수집됩니다.
            <br />
            • 로그인하지 않아도 일부 기능은 이용할 수 있습니다.
            <br />
            • 서비스 이용을 위해 카카오 로그인이 필요합니다.
          </p>
        </div>
      </div>
    </div>
  )
}



