import { useEffect, useState } from 'react';

/**
 * 카카오 맵 SDK를 로드하는 커스텀 훅
 * @returns SDK 로드 완료 여부
 */
export const useKakaoLoader = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // 이미 로드되어 있는지 확인
    if (window.kakao && window.kakao.maps) {
      setIsLoaded(true);
      return;
    }

    const scriptId = 'kakao-maps-script';
    const existingScript = document.getElementById(scriptId);

    // 이미 스크립트가 로드 중이면 중복 로드 방지
    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if (window.kakao && window.kakao.maps) {
          setIsLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
      return () => clearInterval(checkLoaded);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${import.meta.env.VITE_KAKAO_JS_KEY}&libraries=services,clusterer&autoload=false`;
    script.async = true;

    script.onload = () => {
      // 카카오 맵 SDK가 로드되면 초기화
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          setIsLoaded(true);
        });
      }
    };

    script.onerror = () => {
      const err = new Error('카카오 맵 SDK를 로드하는데 실패했습니다.');
      setError(err);
      setIsLoaded(false);
    };

    document.head.appendChild(script);

    return () => {
      // 컴포넌트 언마운트 시 스크립트는 유지 (다른 컴포넌트에서 사용 가능)
      // 필요시 제거하려면 주석 해제
      // const scriptElement = document.getElementById(scriptId);
      // if (scriptElement) {
      //   scriptElement.remove();
      // }
    };
  }, []);

  return { isLoaded, error };
};









