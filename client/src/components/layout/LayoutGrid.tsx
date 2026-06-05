import { useRef, useCallback } from "react";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { usePanelStore } from "../../stores/panelStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { Panel } from "../panel/Panel";
import { ErrorBoundary } from "../ErrorBoundary";

export function LayoutGrid() {
  const panels = usePanelStore((s) => s.panels);
  const activeIndex = usePanelStore((s) => s.activeIndex);
  const { preset, savedSizes, saveSizes } = useLayoutStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const n = panels.length;

  const handleResize = useCallback(
    (sizes: number[]) => {
      saveSizes(preset, sizes);
    },
    [preset, saveSizes]
  );

  // Render based on preset
  const renderLayout = () => {
    switch (preset) {
      case "single":
        return renderSingle();
      case "2h":
        return renderHorizontal(n);
      case "2v":
        return renderVertical(n);
      case "2x2":
        return render2x2(n);
      case "3h":
        return renderHorizontal(n);
      case "3v":
        return renderVertical(n);
      case "col3":
        return renderCol3(n);
      default:
        return renderSingle();
    }
  };

  const renderSingle = () => (
    <div className="flex-1 bg-[var(--color-bg)] overflow-hidden min-h-0 h-full outline-2 outline-[var(--color-accent)] outline-offset-[-2px]">
      <ErrorBoundary>
        <Panel panel={panels[activeIndex] || panels[0]} isActive={true} panelIndex={activeIndex} />
      </ErrorBoundary>
    </div>
  );

  const renderHorizontal = (count: number) => (
    <Allotment defaultSizes={savedSizes["2h"]} onChange={handleResize}>
      {panels.slice(0, count).map((p, i) => (
        <Allotment.Pane key={p.id} minSize={200}>
          <ErrorBoundary>
            <Panel panel={p} isActive={i === activeIndex} panelIndex={i} />
          </ErrorBoundary>
        </Allotment.Pane>
      ))}
    </Allotment>
  );

  const renderVertical = (count: number) => (
    <Allotment vertical defaultSizes={savedSizes["2v"]} onChange={handleResize}>
      {panels.slice(0, count).map((p, i) => (
        <Allotment.Pane key={p.id} minSize={150}>
          <ErrorBoundary>
            <Panel panel={p} isActive={i === activeIndex} panelIndex={i} />
          </ErrorBoundary>
        </Allotment.Pane>
      ))}
    </Allotment>
  );

  const render2x2 = (count: number) => {
    const topCount = Math.min(2, count);
    const bottomCount = Math.min(2, Math.max(0, count - 2));

    return (
      <Allotment vertical defaultSizes={savedSizes["2x2"]}>
        <Allotment.Pane minSize={150}>
          <Allotment>
            {panels.slice(0, topCount).map((p, i) => (
              <Allotment.Pane key={p.id} minSize={200}>
                <ErrorBoundary>
                  <Panel panel={p} isActive={i === activeIndex} panelIndex={i} />
                </ErrorBoundary>
              </Allotment.Pane>
            ))}
          </Allotment>
        </Allotment.Pane>
        {bottomCount > 0 && (
          <Allotment.Pane minSize={150}>
            <Allotment>
              {panels.slice(topCount, topCount + bottomCount).map((p, i) => (
                <Allotment.Pane key={p.id} minSize={200}>
                  <ErrorBoundary>
                    <Panel panel={p} isActive={topCount + i === activeIndex} panelIndex={topCount + i} />
                  </ErrorBoundary>
                </Allotment.Pane>
              ))}
            </Allotment>
          </Allotment.Pane>
        )}
      </Allotment>
    );
  };

  const renderCol3 = (count: number) => {
    if (count <= 1) return renderSingle();
    if (count === 2) return renderHorizontal(2);

    // Distribute panels across 3 columns
    const colCount = Math.min(3, count);
    const panelsPerCol = Math.ceil(count / colCount);

    const cols: number[][] = [];
    for (let c = 0; c < colCount; c++) {
      const start = c * panelsPerCol;
      const end = Math.min(start + panelsPerCol, count);
      cols.push(panels.slice(start, end).map((_, i) => start + i));
    }

    return (
      <Allotment defaultSizes={savedSizes["col3"]}>
        {cols.map((colIndices, colIdx) => (
          <Allotment.Pane key={colIdx} minSize={200}>
            <Allotment vertical>
              {colIndices.map((panelIdx) => {
                const p = panels[panelIdx];
                return (
                  <Allotment.Pane key={p.id} minSize={120}>
                    <ErrorBoundary>
                      <Panel panel={p} isActive={panelIdx === activeIndex} panelIndex={panelIdx} />
                    </ErrorBoundary>
                  </Allotment.Pane>
                );
              })}
            </Allotment>
          </Allotment.Pane>
        ))}
      </Allotment>
    );
  };

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden min-h-0 bg-[var(--color-bd)]" style={{ gap: 0 }} key={preset}>
      {renderLayout()}
    </div>
  );
}
