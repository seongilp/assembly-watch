import {
  LayoutDashboard,
  Users,
  FileText,
  Vote,
  Landmark,
  CalendarDays,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-vue-next";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  desc: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "대시보드", icon: LayoutDashboard, desc: "한눈에 보는 의정 현황" },
  { to: "/members", label: "국회의원", icon: Users, desc: "현직 의원 300명" },
  { to: "/bills", label: "의안", icon: FileText, desc: "계류·처리 법률안" },
  { to: "/votes", label: "본회의 표결", icon: Vote, desc: "의원별 찬반 기록" },
  { to: "/committees", label: "위원회", icon: Landmark, desc: "상임·특별위원회" },
  { to: "/schedule", label: "국회 일정", icon: CalendarDays, desc: "본회의·행사 일정" },
  { to: "/insights", label: "펀팩트", icon: Sparkles, desc: "의정활동 랭킹" },
  { to: "/quiz", label: "성향 테스트", icon: Wand2, desc: "나와 비슷한 의원 찾기" },
];
