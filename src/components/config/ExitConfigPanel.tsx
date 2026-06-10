// src/components/config/ExitConfigPanel.tsx
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'
import { InputField } from '../shared/InputField'
import { SelectField } from '../shared/SelectField'
import { ValidationBadge, fieldResults } from '../shared/ValidationBadge'
import { validateLine } from '../../utils/validation'
import { unitLabel } from '../../utils/unitConverter'
import { DIVERTER_PRESETS, presetMidpoint } from '../../constants/diverterPresets'
import type { ConveyorLineConfig, DiverterType, ExitSide, DivertAngle } from '../../types'

interface Props {
  line: ConveyorLineConfig
}

const SIDE_OPTIONS: { value: ExitSide; label: string }[] = [
  { value: 'left',  label: 'Left'  },
  { value: 'right', label: 'Right' },
]

const ANGLE_OPTIONS: { value: string; label: string }[] = [
  { value: '30', label: '30°' },
  { value: '45', label: '45°' },
  { value: '90', label: '90°' },
]

const DIVERTER_OPTIONS: { value: DiverterType; label: string }[] = [
  { value: 'sliding_shoe',   label: 'Sliding Shoe'   },
  { value: 'pop_up_roller',  label: 'Pop-Up Roller'  },
  { value: 'arm_pusher',     label: 'Arm Pusher'     },
  { value: 'mdr_module',     label: 'MDR Module'     },
  { value: 'powered_roller', label: 'Powered Roller' },
]

export function ExitConfigPanel({ line }: Props) {
  const { addExit, updateExit, removeExit } = useConfigStore(useShallow(s => ({
    addExit: s.addExit,
    updateExit: s.updateExit,
    removeExit: s.removeExit,
  })))
  const unitSystem = useProjectStore(s => s.unitSystem)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const validationResults = validateLine(line, unitSystem)
  const lenUnit = unitLabel('length', unitSystem)
  const speedUnit = unitLabel('speed', unitSystem)

  function applyPreset(exitId: string, type: DiverterType) {
    const p = DIVERTER_PRESETS[type]
    updateExit(line.id, exitId, {
      diverterType:        type,
      diverterCycleTime:   presetMidpoint(p.cycleTimeRange),
      diverterExtendTime:  presetMidpoint(p.extendTimeRange),
      diverterRetractTime: presetMidpoint(p.retractTimeRange),
    })
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Exits ({line.exits.length})</h3>
        <button
          onClick={() => addExit(line.id)}
          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          + Add Exit
        </button>
      </div>

      {line.exits.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">No exits yet. Add one above.</p>
      )}

      {line.exits.map((exit, idx) => (
        <div key={exit.id} className="rounded border border-gray-200 bg-gray-50">
          {/* Header row */}
          <div className="flex items-center justify-between px-3 py-2">
            <button
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              onClick={() => setExpandedId(expandedId === exit.id ? null : exit.id)}
            >
              <span>{expandedId === exit.id ? '▼' : '▶'}</span>
              Exit {idx + 1} — {exit.side}, {exit.distanceFromInfeed.toFixed(1)} {lenUnit}
            </button>
            <button
              onClick={() => removeExit(line.id, exit.id)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Remove
            </button>
          </div>

          <ValidationBadge results={fieldResults(validationResults, `exits[${idx}]`)} />

          {/* Expanded fields */}
          {expandedId === exit.id && (
            <div className="flex flex-col gap-3 border-t border-gray-200 px-3 pb-3 pt-3">
              <SelectField
                label="Side"
                value={exit.side}
                options={SIDE_OPTIONS}
                onChange={v => updateExit(line.id, exit.id, { side: v as ExitSide })}
              />
              <InputField
                label="Distance from Infeed"
                value={+exit.distanceFromInfeed.toFixed(1)}
                onChange={v => updateExit(line.id, exit.id, { distanceFromInfeed: v as number })}
                unit={lenUnit}
                min={0}
                step={unitSystem === 'imperial' ? 12 : 0.1}
              />
              <InputField
                label="Lane Width"
                value={+exit.laneWidth.toFixed(1)}
                onChange={v => updateExit(line.id, exit.id, { laneWidth: v as number })}
                unit={lenUnit}
                min={6}
                step={unitSystem === 'imperial' ? 3 : 0.05}
              />
              <InputField
                label="Lane Length"
                value={+exit.laneLength.toFixed(1)}
                onChange={v => updateExit(line.id, exit.id, { laneLength: v as number })}
                unit={lenUnit}
                min={12}
                step={unitSystem === 'imperial' ? 12 : 0.1}
              />
              <InputField
                label="Exit Belt Speed"
                value={+exit.exitSpeed.toFixed(2)}
                onChange={v => updateExit(line.id, exit.id, { exitSpeed: v as number })}
                unit={speedUnit}
                min={1}
              />
              <InputField
                label="Max Queue Depth"
                value={exit.maxQueueDepth}
                onChange={v => updateExit(line.id, exit.id, { maxQueueDepth: v as number })}
                unit="products"
                min={1}
                max={100}
                step={1}
              />
              <SelectField
                label="Divert Angle"
                value={String(exit.angle)}
                options={ANGLE_OPTIONS}
                onChange={v => updateExit(line.id, exit.id, { angle: parseInt(v) as DivertAngle })}
              />

              {/* Diverter type — changes auto-fill preset values */}
              <div className="flex flex-col gap-1">
                <SelectField
                  label="Diverter Type"
                  value={exit.diverterType}
                  options={DIVERTER_OPTIONS}
                  onChange={type => applyPreset(exit.id, type as DiverterType)}
                />
                <p className="text-xs text-gray-400 italic">
                  {DIVERTER_PRESETS[exit.diverterType].notes}
                </p>
              </div>

              <InputField
                label="Cycle Time"
                value={exit.diverterCycleTime}
                onChange={v => updateExit(line.id, exit.id, { diverterCycleTime: v as number })}
                unit="sec"
                min={0.1}
                max={5}
                step={0.01}
                hint={`Range: ${DIVERTER_PRESETS[exit.diverterType].cycleTimeRange.join('–')} sec`}
              />
              <InputField
                label="Extend Time"
                value={exit.diverterExtendTime}
                onChange={v => updateExit(line.id, exit.id, { diverterExtendTime: v as number })}
                unit="sec"
                min={0.05}
                step={0.01}
              />
              <InputField
                label="Retract Time"
                value={exit.diverterRetractTime}
                onChange={v => updateExit(line.id, exit.id, { diverterRetractTime: v as number })}
                unit="sec"
                min={0.05}
                step={0.01}
              />
              <InputField
                label="Sensor Offset"
                value={+exit.sensorOffset.toFixed(2)}
                onChange={v => updateExit(line.id, exit.id, { sensorOffset: v as number })}
                unit={lenUnit}
                min={0}
                step={0.1}
                hint="Distance upstream from divert centre"
              />
              <InputField
                label="Priority"
                value={exit.priority}
                onChange={v => updateExit(line.id, exit.id, { priority: v as number })}
                unit=""
                min={0}
                step={1}
                hint="0 = highest priority; lower value wins on overflow routing"
              />
            </div>
          )}
        </div>
      ))}

      <ValidationBadge results={fieldResults(validationResults, 'exits')} />
    </div>
  )
}
