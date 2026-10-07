import { defineMessages } from "../define";

export const shell = defineMessages({
  en: {
    home: "QA JOO home",
    nav: { projects: "Projects" },
    userMenu: {
      workspace: "Workspace: {workspace} · AI: {ai}",
      settings: "Settings",
      localSession: "Local session (no sign-in required)",
      signOut: "Sign out",
    },
    workspace: { supabase: "Supabase", demo: "Demo (memory)", local: "Local (memory)" },
    aiProvider: { anthropic: "Anthropic", openai: "OpenAI", heuristic: "Rule-based" },
    switchLanguage: "Switch language",
  },
  ko: {
    home: "QA JOO 홈",
    nav: { projects: "프로젝트" },
    userMenu: {
      workspace: "저장소: {workspace} · AI: {ai}",
      settings: "설정",
      localSession: "로컬 세션 (로그인 불필요)",
      signOut: "로그아웃",
    },
    workspace: { supabase: "Supabase", demo: "데모 (메모리)", local: "로컬 (메모리)" },
    aiProvider: { anthropic: "Anthropic", openai: "OpenAI", heuristic: "규칙 기반" },
    switchLanguage: "언어 변경",
  },
});
