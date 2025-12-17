import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, PhoneCall, Search, Navigation, Loader2, AlertTriangle } from 'lucide-react'
import sosHeroMobile from '../../assets/sos1.jpg'
import sosHeroDesktop from '../../assets/sos2.jpg'
import { fetchLocationBasedList, type TourItem } from '../lib/tourApi'
import { isMobile, isSecureContextForGeo } from '../lib/mobileEnv'

type Coords = { lat: number; lng: number }

const DEFAULT_COORDS: Coords = { lat: 37.5665, lng: 126.9780 } // fallback: 서울시청

function haversineMeters(a: Coords, b: Coords) {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const aa = s1 * s1 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * s2 * s2
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

export default function Sos() {
  const [coords, setCoords] = useState<Coords>(DEFAULT_COORDS)
  const [isLocating, setIsLocating] = useState(true)
  const [items, setItems] = useState<TourItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'ALL' | 'HOSPITAL' | 'NEAR' | 'OPEN_24'>('ALL')
  const showMobileGeoBanner = useMemo(() => isMobile() && !isSecureContextForGeo(), [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setIsLocating(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setIsLocating(false)
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    )
  }, [])

  useEffect(() => {
    const run = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const list = await fetchLocationBasedList({
          mapX: coords.lng,
          mapY: coords.lat,
          radius: 30000,
          arrange: 'E',
          numOfRows: 80,
        })
        setItems(Array.isArray(list) ? list : [])
      } catch (e: any) {
        setError(e?.message || '주변 정보를 불러오지 못했습니다.')
        setItems([])
      } finally {
        setIsLoading(false)
      }
    }
    run()
  }, [coords.lat, coords.lng])

  const enriched = useMemo(() => {
    return items
      .map((it) => {
        const lat = Number(it.mapy)
        const lng = Number(it.mapx)
        const dist = Number.isFinite(lat) && Number.isFinite(lng)
          ? haversineMeters(coords, { lat, lng })
          : Number.POSITIVE_INFINITY
        return { it, dist }
      })
      .sort((a, b) => a.dist - b.dist)
  }, [items, coords])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = enriched

    if (q) {
      list = list.filter(({ it }) =>
        (it.title || '').toLowerCase().includes(q) ||
        (it.addr1 || '').toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q)
      )
    }

    if (tab === 'HOSPITAL') {
      list = list.filter(({ it }) => (it.category || '').includes('동물병원') || (it.title || '').includes('동물병원'))
    } else if (tab === 'OPEN_24') {
      list = list.filter(({ it }) => (it.title || '').includes('24') || (it.category || '').includes('24'))
    } else if (tab === 'NEAR') {
      // 가까운 순은 이미 dist 정렬
      list = list
    }

    return list.slice(0, 12)
  }, [enriched, query, tab])

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
            <source media="(min-width: 768px)" srcSet={sosHeroDesktop} />
            <img
              src={sosHeroMobile}
              alt="SOS 히어로 이미지"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
          <div className="relative min-h-[220px] sm:min-h-[300px] p-6 sm:p-10 flex flex-col justify-end gap-3">
            <span className="inline-flex w-fit items-center rounded-full bg-violet-600/90 px-3 py-1 text-[11px] font-semibold text-white">
              sos
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              pawvent는 당신과 함께합니다
            </h1>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center justify-center">
          <div className="w-full max-w-xl">
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="가까운 응급 장소를 검색해보세요"
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
      <div className="flex items-center justify-between gap-3 text-xs text-gray-500 mb-6">
        <button
          type="button"
          className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="뒤로가기"
          onClick={() => window.history.back()}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="ml-auto">서비스 &gt; SOS</div>
      </div>

      {/* 1. Call */}
      <section className="mb-10">
        <div className="text-sm text-gray-800 space-y-2">
          <div className="font-semibold">1. 다쳤을 때는 119신고, 사건/사고는 112에 신고</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="tel:119"
              className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div>
                <div className="text-xs text-gray-500">응급</div>
                <div className="text-lg font-extrabold text-gray-900">119</div>
              </div>
              <PhoneCall size={18} className="text-gray-700" />
            </a>
            <a
              href="tel:112"
              className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div>
                <div className="text-xs text-gray-500">사건/사고</div>
                <div className="text-lg font-extrabold text-gray-900">112</div>
              </div>
              <PhoneCall size={18} className="text-gray-700" />
            </a>
          </div>
        </div>
      </section>

      {/* 2. Nearby places */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-gray-900">2. 내 주변 긴급 장소</h2>
          <div className="text-xs text-gray-500">
            {isLocating ? '내 위치 확인 중…' : `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { key: 'ALL', label: '전체' },
            { key: 'HOSPITAL', label: '동물병원' },
            { key: 'OPEN_24', label: '24시 동물병원' },
            { key: 'NEAR', label: '가까운' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={[
                'px-4 py-2 rounded-full text-sm border transition-colors',
                tab === t.key ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 text-red-700 text-sm">
              <AlertTriangle size={16} />
              {error}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-gray-500">
            <Loader2 className="animate-spin" size={22} />
            <span className="ml-2 text-sm">불러오는 중...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-10">
            주변 결과가 없습니다.
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {filtered.map(({ it, dist }) => (
              <EmergencyPlaceCard key={it.contentid} item={it} distanceLabel={formatDistance(dist)} />
            ))}
          </div>
        )}
      </section>

      {/* 3. Guides */}
      <section className="mb-6">
        <h2 className="text-lg font-extrabold text-gray-900 mb-4">3. 긴급 상황 대처 가이드</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GuideCard title="반려견 저항감/공포" items={[
            '갑작스러운 접촉을 피하세요.',
            '안전 거리를 확보하고 주변을 정리하세요.',
            '상처가 있으면 즉시 병원에 연락하세요.',
          ]} />
          <GuideCard title="위험 행동 대처 방법" items={[
            '흥분을 유발하는 자극을 차단하세요.',
            '짧게, 명확하게 통제 신호를 주세요.',
            '필요 시 도움을 요청하세요(119/112).',
          ]} />
          <GuideCard title="제어권 장악을 위한" items={[
            '리드줄을 짧게 잡고 몸으로 공간을 만들어요.',
            '침착하게, 천천히 이동하세요.',
            '사람과 반려견의 안전을 최우선으로 하세요.',
          ]} />
          <GuideCard title="반려견 응급처치" items={[
            '호흡/맥박을 먼저 확인하세요.',
            '출혈 시 깨끗한 거즈로 압박하세요.',
            '가능하면 이동 전 병원에 연락하세요.',
          ]} />
          <GuideCard title="제출/기록/신고 방법" items={[
            '사진/시간/장소를 기록하세요.',
            '필요 시 주변 CCTV/목격자 정보를 확보하세요.',
            '상황에 따라 112에 신고하세요.',
          ]} />
          <GuideCard title="1차 대응 체크리스트" items={[
            '내 안전 확보 → 반려견 보호 → 주변 확인',
            '응급 연락(119/112) → 병원 연락',
            '필요 시 위치 공유/도움 요청',
          ]} />
        </div>
      </section>
    </div>
  )
}

function EmergencyPlaceCard({ item, distanceLabel }: { item: TourItem; distanceLabel: string }) {
  const lat = Number(item.mapy)
  const lng = Number(item.mapx)
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng)
  const title = item.title || '장소'
  const addr = item.addr1 || item.description || '주소 정보 없음'
  const tel = (item.tel || '').trim()
  const kakaoRouteUrl = hasCoords ? `https://map.kakao.com/link/to/${encodeURIComponent(title)},${lat},${lng}` : undefined

  return (
    <article className="min-w-[260px] max-w-[300px] w-[80vw] sm:w-auto bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full inline-flex">
              {item.category || '긴급'}
            </div>
            <h3 className="mt-2 font-extrabold text-gray-900 line-clamp-2">{title}</h3>
            <p className="mt-1 text-xs text-gray-500 line-clamp-2">{addr}</p>
          </div>
          <div className="text-xs text-gray-500 whitespace-nowrap">{distanceLabel}</div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {tel ? (
            <a
              href={`tel:${tel.replace(/[^0-9+]/g, '')}`}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-white px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <PhoneCall size={16} />
              전화
            </a>
          ) : (
            <div className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gray-100 text-gray-500 px-4 py-2 text-sm font-semibold">
              <PhoneCall size={16} />
              전화정보 없음
            </div>
          )}

          {kakaoRouteUrl ? (
            <a
              href={kakaoRouteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              title="길찾기"
            >
              <Navigation size={16} />
              길찾기
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function GuideCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="text-sm font-extrabold text-gray-900 mb-3">{title}</div>
      <ul className="space-y-2 text-sm text-gray-600">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-gray-300 flex-shrink-0" />
            <span className="leading-relaxed">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}


