import { useEffect, useRef, useState } from "react"
import Slider from "rc-slider"
import "rc-slider/assets/index.css"
import TranslatedText from "../components/TranslatedText"

const INFINITY_SYMBOL = "\u221E"
const NUMERIC_INPUT_PATTERN = /^\d*$/
const PRICE_FILTER_STEP = 1

const PriceFilter = ({ min, max, onApply, initialRange, isApplied = false }) => {
  const minBound = Number.isFinite(Number(min)) ? Number(min) : 0
  const rawMaxBound = Number.isFinite(Number(max)) ? Number(max) : minBound
  const maxBound = rawMaxBound >= minBound ? rawMaxBound : minBound
  const appliedMinFromProps =
    Array.isArray(initialRange) && initialRange.length === 2 && Number.isFinite(Number(initialRange[0]))
      ? Number(initialRange[0])
      : 0
  const appliedMaxFromProps =
    Array.isArray(initialRange) && initialRange.length === 2 && Number.isFinite(Number(initialRange[1]))
      ? Number(initialRange[1])
      : Number.POSITIVE_INFINITY
  const hasInfiniteUpperBound =
    Array.isArray(initialRange) && initialRange.length === 2 && !Number.isFinite(Number(initialRange[1]))

  const normalizeRange = (maybeRange) => {
    const raw = Array.isArray(maybeRange) && maybeRange.length === 2 ? maybeRange : [minBound, maxBound]

    let nextMin = Number(raw[0])
    let nextMax = Number(raw[1])

    if (!Number.isFinite(nextMin)) nextMin = minBound
    if (!Number.isFinite(nextMax)) nextMax = maxBound

    nextMin = Math.max(minBound, Math.min(nextMin, maxBound))
    nextMax = Math.max(minBound, Math.min(nextMax, maxBound))

    if (nextMin > nextMax) [nextMin, nextMax] = [nextMax, nextMin]

    return [nextMin, nextMax]
  }

  const [range, setRange] = useState(() => normalizeRange(initialRange))
  const [inputMin, setInputMin] = useState("0")
  const [inputMax, setInputMax] = useState(INFINITY_SYMBOL)
  const isUserAdjustingSliderRef = useRef(false)

  useEffect(() => {
    const next = normalizeRange(initialRange)
    setRange(next)

    if (isApplied) {
      setInputMin(String(appliedMinFromProps))
      setInputMax(hasInfiniteUpperBound ? INFINITY_SYMBOL : String(appliedMaxFromProps))
      return
    }

    setInputMin("0")
    setInputMax(INFINITY_SYMBOL)
  }, [initialRange, isApplied, minBound, maxBound, hasInfiniteUpperBound, appliedMinFromProps, appliedMaxFromProps])

  const handleSliderChange = (values) => {
    setRange(values)
    if (!isUserAdjustingSliderRef.current) return

    setInputMin(String(values[0]))
    setInputMax(String(values[1]))
  }

  const handleSliderStart = () => {
    isUserAdjustingSliderRef.current = true
  }

  const handleSliderEnd = () => {
    isUserAdjustingSliderRef.current = false
  }

  const handleInputMin = (e) => {
    const value = e.target.value
    if (value === "") {
      setInputMin("")
      return
    }

    if (NUMERIC_INPUT_PATTERN.test(value)) {
      const numericValue = Number(value)
      if (!Number.isFinite(numericValue)) {
        return
      }

      const clampedValue = Math.max(minBound, Math.min(numericValue, range[1]))
      setInputMin(String(clampedValue))
      setRange([clampedValue, range[1]])
    }
  }

  const handleInputMax = (e) => {
    const value = e.target.value
    if (value === "") {
      setInputMax("")
      return
    }

    if (value === INFINITY_SYMBOL) {
      setInputMax(INFINITY_SYMBOL)
      setRange([range[0], maxBound])
      return
    }

    if (NUMERIC_INPUT_PATTERN.test(value)) {
      const numericValue = Number(value)
      if (!Number.isFinite(numericValue)) {
        return
      }

      const clampedValue = Math.max(range[0], Math.min(numericValue, maxBound))
      setInputMax(String(clampedValue))
      setRange([range[0], clampedValue])
    }
  }

  const handleMinFocus = () => setInputMin("")
  const handleMaxFocus = () => setInputMax((prev) => (prev === INFINITY_SYMBOL ? "" : prev))

  const handleApply = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const parsedMin = inputMin === "" ? minBound : Number(inputMin)
    const normalizedMin = Number.isFinite(parsedMin)
      ? Math.max(minBound, Math.min(parsedMin, maxBound))
      : minBound

    const parsedMax =
      inputMax === "" || inputMax === INFINITY_SYMBOL ? Number.POSITIVE_INFINITY : Number(inputMax)
    const normalizedMax = Number.isFinite(parsedMax)
      ? Math.max(normalizedMin, Math.min(parsedMax, maxBound))
      : Number.POSITIVE_INFINITY

    onApply([normalizedMin, normalizedMax])
  }

  return (
    <div className="">
      <Slider
        range
        min={minBound}
        max={maxBound}
        step={PRICE_FILTER_STEP}
        value={range}
        onChange={handleSliderChange}
        onBeforeChange={handleSliderStart}
        onChangeComplete={handleSliderEnd}
        trackStyle={[{ backgroundColor: "rgb(var(--brand-500))" }]}
        handleStyle={[
          { backgroundColor: "rgb(var(--brand-500))", borderColor: "rgb(var(--brand-500))" },
          { backgroundColor: "rgb(var(--brand-500))", borderColor: "rgb(var(--brand-500))" },
        ]}
        railStyle={{ backgroundColor: "#e5e7eb" }}
      />
      <div className="flex justify-between mt-4 mb-2 text-xs font-semibold">
        <span>MIN</span>
        <span>MAX</span>
      </div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          inputMode="numeric"
          className="w-1/2 border rounded px-2 py-1 text-center focus:border-lime-500 focus:ring-lime-500"
          value={inputMin}
          onChange={handleInputMin}
          onFocus={handleMinFocus}
          onBlur={() => {
            if (inputMin === "") setInputMin(isApplied ? String(appliedMinFromProps) : "0")
          }}
        />
        <input
          type="text"
          inputMode="numeric"
          className="w-1/2 border rounded px-2 py-1 text-center focus:border-lime-500 focus:ring-lime-500"
          value={inputMax}
          onChange={handleInputMax}
          onFocus={handleMaxFocus}
          onBlur={() => {
            if (inputMax === "") {
              setInputMax(isApplied ? (hasInfiniteUpperBound ? INFINITY_SYMBOL : String(appliedMaxFromProps)) : INFINITY_SYMBOL)
            }
          }}
        />
      </div>
      <button
        type="button"
        className="w-full bg-white border border-lime-500 text-lime-600 rounded py-2 font-semibold hover:bg-lime-50 hover:text-lime-700 hover:border-lime-600 transition"
        onClick={handleApply}
      >
        <TranslatedText>Apply</TranslatedText>
      </button>
    </div>
  )
}

export default PriceFilter
