import { create } from "zustand";

export interface AgentProfile {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  thinking: string;
  systemPrompt?: string;
  icon?: string;
}

const DEFAULT_PROFILES: AgentProfile[] = [
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    provider: "deepseek",
    modelId: "deepseek-v4-pro",
    thinking: "high",
    systemPrompt: "You are an expert code reviewer. Analyze the code carefully. Identify bugs, security issues, performance problems, and suggest improvements. Be thorough but concise. Format findings as: severity, location, description, fix.",
    icon: "🔍",
  },
  {
    id: "architect",
    name: "Architect",
    provider: "deepseek",
    modelId: "deepseek-v4-pro",
    thinking: "high",
    systemPrompt: "You are a senior software architect. Think deeply about system design, trade-offs, and scalability. Provide architectural guidance, patterns, and rationale. Consider long-term maintainability.",
    icon: "🏗️",
  },
  {
    id: "debugger",
    name: "Debugger",
    provider: "deepseek",
    modelId: "deepseek-v4-flash",
    thinking: "low",
    systemPrompt: "You are a debugging expert. Focus on finding the root cause of issues. Ask clarifying questions if needed. Provide step-by-step debugging approach. Be direct and practical.",
    icon: "🐛",
  },
  {
    id: "speed",
    name: "Speed",
    provider: "deepseek",
    modelId: "deepseek-v4-flash",
    thinking: "off",
    systemPrompt: "Be fast and concise. Give direct answers without lengthy explanations. Prioritize speed over thoroughness.",
    icon: "⚡",
  },
];

interface ProfileState {
  profiles: AgentProfile[];
  addProfile: (p: AgentProfile) => void;
  removeProfile: (id: string) => void;
  updateProfile: (id: string, p: Partial<AgentProfile>) => void;
  getProfile: (id: string) => AgentProfile | undefined;
}

const STORAGE_KEY = "pi-web-profiles";

function loadProfiles(): AgentProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_PROFILES;
}

function persist(profiles: AgentProfile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: loadProfiles(),

  addProfile: (p) => {
    set((s) => {
      const profiles = [...s.profiles, p];
      persist(profiles);
      return { profiles };
    });
  },

  removeProfile: (id) => {
    set((s) => {
      const profiles = s.profiles.filter((p) => p.id !== id);
      persist(profiles);
      return { profiles };
    });
  },

  updateProfile: (id, partial) => {
    set((s) => {
      const profiles = s.profiles.map((p) =>
        p.id === id ? { ...p, ...partial } : p
      );
      persist(profiles);
      return { profiles };
    });
  },

  getProfile: (id) => get().profiles.find((p) => p.id === id),
}));
