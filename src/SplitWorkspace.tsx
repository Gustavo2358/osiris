import { useEffect, useRef, useState, type ReactNode } from 'react';

const DEFAULT_RATIO = 0.58;
const HANDLE_SIZE = 12;
const MIN_GRAPH = 240;
const MIN_SOURCE = 240;

/** Keeps graph/source mounted while resizing; ratio is a presentation preference. */
export function SplitWorkspace({
  children,
  source,
}: {
  children: ReactNode;
  source?: (controls: { expanded: boolean; onToggleExpand: () => void }) => ReactNode;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const [dragging, setDragging] = useState(false);
  const previousRatio = useRef(DEFAULT_RATIO);
  const drag = useRef<{ pointer: number; x: number; pixels: number } | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    if (area.current) observer.observe(area.current);
    return () => observer.disconnect();
  }, []);
  const space = Math.max(1, width - HANDLE_SIZE);
  const min = Math.min(MIN_GRAPH, space / 2) / space;
  const max = 1 - Math.min(MIN_SOURCE, space / 2) / space;
  const shownRatio = expanded ? min : Math.max(min, Math.min(max, ratio));
  function resize(next: number) {
    setExpanded(false);
    setRatio(Math.max(min, Math.min(max, next)));
  }
  return (
    <div
      ref={area}
      className={`graph-source-workspace ${source ? 'split-open' : ''} ${dragging ? 'resizing' : ''}`}
      style={
        source
          ? {
              gridTemplateColumns: `minmax(0, ${shownRatio}fr) ${HANDLE_SIZE}px minmax(0, ${1 - shownRatio}fr)`,
            }
          : undefined
      }
    >
      {children}
      {source && (
        <>
          <div
            className="pane-divider"
            role="separator"
            tabIndex={0}
            aria-label="Ajustar tamanho do grafo e do código"
            aria-orientation="vertical"
            aria-controls="source-pane"
            aria-valuemin={Math.round(min * 100)}
            aria-valuemax={Math.round(max * 100)}
            aria-valuenow={Math.round(shownRatio * 100)}
            aria-valuetext={`${Math.round(shownRatio * 100)}% grafo, ${Math.round((1 - shownRatio) * 100)}% código`}
            title="Arraste para ajustar · Setas ←/→ · Duplo clique para equilibrar"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                pointer: event.pointerId,
                x: event.clientX,
                pixels: space * shownRatio,
              };
              setDragging(true);
            }}
            onPointerMove={(event) => {
              if (drag.current?.pointer === event.pointerId) {
                resize((drag.current.pixels + event.clientX - drag.current.x) / space);
              }
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onLostPointerCapture={() => {
              drag.current = undefined;
              setDragging(false);
            }}
            onPointerCancel={() => {
              drag.current = undefined;
              setDragging(false);
            }}
            onDoubleClick={() => resize(DEFAULT_RATIO)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(event.key)) return;
              event.preventDefault();
              const step = event.shiftKey ? 0.1 : 0.025;
              resize(
                event.key === 'Home'
                  ? min
                  : event.key === 'End'
                    ? max
                    : event.key === 'Enter'
                      ? DEFAULT_RATIO
                      : shownRatio + (event.key === 'ArrowRight' ? step : -step),
              );
            }}
          >
            <span />
          </div>
          {source({
            expanded,
            onToggleExpand: () => {
              if (!expanded) previousRatio.current = ratio;
              else setRatio(previousRatio.current);
              setExpanded(!expanded);
            },
          })}
        </>
      )}
    </div>
  );
}
