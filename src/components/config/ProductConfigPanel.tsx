// src/components/config/ProductConfigPanel.tsx
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useConfigStore } from '../../store/configStore'
import { useProjectStore } from '../../store/projectStore'
import { InputField } from '../shared/InputField'
import { SelectField } from '../shared/SelectField'
import { ValidationBadge, fieldResults } from '../shared/ValidationBadge'
import { validateLine } from '../../utils/validation'
import { unitLabel } from '../../utils/unitConverter'
import type { ConveyorLineConfig, PackagingType, ProductOrientation } from '../../types'

interface Props { line: ConveyorLineConfig }

const PKG_OPTIONS: { value: PackagingType; label: string }[] = [
  { value: 'rigid_carton', label: 'Rigid Carton' },
  { value: 'poly_bag',     label: 'Poly Bag'     },
  { value: 'tote',         label: 'Tote'         },
  { value: 'loose_item',   label: 'Loose Item'   },
]

const ORIENTATION_OPTIONS: { value: ProductOrientation; label: string }[] = [
  { value: 'long_axis_parallel',      label: 'Long-axis parallel'      },
  { value: 'long_axis_perpendicular', label: 'Long-axis perpendicular' },
]

export function ProductConfigPanel({ line }: Props) {
  const { addSKU, updateSKU, removeSKU } = useConfigStore(useShallow(s => ({
    addSKU: s.addSKU, updateSKU: s.updateSKU, removeSKU: s.removeSKU,
  })))
  const unitSystem = useProjectStore(s => s.unitSystem)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const validationResults = validateLine(line, unitSystem)
  const dimUnit    = unitLabel('smallLength', unitSystem)
  const weightUnit = unitLabel('weight',      unitSystem)

  const exitOptions = [
    { value: '', label: '— Unassigned —' },
    ...line.exits.map((e, i) => ({ value: e.id, label: `Exit ${i + 1} (${e.side})` })),
  ]

  const totalDist = line.skus.reduce((s, sk) => s + sk.distributionPercent, 0)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Products / SKUs ({line.skus.length})</h3>
        <button
          onClick={() => addSKU(line.id)}
          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          + Add SKU
        </button>
      </div>

      {line.skus.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">No SKUs yet. Add one above.</p>
      )}

      {/* Distribution summary */}
      {line.skus.length >= 2 && (
        <div className={`rounded border px-2 py-1 text-xs ${
          Math.abs(totalDist - 100) < 0.01
            ? 'border-green-300 bg-green-50 text-green-700'
            : 'border-red-300 bg-red-50 text-red-700'
        }`}>
          Distribution total: {totalDist.toFixed(1)}% {Math.abs(totalDist - 100) < 0.01 ? '✓' : '(must equal 100%)'}
        </div>
      )}

      <ValidationBadge results={fieldResults(validationResults, 'skus.distributionPercent')} />

      {line.skus.map((sku, idx) => (
        <div key={sku.id} className="rounded border border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between px-3 py-2">
            <button
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              onClick={() => setExpandedId(expandedId === sku.id ? null : sku.id)}
            >
              <span
                className="inline-block h-3 w-3 rounded-full border border-gray-300"
                style={{ background: sku.color }}
              />
              <span>{expandedId === sku.id ? '▼' : '▶'}</span>
              {sku.name} — {sku.distributionPercent}%
            </button>
            <button
              onClick={() => removeSKU(line.id, sku.id)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Remove
            </button>
          </div>

          <ValidationBadge results={fieldResults(validationResults, `skus[${idx}]`)} />

          {expandedId === sku.id && (
            <div className="flex flex-col gap-3 border-t border-gray-200 px-3 pb-3 pt-3">
              <InputField
                label="SKU Name"
                type="text"
                value={sku.name}
                onChange={v => updateSKU(line.id, sku.id, { name: v as string })}
              />

              <div className="grid grid-cols-3 gap-2">
                <InputField
                  label="Length"
                  value={+sku.length.toFixed(1)}
                  onChange={v => updateSKU(line.id, sku.id, { length: v as number })}
                  unit={dimUnit}
                  min={1}
                  step={unitSystem === 'imperial' ? 0.5 : 5}
                />
                <InputField
                  label="Width"
                  value={+sku.width.toFixed(1)}
                  onChange={v => updateSKU(line.id, sku.id, { width: v as number })}
                  unit={dimUnit}
                  min={1}
                  step={unitSystem === 'imperial' ? 0.5 : 5}
                />
                <InputField
                  label="Height"
                  value={+sku.height.toFixed(1)}
                  onChange={v => updateSKU(line.id, sku.id, { height: v as number })}
                  unit={dimUnit}
                  min={1}
                  step={unitSystem === 'imperial' ? 0.5 : 5}
                />
              </div>

              <InputField
                label="Weight"
                value={+sku.weight.toFixed(2)}
                onChange={v => updateSKU(line.id, sku.id, { weight: v as number })}
                unit={weightUnit}
                min={0.1}
                step={0.1}
              />

              <InputField
                label="CoG Height"
                value={+sku.cogHeight.toFixed(1)}
                onChange={v => updateSKU(line.id, sku.id, { cogHeight: v as number })}
                unit={dimUnit}
                min={0}
                hint="Centre-of-gravity height"
              />

              <SelectField
                label="Packaging Type"
                value={sku.packagingType}
                options={PKG_OPTIONS}
                onChange={v => updateSKU(line.id, sku.id, { packagingType: v as PackagingType })}
              />

              <SelectField
                label="Orientation"
                value={sku.orientation}
                options={ORIENTATION_OPTIONS}
                onChange={v => updateSKU(line.id, sku.id, { orientation: v as ProductOrientation })}
              />

              <InputField
                label="Distribution %"
                value={sku.distributionPercent}
                onChange={v => updateSKU(line.id, sku.id, { distributionPercent: v as number })}
                unit="%"
                min={0}
                max={100}
                step={1}
              />

              <SelectField
                label="Assigned Exit"
                value={sku.assignedExitId ?? ''}
                options={exitOptions}
                onChange={v => updateSKU(line.id, sku.id, { assignedExitId: v || null })}
              />

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Colour</label>
                <input
                  type="color"
                  value={sku.color}
                  onChange={e => updateSKU(line.id, sku.id, { color: e.target.value })}
                  className="h-8 w-16 cursor-pointer rounded border border-gray-300 p-0.5"
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
