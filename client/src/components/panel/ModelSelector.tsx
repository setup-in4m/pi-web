import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Star, Clock, ChevronDown, ChevronRight, Zap } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set(providers));
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [open]);

  const filteredModels = useMemo(() => {
    if (!search.trim()) return models;
    const lower = search.toLowerCase();
    return models.filter(
      (m) =>
        m.displayName.toLowerCase().includes(lower) ||
        m.providerId.toLowerCase().includes(lower) ||
        m.modelId.toLowerCase().includes(lower)
    );
  }, [models, search]);

  // Recently used lookup (recent entries that exist in current models)
  const recentInList = useMemo(() => {
    return recentModels
      .map((r) => models.find((m) => m.providerId === r.providerId && m.modelId === r.modelId))
      .filter(Boolean) as Model[];
  }, [recentModels, models]);

  // Group filtered models by provider
  const grouped = useMemo(() => {
    const map = new Map<string, Model[]>();
    for (const m of filteredModels) {
      const list = map.get(m.providerId) || [];
      list.push(m);
      map.set(m.providerId, list);
    }
    return map;
  }, [filteredModels]);

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

  const { defaultProvider, defaultModel } = useModelStore();
  const defaultModelObj = models.find(m => m.providerId === defaultProvider && m.modelId === defaultModel);
  const currentDisplay = currentModel
    ? models.find((m) => m.providerId === currentModel.provider && m.modelId === currentModel.modelId)?.displayName || `${currentModel.provider}/${currentModel.modelId}`
    : defaultModelObj?.displayName || defaultModel || "pi default";
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
        className="flex items-center gap-1 bg-[var(--color-bg3)] text-[var(--color-t2)] border border-[var(--color-bd)] rounded px-1.5 py-0.5 text-[9px] font-sans cursor-pointer max-w-[130px] outline-none hover:border-[var(--color-bdl)] transition-colors"
        title={currentModel ? currentDisplay : `Default: ${currentDisplay}`}
      >
        {isDefaultSelected && (
          <Zap size={8} className="text-[var(--color-accent)] flex-shrink-0" />
        )}
        <span className="truncate">{currentDisplay}</span>
        <ChevronDown size={9} className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-[280px] bg-[var(--color-bg2)] border border-[var(--color-bdl)] rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--color-bd)]">
            <Search size={12} className="text-[var(--color-t3)] flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models…"
              className="flex-1 bg-transparent text-[11px] text-[var(--color-t1)] outline-none placeholder:text-[var(--color-t3)]"
            />
          </div>

          {/* List */}
          <div className="max-h-[320px] overflow-y-auto">
            {/* Recently used section */}
            {recentInList.length > 0 && !search && (
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

            {/* Default indicator section (non-interactive, info only) */}
            {!search && defaultModelObj && (
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
            {search
              ? // Flat list when searching
                filteredModels.map((m) => (
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
                ))
              : providers
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
