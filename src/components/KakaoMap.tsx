import { useEffect, useRef, useState } from 'react';
import { useKakaoLoader } from '../lib/useKakaoLoader';
import axios from 'axios';

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
  /** 지도 중심 위도 */
  centerLat?: number;
  /** 지도 중심 경도 */
  centerLng?: number;
  /** 지도 확대 레벨 (1~14) */
  level?: number;
  /** 지도 높이 (CSS 값) */
  height?: string;
  /** 현재 위치 자동 감지 */
  autoLocation?: boolean;
  /** 위험 지역 표시 여부 */
  showHazards?: boolean;
  /** 스팟 표시 여부 */
  showSpots?: boolean;
  /** 스팟 데이터 배열 (props로 전달) */
  spots?: SpotData[];
  /** 위험 요소 등록 모드 활성화 */
  enableHazardReport?: boolean;
  /** 위험 스팟 마커 클릭 핸들러 */
  onMarkerClick?: (hazard: HazardData) => void;
  /** 스팟 마커 클릭 핸들러 */
  onSpotClick?: (spot: SpotData) => void;
  /** 지도 클릭 핸들러 (위험 요소 등록용) */
  onMapClick?: (latitude: number, longitude: number) => void;
  /** 위험 요소 목록 새로고침 콜백 */
  onHazardsRefresh?: () => void;
}

interface HazardData {
  id: number;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  reporterNickname?: string;
  createdAt: string;
}

export default function KakaoMap({
  centerLat = 37.5665,
  centerLng = 126.9780,
  level = 3,
  height = '400px',
  autoLocation = false,
  showHazards = true,
  showSpots = false,
  spots = [],
  enableHazardReport = false,
  onMarkerClick,
  onSpotClick,
  onMapClick,
  onHazardsRefresh,
}: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);
  const spotMarkersRef = useRef<kakao.maps.Marker[]>([]);
  const { isLoaded, error } = useKakaoLoader();
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hazards, setHazards] = useState<HazardData[]>([]);

  // 현재 위치 가져오기
  useEffect(() => {
    if (!autoLocation || !isLoaded) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          if (mapInstanceRef.current) {
            const moveLatLon = new kakao.maps.LatLng(latitude, longitude);
            mapInstanceRef.current.setCenter(moveLatLon);
          }
        },
        (error) => {
          console.error('위치 정보를 가져올 수 없습니다:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    }
  }, [autoLocation, isLoaded]);

  // 지도 초기화
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const lat = currentLocation?.lat ?? centerLat;
    const lng = currentLocation?.lng ?? centerLng;

    const container = mapRef.current;
    const options = {
      center: new kakao.maps.LatLng(lat, lng),
      level: level,
    };

    const map = new kakao.maps.Map(container, options);
    mapInstanceRef.current = map;

    // 현재 위치 마커 표시
    if (currentLocation) {
      const markerPosition = new kakao.maps.LatLng(currentLocation.lat, currentLocation.lng);
      const marker = new kakao.maps.Marker({
        position: markerPosition,
        map: map,
      });

      // 커스텀 이미지로 현재 위치 표시 (선택사항)
      const imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png';
      const imageSize = new kakao.maps.Size(24, 35);
      const imageOption = { offset: new kakao.maps.Point(12, 35) };
      const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
      marker.setImage(markerImage);
    }
  }, [isLoaded, centerLat, centerLng, level, currentLocation]);

  // 지도 클릭 이벤트 (위험 요소 등록용)
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !enableHazardReport) return;

    const clickHandler = (mouseEvent: kakao.maps.event.MouseEvent) => {
      const latlng = mouseEvent.latLng;
      if (latlng && onMapClick) {
        onMapClick(latlng.getLat(), latlng.getLng());
      }
    };

    kakao.maps.event.addListener(mapInstanceRef.current, 'click', clickHandler);

    return () => {
      if (mapInstanceRef.current) {
        kakao.maps.event.removeListener(mapInstanceRef.current, 'click', clickHandler);
      }
    };
  }, [isLoaded, enableHazardReport, onMapClick]);

  // 위험 지역 가져오기
  useEffect(() => {
    if (!showHazards || !isLoaded || !mapInstanceRef.current) return;

    const lat = currentLocation?.lat ?? centerLat;
    const lng = currentLocation?.lng ?? centerLng;

    const fetchHazards = async () => {
      try {
        const response = await axios.get('/api/hazards/nearby', {
          params: {
            latitude: lat,
            longitude: lng,
            radius: 2000, // 2km 반경
          },
        });

        if (response.data.success && response.data.data) {
          setHazards(response.data.data);
        }
      } catch (error) {
        console.error('위험 지역 조회 실패:', error);
      }
    };

    fetchHazards();
  }, [showHazards, isLoaded, centerLat, centerLng, currentLocation]);


  // 스팟 타입별 마커 색상 및 아이콘
  const getSpotMarkerImage = (type: SpotType): string => {
    const markerColors: Record<SpotType, string> = {
      CAFE: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_orange.png',
      HOSPITAL: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_blue.png',
      PARK: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_green.png',
      STORE: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_purple.png',
      RESTAURANT: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png',
      OTHER: 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_yellow.png',
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

  // 위험 지역 마커 표시
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || hazards.length === 0) return;

    // 기존 위험 지역 마커 제거
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // 위험 지역 마커 추가
    hazards.forEach((hazard) => {
      const markerPosition = new kakao.maps.LatLng(hazard.latitude, hazard.longitude);
      const marker = new kakao.maps.Marker({
        position: markerPosition,
        map: mapInstanceRef.current!,
      });

      // 위험 지역 마커는 빨간색으로 표시
      const imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png';
      const imageSize = new kakao.maps.Size(24, 35);
      const imageOption = { offset: new kakao.maps.Point(12, 35) };
      const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
      marker.setImage(markerImage);

      // 마커 클릭 이벤트
      kakao.maps.event.addListener(marker, 'click', () => {
        if (onMarkerClick) {
          onMarkerClick(hazard);
        } else {
          // 기본 동작: 인포윈도우 표시
          const infowindow = new kakao.maps.InfoWindow({
            content: `
              <div style="padding:10px;min-width:200px;">
                <strong style="color:#dc2626;">⚠️ ${hazard.category}</strong><br/>
                ${hazard.description || '설명 없음'}<br/>
                <small style="color:#666;">신고자: ${hazard.reporterNickname || '알 수 없음'}</small>
              </div>
            `,
          });
          infowindow.open(mapInstanceRef.current!, marker);
        }
      });

      markersRef.current.push(marker);
    });
  }, [hazards, isLoaded, onMarkerClick]);

  // 스팟 마커 표시
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !showSpots || spots.length === 0) {
      // 스팟이 표시되지 않을 때는 기존 스팟 마커 제거
      spotMarkersRef.current.forEach((marker) => marker.setMap(null));
      spotMarkersRef.current = [];
      return;
    }

    // 기존 스팟 마커 제거
    spotMarkersRef.current.forEach((marker) => marker.setMap(null));
    spotMarkersRef.current = [];

    // 스팟 마커 추가
    spots.forEach((spot) => {
      const markerPosition = new kakao.maps.LatLng(spot.latitude, spot.longitude);
      const marker = new kakao.maps.Marker({
        position: markerPosition,
        map: mapInstanceRef.current!,
      });

      // 스팟 타입별 마커 이미지 설정
      const imageSrc = getSpotMarkerImage(spot.type);
      const imageSize = new kakao.maps.Size(24, 35);
      const imageOption = { offset: new kakao.maps.Point(12, 35) };
      const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
      marker.setImage(markerImage);

      // 마커 클릭 이벤트
      kakao.maps.event.addListener(marker, 'click', () => {
        if (onSpotClick) {
          onSpotClick(spot);
        } else {
          // 기본 동작: 인포윈도우 표시
          const ratingHtml = spot.rating 
            ? `<div style="margin-top:5px;">⭐ ${spot.rating.toFixed(1)}</div>` 
            : '';
          const addressHtml = spot.address 
            ? `<div style="margin-top:5px;color:#666;font-size:12px;">📍 ${spot.address}</div>` 
            : '';
          const phoneHtml = spot.phone 
            ? `<div style="margin-top:5px;color:#666;font-size:12px;">📞 ${spot.phone}</div>` 
            : '';
          
          const infowindow = new kakao.maps.InfoWindow({
            content: `
              <div style="padding:10px;min-width:200px;">
                <strong style="color:#2563eb;">📍 ${spot.name}</strong><br/>
                <span style="color:#666;font-size:12px;">${getSpotTypeLabel(spot.type)}</span>
                ${spot.description ? `<div style="margin-top:5px;">${spot.description}</div>` : ''}
                ${ratingHtml}
                ${addressHtml}
                ${phoneHtml}
              </div>
            `,
          });
          infowindow.open(mapInstanceRef.current!, marker);
        }
      });

      spotMarkersRef.current.push(marker);
    });
  }, [spots, showSpots, isLoaded, onSpotClick]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <p className="text-red-500">맵 로드 실패: {error.message}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <p className="text-gray-500">맵 로딩 중...</p>
      </div>
    );
  }

  return <div ref={mapRef} style={{ width: '100%', height }} className="rounded-lg" />;
}


