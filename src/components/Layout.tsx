import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, Map, Users, Trophy, User, LogIn, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userNickname, setUserNickname] = useState('')

  useEffect(() => {
    // 로그인 상태 확인
    const token = localStorage.getItem('authToken')
    const nickname = localStorage.getItem('userNickname')
    setIsLoggedIn(!!token)
    setUserNickname(nickname || '')
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('userId')
    localStorage.removeItem('userNickname')
    setIsLoggedIn(false)
    setUserNickname('')
    navigate('/login')
  }

  const navItems = [
    { path: '/', icon: Home, label: '홈' },
    { path: '/walk', icon: Map, label: '산책' },
    { path: '/community', icon: Users, label: '커뮤니티' },
    { path: '/challenges', icon: Trophy, label: '챌린지' },
    { path: '/profile', icon: User, label: '프로필' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">🐾 Pawvent</h1>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <>
                <span className="text-sm text-gray-600">{userNickname && `${userNickname}님`}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
                >
                  <LogOut size={18} />
                  로그아웃
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <LogIn size={18} />
                로그인
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="pt-16 pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-around">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center py-3 px-4 transition-colors ${
                    isActive
                      ? 'text-primary'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon size={24} />
                  <span className="text-xs mt-1">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}



