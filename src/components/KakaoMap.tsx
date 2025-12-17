import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useKakaoLoader } from '../lib/useKakaoLoader';
import axios from 'axios';
import type { HazardCategory } from '../lib/api';
import { fetchLocationBasedList, type TourItem } from '../lib/tourApi';

export type SpotType = 'CAFE' | 'HOSPITAL' | 'PARK' | 'STORE' | 'RESTAURANT' | 'OTHER';

export interface SpotData {
  id: number;
  name: string;
  type: SpotType;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  imageUrl?: string;
  rating?: number;
  createdAt?: string;
}

interface KakaoMapProps {
  centerLat?: number;
  centerLng?: number;
  level?: number;
  height?: string;
  autoLocation?: boolean;
  className?: string;
  relayoutKey?: number;

  showHazards?: boolean;
  showSpots?: boolean;
  spots?: SpotData[];

  enableHazardReport?: boolean;

  onMarkerClick?: (hazard: HazardData) => void;
  onSpotClick?: (spot: SpotData) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onHazardsRefresh?: () => void;

  onLocationChange?: (lat: number, lng: number) => void;
  draggableLocationMarker?: boolean;
}

interface HazardData {
  id: number;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  reporterId?: number;
  reporterNickname?: string;
  createdAt: string;
}

export default function KakaoMap({
  centerLat = 37.5665,
  centerLng = 126.9780,
  level = 3,
  height = '400px',
  autoLocation = false,
  className,
  relayoutKey,

  showHazards = true,
  showSpots = false,
  spots = [],

  enableHazardReport = false,
  draggableLocationMarker = true,

  onMarkerClick,
  onSpotClick,
  onMapClick,
  onLocationChange,
}: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<kakao.maps.Map | null>(null);

  const markersRef = useRef<kakao.maps.Marker[]>([]);
  const spotMarkersRef = useRef<kakao.maps.Marker[]>([]);
  const currentLocationMarkerRef = useRef<kakao.maps.Marker | null>(null);

  const watchIdRef = useRef<number | null>(null);

  const isManuallyAdjustedRef = useRef<boolean>(false);
  const manualLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastGpsUpdateRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);
  const draggableLocationMarkerRef = useRef(draggableLocationMarker);

  const onLocationChangeRef = useRef(onLocationChange);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onSpotClickRef = useRef(onSpotClick);

  const { isLoaded } = useKakaoLoader();

  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hazards, setHazards] = useState<HazardData[]>([]);
  const [showSpotList, setShowSpotList] = useState(false);
  const [fetchedSpots, setFetchedSpots] = useState<SpotData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<SpotType | 'ALL'>('ALL');
  const [showHazardList, setShowHazardList] = useState(false);
  const [selectedHazardCategory, setSelectedHazardCategory] = useState<HazardCategory | 'ALL'>('ALL');

  /* ---------------------------------------
   * 공공데이터 contenttypeid → SpotType 매핑
   * ----------------------------------------*/
  const mapContentTypeToSpotType = (contenttypeid: string, category?: string): SpotType => {
    // category 필드를 우선 확인 (백엔드에서 원본 카테고리 제공)
    if (category) {
      const catLower = category.toLowerCase();
      if (catLower.includes('동물병원') || catLower.includes('의료센터') || catLower.includes('클리닉')) {
        return 'HOSPITAL';
      }
      if (catLower.includes('카페') || catLower.includes('커피')) {
        return 'CAFE';
      }
      if (catLower.includes('식당') || catLower.includes('음식') || catLower.includes('식음료')) {
        return 'RESTAURANT';
      }
      if (catLower.includes('관광') || catLower.includes('공원') || catLower.includes('체험') || 
          catLower.includes('호수') || catLower.includes('케이블카') || catLower.includes('물레길')) {
        return 'PARK';
      }
      if (catLower.includes('숙박') || catLower.includes('펜션') || catLower.includes('호텔')) {
        return 'OTHER';
      }
    }
    
    // contenttypeid 기반 매핑 (fallback)
    switch (contenttypeid) {
      case '12': // 관광지
      case '28': // 레포츠
        return 'PARK';
      case '32': // 숙박
        return 'OTHER';
      case '39': // 음식점
        return 'RESTAURANT';
      case '14': // 기타 (동물병원 포함)
        // category가 있으면 이미 위에서 처리됨
        return 'OTHER';
      default:
        return 'OTHER';
    }
  };

  /* ---------------------------------------
   * 두 지점 간 거리 계산 (하버사인 공식, 미터 단위)
   ----------------------------------------*/
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // 지구 반경 (미터)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  /* ---------------------------------------
   * 현재 위치 마커 생성/업데이트
   * (GPS 무시 모드일 때는 절대 위치 갱신 안 함)
   ----------------------------------------*/
  const setMarkerPosition = useCallback((lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;

    const pos = new kakao.maps.LatLng(lat, lng);

    // 마커가 없으면 생성 (수동 모드여도 마커는 생성해야 함)
    if (!currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current = new kakao.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        draggable: draggableLocationMarkerRef.current,
        zIndex: 1000,
      });

      const createBlueMarkerSvg = (isDark: boolean) => {
        const color = isDark ? '#2563eb' : '#3b82f6';
        return `data:image/svg+xml;base64,${btoa(`
          <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z"
              fill="${color}" stroke="#ffffff" stroke-width="1"/>
            <circle cx="15" cy="15" r="6" fill="#ffffff"/>
          </svg>
        `.trim())}`;
      };

      const imageSrc = createBlueMarkerSvg(false);
      const imageSize = new kakao.maps.Size(30, 42);
      const imageOption = { offset: new kakao.maps.Point(15, 42) };
      currentLocationMarkerRef.current.setImage(new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption));

      // 드래그 시 GPS 완전차단
      if (draggableLocationMarkerRef.current) {
        // dragstart에서 미리 GPS 차단 (드래그 시작 즉시)
        kakao.maps.event.addListener(currentLocationMarkerRef.current, "dragstart", () => {
          console.log("🎯 드래그 시작 → GPS 차단");
          
          // 🔥 수동 모드를 가장 먼저 설정 (동기적으로 즉시 설정)
          // 이렇게 하면 GPS 콜백이 실행될 때 이미 true로 설정되어 있음
          isManuallyAdjustedRef.current = true;
          
          // watchPosition 완전 중지
          const currentWatchId = watchIdRef.current;
          if (currentWatchId !== null) {
            navigator.geolocation.clearWatch(currentWatchId);
            // clearWatch 후 즉시 null로 설정하여 콜백에서 체크 가능하도록
            watchIdRef.current = null;
          }
          
          // 추가 안전장치: 다음 이벤트 루프에서도 확인 (이미 큐에 들어간 콜백 차단)
          setTimeout(() => {
            if (isManuallyAdjustedRef.current) {
              // 수동 모드가 유지되고 있으면 watchPosition 완전 중지
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
              }
            }
          }, 0);
        });

        // dragend에서 최종 위치 저장 및 마커 업데이트
        kakao.maps.event.addListener(currentLocationMarkerRef.current, "dragend", () => {
          const p = currentLocationMarkerRef.current!.getPosition();
          const newLat = p.getLat();
          const newLng = p.getLng();

          console.log("🎯 수동 드래그 완료 → GPS OFF, 위치 고정:", newLat, newLng);

          // 🔥 수동 모드 확실히 설정 (이미 dragstart에서 설정했지만 재확인)
          isManuallyAdjustedRef.current = true;

          // 🔥 watchPosition 완전 중지 (dragstart에서 이미 했지만 재확인)
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }

          // 최종 위치 저장 (ref와 state 모두 업데이트)
          manualLocationRef.current = { lat: newLat, lng: newLng };
          setCurrentLocation({ lat: newLat, lng: newLng }); // 🔥 state도 업데이트하여 위험 요소 조회에 반영

          // 🔥 마커 위치를 명시적으로 고정 (드래그한 위치로 확실히 설정)
          const fixedPos = new kakao.maps.LatLng(newLat, newLng);
          currentLocationMarkerRef.current!.setPosition(fixedPos);

          // 마커 이미지와 타이틀 업데이트
          const darkImageSrc = createBlueMarkerSvg(true);
          currentLocationMarkerRef.current!.setImage(
            new kakao.maps.MarkerImage(darkImageSrc, imageSize, imageOption)
          );

          currentLocationMarkerRef.current!.setTitle("수동 조정된 위치");

          // 콜백 호출
          if (onLocationChangeRef.current) {
            onLocationChangeRef.current(newLat, newLng);
          }

          // GPS watchPosition은 재시작하지 않음 (수동 모드 유지)
        });
      }
    } else {
      // 기존 마커가 있을 때: 수동 모드면 위치 업데이트 금지 (드래그로 고정된 위치 유지)
      if (isManuallyAdjustedRef.current) {
        console.log("🚫 수동 모드: 마커 위치 업데이트 무시", lat, lng);
        return; // 마커 위치는 그대로 유지
      }
      
      // GPS 모드일 때만 마커 위치 업데이트
      currentLocationMarkerRef.current.setPosition(pos);
    }

    // GPS 모드일 때만 지도 중심 이동
    if (!isManuallyAdjustedRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(pos);
    }
  }, []);

  /* ---------------------------------------
   * GPS 추적 / 수동 고정 모드 관리
   ----------------------------------------*/
  useEffect(() => {
    if (!autoLocation || !isLoaded) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    // 🔥 수동 모드일 때는 GPS 추적을 시작하지 않음
    if (isManuallyAdjustedRef.current) {
      return;
    }

    if (!navigator.geolocation) {
      console.warn("GPS 미지원 브라우저");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // GPS 모드일 때만 최초 좌표 받아오기
    if (!isManuallyAdjustedRef.current) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // 수동 모드로 변경되었는지 다시 확인 (콜백 실행 중에 변경될 수 있음)
          if (isManuallyAdjustedRef.current) {
            return; // 수동 모드면 무시
          }
          
          const { latitude: lat, longitude: lng } = pos.coords;
          setCurrentLocation({ lat, lng });
          setMarkerPosition(lat, lng);
        },
        (err) => console.warn("초기 GPS 실패:", err.message),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
      );
    }

    // 위치 추적 시작
    // watchId를 먼저 null로 설정하여 콜백 실행 전에 체크 가능하도록
    watchIdRef.current = null;
    
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        // 🔥 가장 먼저 체크: watch ID가 유효한지 확인 (clearWatch 후 호출된 콜백 차단)
        // watchIdRef.current가 null이면 이미 clearWatch가 호출된 것이므로 무시
        if (watchIdRef.current === null) {
          return; // 로그도 출력하지 않음
        }

        // 🔥 두 번째 체크: watch ID가 클로저의 watchId와 일치하는지 확인
        // watchIdRef.current가 클로저의 watchId와 다르면 다른 watch의 콜백이므로 무시
        if (watchIdRef.current !== watchId) {
          return; // 로그도 출력하지 않음
        }

        // 🔥 세 번째 체크: 수동 모드면 즉시 무시 (로그도 출력 안 함)
        // 이 체크를 맨 앞에 두어 dragstart 후 호출된 콜백도 확실히 차단
        if (isManuallyAdjustedRef.current) {
          return; // 로그도 출력하지 않음
        }

        // 🔥 네 번째 체크: 수동 모드 재확인 (콜백 실행 중에 변경될 수 있음)
        if (isManuallyAdjustedRef.current) {
          return; // 로그도 출력하지 않음
        }

        const { latitude: lat, longitude: lng } = pos.coords;
        const now = Date.now();

        // 같은 위치의 중복 업데이트 방지 (1초 이내 같은 위치면 무시)
        if (lastGpsUpdateRef.current) {
          const { lat: lastLat, lng: lastLng, timestamp } = lastGpsUpdateRef.current;
          const timeDiff = now - timestamp;
          const latDiff = Math.abs(lat - lastLat);
          const lngDiff = Math.abs(lng - lastLng);
          
          // 1초 이내이고 위치 차이가 매우 작으면 무시 (GPS 노이즈 필터링)
          if (timeDiff < 1000 && latDiff < 0.0001 && lngDiff < 0.0001) {
            return;
          }
        }

        console.log("📌 GPS 업데이트:", lat, lng);
        lastGpsUpdateRef.current = { lat, lng, timestamp: now };

        setCurrentLocation({ lat, lng });
        setMarkerPosition(lat, lng);
      },
      (err) => console.warn("GPS 오류:", err.message),
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 10000 }
    );
    
    // watchPosition 호출 후 즉시 watchId 저장
    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // 🔥 setMarkerPosition을 의존성에서 제거하여 불필요한 재실행 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLocation, isLoaded]);

  /* ---------------------------------------
   * 지도 초기화 (1회만 실행)
   ----------------------------------------*/
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.LatLng) {
      console.warn('kakao.maps.LatLng 로드 전 - 지도 초기화 보류');
      return;
    }

    const map = new kakao.maps.Map(mapRef.current, {
      center: new kakao.maps.LatLng(centerLat, centerLng),
      level: level,
    });

    mapInstanceRef.current = map;
  }, [isLoaded]);

  // 컨테이너 크기 변경(모달/풀스크린 등) 대응
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;
    try {
      mapInstanceRef.current.relayout();
    } catch {
      // noop
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayoutKey, isLoaded]);

  /* ---------------------------------------
   * autoLocation = false이면 기본 마커 생성
   ----------------------------------------*/
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || autoLocation) return;

    if (!currentLocationMarkerRef.current) {
      setMarkerPosition(centerLat, centerLng);
    }
  }, [isLoaded, autoLocation, centerLat, centerLng, setMarkerPosition]);

  /* 콜백 Ref 업데이트 */
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
    onMarkerClickRef.current = onMarkerClick;
    onSpotClickRef.current = onSpotClick;
    draggableLocationMarkerRef.current = draggableLocationMarker;
  }, [onLocationChange, onMarkerClick, onSpotClick, draggableLocationMarker]);
  /* ---------------------------------------
   * 지도 클릭 이벤트 (위험 요소 등록용)
   ----------------------------------------*/
   useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !enableHazardReport) return;

    const clickHandler = (mouseEvent?: kakao.maps.event.MouseEvent) => {
      if (!mouseEvent) return;
      const latlng = mouseEvent.latLng;
      if (latlng && onMapClick) {
        onMapClick(latlng.getLat(), latlng.getLng());
      }
    };

    kakao.maps.event.addListener(mapInstanceRef.current, "click", clickHandler);

    return () => {
      if (mapInstanceRef.current) {
        kakao.maps.event.removeListener(mapInstanceRef.current, "click", clickHandler);
      }
    };
  }, [isLoaded, enableHazardReport, onMapClick]);

  /* ---------------------------------------
   * 위험 요소 조회 (API)
   * GPS 위치가 있으면 그것을 사용, 없으면 centerLat/centerLng 사용
   ----------------------------------------*/
  useEffect(() => {
    if (!showHazards || !isLoaded || !mapInstanceRef.current) return;

    const fetchHazards = async () => {
      try {
        // 위치 우선순위: 수동 조정 위치 > GPS 위치 > 기본 위치
        const lat = manualLocationRef.current?.lat ?? currentLocation?.lat ?? centerLat;
        const lng = manualLocationRef.current?.lng ?? currentLocation?.lng ?? centerLng;

        const response = await axios.get('/api/hazards/nearby', {
          params: {
            latitude: lat,
            longitude: lng,
            radius: 2000,
          },
        });

        if (response.data.success && response.data.data) {
          setHazards(response.data.data);
        }
      } catch (error: any) {
        console.error("위험 지역 조회 실패:", error);
      }
    };

    fetchHazards();
  }, [showHazards, isLoaded, centerLat, centerLng, currentLocation]);

  /* ---------------------------------------
   * 공공데이터 기반 스팟 조회 (locationBasedList)
   * showSpots=true 이고 spots prop 이 비어있을 때만 호출
   * ----------------------------------------*/
  useEffect(() => {
    if (!showSpots || !isLoaded || !mapInstanceRef.current) return;

    // spots prop 이 있으면 공공데이터 호출 안 함
    if (spots.length > 0) return;

    const fetchSpotsFromPublicApi = async () => {
      try {
        const lat = manualLocationRef.current?.lat ?? currentLocation?.lat ?? centerLat;
        const lng = manualLocationRef.current?.lng ?? currentLocation?.lng ?? centerLng;
        console.log('📍 스팟 조회 좌표', { lat, lng, centerLat, centerLng, currentLocation, manual: manualLocationRef.current });

        const items = await fetchLocationBasedList({
          mapX: lng,
          mapY: lat,
          radius: 30000, // 춘천 전역 커버를 위해 반경 30km
          arrange: 'E',  // 거리순
        });
        console.log('📌 공공데이터 응답 items', items);
        // 카테고리 필드 확인
        if (items.length > 0) {
          console.log('📌 첫 5개 항목의 category 필드:', items.slice(0, 5).map((item: any) => ({
            title: item.title,
            category: item.category,
            contenttypeid: item.contenttypeid,
            addr1: item.addr1
          })));
        }

        const mapped: SpotData[] = (items as TourItem[])
          .map((item, idx) => {
            const lat = Number(item.mapy);
            const lng = Number(item.mapx);
            
            // 좌표 유효성 검사
            if (isNaN(lat) || isNaN(lng)) {
              console.warn('유효하지 않은 좌표:', item.title, 'lat:', item.mapy, 'lng:', item.mapx);
              return null;
            }

            return {
              id: Number(item.contentid) || idx,
              name: item.title,
              type: mapContentTypeToSpotType(item.contenttypeid, item.category),
              latitude: lat,
              longitude: lng,
              address: item.addr1,
              imageUrl: item.firstimage2 || item.firstimage,
            } as SpotData;
          })
          .filter((spot): spot is SpotData => spot !== null);

        console.log('📌 변환된 스팟(타입 포함):', mapped.length, '건');
        if (mapped.length > 0) {
          console.log('📌 타입별 분포:', 
            mapped.reduce((acc, spot) => {
              acc[spot.type] = (acc[spot.type] || 0) + 1;
              return acc;
            }, {} as Record<SpotType, number>)
          );
          console.log('📌 첫 5개 스팟:', mapped.slice(0, 5).map(m => ({
            name: m.name,
            type: m.type,
            lat: m.latitude,
            lng: m.longitude,
          })));
        }

        setFetchedSpots(mapped);
        // 새로 불러왔을 때 필터를 전체로 리셋하여 특정 카테고리에 묶이지 않게 함
        setSelectedCategory('ALL');
      } catch (error: any) {
        console.error('공공데이터 스팟 조회 실패:', error?.message || error);
        setFetchedSpots([]);
      }
    };

    fetchSpotsFromPublicApi();
  }, [showSpots, isLoaded, centerLat, centerLng, currentLocation?.lat, currentLocation?.lng, spots.length]);

  /* ---------------------------------------
   * 주변 스팟 필터링 (현재 위치 기준 반경 2km)
   ----------------------------------------*/
  // 사용할 스팟 데이터 (props가 있으면 props 사용, 없으면 API에서 가져온 데이터 사용)
  const allSpots = useMemo(() => {
    return spots.length > 0 ? spots : fetchedSpots;
  }, [spots, fetchedSpots]);

  // spots 배열의 ID를 기반으로 한 키 생성 (의존성 비교용)
  const spotsKey = useMemo(() => {
    return allSpots.map(s => s.id).join(',');
  }, [allSpots]);

  // currentLocation의 lat/lng를 기반으로 한 키 생성 (의존성 비교용)
  const locationKey = useMemo(() => {
    const lat = manualLocationRef.current?.lat ?? currentLocation?.lat ?? centerLat;
    const lng = manualLocationRef.current?.lng ?? currentLocation?.lng ?? centerLng;
    return `${lat.toFixed(6)},${lng.toFixed(6)}`;
  }, [currentLocation?.lat, currentLocation?.lng, centerLat, centerLng]);

  const nearbySpots = useMemo(() => {
    if (!showSpots || allSpots.length === 0) {
      console.log('📍 nearbySpots: showSpots=', showSpots, 'allSpots.length=', allSpots.length);
      return [];
    }

    // 위치 우선순위: 수동 조정 위치 > GPS 위치 > 기본 위치
    const lat = manualLocationRef.current?.lat ?? currentLocation?.lat ?? centerLat;
    const lng = manualLocationRef.current?.lng ?? currentLocation?.lng ?? centerLng;

    // 반경을 30km로 확대 (백엔드에서 30km로 가져오므로)
    const radius = 30000; // 30km
    let filtered = allSpots
      .map(spot => ({
        ...spot,
        distance: calculateDistance(lat, lng, spot.latitude, spot.longitude),
      }))
      .filter(spot => spot.distance <= radius);

    console.log('📍 nearbySpots 필터링: 전체', allSpots.length, '건 중 반경', radius, 'm 내', filtered.length, '건');

    // 카테고리별 필터링
    if (selectedCategory !== 'ALL') {
      filtered = filtered.filter(spot => spot.type === selectedCategory);
      console.log('📍 카테고리 필터링 후:', filtered.length, '건 (카테고리:', selectedCategory, ')');
    }

    // 거리순 정렬
    const sorted = filtered.sort((a, b) => a.distance - b.distance);
    console.log('📍 nearbySpots 최종:', sorted.length, '건');
    return sorted;
  }, [showSpots, spotsKey, allSpots, locationKey, selectedCategory, calculateDistance, centerLat, centerLng, currentLocation]);

  /* ---------------------------------------
   * 위험 스팟 카테고리별 필터링
   ----------------------------------------*/
  const filteredHazards = useMemo(() => {
    if (selectedHazardCategory === 'ALL') {
      return hazards;
    }
    return hazards.filter(hazard => hazard.category === selectedHazardCategory);
  }, [hazards, selectedHazardCategory]);

  /* ---------------------------------------
   * 위험 요소 마커 표시
   ----------------------------------------*/
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    // 기존 마커 제거
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (hazards.length === 0) return;

    hazards.forEach((hazard) => {
      const markerPosition = new kakao.maps.LatLng(hazard.latitude, hazard.longitude);

      const marker = new kakao.maps.Marker({
        position: markerPosition,
        map: mapInstanceRef.current!,
      });

      const imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png';
      const imageSize = new kakao.maps.Size(24, 35);
      const imageOption = { offset: new kakao.maps.Point(12, 35) };
      const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
      marker.setImage(markerImage);
      marker.setZIndex(500);

      // 마커 클릭 이벤트
      kakao.maps.event.addListener(marker, 'click', () => {
        console.log('위험 스팟 클릭:', hazard.id);

        const hazardHandler = onMarkerClickRef.current;
        if (hazardHandler) {
          hazardHandler(hazard);
          return;
        }

        // 기본 인포윈도우
        const contentDiv = document.createElement('div');
        contentDiv.style.padding = '10px';
        contentDiv.style.minWidth = '200px';
        contentDiv.innerHTML = `
          <strong style="color:#dc2626;">⚠️ ${hazard.category}</strong><br/>
          <div style="margin-top:5px;">${hazard.description || '설명 없음'}</div>
          <small style="color:#666;">신고자: ${hazard.reporterNickname || '알 수 없음'}</small>
          <div style="margin-top:10px;text-align:center;">
            <button 
              id="hazard-detail-btn-${hazard.id}" 
              style="background:#dc2626;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;">
              상세보기
            </button>
          </div>
        `;

        const infowindow = new kakao.maps.InfoWindow({ content: contentDiv });
        infowindow.open(mapInstanceRef.current!, marker);

        const detailBtn = contentDiv.querySelector(`#hazard-detail-btn-${hazard.id}`);
        if (detailBtn) {
          detailBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const handler = onMarkerClickRef.current;
            if (handler) handler(hazard);
            infowindow.close();
          });
        }
      });

      markersRef.current.push(marker);
    });
  }, [hazards, isLoaded]);

  /* ---------------------------------------
   * Spot 타입별 이미지
   ----------------------------------------*/
  const getSpotMarkerImage = (type: SpotType): string => {
    const markerColors: Record<SpotType, string> = {
      CAFE: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
      HOSPITAL: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png',
      PARK: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
      STORE: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_purple.png',
      RESTAURANT: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
      OTHER: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
    };
    return markerColors[type] || markerColors.OTHER;
  };

  const getSpotTypeLabel = (type: SpotType): string => {
    const labels: Record<SpotType, string> = {
      CAFE: '카페',
      HOSPITAL: '병원',
      PARK: '공원',
      STORE: '매장',
      RESTAURANT: '식당',
      OTHER: '기타',
    };
    return labels[type] || '기타';
  };

  const getHazardCategoryLabel = (category: HazardCategory): string => {
    const labels: Record<HazardCategory, string> = {
      LEASH: '목줄 미착용',
      MUZZLE: '입마개 미착용',
      AGGRESSIVE_DOG: '공격적인 개',
      HAZARDOUS_MATERIAL: '위험물질',
      WILDLIFE: '야생동물 출몰',
      LOW_LIGHT: '조명 부족',
      BIKE_CAR: '자전거·차량 위험',
      POOP_LEFT: '배변 미수거',
      OTHER: '기타',
    };
    return labels[category] || '기타';
  };

  /* ---------------------------------------
   * 스팟 마커 표시
   ----------------------------------------*/
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !showSpots) {
      spotMarkersRef.current.forEach((m) => m.setMap(null));
      spotMarkersRef.current = [];
      return;
    }

    spotMarkersRef.current.forEach((m) => m.setMap(null));
    spotMarkersRef.current = [];

    // 리스트와 동일한 필터(반경/카테고리) 결과를 사용
    if (nearbySpots.length === 0) {
      console.log('📍 스팟 마커 없음: nearbySpots length=0');
      return;
    }
    console.log('📍 스팟 마커 렌더링', nearbySpots.length, nearbySpots.slice(0, 3));

    nearbySpots.forEach((spot) => {
      if (Number.isNaN(spot.latitude) || Number.isNaN(spot.longitude)) return;
      const markerPosition = new kakao.maps.LatLng(spot.latitude, spot.longitude);

      const marker = new kakao.maps.Marker({
        position: markerPosition,
        map: mapInstanceRef.current!,
        draggable: true,
      });

      const imageSrc = getSpotMarkerImage(spot.type);
      const imageSize = new kakao.maps.Size(24, 35);
      const imageOption = { offset: new kakao.maps.Point(12, 35) };
      marker.setImage(new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption));
      marker.setZIndex(500);

      // 스팟 드래그 이벤트
      kakao.maps.event.addListener(marker, 'dragend', () => {
        const p = marker.getPosition();
        console.log(`스팟 "${spot.name}" 이동:`, p.getLat(), p.getLng());
      });

      // 스팟 클릭 이벤트
      kakao.maps.event.addListener(marker, 'click', () => {
        const handler = onSpotClickRef.current;
        if (handler) {
          handler(spot);
          return;
        }

        // 기본 인포윈도우
        const ratingHtml = spot.rating ? `<div style="margin-top:5px;">⭐ ${spot.rating.toFixed(1)}</div>` : '';
        const addressHtml = spot.address ? `<div style="margin-top:5px;color:#666;">📍 ${spot.address}</div>` : '';
        const phoneHtml = spot.phone ? `<div style="margin-top:5px;color:#666;">📞 ${spot.phone}</div>` : '';

        const contentDiv = document.createElement('div');
        contentDiv.style.padding = '10px';
        contentDiv.style.minWidth = '200px';

        contentDiv.innerHTML = `
          <strong style="color:#2563eb;">📍 ${spot.name}</strong><br/>
          <span style="color:#666;font-size:12px;">${getSpotTypeLabel(spot.type)}</span>
          ${spot.description ? `<div style="margin-top:5px;">${spot.description}</div>` : ''}
          ${ratingHtml}
          ${addressHtml}
          ${phoneHtml}
          <div style="margin-top:10px;text-align:center;">
            <button 
              id="spot-detail-btn-${spot.id}" 
              style="background:#2563eb;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;">
              상세보기
            </button>
          </div>
        `;

        const infowindow = new kakao.maps.InfoWindow({ content: contentDiv });
        infowindow.open(mapInstanceRef.current!, marker);

        const detailBtn = contentDiv.querySelector(`#spot-detail-btn-${spot.id}`);
        if (detailBtn) {
          detailBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const handler = onSpotClickRef.current;
            if (handler) handler(spot);
            infowindow.close();
          });
        }
      });

      spotMarkersRef.current.push(marker);
    });
  }, [nearbySpots, showSpots, isLoaded]);
  /* ---------------------------------------
   * GPS 모드 복귀 버튼
   ----------------------------------------*/
   const moveToCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('이 브라우저는 위치 서비스를 지원하지 않습니다.');
      return;
    }

    // 수동 모드 해제
    isManuallyAdjustedRef.current = false;
    manualLocationRef.current = null;
    lastGpsUpdateRef.current = null; // GPS 업데이트 캐시 초기화

    // GPS watchPosition 재시작 (autoLocation이 true일 때만)
    if (autoLocation && isLoaded) {
      // 기존 watch 제거
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      // watchPosition 재시작
      // watchId를 먼저 null로 설정
      watchIdRef.current = null;
      
      const newWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          // 🔥 가장 먼저 체크: watch ID가 유효한지 확인 (clearWatch 후 호출된 콜백 차단)
          // watchIdRef.current가 null이면 이미 clearWatch가 호출된 것이므로 무시
          if (watchIdRef.current === null) {
            return; // 로그도 출력하지 않음
          }

          // 🔥 두 번째 체크: watch ID가 클로저의 watchId와 일치하는지 확인
          // watchIdRef.current가 클로저의 watchId와 다르면 다른 watch의 콜백이므로 무시
          if (watchIdRef.current !== newWatchId) {
            return; // 로그도 출력하지 않음
          }

          // 🔥 세 번째 체크: 수동 모드면 즉시 무시 (로그도 출력 안 함)
          if (isManuallyAdjustedRef.current) {
            return; // 로그도 출력하지 않음
          }

          // 🔥 네 번째 체크: 수동 모드 재확인 (콜백 실행 중에 변경될 수 있음)
          if (isManuallyAdjustedRef.current) {
            return; // 로그도 출력하지 않음
          }

          const { latitude: lat, longitude: lng } = pos.coords;
          const now = Date.now();

          // 같은 위치의 중복 업데이트 방지 (1초 이내 같은 위치면 무시)
          if (lastGpsUpdateRef.current) {
            const { lat: lastLat, lng: lastLng, timestamp } = lastGpsUpdateRef.current;
            const timeDiff = now - timestamp;
            const latDiff = Math.abs(lat - lastLat);
            const lngDiff = Math.abs(lng - lastLng);
            
            // 1초 이내이고 위치 차이가 매우 작으면 무시 (GPS 노이즈 필터링)
            if (timeDiff < 1000 && latDiff < 0.0001 && lngDiff < 0.0001) {
              return;
            }
          }

          console.log("📌 GPS 업데이트:", lat, lng);
          lastGpsUpdateRef.current = { lat, lng, timestamp: now };

          setCurrentLocation({ lat, lng });
          setMarkerPosition(lat, lng);
        },
        (err) => console.warn("GPS 오류:", err.message),
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 10000 }
      );
      
      watchIdRef.current = newWatchId;
    }

    // 현재 위치로 이동
    navigator.geolocation.getCurrentPosition((pos) => {
      // 수동 모드로 변경되었는지 확인
      if (isManuallyAdjustedRef.current) {
        return; // 수동 모드면 무시
      }
      
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      setMarkerPosition(lat, lng);
      setCurrentLocation({ lat, lng });
    });
  };

  /* ---------------------------------------
   * Render
   ----------------------------------------*/
  return (
    <div className="relative" style={{ width: '100%', height }}>
      <div
        ref={mapRef}
        style={{ width: '100%', height }}
        className={['rounded-lg', className].filter(Boolean).join(' ')}
      />

      {/* 위험 스팟 리스트 토글 버튼 */}
      {showHazards && (
        <button
          onClick={() => setShowHazardList(!showHazardList)}
          className="absolute top-4 left-4 bg-white text-red-600 px-4 py-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors flex items-center gap-2 z-10 border border-red-200"
          title="위험 스팟 목록"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          위험 스팟 {filteredHazards.length > 0 && `(${filteredHazards.length})`}
        </button>
      )}

      {/* 위험 스팟 리스트 패널 */}
      {showHazards && showHazardList && (
        <div className={`absolute top-16 left-4 bg-white rounded-lg shadow-xl z-20 w-80 max-h-[calc(100%-5rem)] overflow-hidden flex flex-col border border-gray-200`}>
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-red-600">위험 스팟</h3>
              <button
                onClick={() => setShowHazardList(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {/* 카테고리 필터 */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedHazardCategory('ALL')}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  selectedHazardCategory === 'ALL'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              {(['LEASH', 'MUZZLE', 'AGGRESSIVE_DOG', 'HAZARDOUS_MATERIAL', 'WILDLIFE', 'LOW_LIGHT', 'BIKE_CAR', 'POOP_LEFT', 'OTHER'] as HazardCategory[]).map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedHazardCategory(category)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    selectedHazardCategory === category
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {getHazardCategoryLabel(category)}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredHazards.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>주변에 위험 스팟이 없습니다.</p>
              </div>
            ) : (
              filteredHazards.map((hazard) => {
                // 위치 우선순위: 수동 조정 위치 > GPS 위치 > 기본 위치
                const lat = manualLocationRef.current?.lat ?? currentLocation?.lat ?? centerLat;
                const lng = manualLocationRef.current?.lng ?? currentLocation?.lng ?? centerLng;
                const distance = calculateDistance(lat, lng, hazard.latitude, hazard.longitude);
                
                return (
                  <div
                    key={hazard.id}
                    onClick={() => {
                      if (onMarkerClickRef.current) {
                        onMarkerClickRef.current(hazard);
                      }
                      // 지도 중심 이동
                      if (mapInstanceRef.current) {
                        const pos = new kakao.maps.LatLng(hazard.latitude, hazard.longitude);
                        mapInstanceRef.current.setCenter(pos);
                        mapInstanceRef.current.setLevel(3);
                      }
                    }}
                    className="p-4 border-b border-gray-100 hover:bg-red-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-red-600">⚠️ {getHazardCategoryLabel(hazard.category as HazardCategory)}</span>
                        </div>
                        {hazard.description && (
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{hazard.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <span>📍</span>
                            <span>{Math.round(distance)}m</span>
                          </span>
                          {hazard.reporterNickname && (
                            <span className="text-gray-400">신고자: {hazard.reporterNickname}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 스팟 리스트 토글 버튼 */}
      {showSpots && (
        <button
          onClick={() => setShowSpotList(!showSpotList)}
          className={`absolute top-4 ${showHazards ? 'left-48' : 'left-4'} bg-white text-gray-800 px-4 py-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors flex items-center gap-2 z-10 border border-gray-200`}
          title="주변 스팟 목록"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
          주변 스팟 {nearbySpots.length > 0 && `(${nearbySpots.length})`}
        </button>
      )}

      {/* 스팟 리스트 패널 */}
      {showSpots && showSpotList && (
        <div className={`absolute top-16 ${showHazards && showHazardList ? 'left-48' : 'left-4'} bg-white rounded-lg shadow-xl z-20 w-80 max-h-[calc(100%-5rem)] overflow-hidden flex flex-col border border-gray-200`}>
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">주변 스팟</h3>
              <button
                onClick={() => setShowSpotList(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {/* 카테고리 필터 */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  selectedCategory === 'ALL'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              {(['CAFE', 'HOSPITAL', 'PARK', 'STORE', 'RESTAURANT', 'OTHER'] as SpotType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedCategory(type)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    selectedCategory === type
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {getSpotTypeLabel(type)}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {nearbySpots.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>주변에 스팟이 없습니다.</p>
              </div>
            ) : (
              nearbySpots.map((spot) => (
              <div
                key={spot.id}
                onClick={() => {
                  if (onSpotClickRef.current) {
                    onSpotClickRef.current(spot);
                  }
                  // 지도 중심 이동
                  if (mapInstanceRef.current) {
                    const pos = new kakao.maps.LatLng(spot.latitude, spot.longitude);
                    mapInstanceRef.current.setCenter(pos);
                    mapInstanceRef.current.setLevel(3);
                  }
                }}
                className="p-4 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{spot.name}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {getSpotTypeLabel(spot.type)}
                      </span>
                    </div>
                    {spot.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{spot.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {spot.rating && (
                        <span className="flex items-center gap-1">
                          <span>⭐</span>
                          <span>{spot.rating.toFixed(1)}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <span>📍</span>
                        <span>{Math.round(spot.distance || 0)}m</span>
                      </span>
                    </div>
                    {spot.address && (
                      <p className="text-xs text-gray-400 mt-1">{spot.address}</p>
                    )}
                  </div>
                </div>
              </div>
              ))
            )}
          </div>
        </div>
      )}

      {autoLocation && (
        <button
          onClick={moveToCurrentLocation}
          className="absolute bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-600 transition-colors flex items-center gap-2 z-10"
          title="현재 위치로 이동"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          현재 위치
        </button>
      )}
    </div>
  );
}
