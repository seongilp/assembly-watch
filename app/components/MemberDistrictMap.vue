<script setup lang="ts">
import { MapPin } from "lucide-vue-next";
import { partyColor } from "~/lib/party";

// 의원 상세 페이지용 — 해당 의원의 선거구(시군구) 경계만 그려 지도 ~50% 차지하도록 확대.
// 전국 버블/마커가 얽힌 KakaoMemberMap 과 달리, 단일 선거구 표시만 담당하는 경량 컴포넌트.
const props = defineProps<{
  id: string;
  party: string;
  origin: string;
}>();
// 지역구 데이터가 없으면(데이터 누락 등) 부모가 카드를 숨길 수 있도록 알린다.
const emit = defineEmits<{ empty: [] }>();

type Shapes = {
  codes: Record<string, { name: string; rings: [number, number][][] }>;
  members: Record<string, string[]>;
};

const mapEl = ref<HTMLElement | null>(null);
const status = ref<"loading" | "ready" | "error">("loading");
let kakao: any = null;
let map: any = null;
let polygons: any[] = [];

const color = computed(() => partyColor(props.party));

function clearPolygons() {
  polygons.forEach((p) => p.setMap(null));
  polygons = [];
}

// 의원 선거구(시군구) 경계 폴리곤 + 지도의 ~50% 를 차지하도록 fit.
function drawDistrict(shapes: Shapes) {
  const codes = shapes.members[props.id];
  if (!codes || !codes.length) return false;
  clearPolygons();
  const bounds = new kakao.maps.LatLngBounds();
  let has = false;
  for (const code of codes) {
    const shp = shapes.codes[code];
    if (!shp) continue;
    for (const ring of shp.rings) {
      const path = ring.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng));
      const poly = new kakao.maps.Polygon({
        path,
        strokeWeight: 2,
        strokeColor: color.value,
        strokeOpacity: 0.9,
        fillColor: color.value,
        fillOpacity: 0.18,
      });
      poly.setMap(map);
      polygons.push(poly);
      for (const [lng, lat] of ring) {
        bounds.extend(new kakao.maps.LatLng(lat, lng));
        has = true;
      }
    }
  }
  if (!has) return false;
  // 사방 25% 여백 → 선거구가 가운데 절반 차지
  const w = mapEl.value?.clientWidth ?? 0;
  const h = mapEl.value?.clientHeight ?? 0;
  const padX = Math.round(w * 0.25);
  const padY = Math.round(h * 0.25);
  map.setBounds(bounds, padY, padX, padY, padX);
  return true;
}

onMounted(async () => {
  try {
    kakao = await useKakaoLoader();
    if (!mapEl.value) return;
    map = new kakao.maps.Map(mapEl.value, {
      center: new kakao.maps.LatLng(36.3, 127.8),
      level: 9,
      draggable: true,
    });
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
    const shapes = await $fetch<Shapes>("/api/shapes");
    // 선거구 좌표가 없으면(비례대표·매핑 누락) 카드 자체를 숨긴다.
    if (!shapes.members[props.id]?.length) {
      emit("empty");
      return;
    }
    const ok = drawDistrict(shapes);
    if (!ok) {
      emit("empty");
      return;
    }
    status.value = "ready";
  } catch {
    // SDK·shapes 로드 실패는 숨기지 않고 안내를 띄운다(일시 장애로 카드가 사라지는 혼란 방지).
    status.value = "error";
  }
});

onBeforeUnmount(clearPolygons);
</script>

<template>
  <section class="rounded-2xl bg-card card-shadow p-6">
    <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900 mb-4">
      <MapPin class="size-4 text-toss-blue" /> 선거구
      <span class="text-[13px] font-medium text-toss-gray-400">{{ origin }}</span>
    </h2>
    <div class="relative">
      <div
        ref="mapEl"
        class="w-full h-[300px] lg:h-[360px] rounded-xl overflow-hidden bg-toss-gray-100"
      />
      <div
        v-if="status === 'loading'"
        class="absolute inset-0 grid place-items-center rounded-xl bg-toss-gray-100 text-[13px] text-toss-gray-400"
      >
        지도를 불러오는 중…
      </div>
      <div
        v-else-if="status === 'error'"
        class="absolute inset-0 grid place-items-center rounded-xl bg-toss-gray-100 text-center px-6"
      >
        <p class="text-[13px] text-toss-gray-500">지도를 불러오지 못했습니다.</p>
      </div>
    </div>
  </section>
</template>
