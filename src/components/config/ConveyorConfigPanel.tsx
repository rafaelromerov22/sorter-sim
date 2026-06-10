// src/components/config/ConveyorConfigPanel.tsx
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'
import { InputField } from '../shared/InputField'
import { ValidationBadge, fieldResults } from '../shared/ValidationBadge'
import { validateLine } from '../../utils/validation'
import { unitLabel } from '../../utils/unitConverter'
import { gapTimeSec } from '../../utils/throughputCalc'
import type { ConveyorLineConfig } from '../../types'

interface Props {
  line: ConveyorLineConfig
}

export function ConveyorConfigPanel({ line }: Props) {
  const updateConveyor = useConfigStore(s => s.updateConveyor)
  const unitSystem = useProjectStore(s => s.unitSystem)

  const validationResults = validateLine(line, unitSystem)
  const lenUnit   = unitLabel('length',      unitSystem)
  const speedUnit = unitLabel('speed',       unitSystem)
  const gapUnit   = unitLabel('smallLength', unitSystem)

  const gapSec = gapTimeSec(
    unitSystem === 'imperial' ? line.conveyor.minGapDistance : line.conveyor.minGapDistance / 25.4,
    unitSystem === 'imperial' ? line.conveyor.speed : line.conveyor.speed / 0.3048,
  )

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold text-gray-800">Conveyor</h3>

      <InputField
        label="Belt Length"
        value={+line.conveyor.length.toFixed(3)}
        onChange={v => updateConveyor(line.id, { length: v as number })}
        unit={lenUnit}
        min={1}
        max={unitSystem === 'imperial' ? 2000 : 600}
        step={unitSystem === 'imperial' ? 1 : 0.1}
      />

      <InputField
        label="Belt Width"
        value={+line.conveyor.width.toFixed(3)}
        onChange={v => updateConveyor(line.id, { width: v as number })}
        unit={lenUnit}
        min={0.5}
        max={unitSystem === 'imperial' ? 10 : 3}
        step={unitSystem === 'imperial' ? 0.25 : 0.05}
      />

      <InputField
        label="Belt Speed"
        value={+line.conveyor.speed.toFixed(2)}
        onChange={v => updateConveyor(line.id, { speed: v as number })}
        unit={speedUnit}
        min={1}
        max={unitSystem === 'imperial' ? 600 : 183}
        step={unitSystem === 'imperial' ? 5 : 1}
      />
      <ValidationBadge results={fieldResults(validationResults, 'conveyor.speed')} />

      <InputField
        label="Min Gap Distance"
        value={+line.conveyor.minGapDistance.toFixed(2)}
        onChange={v => updateConveyor(line.id, { minGapDistance: v as number })}
        unit={gapUnit}
        min={0}
        step={unitSystem === 'imperial' ? 0.5 : 5}
        hint={`Gap time: ${gapSec.toFixed(3)} sec`}
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Availability Factor
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.01}
            value={line.conveyor.availabilityFactor}
            onChange={e => updateConveyor(line.id, { availabilityFactor: parseFloat(e.target.value) })}
            className="flex-1"
          />
          <span className="w-12 text-right text-sm tabular-nums">
            {(line.conveyor.availabilityFactor * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <InputField
        label="Encoder Resolution"
        value={line.conveyor.encoderResolution}
        onChange={v => updateConveyor(line.id, { encoderResolution: v as number })}
        unit={`pulses/${lenUnit}`}
        min={1}
        max={10000}
        step={10}
      />
    </div>
  )
}
