import { useRef, useEffect, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, Copy, Pencil, SendHorizontal, GitFork, Bot, Pin, RotateCcw, ArrowUp } from "lucide-react";
import type { PanelData } from "../../stores/panelStore";
import { usePanelStore } from "../../stores/panelStore";
import { MessageBubble } from "./MessageBubble";
import { ChatSkeleton } from "../Skeletons";
import { useToastStore } from "../../stores/toastStore";
import * as api from "../../lib/api";

interface Props {
  panel: PanelData;
}

export function ChatView({ panel }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const sendMessage = usePanelStore((s) => s.sendMessage);
  const panels = usePanelStore((s) => s.panels);
  const branchFromMessage = usePanelStore((s) => s.branchFromMessage);
  const spawnSubAgent = usePanelStore((s) => s.spawnSubAgent);
  const pinMessage = usePanelStore((s) => s.pinMessage);
  const unpinMessage = usePanelStore((s) => s.unpinMessage);
  const regenLastMessage = usePanelStore((s) => s.regenLastMessage);
  const addToast = useToastStore((s) => s.addToast);
  const [dragOver, setDragOver] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Elapsed time counter during streaming ──────────────
  useEffect(() => {
    if (panel.streaming) {
      setElapsedSec(0);
      elapsedRef.current = setInterval(() => {
        setElapsedSec((s) => s + 1);
      }, 1000);
    } else {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
      setElapsedSec(0);
    }
    return () => {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
    };
  }, [panel.streaming]);

  const virtualizer = useVirtualizer({
    count: panel.messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  const scrollToBottom = useCallback(() => {
    virtualizer.scrollToIndex(panel.messages.length - 1, { align: "end" });
    shouldAutoScroll.current = true;
    setShowScrollBtn(false);
  }, [virtualizer, panel.messages.length]);

  // aria-live announcements for screen readers
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const prevStreaming = useRef(panel.streaming);
  const prevMsgCount = useRef(panel.messages.length);

  useEffect(() => {
    if (panel.streaming && !prevStreaming.current) {
      setLiveAnnouncement("New message from pi");
    } else if (!panel.streaming && prevStreaming.current) {
      setLiveAnnouncement("Message complete");
    } else if (panel.messages.length > prevMsgCount.current && !panel.streaming) {
      // User sent a message
      setLiveAnnouncement("Message sent");
    } else {
      // Clear announcement after a beat so it can be re-read
      const timer = setTimeout(() => setLiveAnnouncement(""), 100);
      return () => clearTimeout(timer);
    }
    prevStreaming.current = panel.streaming;
    prevMsgCount.current = panel.messages.length;
  }, [panel.streaming, panel.messages.length]);

  // Auto-scroll when streaming
  useEffect(() => {
    if (panel.streaming && shouldAutoScroll.current && panel.messages.length > 0) {
      virtualizer.scrollToIndex(panel.messages.length - 1, { align: "end" });
    }
  }, [panel.messages.length, panel.streaming, virtualizer]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    shouldAutoScroll.current = atBottom;
    setShowScrollBtn(!atBottom && panel.messages.length > 2);
  };

  const handleCopyMessage = (content: string) => {
    const div = document.createElement("div");
    div.innerHTML = content;
    const text = div.textContent || div.innerText || content;
    navigator.clipboard.writeText(text).then(() => {
      addToast("Copied to clipboard", "success");
    }).catch(() => {
      addToast("Failed to copy", "error");
    });
  };

  const handleEditMessage = (index: number, content: string) => {
    setEditingIndex(index);
    setEditText(content);
  };

  const handleResend = () => {
    if (editingIndex === null) return;
    const panelIndex = usePanelStore.getState().panels.indexOf(panel);
    if (panelIndex < 0) return;

    const msgs = panel.messages.slice(0, editingIndex);
    usePanelStore.setState((s) => ({
      panels: s.panels.map((p, i) =>
        i === panelIndex ? { ...p, messages: msgs } : p
      ),
    }));

    sendMessage(panelIndex, editText);
    setEditingIndex(null);
    setEditText("");
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  // ── Load earlier messages ────────────────────────────────

  const handleLoadEarlier = useCallback(async () => {
    if (!panel.sessionKey) return;
    addToast("Loading earlier messages…", "success");
    // Re-fetch full transcript (server-side pagination not yet implemented,
    // this refreshes the entire transcript as a fallback)
    try {
      const transcript = await api.getTranscript(panel.sessionKey);
      const panelIdx = panels.indexOf(panel);
      if (panelIdx >= 0) {
        usePanelStore.setState((s) => ({
          panels: s.panels.map((p, i) =>
            i === panelIdx
              ? { ...p, messages: transcript.transcript, usage: transcript.usage }
              : p
          ),
        }));
      }
      addToast("Transcript refreshed", "success");
    } catch {
      addToast("Failed to load messages", "error");
    }
  }, [panel.sessionKey, panel, panels, addToast]);

  // ── Drag-drop handlers ───────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only accept files
    if (e.dataTransfer.types.includes("Files")) {
      setDragOver(true);
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if we left the container (not entering a child)
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter((f) =>
        /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(f.name) || f.type.startsWith("image/")
      );
      if (imageFiles.length > 0) {
        addToast(`Image upload not yet configured (${imageFiles.length} file${imageFiles.length > 1 ? "s" : ""})`, "warning");
      } else if (files.length > 0) {
        addToast(`${files.length} file${files.length > 1 ? "s" : ""} dropped — only images are supported for now`, "warning");
      }
    },
    [addToast]
  );

  // ── Regen handler ────────────────────────────────────────

  const handleRegenLast = useCallback(async () => {
    const panelIdx = panels.indexOf(panel);
    if (panelIdx < 0) return;
    try {
      await regenLastMessage(panelIdx);
    } catch (e: any) {
      addToast(e.message || "Regen failed", "error");
    }
  }, [panels, panel, regenLastMessage, addToast]);

  if (panel.loadingMessages) {
    return <ChatSkeleton />;
  }

  if (!panel.workspacePath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5 text-[var(--color-t3)] px-4">
        <span className="text-2xl opacity-25">📂</span>
        <span className="text-xs font-medium text-[var(--color-t2)]">No workspace</span>
        <span className="text-[10px] max-w-[200px] leading-relaxed">
          Open a folder from the sidebar to start chatting with pi.
        </span>
      </div>
    );
  }

  if (panel.messages.length === 0 && !panel.streaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5 text-[var(--color-t3)] px-4">
        <span className="text-2xl opacity-25">💬</span>
        <span className="text-xs font-medium text-[var(--color-t2)]">New conversation</span>
        <span className="text-[10px] max-w-[200px] leading-relaxed">
          Type a message below to start.
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 relative min-h-0" role="log" aria-label="Chat messages">
      {/* Screen-reader live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
        {liveAnnouncement}
      </div>

      {/* ── Drag-drop overlay ──────────────────────────────── */}
      {dragOver && (
        <div className="absolute inset-0 z-30 bg-[var(--color-accent)]/10 border-2 border-dashed border-[var(--color-accent)] rounded-lg flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-1 text-[var(--color-accent)]">
            <span className="text-2xl">🖼</span>
            <span className="text-xs font-medium">Drop images here</span>
            <span className="text-[9px] opacity-70">PNG, JPG, GIF, WebP</span>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="absolute inset-0 overflow-y-auto"
      >
        {/* ── Load earlier messages ────────────────────────── */}
        {panel.messages.length > 20 && !panel.loadingMessages && (
          <div className="flex justify-center pt-2 pb-1">
            <button
              onClick={handleLoadEarlier}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] text-[var(--color-t3)] hover:text-[var(--color-t2)] hover:bg-[var(--color-bgh)] transition-colors"
              title="Refresh transcript from server"
            >
              <ArrowUp size={10} />
              Load earlier messages
            </button>
          </div>
        )}

        {/* Pinned messages */}
        {panel.pinnedIndices && panel.pinnedIndices.length > 0 && (
          <div className="sticky top-0 z-10 bg-[var(--color-bg)]/95 backdrop-blur-sm border-b border-[var(--color-accent)]/30 px-3 py-1.5 mb-1">
            <div className="text-[9px] text-[var(--color-t3)] uppercase tracking-wider mb-1 flex items-center gap-1">
              <Pin size={9} />
              Pinned ({panel.pinnedIndices.length})
            </div>
            {panel.pinnedIndices.map((idx) => {
              const msg = panel.messages[idx];
              if (!msg) return null;
              return (
                <div key={idx} className="relative group/pinned mb-1">
                  <MessageBubble message={msg} />
                  <button
                    onClick={() => {
                      const panelIdx = panels.indexOf(panel);
                      if (panelIdx >= 0) unpinMessage(panelIdx, idx);
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--color-bg2)] border border-[var(--color-bd)] flex items-center justify-center opacity-0 group-hover/pinned:opacity-100 transition-opacity hover:border-[var(--color-danger)]"
                    title="Unpin"
                    aria-label="Unpin message"
                  >
                    <span className="text-[8px] leading-none">✕</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Virtualized message list */}
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
          className="px-3 py-3"
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const i = virtualItem.index;
            const msg = panel.messages[i];
            const isStreaming = panel.streaming && i === panel.messages.length - 1 && msg.role === "assistant";
            const isEditing = editingIndex === i;
            const isLastAssistant =
              msg.role === "assistant" &&
              i === panel.messages.length - 1 &&
              !panel.streaming;

            return (
              <div
                key={virtualItem.key}
                data-index={i}
                ref={virtualizer.measureElement}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualItem.start}px)` }}
              >
                <div className="group/message relative">
                  {isEditing && msg.role === "user" ? (
                    <div className="flex gap-2 mb-3 flex-row-reverse">
                      <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 bg-[var(--color-accent)] text-white">
                        U
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-[var(--color-bg)] border border-[var(--color-accent)] rounded-lg px-2 py-1.5 text-[var(--color-t1)] text-xs resize-none min-h-[40px] outline-none"
                          rows={2}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleResend();
                            }
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                        />
                        <div className="flex gap-1 justify-end">
                          <button onClick={handleCancelEdit} className="px-2 py-0.5 rounded text-[10px] text-[var(--color-t3)] hover:bg-[var(--color-bgh)] transition-colors">
                            Cancel
                          </button>
                          <button onClick={handleResend} disabled={!editText.trim()} className="px-2 py-0.5 rounded text-[10px] bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-25 transition-colors">
                            Resend
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <MessageBubble
                      message={msg}
                      streaming={isStreaming}
                      modelDotName={panel.model?.modelId || panel.sessionKey?.split("::")[1]?.slice(0, 12)}
                      showRegen={isLastAssistant}
                      onRegen={isLastAssistant ? handleRegenLast : undefined}
                    />
                  )}

                  {!isEditing && !panel.streaming && (
                    <div className={`absolute top-0 ${msg.role === "user" ? "left-2" : "right-2"} opacity-0 group-hover/message:opacity-100 transition-opacity flex gap-0.5`}>
                      <button
                        onClick={() => handleCopyMessage(msg.content)}
                        className="p-0.5 rounded text-[var(--color-t3)] hover:text-[var(--color-t1)] hover:bg-[var(--color-bgh)] transition-colors"
                        title="Copy message"
                        aria-label="Copy message"
                      >
                        <Copy size={11} aria-hidden="true" />
                      </button>
                      {msg.role === "user" && (
                        <button
                          onClick={() => handleEditMessage(i, msg.content)}
                          className="p-0.5 rounded text-[var(--color-t3)] hover:text-[var(--color-t1)] hover:bg-[var(--color-bgh)] transition-colors"
                          title="Edit and resend"
                          aria-label="Edit and resend message"
                        >
                          <Pencil size={11} aria-hidden="true" />
                        </button>
                      )}
                      {msg.role === "assistant" && panels.length > 1 && !panel.streaming && (
                        <button
                          onClick={() => {
                            const text = document.createElement("div");
                            text.innerHTML = msg.content;
                            const plain = text.textContent || "";
                            // Send to the next panel
                            const currentIdx = panels.indexOf(panel);
                            const targetIdx = (currentIdx + 1) % panels.length;
                            usePanelStore.getState().setActive(targetIdx);
                            const target = panels[targetIdx];
                            if (target.sessionKey) {
                              sendMessage(targetIdx, plain);
                            } else if (target.workspacePath) {
                              usePanelStore.getState().createAndSend(targetIdx, plain);
                            }
                            addToast("Piped to panel " + (targetIdx + 1), "success");
                          }}
                          className="p-0.5 rounded text-[var(--color-t3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bgh)] transition-colors"
                          title="Send to next panel"
                          aria-label="Send to next panel"
                        >
                          <SendHorizontal size={11} aria-hidden="true" />
                        </button>
                      )}
                      {/* Branch button — appears on any message, forks from this point */}
                      <button
                        onClick={() => {
                          const panelIdx = panels.indexOf(panel);
                          if (panelIdx >= 0) branchFromMessage(panelIdx, i);
                        }}
                        className="p-0.5 rounded text-[var(--color-t3)] hover:text-[var(--color-warning)] hover:bg-[var(--color-bgh)] transition-colors"
                        title="Branch from here"
                        aria-label="Branch from this message"
                      >
                        <GitFork size={11} aria-hidden="true" />
                      </button>
                      {/* Sub-agent button — spawns sub-agent on this message content */}
                      {msg.role === "assistant" && panel.sessionKey && (
                        <button
                          onClick={() => {
                            const text = document.createElement("div");
                            text.innerHTML = msg.content;
                            const plain = (text.textContent || "").trim();
                            const task = plain.slice(0, 200) || "Analyze this";
                            const panelIdx = panels.indexOf(panel);
                            if (panelIdx >= 0) spawnSubAgent(panelIdx, task);
                          }}
                          className="p-0.5 rounded text-[var(--color-t3)] hover:text-[#3b82f6] hover:bg-[var(--color-bgh)] transition-colors"
                          title="Spawn sub-agent"
                          aria-label="Spawn sub-agent"
                        >
                          <Bot size={11} aria-hidden="true" />
                        </button>
                      )}
                      {/* Regen button — only on the LAST assistant message */}
                      {isLastAssistant && panel.sessionKey && (
                        <button
                          onClick={handleRegenLast}
                          className="p-0.5 rounded text-[var(--color-t3)] hover:text-[#22c55e] hover:bg-[var(--color-bgh)] transition-colors"
                          title="Regenerate response"
                          aria-label="Regenerate last response"
                        >
                          <RotateCcw size={11} aria-hidden="true" />
                        </button>
                      )}
                      {/* Pin button */}
                      <button
                        onClick={() => {
                          const panelIdx = panels.indexOf(panel);
                          if (panelIdx < 0) return;
                          if (panel.pinnedIndices?.includes(i)) {
                            unpinMessage(panelIdx, i);
                          } else {
                            pinMessage(panelIdx, i);
                          }
                        }}
                        className={`p-0.5 rounded transition-colors ${
                          panel.pinnedIndices?.includes(i)
                            ? "text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                            : "text-[var(--color-t3)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bgh)]"
                        }`}
                        title={panel.pinnedIndices?.includes(i) ? "Unpin message" : "Pin message"}
                        aria-label={panel.pinnedIndices?.includes(i) ? "Unpin message" : "Pin message"}
                      >
                        <Pin size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {panel.streaming && panel.messages.length === 0 && (
          <div className="flex gap-1 p-3">
            <span className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full animate-bounce" />
            <span className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full animate-bounce [animation-delay:0.15s]" />
            <span className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full animate-bounce [animation-delay:0.3s]" />
          </div>
        )}
      </div>

      {/* ── Stall banner ──────────────────────────────────── */}
      {panel.streaming && elapsedSec > 45 && (
        <div className="absolute bottom-10 left-3 right-3 z-20 bg-[var(--color-bg2)] border border-[var(--color-warning)]/40 rounded-lg px-3 py-2 shadow-lg animate-[fadeIn_0.2s_ease]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--color-warning)]">
              ⏳ Still working? No response in {elapsedSec}s.
            </span>
            <button
              onClick={() => setElapsedSec(0)}
              className="ml-auto text-[9px] text-[var(--color-t3)] hover:text-[var(--color-t2)] px-2 py-0.5 rounded border border-[var(--color-bd)] transition-colors"
            >
              Wait
            </button>
            <button
              onClick={() => {
                // Stop: abort the stream
                const panelIdx = panels.indexOf(panel);
                if (panelIdx >= 0) {
                  // Trigger a stop by sending an empty message or using a stop action
                  // For now: just reset streaming state
                  usePanelStore.setState((s) => ({
                    panels: s.panels.map((p, i) =>
                      i === panelIdx ? { ...p, streaming: false } : p
                    ),
                  }));
                }
              }}
              className="text-[9px] text-[var(--color-danger)] hover:text-white hover:bg-[var(--color-danger)] px-2 py-0.5 rounded border border-[var(--color-danger)]/40 transition-colors"
            >
              Stop
            </button>
          </div>
          {/* Elapsed time bar */}
          <div className="mt-1.5 h-[2px] bg-[var(--color-bg)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-warning)]/60 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min((elapsedSec / 60) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Streaming elapsed indicator ──────────────────── */}
      {panel.streaming && elapsedSec > 5 && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full bg-[var(--color-bg2)]/90 border border-[var(--color-bd)] text-[9px] text-[var(--color-t3)] shadow-sm backdrop-blur-sm animate-[fadeIn_0.3s_ease]">
          Generating… {elapsedSec}s
        </div>
      )}

      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-3 right-3 w-7 h-7 rounded-full bg-[var(--color-bga)] border border-[var(--color-bdl)] text-[var(--color-t2)] hover:text-[var(--color-t1)] hover:bg-[var(--color-bgh)] flex items-center justify-center shadow-lg transition-all z-10 animate-[fadeIn_0.2s_ease]"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <ArrowDown size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
