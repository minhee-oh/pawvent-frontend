// 카카오 맵 SDK 타입 선언
declare namespace kakao.maps {
  interface LatLng {
    getLat(): number;
    getLng(): number;
  }

  class LatLng {
    constructor(lat: number, lng: number);
  }

  interface MapOptions {
    center: LatLng;
    level: number;
  }

  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    setCenter(latlng: LatLng): void;
    setLevel(level: number): void;
    getCenter(): LatLng;
    getLevel(): number;
    relayout(): void;
    panTo(target: LatLng): void;
  }

  interface MarkerOptions {
    position: LatLng;
    map?: Map;
    image?: MarkerImage;
    title?: string;
    clickable?: boolean;
    zIndex?: number;
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
    setPosition(position: LatLng): void;
    getPosition(): LatLng;
  }

  interface MarkerImageOptions {
    src: string;
    size?: Size;
    options?: {
      offset?: Point;
      alt?: string;
      shape?: string;
      coords?: string;
      spriteOrigin?: Point;
      spriteSize?: Size;
    };
  }

  class MarkerImage {
    constructor(src: string, size?: Size, options?: MarkerImageOptions['options']);
  }

  class Size {
    constructor(width: number, height: number);
  }

  class Point {
    constructor(x: number, y: number);
  }

  interface InfoWindowOptions {
    content?: string | HTMLElement;
    position?: LatLng;
    removable?: boolean;
    zIndex?: number;
  }

  class InfoWindow {
    constructor(options?: InfoWindowOptions);
    open(map: Map, marker: Marker): void;
    close(): void;
    setContent(content: string | HTMLElement): void;
    setPosition(position: LatLng): void;
  }

  namespace event {
    function addListener(target: any, type: string, handler: () => void): void;
    function removeListener(target: any, type: string, handler: () => void): void;
  }

  namespace services {
    class Geocoder {
      constructor();
      addressSearch(
        addr: string,
        callback: (result: AddressSearchResult[], status: Status) => void
      ): void;
      coord2Address(
        coord: LatLng,
        callback: (result: Coord2AddressResult[], status: Status) => void
      ): void;
    }

    enum Status {
      OK = 'OK',
      ZERO_RESULT = 'ZERO_RESULT',
      ERROR = 'ERROR',
    }

    interface AddressSearchResult {
      address: {
        address_name: string;
        y: string;
        x: string;
        road_address?: {
          address_name: string;
          y: string;
          x: string;
          building_name?: string;
        };
      };
    }

    interface Coord2AddressResult {
      address: {
        address_name: string;
        road_address?: {
          address_name: string;
          building_name?: string;
        };
      };
    }
  }

  namespace clusterer {
    interface ClustererOptions {
      map: Map;
      markers: Marker[];
      gridSize?: number;
      minClusterSize?: number;
      averageCenter?: boolean;
      minLevel?: number;
      disableClickZoom?: boolean;
      calculator?: number[];
      styles?: any[];
    }

    class MarkerClusterer {
      constructor(options: ClustererOptions);
      addMarker(marker: Marker, nodraw?: boolean): void;
      addMarkers(markers: Marker[], nodraw?: boolean): void;
      removeMarker(marker: Marker, nodraw?: boolean): void;
      removeMarkers(markers: Marker[], nodraw?: boolean): void;
      clear(): void;
      getClusters(): any[];
      getClusterSize(): number;
      getMap(): Map;
      setGridSize(gridSize: number): void;
      setMinClusterSize(size: number): void;
      setAverageCenter(averageCenter: boolean): void;
      setMinLevel(minLevel: number): void;
      redraw(): void;
    }
  }
}

// 전역 window 객체에 kakao 추가
interface Window {
  kakao: typeof kakao;
}

declare const kakao: {
  maps: typeof kakao.maps;
};

