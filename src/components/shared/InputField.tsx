// src/components/shared/InputField.tsx
interface InputFieldProps {
  label: string
  value: number | string
  onChange: (value: number | string) => void
  type?: 'number' | 'text'
  unit?: string
  min?: number
  max?: number
  step?: number
  error?: string
  hint?: string
  disabled?: boolean
}

export function InputField({
  label, value, onChange, type = 'number',
  unit, min, max, step, error, hint, disabled,
}: InputFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type={type}
          value={value}
          min={min}
          max={max}
          step={step ?? (type === 'number' ? 'any' : undefined)}
          disabled={disabled}
          onChange={e =>
            onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)
          }
          className={`w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 ${
            error
              ? 'border-red-400 focus:ring-red-300'
              : 'border-gray-300 focus:ring-blue-300'
          } disabled:bg-gray-50 disabled:text-gray-400`}
        />
        {unit && (
          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-1 text-xs text-gray-500">
            {unit}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}
