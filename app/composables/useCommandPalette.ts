/** 커맨드 팔레트(⌘K) 전역 열림 상태 */
export const useCommandPalette = () =>
  useState<boolean>("command-palette-open", () => false);
