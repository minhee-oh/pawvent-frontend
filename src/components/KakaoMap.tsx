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
  /** 현재 위치 변경 핸들러 */
  onLocationChange?: (latitude: number, longitude: number) => void;
  /** 현재 위치 마커를 드래그 가능하게 할지 여부 */
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
  showHazards = true,
  showSpots = false,
  spots = [],
  enableHazardReport = false,
  draggableLocationMarker = true,
  onMarkerClick,
  onSpotClick,
  onMapClick,
  onHazardsRefresh,
  onLocationChange,
}: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<kakao.maps.Map | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);
  const spotMarkersRef = useRef<kakao.maps.Marker[]>([]);
  const currentLocationMarkerRef = useRef<kakao.maps.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const isManuallyAdjustedRef = useRef<boolean>(false);
  const { isLoaded, error } = useKakaoLoader();
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hazards, setHazards] = useState<HazardData[]>([]);

  // 현재 위치 가져오기 (지속적으로 업데이트, 수동 조정 시 일시 중지)
  useEffect(() => {
    if (!autoLocation || !isLoaded) {
      // GPS 추적 중지
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    // 수동 조정된 경우 GPS 추적하지 않음
    if (isManuallyAdjustedRef.current) {
      return;
    }

    if (!navigator.geolocation) {
      console.warn('GPS가 지원되지 않습니다.');
      return;
    }

    // 기존 watch 중지
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // 첫 위치 가져오기 (타임아웃 시간 증가 및 에러 처리 개선)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (isManuallyAdjustedRef.current) return; // 수동 조정 중이면 무시
        
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        if (mapInstanceRef.current) {
          const moveLatLon = new kakao.maps.LatLng(latitude, longitude);
          mapInstanceRef.current.setCenter(moveLatLon);
        }
      },
      (error) => {
        // 타임아웃 에러는 조용히 처리 (사용자 경험 개선)
        if (error.code === 3) {
          // 타임아웃: 캐시된 위치 사용 시도
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (isManuallyAdjustedRef.current) return;
              const { latitude, longitude } = position.coords;
              setCurrentLocation({ lat: latitude, lng: longitude });
              if (mapInstanceRef.current) {
                const moveLatLon = new kakao.maps.LatLng(latitude, longitude);
                mapInstanceRef.current.setCenter(moveLatLon);
              }
            },
            () => {
              // 캐시된 위치도 없으면 조용히 실패 (현재 위치 유지)
            },
            {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 300000, // 5분 이내 캐시된 위치 사용
            }
          );
        } else if (error.code === 1) {
          // 권한 거부: 조용히 처리
          console.warn('위치 권한이 거부되었습니다.');
        } else {
          // 기타 에러: 조용히 처리
          console.warn('위치 정보를 가져올 수 없습니다:', error.message);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000, // 타임아웃 시간 증가 (10초 -> 20초)
        maximumAge: 60000, // 1분 이내 캐시된 위치 사용 가능
      }
    );

    // 위치 추적 시작 (지속적으로 업데이트, 수동 조정 시 업데이트 안 함)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (isManuallyAdjustedRef.current) return; // 수동 조정 중이면 GPS 업데이트 무시
        
        const { latitude, longitude } = position.coords;
        const newLocation = { lat: latitude, lng: longitude };
        setCurrentLocation(newLocation);
        // 지도 중심은 자동으로 이동하지 않음 (사용자 경험 개선)
      },
      (error) => {
        // 위치 추적 오류는 조용히 처리 (첫 위치 가져오기에서 이미 처리됨)
        if (error.code !== 1) { // 권한 거부가 아닌 경우만 로그
          console.warn('위치 추적 오류:', error.message);
        }
      },
      {
        enableHighAccuracy: false, // 배터리 절약 및 빠른 응답을 위해 false
        timeout: 15000, // 타임아웃 시간 증가
        maximumAge: 5000, // 5초 이내의 캐시된 위치 사용
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
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

  }, [isLoaded, centerLat, centerLng, level]);

  // 현재 위치 마커 생성 및 업데이트
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;

    const lat = currentLocation?.lat ?? centerLat;
    const lng = currentLocation?.lng ?? centerLng;

    // 기존 마커 제거
    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.setMap(null);
      currentLocationMarkerRef.current = null;
    }

    // 현재 위치 마커 생성
    const markerPosition = new kakao.maps.LatLng(lat, lng);
    const marker = new kakao.maps.Marker({
      position: markerPosition,
      map: mapInstanceRef.current,
      draggable: draggableLocationMarker,
      title: isManuallyAdjustedRef.current 
        ? '수동 조정된 위치 (드래그하여 이동, 내 위치로 버튼으로 GPS 복귀)' 
        : '현재 위치 (드래그하여 정확한 위치로 이동)',
    });

    // 커스텀 이미지로 현재 위치 표시 (수동 조정 시 다른 색상)
    const imageSrc = isManuallyAdjustedRef.current
      ? 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_orange.png' // 수동 조정 시 주황색
      : 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png'; // GPS 위치 시 빨간색
    const imageSize = new kakao.maps.Size(24, 35);
    const imageOption = { offset: new kakao.maps.Point(12, 35) };
    const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);
    marker.setImage(markerImage);

    // 마커 드래그 이벤트
    if (draggableLocationMarker) {
      kakao.maps.event.addListener(marker, 'dragstart', () => {
        // 드래그 시작 시 수동 조정 모드 활성화
        isManuallyAdjustedRef.current = true;
      });
      
      kakao.maps.event.addListener(marker, 'dragend', () => {
        const position = marker.getPosition();
        const newLat = position.getLat();
        const newLng = position.getLng();
        isManuallyAdjustedRef.current = true; // 수동 조정 완료
        setCurrentLocation({ lat: newLat, lng: newLng }); // 상태 업데이트로 마커 재생성
        
        // 지도 중심을 드래그한 위치로 이동
        if (mapInstanceRef.current) {
          const moveLatLon = new kakao.maps.LatLng(newLat, newLng);
          mapInstanceRef.current.setCenter(moveLatLon);
        }
        
        if (onLocationChange) {
          onLocationChange(newLat, newLng);
        }
      });
    }

    currentLocationMarkerRef.current = marker;
  }, [isLoaded, currentLocation, centerLat, centerLng, draggableLocationMarker, onLocationChange]);

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
      } catch (error: any) {
        console.error('위험 지역 조회 실패:', error);
        console.error('에러 상세:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText,
        });
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
        console.log('위험 스팟 마커 클릭:', hazard.id, 'onMarkerClick:', !!onMarkerClick);
        if (onMarkerClick) {
          // onMarkerClick이 있으면 모달 표시
          console.log('onMarkerClick 호출:', hazard);
          onMarkerClick(hazard);
        } else {
          // 기본 동작: 인포윈도우 표시 (상세보기 버튼 포함)
          const contentDiv = document.createElement('div');
          contentDiv.style.padding = '10px';
          contentDiv.style.minWidth = '200px';
          contentDiv.innerHTML = `
            <strong style="color:#dc2626;">⚠️ ${hazard.category}</strong><br/>
            ${hazard.description ? `<div style="margin-top:5px;">${hazard.description}</div>` : '<div style="margin-top:5px;">설명 없음</div>'}
            <small style="color:#666;">신고자: ${hazard.reporterNickname || '알 수 없음'}</small>
            <div style="margin-top:10px;text-align:center;">
              <button 
                id="hazard-detail-btn-${hazard.id}" 
                style="background:#dc2626;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;"
              >
                상세보기
              </button>
            </div>
          `;
          
          // 상세보기 버튼 클릭 이벤트 리스너 추가
          const detailBtn = contentDiv.querySelector(`#hazard-detail-btn-${hazard.id}`);
          if (detailBtn) {
            detailBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('인포윈도우 상세보기 버튼 클릭:', hazard);
              if (onMarkerClick) {
                onMarkerClick(hazard);
                infowindow.close();
              }
            });
          }
          
          // 인포윈도우 전체 클릭 시에도 모달 열기
          contentDiv.style.cursor = 'pointer';
          contentDiv.addEventListener('click', (e) => {
            // 버튼 클릭이 아닌 경우에만
            if (!(e.target as HTMLElement).closest('button')) {
              console.log('인포윈도우 클릭:', hazard);
              if (onMarkerClick) {
                onMarkerClick(hazard);
                infowindow.close();
              }
            }
          });
          
          const infowindow = new kakao.maps.InfoWindow({
            content: contentDiv,
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
        console.log('스팟 마커 클릭:', spot.name, 'onSpotClick:', !!onSpotClick);
        if (onSpotClick) {
          // onSpotClick이 있으면 모달 표시
          console.log('onSpotClick 호출:', spot);
          onSpotClick(spot);
        } else {
          // 기본 동작: 인포윈도우 표시 (상세보기 버튼 포함)
          const ratingHtml = spot.rating 
            ? `<div style="margin-top:5px;">⭐ ${spot.rating.toFixed(1)}</div>` 
            : '';
          const addressHtml = spot.address 
            ? `<div style="margin-top:5px;color:#666;font-size:12px;">📍 ${spot.address}</div>` 
            : '';
          const phoneHtml = spot.phone 
            ? `<div style="margin-top:5px;color:#666;font-size:12px;">📞 ${spot.phone}</div>` 
            : '';
          
          // 상세보기 버튼 추가
          const detailButtonHtml = `
            <div style="margin-top:10px;text-align:center;">
              <button 
                id="spot-detail-btn-${spot.id}" 
                style="background:#2563eb;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;"
                onclick="window.dispatchEvent(new CustomEvent('spotDetailClick', {detail: ${JSON.stringify(spot)}}))"
              >
                상세보기
              </button>
            </div>
          `;
          
          // 인포윈도우 컨텐츠 생성
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
            ${detailButtonHtml}
          `;
          
          // 상세보기 버튼 클릭 이벤트 리스너 추가
          const detailBtn = contentDiv.querySelector(`#spot-detail-btn-${spot.id}`);
          if (detailBtn) {
            detailBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('인포윈도우 상세보기 버튼 클릭:', spot);
              if (onSpotClick) {
                onSpotClick(spot);
              }
              infowindow.close();
            });
          }
          
          // 인포윈도우 전체 클릭 시에도 모달 열기
          contentDiv.style.cursor = 'pointer';
          contentDiv.addEventListener('click', (e) => {
            // 버튼 클릭이 아닌 경우에만
            if (!(e.target as HTMLElement).closest('button')) {
              console.log('인포윈도우 클릭:', spot);
              if (onSpotClick) {
                onSpotClick(spot);
                infowindow.close();
              }
            }
          });
          
          const infowindow = new kakao.maps.InfoWindow({
            content: contentDiv,
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

  const moveToCurrentLocation = () => {
    if (!mapInstanceRef.current) return;
    
    // 수동 조정 모드 해제하고 GPS 위치로 복귀
    isManuallyAdjustedRef.current = false;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // 상태 업데이트로 마커 재생성 (색상 변경)
          setCurrentLocation({ lat: latitude, lng: longitude });
          if (mapInstanceRef.current) {
            const moveLatLon = new kakao.maps.LatLng(latitude, longitude);
            mapInstanceRef.current.setCenter(moveLatLon);
          }
        },
        (error) => {
          // 모든 에러는 조용히 처리 (콘솔 로그 제거)
          if (error.code === 3) {
            // 타임아웃: 캐시된 위치 사용 시도
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude } = position.coords;
                setCurrentLocation({ lat: latitude, lng: longitude });
                if (mapInstanceRef.current) {
                  const moveLatLon = new kakao.maps.LatLng(latitude, longitude);
                  mapInstanceRef.current.setCenter(moveLatLon);
                }
              },
              () => {
                // 캐시된 위치도 없으면 현재 위치 유지
                if (currentLocation) {
                  const moveLatLon = new kakao.maps.LatLng(currentLocation.lat, currentLocation.lng);
                  mapInstanceRef.current?.setCenter(moveLatLon);
                }
              },
              {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 300000, // 5분 이내 캐시된 위치 사용
              }
            );
          } else {
            // 기타 에러: 현재 위치 유지 (에러 로그 없음)
            if (currentLocation) {
              const moveLatLon = new kakao.maps.LatLng(currentLocation.lat, currentLocation.lng);
              mapInstanceRef.current?.setCenter(moveLatLon);
            }
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 20000, // 타임아웃 시간 증가
          maximumAge: 60000, // 1분 이내 캐시된 위치 사용 가능
        }
      );
    } else if (currentLocation) {
      const moveLatLon = new kakao.maps.LatLng(currentLocation.lat, currentLocation.lng);
      mapInstanceRef.current.setCenter(moveLatLon);
    }
  };

  return (
    <div className="relative" style={{ width: '100%', height }}>
      <div ref={mapRef} style={{ width: '100%', height }} className="rounded-lg" />
      {autoLocation && (
        <button
          onClick={moveToCurrentLocation}
          className="absolute bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-600 transition-colors flex items-center gap-2 z-10"
          title="현재 위치로 이동"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          현재 위치
        </button>
      )}
    </div>
  );
}


