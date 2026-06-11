<script setup lang="ts">
import { ShieldCheck, Mail } from "lucide-vue-next";

useHead({ title: "개인정보처리방침 · 의정감시" });
</script>

<template>
  <div class="max-w-2xl">
    <PageHeader eyebrow="의정감시" title="개인정보처리방침" subtitle="2026년 6월 12일 시행" />

    <section class="rounded-2xl bg-card card-shadow p-6 sm:p-8 space-y-6 text-[14px] leading-relaxed text-toss-gray-700">
      <div>
        <h2 class="flex items-center gap-2 text-[15px] font-bold text-toss-gray-900 mb-2">
          <ShieldCheck class="size-4 text-toss-blue" /> 1. 수집하는 개인정보
        </h2>
        <p>
          의정감시(asm.zihado.com)는 회원가입·로그인 기능이 없으며, 이용자의 개인정보를
          <b>수집하지 않습니다</b>. 서비스 운영 인프라(Cloudflare)가 보안·통계 목적으로 접속
          기록(IP, 접속 시각 등)을 일시적으로 처리할 수 있으나, 운영자가 이를 별도로 저장하거나
          이용하지 않습니다.
        </p>
      </div>

      <div>
        <h2 class="text-[15px] font-bold text-toss-gray-900 mb-2">2. 쿠키·로컬 저장소</h2>
        <p>
          다크 모드 등 화면 설정을 이용자의 브라우저(localStorage)에만 저장합니다. 이 정보는
          서버로 전송되지 않으며, 브라우저 설정에서 언제든 삭제할 수 있습니다. 광고·추적 쿠키는
          사용하지 않습니다.
        </p>
      </div>

      <div>
        <h2 class="text-[15px] font-bold text-toss-gray-900 mb-2">3. 공개 정보의 출처</h2>
        <p>
          이 서비스가 표시하는 국회의원 정보(인적사항·발의·표결·재산 등)는
          <a href="https://open.assembly.go.kr" target="_blank" rel="noopener" class="text-toss-blue underline">열린국회정보</a>,
          국회공보 및
          <a href="https://github.com/opengirok/congress_asset_disclosure" target="_blank" rel="noopener" class="text-toss-blue underline">투명사회를 위한 정보공개센터</a>가
          공개한 공공 정보입니다. 공인(公人)의 공적 정보를 공익 목적으로 표시하며, 일반 이용자의
          개인정보는 다루지 않습니다.
        </p>
      </div>

      <div>
        <h2 class="text-[15px] font-bold text-toss-gray-900 mb-2">4. 정정·삭제 요청 및 문의</h2>
        <p>
          게시된 정보의 오류 정정, 삭제 요청, 기타 개인정보 관련 문의는 아래 메일로 보내주세요.
          확인 후 신속히 처리하겠습니다.
        </p>
        <a
          href="mailto:tellme@duck.com"
          class="mt-3 inline-flex items-center gap-2 rounded-xl bg-toss-blue-light px-4 py-2.5 text-[14px] font-bold text-toss-blue hover:opacity-80"
        >
          <Mail class="size-4" /> tellme@duck.com
        </a>
      </div>

      <p class="text-[12px] text-toss-gray-400 pt-2 border-t border-toss-gray-100">
        본 방침은 서비스 변경에 따라 갱신될 수 있으며, 변경 시 본 페이지에 게시합니다.
      </p>
    </section>
  </div>
</template>
