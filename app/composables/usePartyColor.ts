import { partyColorMode } from "~/lib/party";

/**
 * 색상 모드에 맞는 정당색 함수.
 * SSR/하이드레이션 시점엔 모드를 알 수 없어 라이트색으로 그리고,
 * 마운트 후에만 다크 보정을 적용 → 하이드레이션 불일치 방지.
 */
export function usePartyColor() {
  const colorMode = useNuxtApp().$colorMode;
  const mounted = ref(false);
  onMounted(() => {
    mounted.value = true;
  });
  return (party: string) =>
    partyColorMode(party, mounted.value && colorMode.value === "dark");
}
