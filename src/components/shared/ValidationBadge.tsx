// src/components/shared/ValidationBadge.tsx
import type { ValidationResult, ValidationSeverity } from '../../types'

const styles: Record<ValidationSeverity, string> = {
  critical: 'bg-red-50 border-red-300 text-red-700',
  warning:  'bg-amber-50 border-amber-300 text-amber-700',
  info:     'bg-blue-50 border-blue-300 text-blue-700',
}

const icons: Record<ValidationSeverity, string> = {
  critical: '✕',
  warning:  '⚠',
  info:     'ℹ',
}

interface Props {
  results: ValidationResult[]
}

export function ValidationBadge({ results }: Props) {
  if (results.length === 0) return null
  return (
    <div className="flex flex-col gap-1 mt-1">
      {results.map((r, i) => (
        <div
          key={i}
          className={`flex items-start gap-1.5 rounded border px-2 py-1 text-xs ${styles[r.severity]}`}
        >
          <span className="shrink-0 font-bold">{icons[r.severity]}</span>
          <span>{r.message}</span>
        </div>
      ))}
    </div>
  )
}

/** Returns results whose field equals the given field or starts with field + '[' */
export function fieldResults(results: ValidationResult[], field: string): ValidationResult[] {
  return results.filter(r => r.field === field || r.field.startsWith(field + '['))
}
