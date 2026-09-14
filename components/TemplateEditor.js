'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, QrCode, RotateCcw } from 'lucide-react';
import { POSTER_HEIGHT, POSTER_WIDTH, TEXT_FIELDS, defaultLayout } from '@/lib/templates';

const FIELD_KEYS = TEXT_FIELDS.map((f) => f.key);
const SAMPLES = Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, f.sample]));
const LABELS = Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, f.label]));

/** Drag state lives in a ref: it changes every pointer move and must not re-render. */
const emptyDrag = { key: null, startX: 0, startY: 0, originX: 0, originY: 0 };

export default function TemplateEditor({ imageUrl, layout, onChange, disabled = false }) {
  const stageRef = useRef(null);
  const dragRef = useRef(emptyDrag);
  const [stageWidth, setStageWidth] = useState(0);
  const [selected, setSelected] = useState('title');

  // Font sizes are a percentage of the poster width, so the preview needs its
  // own pixel width to scale them down faithfully.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const measure = () => setStageWidth(stage.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const patch = useCallback(
    (key, changes) => {
      onChange({ ...layout, [key]: { ...layout[key], ...changes } });
    },
    [layout, onChange],
  );

  // --- dragging ----------------------------------------------------------
  const onPointerDown = (event, key) => {
    if (disabled) return;
    setSelected(key);
    const stage = stageRef.current.getBoundingClientRect();
    dragRef.current = {
      key,
      stageW: stage.width,
      stageH: stage.height,
      startX: event.clientX,
      startY: event.clientY,
      originX: layout[key].x,
      originY: layout[key].y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag.key) return;
    const dx = ((event.clientX - drag.startX) / drag.stageW) * 100;
    const dy = ((event.clientY - drag.startY) / drag.stageH) * 100;
    patch(drag.key, {
      x: Math.round(Math.min(105, Math.max(-5, drag.originX + dx)) * 10) / 10,
      y: Math.round(Math.min(105, Math.max(-5, drag.originY + dy)) * 10) / 10,
    });
  };

  const endDrag = (event) => {
    if (!dragRef.current.key) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* The pointer may already have been released. */
    }
    dragRef.current = emptyDrag;
  };

  // Arrow keys nudge the selected box, which is both an accessibility path and
  // the only practical way to place something precisely.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (disabled || !selected) return;
      const step = event.shiftKey ? 2 : 0.4;
      const moves = {
        ArrowLeft: { x: -step }, ArrowRight: { x: step },
        ArrowUp: { y: -step }, ArrowDown: { y: step },
      };
      const move = moves[event.key];
      if (!move) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      event.preventDefault();
      patch(selected, {
        x: Math.round((layout[selected].x + (move.x ?? 0)) * 10) / 10,
        y: Math.round((layout[selected].y + (move.y ?? 0)) * 10) / 10,
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, selected, layout, patch]);

  const scale = stageWidth / POSTER_WIDTH;
  const field = selected === 'qr' ? layout.qr : layout[selected];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* ---------------------------------------------------------- stage */}
      <div>
        <div
          ref={stageRef}
          className="relative w-full select-none overflow-hidden rounded-lg bg-gray-900 shadow-inner"
          style={{ aspectRatio: `${POSTER_WIDTH} / ${POSTER_HEIGHT}` }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Template background"
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
          )}

          {FIELD_KEYS.map((key) => {
            const f = layout[key];
            const isSelected = selected === key;
            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                aria-label={`Move ${LABELS[key]}`}
                onPointerDown={(e) => onPointerDown(e, key)}
                onFocus={() => setSelected(key)}
                className={`absolute cursor-move ${
                  isSelected ? 'outline outline-2 outline-offset-2 outline-blue-400' : 'hover:outline hover:outline-1 hover:outline-white/50'
                }`}
                style={{
                  left: `${f.x}%`,
                  top: `${f.y}%`,
                  width: `${f.w}%`,
                  fontSize: `${(f.size / 100) * POSTER_WIDTH * scale}px`,
                  lineHeight: f.lineHeight,
                  color: f.color,
                  textAlign: f.align,
                  fontWeight: f.weight,
                  textTransform: f.uppercase ? 'uppercase' : 'none',
                  textShadow: f.shadow ? '0 3px 14px rgba(0,0,0,.55)' : 'none',
                  overflowWrap: 'anywhere',
                }}
              >
                {SAMPLES[key]}
              </div>
            );
          })}

          {layout.qr.show && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Move QR code"
              onPointerDown={(e) => onPointerDown(e, 'qr')}
              onFocus={() => setSelected('qr')}
              className={`absolute flex cursor-move items-center justify-center ${
                selected === 'qr' ? 'outline outline-2 outline-offset-2 outline-blue-400' : ''
              }`}
              style={{
                left: `${layout.qr.x}%`,
                top: `${layout.qr.y}%`,
                width: `${layout.qr.size}%`,
                aspectRatio: '1 / 1',
                background: layout.qr.bg,
                borderRadius: `${(layout.qr.radius / 100) * POSTER_WIDTH * scale}px`,
                padding: `${(layout.qr.padding / 100) * POSTER_WIDTH * scale}px`,
                border: layout.qr.border > 0
                  ? `${(layout.qr.border / 100) * POSTER_WIDTH * scale}px solid ${layout.qr.borderColor}`
                  : undefined,
              }}
            >
              <QrCode className="h-full w-full text-gray-900" strokeWidth={1.2} aria-hidden="true" />
            </div>
          )}
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Drag a box to move it. Click one to edit it on the right, then use the arrow keys to
          nudge (hold Shift for bigger steps).
        </p>
      </div>

      {/* -------------------------------------------------------- controls */}
      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Editing
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[...FIELD_KEYS, 'qr'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`rounded-md px-2.5 py-1.5 text-sm font-semibold transition ${
                  selected === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-100'
                }`}
              >
                {key === 'qr' ? 'QR code' : LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {selected === 'qr' ? (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={layout.qr.show}
                onChange={(e) => patch('qr', { show: e.target.checked })}
                className="h-4 w-4"
              />
              Show the QR code
            </label>
            <Slider label="Size" value={field.size} min={5} max={60} step={0.5}
              onChange={(v) => patch('qr', { size: v })} suffix="%" />
            <Slider label="Padding" value={field.padding} min={0} max={8} step={0.25}
              onChange={(v) => patch('qr', { padding: v })} suffix="%" />
            <Slider label="Corner radius" value={field.radius} min={0} max={10} step={0.25}
              onChange={(v) => patch('qr', { radius: v })} suffix="%" />
            <Slider label="Border" value={field.border} min={0} max={5} step={0.1}
              onChange={(v) => patch('qr', { border: v })} suffix="%" />
            <ColorRow label="Background" value={field.bg} onChange={(v) => patch('qr', { bg: v })} />
            <ColorRow label="Border colour" value={field.borderColor}
              onChange={(v) => patch('qr', { borderColor: v })} />
          </div>
        ) : (
          <div className="space-y-3">
            <Slider label="Text size" value={field.size} min={1} max={16} step={0.1}
              onChange={(v) => patch(selected, { size: v })} suffix="%" />
            <Slider label="Box width" value={field.w} min={10} max={100} step={1}
              onChange={(v) => patch(selected, { w: v })} suffix="%" />
            <Slider label="Line height" value={field.lineHeight} min={0.8} max={2} step={0.05}
              onChange={(v) => patch(selected, { lineHeight: v })} />

            <div>
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">Align</span>
              <div className="flex gap-1.5">
                {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(
                  ([value, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => patch(selected, { align: value })}
                      aria-label={`Align ${value}`}
                      className={`flex-1 rounded-md p-2 transition ${
                        field.align === value
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={16} className="mx-auto" aria-hidden="true" />
                    </button>
                  ),
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600" htmlFor="tpl-weight">
                Weight
              </label>
              <select
                id="tpl-weight"
                value={field.weight}
                onChange={(e) => patch(selected, { weight: Number(e.target.value) })}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                {[300, 400, 500, 600, 700, 800, 900].map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            <ColorRow label="Colour" value={field.color}
              onChange={(v) => patch(selected, { color: v })} />

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={field.uppercase} className="h-4 w-4"
                onChange={(e) => patch(selected, { uppercase: e.target.checked })} />
              UPPERCASE
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={field.shadow} className="h-4 w-4"
                onChange={(e) => patch(selected, { shadow: e.target.checked })} />
              Shadow (helps on busy backgrounds)
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={() => onChange(defaultLayout())}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 transition hover:bg-gray-100"
        >
          <RotateCcw size={15} aria-hidden="true" /> Reset all positions
        </button>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, suffix = '' }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className="text-xs tabular-nums text-gray-500">
          {Number(value).toFixed(step < 1 ? 1 : 0)}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
        aria-label={label}
      />
    </div>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-gray-600">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-14 cursor-pointer rounded border border-gray-300 bg-white"
        aria-label={label}
      />
    </div>
  );
}
