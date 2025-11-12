import { useState } from 'react';
import { X, Upload, AlertTriangle } from 'lucide-react';
import { hazardApi, HazardCategory, HazardReportRequest, fileApi } from '../lib/api';

interface HazardReportModalProps {
  latitude: number;
  longitude: number;
  onClose: () => void;
  onSuccess: () => void;
}

const HAZARD_CATEGORIES: { value: HazardCategory; label: string }[] = [
  { value: 'LEASH', label: '목줄 미착용' },
  { value: 'MUZZLE', label: '입마개 미착용' },
  { value: 'AGGRESSIVE_DOG', label: '공격적인 개' },
  { value: 'HAZARDOUS_MATERIAL', label: '위험물질' },
  { value: 'WILDLIFE', label: '야생동물 출몰' },
  { value: 'LOW_LIGHT', label: '조명 부족' },
  { value: 'BIKE_CAR', label: '자전거·차량 위험' },
  { value: 'POOP_LEFT', label: '배변 미수거' },
  { value: 'OTHER', label: '기타' },
];

export default function HazardReportModal({
  latitude,
  longitude,
  onClose,
  onSuccess,
}: HazardReportModalProps) {
  const [category, setCategory] = useState<HazardCategory>('OTHER');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('파일 크기는 10MB를 초과할 수 없습니다.');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('이미지 파일만 업로드 가능합니다.');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) {
      setError('위험 유형을 선택해주세요.');
      return;
    }
    if (!description.trim()) {
      setError('설명을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      let imageUrl: string | undefined = undefined;

      // 이미지 업로드
      if (selectedFile) {
        try {
          imageUrl = await fileApi.uploadPetImage(selectedFile);
        } catch (uploadError: any) {
          setError('이미지 업로드에 실패했습니다: ' + (uploadError.message || '알 수 없는 오류'));
          setIsSubmitting(false);
          return;
        }
      }

      const request: HazardReportRequest = {
        category,
        description: description.trim(),
        latitude,
        longitude,
        imageUrl,
      };

      console.log('위험 요소 신고 요청:', request);
      const response = await hazardApi.report(request);
      console.log('위험 요소 신고 응답:', response);

      if (response.success) {
        onSuccess();
        onClose();
      } else {
        const errorMessage = response.message || '위험 요소 신고에 실패했습니다.';
        console.error('위험 요소 신고 실패:', errorMessage, response);
        setError(errorMessage);
      }
    } catch (e: any) {
      console.error('위험 요소 신고 오류:', e);
      console.error('에러 상세:', {
        message: e.message,
        response: e.response?.data,
        status: e.response?.status,
        statusText: e.response?.statusText,
      });
      
      let errorMessage = '위험 요소 신고 중 오류가 발생했습니다.';
      if (e.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e.response?.data?.data) {
        errorMessage = e.response.data.data;
      } else if (e.message) {
        errorMessage = e.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="text-red-500" size={24} />
            위험 요소 신고
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              위치
            </label>
            <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              위도: {latitude.toFixed(6)}, 경도: {longitude.toFixed(6)}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              위험 유형 <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as HazardCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isSubmitting}
              required
            >
              {HAZARD_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="위험 요소에 대해 자세히 설명해주세요"
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              사진 (선택)
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="hazard-image-upload"
                disabled={isSubmitting}
              />
              <label
                htmlFor="hazard-image-upload"
                className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={20} />
                <span>이미지 선택</span>
              </label>
              {previewUrl && (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="미리보기"
                    className="w-full h-48 object-cover rounded-lg border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrl(null);
                      setSelectedFile(null);
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    disabled={isSubmitting}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  신고 중...
                </>
              ) : (
                '신고하기'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

