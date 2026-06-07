/** Kakao 지도 SDK 1회 로드 (클라이언트 전용) */
let loaderPromise: Promise<any> | null = null;

export function useKakaoLoader(): Promise<any> {
  if (import.meta.server) return Promise.reject(new Error("server"));
  if (loaderPromise) return loaderPromise;

  const key = useRuntimeConfig().public.kakaoMapKey as string;
  if (!key) return Promise.reject(new Error("KAKAO_MAP_KEY 미설정"));

  loaderPromise = new Promise((resolve, reject) => {
    const w = window as any;
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn();
    };
    // 8초 내 미로드 시 폴백(도메인 미등록/네트워크 차단 대비)
    const timer = setTimeout(() => {
      loaderPromise = null;
      finish(() => reject(new Error("Kakao SDK 로드 타임아웃")));
    }, 8000);

    if (w.kakao?.maps) {
      w.kakao.maps.load(() => finish(() => resolve(w.kakao)));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
    script.async = true;
    script.onload = () => {
      w.kakao.maps.load(() => finish(() => resolve(w.kakao)));
    };
    script.onerror = () => {
      loaderPromise = null;
      finish(() => reject(new Error("Kakao SDK 로드 실패 (도메인 등록 확인)")));
    };
    document.head.appendChild(script);
  });
  return loaderPromise;
}
