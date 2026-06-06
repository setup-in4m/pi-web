import { useState, useRef, useEffect, useMemo } from "react";
import { Star, Clock, ChevronDown, ChevronRight, Zap, AlertCircle, Loader2 } from "lucide-react";
import type { Model } from "../../lib/api";
import type { RecentModelEntry } from "../../stores/modelStore";
import { useModelStore } from "../../stores/modelStore";

// Models with "Recommended" badge
const RECOMMENDED_MODELS: Record<string, true> = {
  "claude-sonnet-4": true,
  "claude-opus-4": true,
  "claude-haiku-4": true,
  "gpt-4o": true,
  "gpt-4.1": true,
  "gemini-2.5-pro": true,
  "gemini-2.5-flash": true,
  "deepseek-chat": true,
  "grok-4": true,
  "llama-4": true,
};

interface Props {
  models: Model[];
  providers: string[];
  recentModels: RecentModelEntry[];
  currentModel: { provider: string; modelId: string } | null;
  onSelect: (provider: string, modelId: string) => void;
  onAddRecent: (provider: string, modelId: string) => void;
}

export function ModelSelector({ models, providers, recentModels, currentModel, onSelect, onAddRecent }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set(providers));
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Recently used lookup (recent entries that exist in current models)
  const recentInList = useMemo(() => {
    return recentModels
      .map((r) => models.find((m) => m.providerId === r.providerId && m.modelId === r.modelId))
      .filter(Boolean) as Model[];
  }, [recentModels, models]);

  // Group models by provider
  const grouped = useMemo(() => {
    const map = new Map<string, Model[]>();
    for (const m of models) {
      const list = map.get(m.providerId) || [];
      list.push(m);
      map.set(m.providerId, list);
    }
    return map;
  }, [models]);

  const handleSelect = (provider: string, modelId: string) => {
    onSelect(provider, modelId);
    onAddRecent(provider, modelId);
    setOpen(false);
  };

  const toggleProvider = (prov: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(prov)) next.delete(prov);
      else next.add(prov);
      return next;
    });
  };

  const { defaultProvider, defaultModel, loading: modelsLoading } = useModelStore();
  const defaultModelObj = models.find(m => m.providerId === defaultProvider && m.modelId === defaultModel);
  const hasModels = models.length > 0;
  const currentDisplay = hasModels
    ? (currentModel
        ? models.find((m) => m.providerId === currentModel.provider && m.modelId === currentModel.modelId)?.displayName || `${currentModel.provider}/${currentModel.modelId}`
        : defaultModelObj?.displayName || defaultModel || "pi default")
    : "No models";
  const isDefaultSelected = !currentModel && !!defaultModelObj;
  const isDefaultActive = (model: Model) =>
    !!defaultModelObj &&
    model.providerId === defaultProvider &&
    model.modelId === defaultModel;

  return (
    <div className="relative flex-shrink-0" ref={containerRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 bg-[var(--color-bg3)] border rounded px-1.5 py-0.5 text-[9px] font-sans cursor-pointer max-w-[130px] outline-none transition-colors ${
          !hasModels && !modelsLoading
            ? "text-[var(--color-warning)] border-[var(--color-warning)]/40 hover:border-[var(--color-warning)]"
            : "text-[var(--color-t2)] border-[var(--color-bd)] hover:border-[var(--color-bdl)]"
        }`}
        title={!hasModels ? "No models available" : currentModel ? currentDisplay : `Default: ${currentDisplay}`}
      >
        {!hasModels && !modelsLoading && (
          <AlertCircle size={8} className="text-[var(--color-warning)] flex-shrink-0" />
        )}
        {!hasModels && modelsLoading && (
          <Loader2 size={8} className="animate-spin text-[var(--color-t3)] flex-shrink-0" />
        )}
        {hasModels && isDefaultSelected && (
          <Zap size={8} className="text-[var(--color-accent)] flex-shrink-0" />
        )}
        <span className="truncate">{modelsLoading ? "Loading…" : currentDisplay}</span>
        <ChevronDown size={9} className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-[280px] bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col">
          {/* List */}
          <div className="max-h-[320px] overflow-y-auto">
            {/* Empty / loading state */}
            {!hasModels && (
              <div className="px-4 py-6 flex flex-col items-center gap-2 text-center">
                {modelsLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-[var(--color-t3)]" />
                    <span className="text-[10px] text-[var(--color-t3)]">Loading models…</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} className="text-[var(--color-warning)]" />
                    <div className="text-[10px] text-[var(--color-t2)]">
                      No models found.
                    </div>
                    <div className="text-[9px] text-[var(--color-t3)] leading-relaxed">
                      Configure providers in pi CLI settings<br />
                      or check that the pi server is running.
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Recently used section */}
            {hasModels && recentInList.length > 0 && (
              <div className="border-b border-[var(--color-bd)]">
                <div className="px-3 py-1.5 text-[9px] text-[var(--color-t3)] font-medium flex items-center gap-1">
                  <Clock size={10} />
                  Recently used
                </div>
                {recentInList.map((m) => (
                  <ModelRow
                    key={`recent-${m.providerId}/${m.modelId}`}
                    model={m}
                    selected={
                      currentModel?.provider === m.providerId &&
                      currentModel?.modelId === m.modelId
                    }
                    onSelect={() => handleSelect(m.providerId, m.modelId)}
                    isDefault={isDefaultActive(m)}
                  />
                ))}
              </div>
            )}

            {/* Default indicator */}
            {defaultModelObj && (
              <div className="px-3 py-1.5 border-b border-[var(--color-bd)] flex items-center gap-2">
                <span className="text-[9px] text-[var(--color-t3)]">Default:</span>
                <span className="text-[10px] font-medium text-[var(--color-t2)]">{defaultModelObj.displayName}</span>
                <span className="text-[8px] text-[var(--color-t3)] bg-[var(--color-bg3)] px-1 rounded">{defaultModelObj.providerId}</span>
                <span
                  onClick={() => onSelect(defaultProvider, defaultModel)}
                  className="ml-auto text-[9px] text-[var(--color-accent)] hover:underline cursor-pointer"
                >
                  Use default
                </span>
              </div>
            )}

            {/* Grouped by provider */}
            {hasModels && providers
                  .filter((prov) => grouped.has(prov))
                  .map((prov) => {
                    const list = grouped.get(prov)!;
                    const expanded = expandedProviders.has(prov);
                    return (
                      <div key={prov}>
                        {/* Provider header */}
                        <div
                          onClick={() => toggleProvider(prov)}
                          className="flex items-center gap-1 px-3 py-1 text-[9px] text-[var(--color-t3)] font-medium cursor-pointer hover:bg-[var(--color-bgh)] transition-colors border-b border-[var(--color-bd)] sticky top-0 bg-[var(--color-bg2)] z-10"
                        >
                          <ChevronRight
                            size={9}
                            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                          />
                          {prov}
                          <span className="ml-auto">{list.length}</span>
                        </div>
                        {expanded &&
                          list.map((m) => (
                            <ModelRow
                              key={`${m.providerId}/${m.modelId}`}
                              model={m}
                              selected={
                                currentModel?.provider === m.providerId &&
                                currentModel?.modelId === m.modelId
                              }
                              onSelect={() => handleSelect(m.providerId, m.modelId)}
                              isDefault={isDefaultActive(m)}
                            />
                          ))}
                      </div>
                    );
                  })}
          </div>
        </div>
      )}
    </div>
  );
}

function ModelRow({
  model,
  selected,
  onSelect,
  isDefault,
}: {
  model: Model;
  selected: boolean;
  onSelect: () => void;
  isDefault?: boolean;
}) {
  const isRec = RECOMMENDED_MODELS[model.modelId] ?? false;

  return (
    <div
      onClick={onSelect}
      className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between gap-2 ${
        selected
          ? "bg-[var(--color-accent)]/10 border-l-2 border-[var(--color-accent)]"
          : "hover:bg-[var(--color-bgh)] border-l-2 border-transparent"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[11px] font-medium truncate ${
              selected ? "text-[var(--color-accent)]" : "text-[var(--color-t1)]"
            }`}
          >
            {model.displayName}
          </span>
          {isDefault && (
            <span className="flex items-center gap-0.5 text-[8px] text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-1 rounded flex-shrink-0">
              <Zap size={7} />
              Default
            </span>
          )}
          {isRec && !isDefault && (
            <span className="flex items-center gap-0.5 text-[8px] text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-1 rounded flex-shrink-0">
              <Star size={7} />
              Rec
            </span>
          )}
        </div>
        <div className="text-[8px] text-[var(--color-t3)] mt-0.5 flex items-center gap-2">
          <span>{model.providerId}</span>
          {model.contextWindow && (
            <span>{model.contextWindow >= 1000 ? `${model.contextWindow / 1000}K` : model.contextWindow}</span>
          )}
        </div>
      </div>

      {/* Cost indicator */}
      {model.cost && (
        <div className="text-[8px] text-[var(--color-t3)] text-right flex-shrink-0">
          <span className="tabular-nums">
            ${model.cost.input.toFixed(0)}/$
            {(model.cost.output ?? model.cost.input).toFixed(0)}
          </span>
          <div className="text-[7px]">/1M</div>
        </div>
      )}
    </div>
  );
}
