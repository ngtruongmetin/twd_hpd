import { useEffect, useMemo, useRef, useState } from 'react'

type RoleSelectorOption<T extends string> = {
  value: T
  label: string
}

type RoleSelectorProps<T extends string> = {
  id: string
  label: string
  value: T
  onChange: (value: T) => void
  options: RoleSelectorOption<T>[]
  required?: boolean
}

export default function RoleSelector<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
  required = false,
}: RoleSelectorProps<T>) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        rootRef.current &&
        !rootRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    if (!q) return options

    return options.filter((o) =>
      o.label.toLowerCase().includes(q)
    )
  }, [query, options])

  const displayValue =
    open
      ? query
      : selectedOption?.label ?? ''

  return (
    <div
      className="vb-field vb-selector"
      ref={rootRef}
    >
      <input
        id={id}
        className="vb-input"
        placeholder=" "
        value={displayValue}
        required={required}
        autoComplete="off"
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
      />

      <label
        className="vb-float-label"
        htmlFor={id}
      >
        {label}
        {required && (
          <span className="vb-required">*</span>
        )}
      </label>

      {open && (
        <div className="vb-selector-menu">
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              className="vb-selector-item"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
                setQuery('')
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}