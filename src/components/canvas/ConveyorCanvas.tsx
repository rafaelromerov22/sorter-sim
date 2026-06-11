// src/components/canvas/ConveyorCanvas.tsx
import { useRef, useEffect, useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useConfigStore } from '../../store/configStore'
import { drawFrame } from './canvasRenderer'
import type { CanvasExit } from './canvasRenderer'
import type { UnitSystem, ConveyorLineConfig } from '../../types'

// ── Unit helpers ─────────────────────────────────────────────────────────────
const FT_PER_M   = 3.28084
const FT_PER_IN  = 1 / 12
const FT_PER_MM  = 1 / 304.8

function conveyorToFt(v: number, us: UnitSystem): number {
  return us === 'metric' ? v * FT_PER_M : v * FT_PER_IN
}
function skuDimToFt(v: number, us: UnitSystem): number {
  return us === 'metric' ? v * FT_PER_MM : v * FT_PER_IN
}

function buildSkuMap(line: ConveyorLineConfig, us: UnitSystem) {
  return new Map(
    line.skus.map(sku => [
      sku.id,
      {
        color:       sku.color,
        lengthFt:    skuDimToFt(sku.length, us),
        widthFt:     skuDimToFt(sku.width, us),
        orientation: sku.orientation,
      },
    ]),
  )
}

function buildExits(line: ConveyorLineConfig, us: UnitSystem): CanvasExit[] {
  return line.exits.map(e => ({
    id: e.id,
    side: e.side,
    angle: e.angle,
    distanceFromInfeedFt: conveyorToFt(e.distanceFromInfeed, us),
    laneWidthFt: conveyorToFt(e.laneWidth, us),
    laneLengthFt: conveyorToFt(e.laneLength, us),
  }))
}

// ── Component ────────────────────────────────────────────────────────────────
export function ConveyorCanvas() {
  const { simFullResultByLine, lines, activeLineId, unitSystem } = useConfigStore(
    useShallow(s => ({
      simFullResultByLine: s.simFullResultByLine,
      lines: s.lines,
      activeLineId: s.activeLineId,
      unitSystem: s.unitSystem,
    })),
  )
  const line = lines.find(l => l.id === activeLineId)
  const simFullResult = activeLineId ? simFullResultByLine[activeLineId] ?? null : null

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef       = useRef<number | null>(null)
  const lastTsRef    = useRef<number | null>(null)
  const simTimeRef   = useRef(0)

  const [simTime, setSimTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed]     = useState<1 | 2 | 5 | 10>(1)

  const runDuration = simFullResult?.runDurationSec ?? 0

  // ── Draw one frame ──────────────────────────────────────────────────────────
  const draw = useCallback(
    (t: number) => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container || !simFullResult || !line) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width  = container.clientWidth
      canvas.height = Math.max(180, container.clientHeight - 56) // 56 = toolbar height

      const beltLengthFt = conveyorToFt(line.conveyor.length, unitSystem)
      const beltWidthFt  = conveyorToFt(line.conveyor.width, unitSystem)
      const beltSpeedFpm = unitSystem === 'metric'
        ? line.conveyor.speed * FT_PER_M
        : line.conveyor.speed

      drawFrame({
        ctx,
        canvasWidth:  canvas.width,
        canvasHeight: canvas.height,
        simTime: t,
        beltLengthFt,
        beltWidthFt,
        beltSpeedFpm,
        exits:  buildExits(line, unitSystem),
        skuMap: buildSkuMap(line, unitSystem),
        packages: simFullResult.packages,
      })
    },
    [simFullResult, line, unitSystem],
  )

  // ── Animation loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    const tick = (ts: number) => {
      const elapsed = lastTsRef.current !== null ? (ts - lastTsRef.current) / 1000 : 0
      lastTsRef.current = ts

      const next = Math.min(simTimeRef.current + elapsed * speed, runDuration)
      simTimeRef.current = next
      setSimTime(next)
      draw(next)

      if (next >= runDuration) {
        setPlaying(false)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    lastTsRef.current = null
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, speed, runDuration, draw])

  // ── Controls ────────────────────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (simTime >= runDuration) {
      simTimeRef.current = 0
      setSimTime(0)
    }
    setPlaying(p => !p)
  }

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value)
    setPlaying(false)
    simTimeRef.current = t
    setSimTime(t)
    draw(t)
  }

  if (!simFullResult || !line) return null

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-2 p-4">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3">
        <button
          onClick={handlePlayPause}
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          {playing ? '⏸' : '▶'}
        </button>

        {/* Speed pills */}
        <div className="flex gap-1">
          {([1, 2, 5, 10] as const).map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                speed === s
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Scrubber */}
        <input
          type="range"
          min={0}
          max={runDuration}
          step={0.1}
          value={simTime}
          onChange={handleScrub}
          className="flex-1"
        />

        {/* Time display */}
        <span className="shrink-0 text-xs tabular-nums text-gray-500">
          t&nbsp;=&nbsp;{simTime.toFixed(1)}s&nbsp;/&nbsp;{runDuration.toFixed(0)}s
        </span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full flex-1 rounded-lg border border-gray-200 bg-white"
      />
    </div>
  )
}
