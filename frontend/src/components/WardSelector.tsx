import { useEffect, useMemo, useRef, useState } from 'react'

export type WardOption = {
  code: number
  name: string
}

type WardApiItem = {
  code: number
  name: string
}

type ProvinceDetail = {
  wards: WardApiItem[]
}

type WardSelectorProps = {
  provinceCode: number | null
  value: WardOption | null
  onChange: (ward: WardOption | null) => void
}

export default function WardSelector({ provinceCode, value, onChange }: WardSelectorProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<WardOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const previousProvinceCodeRef = useRef<number | null | undefined>(undefined)

  useEffect(() => {
    const isFirstRender = previousProvinceCodeRef.current === undefined
    const provinceChanged = previousProvinceCodeRef.current !== provinceCode
    previousProvinceCodeRef.current = provinceCode

    if (!isFirstRender && provinceChanged) {
      onChange(null)
      setQuery('')
      setIndex(0)
      setOpen(false)
    }

    if (!provinceCode) {
      setOptions([])
      setLoading(false)
      setError('')
      return
    }

    let cancelled = false

    async function loadWards() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`https://provinces.open-api.vn/api/v2/p/${provinceCode}?depth=2`)
        if (!res.ok) {
          throw new Error('Không tải được danh sách phường/xã')
        }
        const data = (await res.json()) as ProvinceDetail
        if (!cancelled) {
          const wards = (data.wards ?? []).map((w) => ({ code: w.code, name: w.name }))
          setOptions(wards)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Không tải được danh sách phường/xã')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadWards()
    return () => {
      cancelled = true
    }
  }, [provinceCode, onChange])

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
    return options.filter((w) => w.name.toLowerCase().includes(q))
  }, [options, query])

  const disabled = !provinceCode
  const displayValue = open ? query : (value?.name ?? '')

  function selectWard(ward: WardOption) {
    onChange(ward)
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
      const ward = filtered[index]
      if (ward) {
        selectWard(ward)
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="vb-field vb-selector">
      <div ref={rootRef}>
        <input
          id="ward_name"
          className="vb-input"
          placeholder=" "
          value={displayValue}
          required
          autoComplete="off"
          disabled={disabled}
          onFocus={() => {
            if (disabled) {
              return
            }
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
        <label className="vb-float-label" htmlFor="ward_name">Phường/Xã <span className="vb-required">*</span></label>

        {open && !disabled && (
          <div ref={listRef} className="vb-selector-menu">
            {loading && <div className="vb-selector-item is-muted">Đang tải phường/xã...</div>}
            {!loading && error && <div className="vb-selector-item is-error">{error}</div>}
            {!loading && !error && filtered.length === 0 && <div className="vb-selector-item is-muted">Không có kết quả</div>}
            {!loading && !error && filtered.map((w, i) => (
              <button
                type="button"
                key={w.code}
                className={`vb-selector-item ${i === index ? 'is-active' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => selectWard(w)}
              >
                {w.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
