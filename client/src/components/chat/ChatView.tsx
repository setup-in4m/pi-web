import { useRef, useEffect, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, Copy, Pencil, SendHorizontal, GitFork, Bot } from "lucide-react";
import type { PanelData } from "../../stores/panelStore";
import { usePanelStore } from "../../stores/panelStore";
import { MessageBubble } from "./MessageBubble";
import { ChatSkeleton } from "../Skeletons";
import { useToastStore } from "../../stores/toastStore";

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
  const addToast = useToastStore((s) => s.addToast);

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
    <div className="flex-1 relative min-h-0">
      <div ref={scrollRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto">
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
                    <MessageBubble message={msg} streaming={isStreaming} />
                  )}

                  {!isEditing && !panel.streaming && (
                    <div className={`absolute top-0 ${msg.role === "user" ? "left-2" : "right-2"} opacity-0 group-hover/message:opacity-100 transition-opacity flex gap-0.5`}>
                      <button
                        onClick={() => handleCopyMessage(msg.content)}
                        className="p-0.5 rounded text-[var(--color-t3)] hover:text-[var(--color-t1)] hover:bg-[var(--color-bgh)] transition-colors"
                        title="Copy message"
                      >
                        <Copy size={11} />
                      </button>
                      {msg.role === "user" && (
                        <button
                          onClick={() => handleEditMessage(i, msg.content)}
                          className="p-0.5 rounded text-[var(--color-t3)] hover:text-[var(--color-t1)] hover:bg-[var(--color-bgh)] transition-colors"
                          title="Edit and resend"
                        >
                          <Pencil size={11} />
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
                        >
                          <SendHorizontal size={11} />
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
                      >
                        <GitFork size={11} />
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
                        >
                          <Bot size={11} />
                        </button>
                      )}
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

      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-3 right-3 w-7 h-7 rounded-full bg-[var(--color-bga)] border border-[var(--color-bdl)] text-[var(--color-t2)] hover:text-[var(--color-t1)] hover:bg-[var(--color-bgh)] flex items-center justify-center shadow-lg transition-all z-10 animate-[fadeIn_0.2s_ease]"
          title="Scroll to bottom"
        >
          <ArrowDown size={14} />
        </button>
      )}
    </div>
  );
}
