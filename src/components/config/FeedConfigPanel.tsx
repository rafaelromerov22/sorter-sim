// src/components/config/FeedConfigPanel.tsx
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'
import { InputField } from '../shared/InputField'
import { SelectField } from '../shared/SelectField'
import { ValidationBadge, fieldResults } from '../shared/ValidationBadge'
import { validateLine } from '../../utils/validation'
import type { ConveyorLineConfig, FeedMode } from '../../types'

interface Props { line: ConveyorLineConfig }

const FEED_MODE_OPTIONS: { value: FeedMode; label: string }[] = [
  { value: 'horizontal', label: 'Horizontal (side-by-side)' },
  { value: 'vertical',   label: 'Vertical (end-to-end)'    },
  { value: 'random',     label: 'Random mix'               },
]

export function FeedConfigPanel({ line }: Props) {
  const updateFeed = useConfigStore(s => s.updateFeed)
  const unitSystem = useProjectStore(s => s.unitSystem)
  const validationResults = validateLine(line, unitSystem)

  const f = line.feed

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold text-gray-800">Feed</h3>

      <SelectField
        label="Feed Mode"
        value={f.mode}
        options={FEED_MODE_OPTIONS}
        onChange={v => updateFeed(line.id, { mode: v as FeedMode })}
      />

      <InputField
        label="Run Duration"
        value={Math.round(f.runDurationSec / 60)}
        onChange={v => updateFeed(line.id, { runDurationSec: (v as number) * 60 })}
        unit="min"
        min={1}
        max={480}
        step={1}
        hint={`${f.runDurationSec} seconds`}
      />

      <InputField
        label="Target Feed Rate"
        value={f.targetPPM}
        onChange={v => updateFeed(line.id, { targetPPM: v as number })}
        unit="PPM"
        min={1}
        max={3000}
        step={5}
      />
      <ValidationBadge results={fieldResults(validationResults, 'feed.targetPPM')} />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Scan Read Rate
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.01}
            value={f.scanReadRate}
            onChange={e => updateFeed(line.id, { scanReadRate: parseFloat(e.target.value) })}
            className="flex-1"
          />
          <span className="w-14 text-right text-sm tabular-nums">
            {(f.scanReadRate * 100).toFixed(0)}%
          </span>
        </div>
        <p className="text-xs text-gray-400">Fraction of barcodes successfully read</p>
      </div>

      <InputField
        label="PLC Latency"
        value={f.plcLatencyMs}
        onChange={v => updateFeed(line.id, { plcLatencyMs: v as number })}
        unit="ms"
        min={1}
        max={500}
        step={1}
      />
      <ValidationBadge results={fieldResults(validationResults, 'feed.plcLatencyMs')} />

      <div className="flex flex-col gap-2">
        {(
          [
            ['Mixed Dimensions',   'mixedDimensions', 'Products vary in size within a run'] ,
            ['Singulated',         'singulated',       'One product at a time on infeed'    ],
            ['Metered Feed',       'metered',          'Feed rate actively controlled by PLC'],
          ] as [string, keyof typeof f, string][]
        ).map(([label, key, hint]) => (
          <label key={key} className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={f[key] as boolean}
              onChange={e => updateFeed(line.id, { [key]: e.target.checked })}
              className="mt-0.5 rounded"
            />
            <span className="flex flex-col">
              <span className="text-sm text-gray-700">{label}</span>
              <span className="text-xs text-gray-400">{hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
