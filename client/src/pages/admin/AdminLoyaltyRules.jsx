"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import axios from "axios"
import { Layers, Plus, Trash2, Search, Info, ChevronRight } from "lucide-react"
import config from "../../config/config"
import { describeApiError } from "../../utils/apiError"

// Category-level earning rules.
//
// The picker is a cascade: choose a main category, and its sub-levels appear one at a time
// as you drill in. The rule lands on the DEEPEST level you selected -- stop at the main
// category and the rule covers everything under it; carry on to level 4 and it covers only
// that leaf. This also sidesteps the duplicate sub-category names in the catalogue
// ("Gaming Laptops" exists at two levels), because you reach one by its parent, not by
// picking a name out of a flat list of 250.
const AdminLoyaltyRules = () => {
  const [rules, setRules] = useState([])
  const [categories, setCategories] = useState([])
  const [subCategories, setSubCategories] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)

  // One slot per level. Selecting a level clears everything below it.
  const EMPTY_PATH = { main: "", l1: "", l2: "", l3: "", l4: "" }
  const [path, setPath] = useState(EMPTY_PATH)
  const [mode, setMode] = useState("multiplier")
  const [multiplier, setMultiplier] = useState(2)
  const [fixedPoints, setFixedPoints] = useState(500)

  const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [rulesRes, settingsRes] = await Promise.all([
        axios.get(`${config.API_URL}/api/loyalty/admin/rules`, authHeader),
        axios.get(`${config.API_URL}/api/loyalty/admin/settings`, authHeader).catch(() => ({ data: null })),
      ])
      setRules(rulesRes.data?.rules || [])
      setCategories(rulesRes.data?.categories || [])
      setSubCategories(rulesRes.data?.subCategories || [])
      setSettings(settingsRes.data)
      setError("")
    } catch (err) {
      setError(describeApiError(err, "Failed to load earning rules"))
    } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => {
    load()
  }, [load])

  const pointsName = settings?.pointsName || "Points"
  const baseRate = Number(settings?.earnPointsPerAed ?? 0)

  // Index children by parent once, so each dropdown is a map lookup rather than a scan.
  // Children are keyed on the structural link (category for level 1, parentSubCategory
  // below that) rather than on `level`, so the tree is right even where a level number
  // disagrees with where the row actually sits.
  const { childrenOfCategory, childrenOfSub, subsById } = useMemo(() => {
    const byCategory = new Map()
    const bySub = new Map()
    const byId = new Map()

    for (const sub of subCategories) {
      byId.set(String(sub._id), sub)
      const parentSub = sub.parentSubCategory ? String(sub.parentSubCategory) : null
      if (parentSub) {
        if (!bySub.has(parentSub)) bySub.set(parentSub, [])
        bySub.get(parentSub).push(sub)
      } else if (sub.category) {
        const key = String(sub.category)
        if (!byCategory.has(key)) byCategory.set(key, [])
        byCategory.get(key).push(sub)
      }
    }
    return { childrenOfCategory: byCategory, childrenOfSub: bySub, subsById: byId }
  }, [subCategories])

  const level1Options = path.main ? childrenOfCategory.get(path.main) || [] : []
  const level2Options = path.l1 ? childrenOfSub.get(path.l1) || [] : []
  const level3Options = path.l2 ? childrenOfSub.get(path.l2) || [] : []
  const level4Options = path.l3 ? childrenOfSub.get(path.l3) || [] : []

  // The rule lands on the deepest thing chosen.
  const target = path.l4 || path.l3 || path.l2 || path.l1
  const targetScope = target ? "subcategory" : "category"
  const targetId = target || path.main

  const selectLevel = (key, value) => {
    // Choosing a level invalidates everything under it.
    const below = { main: ["l1", "l2", "l3", "l4"], l1: ["l2", "l3", "l4"], l2: ["l3", "l4"], l3: ["l4"], l4: [] }
    setPath((prev) => {
      const next = { ...prev, [key]: value }
      for (const k of below[key]) next[k] = ""
      return next
    })
  }

  // Names for the breadcrumb, so it is obvious what the rule will cover.
  const pathNames = useMemo(() => {
    const names = []
    const main = categories.find((c) => String(c._id) === path.main)
    if (main) names.push(main.name)
    for (const key of ["l1", "l2", "l3", "l4"]) {
      if (!path[key]) break
      names.push(subsById.get(path[key])?.name || "?")
    }
    return names
  }, [path, categories, subsById])

  // Full path of an existing rule, rebuilt by walking up its parents.
  const pathOf = useCallback(
    (rule) => {
      if (rule.scope === "category") {
        return [categories.find((c) => String(c._id) === String(rule.refId))?.name || rule.refName || "?"]
      }
      // One walk up the parent chain: collect the names and keep hold of the root, whose
      // `category` names the main category the branch hangs off.
      const chain = []
      let node = subsById.get(String(rule.refId))
      let root = null
      let guard = 0
      while (node && guard++ < 6) {
        chain.unshift(node.name)
        root = node
        node = node.parentSubCategory ? subsById.get(String(node.parentSubCategory)) : null
      }
      const main = root?.category ? categories.find((c) => String(c._id) === String(root.category)) : null
      if (main) chain.unshift(main.name)
      return chain.length ? chain : [rule.refName || "?"]
    },
    [categories, subsById],
  )

  const saveRule = async (payload) => {
    try {
      setSaving(true)
      setError("")
      await axios.put(`${config.API_URL}/api/loyalty/admin/rules`, payload, authHeader)
      await load()
      return true
    } catch (err) {
      setError(describeApiError(err, "Failed to save the rule"))
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async () => {
    if (!targetId) {
      setError("Choose a category first")
      return
    }
    const ok = await saveRule({
      scope: targetScope,
      refId: targetId,
      mode,
      ...(mode === "multiplier" ? { multiplier: Number(multiplier) } : { fixedPoints: Number(fixedPoints) }),
    })
    if (ok) setPath(EMPTY_PATH)
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this rule? The category will go back to the global rate.")) return
    try {
      await axios.delete(`${config.API_URL}/api/loyalty/admin/rules/${id}`, authHeader)
      await load()
    } catch (err) {
      setError(describeApiError(err, "Failed to remove the rule"))
    }
  }

  const describeRule = (rule) => {
    if (rule.mode === "fixed") return `${Number(rule.fixedPoints).toLocaleString()} ${pointsName} per item`
    const effective = baseRate * Number(rule.multiplier || 0)
    if (effective === 0) return `Earns no ${pointsName}`
    return `${rule.multiplier}x base = ${effective} per Rs (${(effective * 100).toLocaleString()} on a Rs 100 item)`
  }

  // Live preview of what is about to be created.
  const previewEffect = () => {
    if (mode === "fixed") return `${Number(fixedPoints || 0).toLocaleString()} ${pointsName} per item`
    const effective = baseRate * Number(multiplier || 0)
    if (effective === 0) return `Earns no ${pointsName}`
    return `${(effective * 100).toLocaleString()} ${pointsName} on a Rs 100 item`
  }

  const filteredRules = rules.filter((r) =>
    search.trim() ? pathOf(r).join(" ").toLowerCase().includes(search.trim().toLowerCase()) : true,
  )

  // An existing rule on exactly this target will be replaced rather than duplicated.
  const existingForTarget = rules.find(
    (r) => r.scope === targetScope && String(r.refId) === String(targetId) && targetId,
  )

  return (
    <div className="ml-64 p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <Layers className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Category Earning Rules</h1>
          <p className="text-sm text-gray-500">Give a category a different points rate to the global one</p>
        </div>
      </div>

      <div className="mb-5 flex items-start gap-2 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          Rules resolve <strong>product first, then the deepest category, then the global rate</strong> of{" "}
          <strong>
            {baseRate} {pointsName} per Rs
          </strong>
          . Rules do not stack — the deepest one wins outright. Set a single product's own rate on the product form.
        </span>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      {/* Add a rule — cascading picker */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Add a rule</h2>
        <p className="text-sm text-gray-500 mb-4">
          Pick a category. To target something narrower, keep drilling down — the rule applies to the last level you
          choose.
        </p>

        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-3">
          <LevelSelect
            label="Category"
            value={path.main}
            onChange={(v) => selectLevel("main", v)}
            options={categories}
            placeholder="Select category…"
          />
          <LevelSelect
            label="Sub category"
            value={path.l1}
            onChange={(v) => selectLevel("l1", v)}
            options={level1Options}
            placeholder={path.main ? "All of category" : "Select category first"}
            disabled={!path.main || level1Options.length === 0}
          />
          <LevelSelect
            label="Level 2"
            value={path.l2}
            onChange={(v) => selectLevel("l2", v)}
            options={level2Options}
            placeholder={path.l1 ? "All of sub category" : "—"}
            disabled={!path.l1 || level2Options.length === 0}
          />
          <LevelSelect
            label="Level 3"
            value={path.l3}
            onChange={(v) => selectLevel("l3", v)}
            options={level3Options}
            placeholder={path.l2 ? "All of level 2" : "—"}
            disabled={!path.l2 || level3Options.length === 0}
          />
          <LevelSelect
            label="Level 4"
            value={path.l4}
            onChange={(v) => selectLevel("l4", v)}
            options={level4Options}
            placeholder={path.l3 ? "All of level 3" : "—"}
            disabled={!path.l3 || level4Options.length === 0}
          />
        </div>

        {/* What this rule will cover */}
        {pathNames.length > 0 && (
          <div className="mt-4 flex items-center flex-wrap gap-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-gray-500">Rule applies to</span>
            {pathNames.map((name, i) => (
              <span key={`${name}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                <strong className={i === pathNames.length - 1 ? "text-gray-900" : "text-gray-500 font-medium"}>
                  {name}
                </strong>
              </span>
            ))}
            <span className="text-gray-500">
              {targetScope === "category" ? "and everything under it" : "and everything under it"}
            </span>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-3 items-end mt-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rule</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputClass}>
              <option value="multiplier">Multiply base rate</option>
              <option value="fixed">Fixed points per item</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {mode === "multiplier" ? "Multiplier" : `${pointsName} per item`}
            </label>
            {mode === "multiplier" ? (
              <input
                type="number"
                min="0"
                step="0.1"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                className={inputClass}
              />
            ) : (
              <input
                type="number"
                min="0"
                step="1"
                value={fixedPoints}
                onChange={(e) => setFixedPoints(e.target.value)}
                className={inputClass}
              />
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !targetId}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            {existingForTarget ? "Update rule" : "Add rule"}
          </button>
        </div>

        <div className="mt-3 text-xs text-gray-500 space-y-1">
          {targetId && <p>Effect: {previewEffect()}</p>}
          {mode === "multiplier" && <p>Set 0 to stop a category earning points entirely. 2 means double the base rate.</p>}
          {existingForTarget && (
            <p className="text-amber-700">This category already has a rule — adding will replace it.</p>
          )}
        </div>
      </div>

      {/* Existing rules */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-gray-900">Active rules ({rules.length})</h2>
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories"
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading…</div>
        ) : filteredRules.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {rules.length === 0
              ? `No category rules yet — every product earns the global rate of ${baseRate} ${pointsName} per Rs.`
              : "No categories match that search."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Applies to</th>
                  <th className="px-4 py-3 font-medium">Rule</th>
                  <th className="px-4 py-3 font-medium">Effect</th>
                  <th className="px-4 py-3 font-medium">Active</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRules.map((rule) => {
                  const chain = pathOf(rule)
                  return (
                    <tr key={rule._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center flex-wrap gap-1">
                          {chain.map((name, i) => (
                            <span key={`${name}-${i}`} className="flex items-center gap-1">
                              {i > 0 && <ChevronRight className="h-3 w-3 text-gray-400" />}
                              <span
                                className={
                                  i === chain.length - 1 ? "font-semibold text-gray-900" : "text-gray-500 text-xs"
                                }
                              >
                                {name}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={rule.mode}
                            onChange={(e) => saveRule({ scope: rule.scope, refId: rule.refId, mode: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            <option value="multiplier">Multiplier</option>
                            <option value="fixed">Fixed</option>
                          </select>
                          <input
                            type="number"
                            min="0"
                            step={rule.mode === "multiplier" ? "0.1" : "1"}
                            defaultValue={rule.mode === "multiplier" ? rule.multiplier : rule.fixedPoints}
                            onBlur={(e) => {
                              const value = Number(e.target.value)
                              const current = rule.mode === "multiplier" ? rule.multiplier : rule.fixedPoints
                              if (value === Number(current)) return
                              saveRule({
                                scope: rule.scope,
                                refId: rule.refId,
                                mode: rule.mode,
                                ...(rule.mode === "multiplier" ? { multiplier: value } : { fixedPoints: value }),
                              })
                            }}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{describeRule(rule)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={rule.isActive !== false}
                          onChange={(e) =>
                            saveRule({ scope: rule.scope, refId: rule.refId, isActive: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(rule._id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Remove rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm disabled:bg-gray-50 disabled:text-gray-400"

// One level of the cascade. Disabled when its parent is unset or has no children, so the
// depth of the catalogue is visible without having to guess.
const LevelSelect = ({ label, value, onChange, options, placeholder, disabled = false }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o._id} value={o._id}>
          {o.name}
        </option>
      ))}
    </select>
  </div>
)

export default AdminLoyaltyRules
