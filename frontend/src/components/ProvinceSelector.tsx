import { useEffect, useMemo, useRef, useState } from 'react'

export type ProvinceOption = {
  code: number
  name: string
}

type ProvinceApiItem = {
  code: number
  name: string
}

type ProvinceSelectorProps = {
  value: ProvinceOption | null
  onChange: (province: ProvinceOption | null) => void
}

export default function ProvinceSelector({ value, onChange }: ProvinceSelectorProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ProvinceOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadProvinces() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('https://provinces.open-api.vn/api/v2/p/')
        if (!res.ok) {
          throw new Error('Không tải được danh sách tỉnh/thành')
        }
        const data = (await res.json()) as ProvinceApiItem[]
        if (!cancelled) {
          setOptions(data.map((p) => ({ code: p.code, name: p.name })))
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Không tải được danh sách tỉnh/thành')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProvinces()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    const list = listRef.current
    if (!list) {
      return
    }
    const item = list.children[index] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [index, open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return options
    }
    return options.filter((p) => p.name.toLowerCase().includes(q))
  }, [options, query])

  const displayValue = open ? query : (value?.name ?? '')

  function selectProvince(province: ProvinceOption) {
    onChange(province)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => Math.min(i + 1, filtered.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const province = filtered[index]
      if (province) {
        selectProvince(province)
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="vb-field vb-selector" ref={rootRef}>
      <input
        id="province_name"
        className="vb-input"
        placeholder=" "
        value={displayValue}
        required
        autoComplete="off"
        onFocus={() => {
          setOpen(true)
          setQuery(value?.name ?? '')
          setIndex(0)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setIndex(0)
          onChange(null)
        }}
        onKeyDown={onKeyDown}
      />
      <label className="vb-float-label" htmlFor="province_name">Tỉnh/Thành phố <span className="vb-required">*</span></label>

      {open && (
        <div ref={listRef} className="vb-selector-menu">
          {loading && <div className="vb-selector-item is-muted">Đang tải tỉnh/thành...</div>}
          {!loading && error && <div className="vb-selector-item is-error">{error}</div>}
          {!loading && !error && filtered.length === 0 && <div className="vb-selector-item is-muted">Không có kết quả</div>}
          {!loading && !error && filtered.map((p, i) => (
            <button
              type="button"
              key={p.code}
              className={`vb-selector-item ${i === index ? 'is-active' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => selectProvince(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
