import { useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { usePanelStore } from "../../stores/panelStore";

interface Props {
  panelIndex: number;
  disabled: boolean;
}

export function Composer({ panelIndex, disabled }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { createAndSend, sendMessage, panels } = usePanelStore();
  const panel = panels[panelIndex];

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
    }
  }, []);

  const handleSend = useCallback(async () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const text = ta.value.trim();
    if (!text) return;

    ta.value = "";
    adjustHeight();

    if (!panel?.sessionKey) {
      await createAndSend(panelIndex, text);
    } else {
      await sendMessage(panelIndex, text);
    }
  }, [panel, panelIndex, createAndSend, sendMessage, adjustHeight]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="border-t border-[var(--color-bd)] p-1.5 bg-[var(--color-bg2)] flex-shrink-0">
      <div className="flex gap-1.5 items-end">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={
            !panel?.workspacePath
              ? "Open a folder to start…"
              : panel.streaming
                ? "Waiting for response…"
                : "Ask pi…"
          }
          disabled={disabled}
          onInput={adjustHeight}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-[var(--color-bg)] border border-[var(--color-bdl)] rounded-lg px-2.5 py-1.5 text-[var(--color-t1)] font-sans text-xs leading-relaxed resize-none min-h-[28px] max-h-[140px] outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0_0_0_2px_var(--color-accent-glow)] placeholder:text-[var(--color-t3)] disabled:opacity-40"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !textareaRef.current?.value?.trim()}
          className="w-[28px] h-[28px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-25 disabled:cursor-not-allowed rounded flex items-center justify-center transition-colors flex-shrink-0"
        >
          <Send size={13} className="text-white" />
        </button>
      </div>
    </div>
  );
}
