import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { Send, Command, Zap, Trash2, List, HelpCircle, AtSign, Mic, MicOff, Palette, Type, Download } from "lucide-react";
import { usePanelStore } from "../../stores/panelStore";
import { useModelStore } from "../../stores/modelStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useToastStore } from "../../stores/toastStore";
import * as api from "../../lib/api";

interface Props {
  panelIndex: number;
  disabled: boolean;
}

// ── Slash command definitions ────────────────────────────

interface SlashCommand {
  id: string;
  description: string;
  icon: React.ReactNode;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { id: "/compact", description: "Compact session context to save tokens", icon: <Zap size={13} /> },
  { id: "/clear", description: "Clear current chat messages", icon: <Trash2 size={13} /> },
  { id: "/models", description: "List available models", icon: <List size={13} /> },
  { id: "/theme", description: "List available UI themes", icon: <Palette size={13} /> },
  { id: "/font", description: "List available font families", icon: <Type size={13} /> },
  { id: "/export", description: "Export this session as Markdown", icon: <Download size={13} /> },
  { id: "/help", description: "Show available commands and tips", icon: <HelpCircle size={13} /> },
];

export function Composer({ panelIndex, disabled }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { createAndSend, sendMessage, panels } = usePanelStore();
  const { models } = useModelStore();
  const workspaceStore = useWorkspaceStore();
  const addToast = useToastStore((s) => s.addToast);
  const panel = panels[panelIndex];

  // Slash command state
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashIdx, setSlashIdx] = useState(0);

  // @-mention state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIdx, setMentionIdx] = useState(0);
  const [mentionItems, setMentionItems] = useState<{ name: string; type: "file" | "folder" | "session" }[]>([]);

  // Voice input state
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [charCount, setCharCount] = useState(0);

  // Ctrl+K / Cmd+K to focus composer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }
  }, []);

  // ── Voice input via Web Speech API ───────────────────────
  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addToast("Speech recognition not supported in this browser", "warning");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      const ta = textareaRef.current;
      if (ta) {
        if (final) {
          ta.value = (ta.value + final).trim() + " ";
        }
        if (interim) {
          const base = ta.value.replace(/\[…\]$/, "").trim();
          ta.value = base + (base ? " " : "") + "[" + interim + "]";
        }
        adjustHeight();
        setCharCount(ta.value.length);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech" || event.error === "aborted") return;
      addToast(`Voice error: ${event.error}`, "error");
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      const ta = textareaRef.current;
      if (ta) {
        ta.value = ta.value.replace(/\s*\[([^\]]*)\]\s*$/, " $1").trim();
        adjustHeight();
        setCharCount(ta.value.length);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, adjustHeight, addToast]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // ── Detect slash command trigger ────────────────────────

  const updateDropdowns = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const text = ta.value;

    // Slash: must be at start of input (or after whitespace at start)
    const slashMatch = text.match(/^\/(\S*)$/);
    if (slashMatch) {
      const prefix = slashMatch[1].toLowerCase();
      setSlashOpen(true);
      setSlashFilter(prefix);
      setSlashIdx(0);
      setMentionOpen(false);
      return;
    }
    setSlashOpen(false);

    // @-mention: detect @ anywhere after whitespace or start
    const cursorPos = ta.selectionStart;
    const textBefore = text.slice(0, cursorPos);
    const mentionMatch = textBefore.match(/(?:^|\s)@(\S*)$/);
    if (mentionMatch) {
      const prefix = mentionMatch[1].toLowerCase();
      setMentionOpen(true);
      setMentionFilter(prefix);
      setMentionIdx(0);
      return;
    }
    setMentionOpen(false);
  }, []);

  // ── Fetch mention items from workspace ──────────────────

  useEffect(() => {
    if (!panel?.workspacePath) {
      setMentionItems([]);
      return;
    }
    // Use workspace sessions + folder name as mentionable items
    const ws = workspaceStore.workspaces.find((w) => w.path === panel.workspacePath);
    if (!ws) {
      setMentionItems([]);
      return;
    }
    const items: { name: string; type: "file" | "folder" | "session" }[] = [];
    // Add sessions
    for (const s of ws.sessions) {
      items.push({ name: s.title || `session-${s.id.slice(0, 6)}`, type: "session" });
    }
    // Add folder name
    items.push({ name: ws.name, type: "folder" });
    setMentionItems(items);
  }, [panel?.workspacePath, workspaceStore.workspaces]);

  // ── Filtered commands ───────────────────────────────────

  const filteredCommands = useMemo(() => {
    if (!slashFilter) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      (c) => c.id.toLowerCase().includes(slashFilter) || c.description.toLowerCase().includes(slashFilter)
    );
  }, [slashFilter]);

  const filteredMentions = useMemo(() => {
    if (!mentionFilter) return mentionItems;
    return mentionItems.filter((m) => m.name.toLowerCase().includes(mentionFilter));
  }, [mentionFilter, mentionItems]);

  // ── Handle send ─────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const text = ta.value.trim();
    if (!text) return;

    // ── Slash command intercept ────────────────────────────
    if (text.startsWith("/")) {
      const cmd = text.split(/\s/)[0].toLowerCase();
      switch (cmd) {
        case "/compact": {
          if (!panel?.sessionKey) { addToast("No active session", "warning"); ta.value = ""; adjustHeight(); return; }
          try {
            const result = await api.compactSession(panel.sessionKey);
            ta.value = "";
            adjustHeight();
            addToast(result.message || "Session compacted", "success");
          } catch (e: any) {
            addToast(e.message || "Compaction failed", "error");
          }
          return;
        }
        case "/clear": {
          const panelIdx = panelIndex;
          const oldMessages = panels[panelIdx]?.messages || [];
          usePanelStore.setState((s) => ({
            panels: s.panels.map((p, i) =>
              i === panelIdx ? { ...p, messages: [] } : p
            ),
          }));
          ta.value = "";
          adjustHeight();
          addToast("Chat cleared", "success", {
            action: {
              label: "Undo",
              onClick: () => {
                usePanelStore.setState((s) => ({
                  panels: s.panels.map((p, i) =>
                    i === panelIdx ? { ...p, messages: oldMessages } : p
                  ),
                }));
              },
            },
          });
          return;
        }
        case "/models": {
          const modelList = models.map(
            (m) => `${m.displayName} (${m.providerId})${m.contextWindow ? ` · ${Math.round(m.contextWindow / 1000)}K ctx` : ""}`
          ).join("\n");
          // Append as system-style assistant message
          usePanelStore.setState((s) => ({
            panels: s.panels.map((p, i) =>
              i === panelIndex ? {
                ...p,
                messages: [...p.messages, {
                  role: "assistant" as const,
                  content: `<div class="text-[11px] text-[var(--color-t2)]"><span class="text-[var(--color-t3)] text-[9px]">📋 Available models (${models.length})</span><pre class="text-[10px] mt-1 text-[var(--color-t2)] whitespace-pre-wrap">${modelList.replace(/</g, "&lt;")}</pre></div>`,
                  timestamp: new Date().toISOString(),
                }],
              } : p
            ),
          }));
          ta.value = "";
          adjustHeight();
          addToast(`${models.length} models listed`, "success");
          return;
        }
        case "/theme": {
          const { useThemeStore } = await import("../../stores/themeStore");
          // List available theme modes
          const themes = ["dark", "light", "system", "solarized-dark", "solarized-light", "tokyo-night", "catppuccin", "nord", "rose-pine", "odysseus"];
          const current = useThemeStore.getState().mode;
          const themeList = themes.map(t => `- ${t}${t === current ? ' *(current)*' : ''}`).join('\n');
          usePanelStore.setState((s) => ({
            panels: s.panels.map((p, i) =>
              i === panelIndex ? {
                ...p,
                messages: [...p.messages, {
                  role: "assistant" as const,
                  content: `<div class="text-[11px] text-[var(--color-t2)]"><span class="text-[var(--color-t3)] text-[9px]">🎨 Available themes</span><div class="mt-1">${themeList}</div><div class="mt-1.5 text-[10px] text-[var(--color-t3)]">Change in Settings → Appearance, or use <code>/font</code> to pick fonts</div></div>`,
                  timestamp: new Date().toISOString(),
                }],
              } : p
            ),
          }));
          ta.value = "";
          adjustHeight();
          addToast("Theme list shown", "success");
          return;
        }
        case "/font": {
          const { FONT_MAP } = await import("../../stores/themeStore");
          const current = (await import("../../stores/themeStore")).useThemeStore.getState().fontFamily;
          const fontList = Object.entries(FONT_MAP).map(([k, v]) => `- **${k}** — ${v.name}${k === current ? ' *(current)*' : ''}`).join('\n');
          usePanelStore.setState((s) => ({
            panels: s.panels.map((p, i) =>
              i === panelIndex ? {
                ...p,
                messages: [...p.messages, {
                  role: "assistant" as const,
                  content: `<div class="text-[11px] text-[var(--color-t2)]"><span class="text-[var(--color-t3)] text-[9px]">🔤 Available code fonts</span><div class="mt-1">${fontList}</div><div class="mt-1.5 text-[10px] text-[var(--color-t3)]">Change in Settings → Appearance</div></div>`,
                  timestamp: new Date().toISOString(),
                }],
              } : p
            ),
          }));
          ta.value = "";
          adjustHeight();
          addToast("Font list shown", "success");
          return;
        }
        case "/export": {
          if (!panel?.sessionKey) { addToast("No active session to export", "warning"); ta.value = ""; adjustHeight(); return; }
          window.open(`/api/session/${encodeURIComponent(panel.sessionKey)}/export`, "_blank");
          ta.value = "";
          adjustHeight();
          addToast("Export opened in new tab", "success");
          return;
        }
        case "/help": {
          const helpText = SLASH_COMMANDS.map((c) => `**${c.id}** — ${c.description}`).join("\n");
          usePanelStore.setState((s) => ({
            panels: s.panels.map((p, i) =>
              i === panelIndex ? {
                ...p,
                messages: [...p.messages, {
                  role: "assistant" as const,
                  content: `<div class="text-[11px] text-[var(--color-t2)]"><span class="text-[var(--color-t3)] text-[9px]">💡 Available commands</span><div class="mt-1">${helpText}</div><div class="mt-1.5 text-[10px] text-[var(--color-t3)]">Shift+Enter for newline · Click ↑ to edit last message · @ to mention workspace files</div></div>`,
                  timestamp: new Date().toISOString(),
                }],
              } : p
            ),
          }));
          ta.value = "";
          adjustHeight();
          return;
        }
        default:
          // Unknown command — send to model as-is (fall through to normal send)
          break;
      }
    }

    // ── Normal send ────────────────────────────────────────
    ta.value = "";
    setCharCount(0);
    adjustHeight();
    setSlashOpen(false);
    setMentionOpen(false);

    if (!panel?.sessionKey) {
      await createAndSend(panelIndex, text);
    } else {
      await sendMessage(panelIndex, text);
    }
  }, [panel, panelIndex, createAndSend, sendMessage, adjustHeight, addToast, models]);

  // ── Keyboard handling ───────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Slash dropdown navigation
      if (slashOpen && filteredCommands.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashIdx((prev) => (prev + 1) % filteredCommands.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashIdx((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          // Replace current slash text with selected command
          const ta = textareaRef.current;
          if (ta) {
            const cmd = filteredCommands[slashIdx]?.id || "/help";
            ta.value = cmd + " ";
            setSlashOpen(false);
            adjustHeight();
            // Focus stays on textarea
            ta.focus();
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashOpen(false);
          return;
        }
      }

      // @-mention dropdown navigation
      if (mentionOpen && filteredMentions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIdx((prev) => (prev + 1) % filteredMentions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIdx((prev) => (prev - 1 + filteredMentions.length) % filteredMentions.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const ta = textareaRef.current;
          if (ta) {
            const mention = filteredMentions[mentionIdx];
            if (mention) {
              const cursorPos = ta.selectionStart;
              const textBefore = ta.value.slice(0, cursorPos);
              const textAfter = ta.value.slice(cursorPos);
              // Replace @partial with @name
              const lastAt = textBefore.lastIndexOf("@");
              const newText = textBefore.slice(0, lastAt) + "@" + mention.name + " " + textAfter;
              ta.value = newText;
              setMentionOpen(false);
              adjustHeight();
              const newCursor = lastAt + mention.name.length + 2;
              ta.setSelectionRange(newCursor, newCursor);
              ta.focus();
            }
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setMentionOpen(false);
          return;
        }
      }

      // Default: Enter to send (without Shift)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [slashOpen, slashIdx, filteredCommands, mentionOpen, mentionIdx, filteredMentions, handleSend, adjustHeight]
  );

  // ── Select slash command by click ───────────────────────

  const selectSlashCommand = useCallback(
    (cmd: SlashCommand) => {
      const ta = textareaRef.current;
      if (ta) {
        ta.value = cmd.id + " ";
        setSlashOpen(false);
        adjustHeight();
        ta.focus();
      }
    },
    [adjustHeight]
  );

  return (
    <div className="border-t border-[var(--color-bd)] p-1.5 bg-[var(--color-bg2)] flex-shrink-0 relative">
      {/* ── Slash command dropdown ─────────────────────────── */}
      {slashOpen && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-2 mb-1 w-[220px] bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-lg shadow-2xl z-50 overflow-hidden">
          {filteredCommands.map((cmd, idx) => (
            <div
              key={cmd.id}
              onClick={() => selectSlashCommand(cmd)}
              onMouseEnter={() => setSlashIdx(idx)}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-[11px] transition-colors ${
                idx === slashIdx
                  ? "bg-[var(--color-accent)]/10 text-[var(--color-t1)] border-l-2 border-[var(--color-accent)]"
                  : "text-[var(--color-t2)] hover:bg-[var(--color-bgh)] border-l-2 border-transparent"
              }`}
            >
              <span className="text-[var(--color-t3)] flex-shrink-0">{cmd.icon}</span>
              <span className="font-medium flex-shrink-0">{cmd.id}</span>
              <span className="text-[var(--color-t3)] truncate flex-1 text-[10px]">{cmd.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── @-mention dropdown ─────────────────────────────── */}
      {mentionOpen && filteredMentions.length > 0 && (
        <div className="absolute bottom-full left-2 mb-1 w-[200px] bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-lg shadow-2xl z-50 overflow-hidden">
          {filteredMentions.map((item, idx) => (
            <div
              key={`${item.type}-${item.name}`}
              onMouseEnter={() => setMentionIdx(idx)}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-[11px] transition-colors ${
                idx === mentionIdx
                  ? "bg-[var(--color-accent)]/10 text-[var(--color-t1)] border-l-2 border-[var(--color-accent)]"
                  : "text-[var(--color-t2)] hover:bg-[var(--color-bgh)] border-l-2 border-transparent"
              }`}
            >
              <span className="flex-shrink-0 text-xs">
                {item.type === "folder" ? "📁" : item.type === "session" ? "💬" : "📄"}
              </span>
              <span className="truncate">{item.name}</span>
              <span className="text-[9px] text-[var(--color-t3)] flex-shrink-0 capitalize">{item.type}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Textarea row ───────────────────────────────────── */}
      <div className="flex gap-1.5 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={
              !panel?.workspacePath
                ? "Open a folder to start…"
                : panel.streaming
                  ? "Waiting for response…"
                  : "Ask pi… (Shift+Enter for newline, / for commands, @ to mention)"
            }
            disabled={disabled}
            onInput={(e) => {
              adjustHeight();
              setCharCount(e.currentTarget.value.length);
              updateDropdowns();
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-bdl)] rounded-lg px-2.5 py-1.5 text-[var(--color-t1)] font-sans text-xs leading-relaxed resize-none min-h-[28px] max-h-[200px] outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0_0_0_2px_var(--color-accent-glow)] placeholder:text-[var(--color-t3)] disabled:opacity-40"
          />
          {charCount > 500 && (
            <span className="absolute bottom-1 right-8 text-[8px] text-[var(--color-t3)] select-none pointer-events-none">
              {charCount.toLocaleString()}
            </span>
          )}
        </div>
        <button
          onClick={toggleVoice}
          disabled={disabled}
          className={`w-[28px] h-[28px] rounded flex items-center justify-center transition-colors flex-shrink-0 ${
            listening
              ? "bg-[var(--color-danger)] text-white animate-pulse"
              : "text-[var(--color-t3)] hover:text-[var(--color-t2)] hover:bg-[var(--color-bgh)]"
          } disabled:opacity-25`}
          title={listening ? "Stop listening" : "Voice input"}
        >
          {listening ? <MicOff size={13} /> : <Mic size={13} />}
        </button>
        <button
          onClick={handleSend}
          disabled={disabled || charCount === 0}
          className="w-[28px] h-[28px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-25 disabled:cursor-not-allowed rounded flex items-center justify-center transition-colors flex-shrink-0"
        >
          <Send size={13} className="text-white" />
        </button>
      </div>

      {/* ── Subtle hint ────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-1 mt-0.5 text-[8px] text-[var(--color-t3)] select-none">
        <span className="flex items-center gap-0.5">
          <Command size={8} />
          / for commands
        </span>
        <span className="flex items-center gap-0.5">
          <AtSign size={8} />
          @ to mention
        </span>
        <span className="flex items-center gap-0.5">
          Ctrl+K to focus
        </span>
        <span className="ml-auto">Shift+Enter for newline</span>
      </div>
    </div>
  );
}


