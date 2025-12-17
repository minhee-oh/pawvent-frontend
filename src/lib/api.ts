import axios from 'axios';

// API 기본 URL 설정
export const getApiBaseUrl = () => {
  // 1) 명시적 설정이 있으면 우선 사용
  // - 예: VITE_API_BASE_URL=http://192.168.0.10:8081/api
  // - 예: VITE_API_BASE_URL=/api (리버스 프록시/동일 오리진)
  const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined
  if (envBase && typeof envBase === 'string') return envBase

  // 2) 기본은 항상 '/api'를 사용 (Vite dev proxy 또는 동일 오리진 프록시)
  // iOS HTTPS 테스트 시, 프론트(https) → 백엔드(http) 직접 호출은 Mixed Content로 막히므로
  // 개발 환경에서는 반드시 프론시를 타도록 '/api' 고정이 안전합니다.
  return '/api'
};

// API_BASE_URL은 getApiBaseUrl() 함수로 동적으로 가져옴

// Axios 인스턴스 생성 (동적 baseURL을 위해 함수로 생성)
const createApiClient = () => {
  const baseURL = getApiBaseUrl();
  const client = axios.create({
    baseURL: baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // 요청 인터셉터 - 인증 토큰 추가 및 디버깅
  client.interceptors.request.use(
    (config) => {
      // 매 요청마다 최신 baseURL 사용 (모바일 접속 시 IP 변경 대응)
      const currentBaseURL = getApiBaseUrl();
      config.baseURL = currentBaseURL;
      
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // 디버깅: 요청 URL 확인
      console.log('API 요청:', currentBaseURL + config.url);
      console.log('전체 URL:', config.baseURL + config.url);
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // 응답 인터셉터 - 에러 처리 및 디버깅
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      // 디버깅: 상세 에러 정보 출력
      if (error.config) {
        console.error('API 에러:', {
          url: error.config.baseURL + error.config.url,
          method: error.config.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          data: error.response?.data,
        });
      }
      
      // 서버 응답이 있는 경우 더 자세한 로그
      if (error.response) {
        console.error('서버 응답 상세:', {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
          data: error.response.data,
        });
      }
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        // 인증 실패 또는 토큰 만료 시 로그인 페이지로 리다이렉트
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userNickname');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userProfileImageUrl');
        // 현재 페이지가 로그인 페이지가 아닐 때만 리다이렉트
        if (window.location.pathname !== '/login') {
        window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
  
  return client;
};

// API 클라이언트 인스턴스 생성
const apiClient = createApiClient();

// API 응답 타입
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

// 인증 관련 API
export const authApi = {
  // 테스트 엔드포인트 (백엔드 확인용)
  test: async () => {
    const response = await apiClient.get<ApiResponse<string>>('/auth/test');
    return response.data;
  },

  // 카카오 로그인
  kakaoLogin: async (accessToken: string) => {
    const response = await apiClient.post<ApiResponse<LoginResponse>>(
      '/auth/kakao/login',
      { accessToken }
    );
    return response.data;
  },

  // 현재 사용자 정보 조회
  getCurrentUser: async () => {
    const response = await apiClient.get<ApiResponse<any>>('/auth/me');
    return response.data;
  },
};

// 로그인 응답 타입
export interface LoginResponse {
  token: string;
  userId: number;
  email: string;
  nickname: string;
  profileImageUrl?: string;
}

// 산책 세션 관련 API
export const walkSessionApi = {
  // 산책 세션 시작
  start: async (petId: number, routeId?: number) => {
    const requestBody: any = { petId };
    if (routeId !== undefined && routeId !== null) {
      requestBody.routeId = routeId;
    }
    const response = await apiClient.post<ApiResponse<WalkSessionResponse>>(
      '/walk-sessions/start',
      requestBody
    );
    return response.data;
  },

  // 산책 세션 완료
  complete: async (
    sessionId: number,
    distance: number,
    duration: number,
    calories: number,
    imageUrls?: string[],
    memo?: string
  ) => {
    // 백엔드가 @RequestParam을 사용하므로 쿼리 파라미터로 전송
    const params = new URLSearchParams();
    params.append('distance', distance.toString());
    params.append('duration', duration.toString());
    params.append('calories', calories.toString());
    if (imageUrls && imageUrls.length > 0) {
      imageUrls.forEach(url => params.append('imageUrls', url));
    }
    if (memo) {
      params.append('memo', memo);
    }
    
    const response = await apiClient.post<ApiResponse<WalkSessionResponse>>(
      `/walk-sessions/${sessionId}/complete?${params.toString()}`,
      null
    );
    return response.data;
  },

  // 내 산책 세션 목록 조회
  getMySessions: async () => {
    const response = await apiClient.get<ApiResponse<WalkSessionResponse[]>>(
      '/walk-sessions/my'
    );
    return response.data;
  },

  // 내 완료된 산책 세션 목록 조회
  getMyCompletedSessions: async () => {
    const response = await apiClient.get<ApiResponse<WalkSessionResponse[]>>(
      '/walk-sessions/my/completed'
    );
    return response.data;
  },

  // 내 산책 세션 목록 페이지네이션 조회
  getMySessionsPaged: async (page: number = 0, size: number = 10) => {
    const response = await apiClient.get<ApiResponse<PageResponse<WalkSessionResponse>>>(
      '/walk-sessions/my/paged',
      { params: { page, size, sort: 'startTime,desc' } }
    );
    return response.data;
  },

  // 기간별 산책 세션 조회
  getMySessionsByRange: async (startDate: string, endDate: string) => {
    const response = await apiClient.get<ApiResponse<WalkSessionResponse[]>>(
      '/walk-sessions/my/range',
      { params: { startDate, endDate } }
    );
    return response.data;
  },

  // 산책 세션 단건 조회
  getById: async (sessionId: number) => {
    const response = await apiClient.get<ApiResponse<WalkSessionResponse>>(
      `/walk-sessions/${sessionId}`
    );
    return response.data;
  },

  // 최근 산책 세션 조회
  getRecent: async (limit: number = 5) => {
    const response = await apiClient.get<ApiResponse<WalkSessionResponse[]>>(
      '/walk-sessions/my/recent',
      { params: { limit } }
    );
    return response.data;
  },

  // 산책 통계 조회
  getStats: async (startDate: string, endDate: string) => {
    const response = await apiClient.get<ApiResponse<WalkStats>>(
      '/walk-sessions/my/stats',
      { params: { startDate, endDate } }
    );
    return response.data;
  },

  // 진행 중인 산책 세션 조회
  getActive: async () => {
    const response = await apiClient.get<ApiResponse<WalkSessionResponse[]>>(
      '/walk-sessions/my/active'
    );
    return response.data;
  },
};

// 산책 경로 관련 API
export const walkRouteApi = {
  // 내 산책 경로 조회
  getMyRoutes: async () => {
    const response = await apiClient.get<ApiResponse<WalkRoute[]>>('/routes/my');
    return response.data;
  },

  // 공유 산책 경로 조회
  getSharedRoutes: async () => {
    const response = await apiClient.get<ApiResponse<WalkRoute[]>>('/routes/shared');
    return response.data;
  },

  // 산책 경로 생성
  create: async (route: RouteCreateRequest) => {
    const response = await apiClient.post<ApiResponse<WalkRoute>>('/routes', route);
    return response.data;
  },
};

// 사용자 관련 API
export const userApi = {
  // 현재 사용자 정보 조회
  getMe: async () => {
    const response = await apiClient.get<ApiResponse<UserResponse>>('/users/me');
    return response.data;
  },
  // 사용자 ID로 사용자 정보 조회
  getById: async (userId: number) => {
    const response = await apiClient.get<ApiResponse<UserResponse>>(`/users/${userId}`);
    return response.data;
  },
};

// 파일 업로드 관련 API
export const fileApi = {
  // 반려동물 프로필 이미지 업로드
  uploadPetImage: async (file: File): Promise<string> => {
    console.log('파일 업로드 시작:', file.name, file.size, file.type);
    
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('authToken');
    console.log('인증 토큰 존재:', !!token);
    
    try {
      // multipart/form-data를 위해 axios를 직접 사용
      // 모바일 접속 시 백엔드 서버의 실제 IP 주소 사용
      const fileApiUrl = getApiBaseUrl() + '/files/pets/image';
      const response = await axios.post<ApiResponse<string>>(
        fileApiUrl,
        formData,
        {
          headers: {
            // multipart/form-data는 브라우저가 자동으로 boundary를 포함한 Content-Type을 설정
            // Authorization 헤더만 명시적으로 추가
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      
      console.log('파일 업로드 응답:', response.data);
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.message || '이미지 업로드에 실패했습니다.');
    } catch (error: any) {
      console.error('파일 업로드 에러 상세:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        config: error.config,
      });
      throw error;
    }
  },
};

// 커뮤니티 게시글 관련 API
export const communityApi = {
  // 게시글 작성
  create: async (post: CommunityPostCreateRequest) => {
    const response = await apiClient.post<ApiResponse<CommunityPostResponse>>('/posts', post);
    return response.data;
  },
  // 게시글 수정
  update: async (postId: number, post: CommunityPostUpdateRequest) => {
    const response = await apiClient.put<ApiResponse<CommunityPostResponse>>(`/posts/${postId}`, post);
    return response.data;
  },
  // 게시글 삭제
  delete: async (postId: number) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/posts/${postId}`);
    return response.data;
  },
  // 게시글 조회
  getById: async (postId: number) => {
    const response = await apiClient.get<ApiResponse<CommunityPostResponse>>(`/posts/${postId}`);
    return response.data;
  },
  // 카테고리별 목록 조회
  list: async (params?: { category?: PostCategory; page?: number; size?: number }) => {
    const response = await apiClient.get<ApiResponse<CommunityPostResponse[]>>('/posts', { params });
    return response.data;
  },
};

// 반려동물 관련 API
export const petApi = {
  // 내 반려동물 목록 조회
  getMyPets: async () => {
    const response = await apiClient.get<ApiResponse<PetResponse[]>>('/pets/my');
    return response.data;
  },

  // 사용자 ID로 반려동물 목록 조회
  getPetsByUserId: async (userId: number) => {
    const response = await apiClient.get<ApiResponse<PetResponse[]>>(`/pets/by-user/${userId}`);
    return response.data;
  },

  // 반려동물 등록
  create: async (pet: PetCreateRequest) => {
    const response = await apiClient.post<ApiResponse<PetResponse>>('/pets', pet);
    return response.data;
  },

  // 반려동물 정보 조회
  getById: async (petId: number) => {
    const response = await apiClient.get<ApiResponse<PetResponse>>(`/pets/${petId}`);
    return response.data;
  },

  // 반려동물 정보 수정
  update: async (petId: number, pet: PetUpdateRequest) => {
    const response = await apiClient.put<ApiResponse<PetResponse>>(`/pets/${petId}`, pet);
    return response.data;
  },

  // 반려동물 삭제
  delete: async (petId: number) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/pets/${petId}`);
    return response.data;
  },
};

// 위험 요소 관련 API
export type HazardCategory = 'LEASH' | 'MUZZLE' | 'AGGRESSIVE_DOG' | 'HAZARDOUS_MATERIAL' | 'WILDLIFE' | 'LOW_LIGHT' | 'BIKE_CAR' | 'POOP_LEFT' | 'OTHER';

export interface HazardReportRequest {
  category: HazardCategory;
  description: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
}

export interface HazardResponse {
  id: number;
  category: HazardCategory;
  description: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  reporterId?: number;
  reporterNickname?: string;
  createdAt: string;
}

export const hazardApi = {
  // 위험 요소 신고
  report: async (request: HazardReportRequest) => {
    const response = await apiClient.post<ApiResponse<HazardResponse>>('/hazards/report', request);
    return response.data;
  },

  // 주변 위험 요소 조회
  getNearby: async (latitude: number, longitude: number, radius: number = 2000) => {
    const response = await apiClient.get<ApiResponse<HazardResponse[]>>('/hazards/nearby', {
      params: { latitude, longitude, radius },
    });
    return response.data;
  },

  // 카테고리별 위험 요소 조회
  getByCategory: async (category: HazardCategory) => {
    const response = await apiClient.get<ApiResponse<HazardResponse[]>>(`/hazards/category/${category}`);
    return response.data;
  },

  // 위험 요소 수정
  update: async (hazardId: number, request: HazardReportRequest) => {
    const response = await apiClient.put<ApiResponse<HazardResponse>>(`/hazards/${hazardId}`, request);
    return response.data;
  },

  // 위험 요소 삭제
  delete: async (hazardId: number) => {
    const response = await apiClient.delete<ApiResponse<void>>(`/hazards/${hazardId}`);
    return response.data;
  },
};

// 타입 정의
export interface WalkSessionResponse {
  id: number;
  userId: number;
  userNickname: string;
  petId: number;
  petName: string;
  routeId: number | null;
  routeName: string | null;
  startTime: string;
  endTime: string | null;
  distance: number | null;
  duration: number | null;
  isCompleted: boolean;
  createdAt: string;
}

export interface WalkStats {
  totalSessions: number;
  totalDistance: number;
  totalDuration: number;
  totalCalories: number;
  averageDistance: number;
  averageDuration: number;
}

export interface WalkRoute {
  id: number;
  name: string;
  distance: number;
  duration: number;
  isShared: boolean;
  coordinates?: Array<{ latitude: number; longitude: number }>;
  authorId?: number;
  authorNickname?: string;
  createdAt?: string;
}

export interface RouteCreateRequest {
  name: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  distance: number;
  duration: number;
  shared: boolean;
}

export interface UserResponse {
  id: number;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
}

export interface PetResponse {
  id: number;
  name: string;
  species: string | null;
  breed: string | null;
  birthDate: string | null;
  gender: string | null;
  weight: number | null;
  imageUrl: string | null;
  description: string | null;
  ownerId: number;
  ownerNickname: string | null;
  createdAt: string;
}

export interface PetCreateRequest {
  name: string;
  species?: string;
  breed?: string;
  birthDate?: string;
  gender?: string;
  weight?: number;
  imageUrl?: string;
  description?: string;
}

export interface PetUpdateRequest {
  name?: string;
  species?: string;
  breed?: string;
  birthDate?: string;
  gender?: string;
  weight?: number;
  imageUrl?: string;
  description?: string;
}

// 커뮤니티 타입
export type PostCategory = 'WALK_CERTIFICATION' | 'FREE' | 'SAFETY';

export interface CommunityPostResponse {
  id: number;
  title: string;
  content: string;
  category: PostCategory;
  imageUrl: string | null;
  videoUrl: string | null;
  authorId: number;
  authorNickname: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CommunityPostCreateRequest {
  title: string;
  content: string;
  category: PostCategory;
  imageUrl?: string | null;
  videoUrl?: string | null;
}

export interface CommunityPostUpdateRequest {
  title?: string;
  content?: string;
  category?: PostCategory;
  imageUrl?: string | null;
  videoUrl?: string | null;
}

export default apiClient;

// API 클라이언트 재생성 함수 (모바일 접속 시 IP 변경 대응)
export const recreateApiClient = () => {
  return createApiClient();
};

