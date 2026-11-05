import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { Languages, Play, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react"
import AdminSidebar from "../../components/admin/AdminSidebar"
import { useToast } from "../../context/ToastContext"
import config from "../../config/config"

const POLL_INTERVAL_MS = 2000

const getAuthHeaders = () => {
  const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
  return { Authorization: `Bearer ${token}` }
}

const initialJob = {
  scope: "",
  status: "idle",
  message: "",
  startedAt: null,
  finishedAt: null,
  total: 0,
  processed: 0,
  updated: 0,
  failed: 0,
  percentage: 0,
  currentEntity: "",
  currentItem: "",
  entities: [],
}

const JobCard = ({ title, description, scope, job, onStart, loadingStart }) => {
  const percentage = Number.isFinite(job?.percentage) ? job.percentage : 0
  const isRunning = job?.status === "running"
  const isDone = job?.status === "completed"
  const isFailed = job?.status === "failed"

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onStart(scope)}
          disabled={isRunning || loadingStart}
          className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingStart ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {isRunning ? "Running..." : "Start"}
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
          <span>{job?.message || "Not started"}</span>
          <span>{percentage}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-lime-500 transition-all duration-300" style={{ width: `${percentage}%` }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-md bg-gray-50 p-2"><span className="text-gray-500">Total</span><p className="font-semibold">{job?.total || 0}</p></div>
        <div className="rounded-md bg-gray-50 p-2"><span className="text-gray-500">Processed</span><p className="font-semibold">{job?.processed || 0}</p></div>
        <div className="rounded-md bg-gray-50 p-2"><span className="text-gray-500">Updated</span><p className="font-semibold text-lime-700">{job?.updated || 0}</p></div>
        <div className="rounded-md bg-gray-50 p-2"><span className="text-gray-500">Failed</span><p className="font-semibold text-red-600">{job?.failed || 0}</p></div>
      </div>

      <div className="mt-3 text-xs text-gray-600">
        <p><span className="font-medium">Current:</span> {job?.currentEntity || "-"} {job?.currentItem ? `- ${job.currentItem}` : ""}</p>
        {job?.startedAt && <p><span className="font-medium">Started:</span> {new Date(job.startedAt).toLocaleString()}</p>}
        {job?.finishedAt && <p><span className="font-medium">Finished:</span> {new Date(job.finishedAt).toLocaleString()}</p>}
      </div>

      {isDone && (
        <div className="mt-3 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Completed
        </div>
      )}

      {isFailed && (
        <div className="mt-3 inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
          <AlertTriangle className="h-4 w-4" /> Failed
        </div>
      )}
    </div>
  )
}

const AdminArabicConversion = () => {
  const { showToast } = useToast()
  const [jobs, setJobs] = useState({
    blog: { ...initialJob, scope: "blog" },
    grab: { ...initialJob, scope: "grab" },
  })
  const [showSelector, setShowSelector] = useState(false)
  const [loadingStart, setLoadingStart] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)

  const hasRunning = useMemo(() => Object.values(jobs).some((job) => job.status === "running"), [jobs])

  const fetchStatus = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoadingStatus(true)
      const { data } = await axios.get(`${config.API_URL}/api/admin/arabic-conversion/status`, {
        headers: getAuthHeaders(),
      })
      if (data?.jobs) {
        setJobs({
          blog: data.jobs.blog || { ...initialJob, scope: "blog" },
          grab: data.jobs.grab || { ...initialJob, scope: "grab" },
        })
      }
    } catch (error) {
      console.error("Failed to load conversion status:", error)
      showToast(error.response?.data?.message || "Failed to load conversion status", "error")
    } finally {
      if (!silent) setLoadingStatus(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      fetchStatus({ silent: true })
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  const startConversion = async (scope) => {
    try {
      setLoadingStart(true)
      const { data } = await axios.post(
        `${config.API_URL}/api/admin/arabic-conversion/start`,
        { scope },
        { headers: getAuthHeaders() },
      )

      if (data?.job) {
        setJobs((prev) => ({ ...prev, [scope]: data.job }))
      }

      if (data?.started) {
        showToast(data.message || "Conversion started", "success")
      } else {
        showToast(data.message || "Conversion already running", "warning")
      }
    } catch (error) {
      console.error("Failed to start conversion:", error)
      showToast(error.response?.data?.message || "Failed to start conversion", "error")
    } finally {
      setLoadingStart(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 p-4 md:ml-64 md:p-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                  <Languages className="h-7 w-7 text-lime-600" /> Arabic Conversion
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                  Convert missing Arabic content and save it in database with live progress tracking.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSelector((prev) => !prev)}
                  className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-600"
                >
                  Arabic Conversion
                </button>
                <button
                  type="button"
                  onClick={() => fetchStatus()}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingStatus ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>
            </div>
          </div>

          {showSelector && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <JobCard
                title="Blog Conversion"
                description="Scan and convert blogs, blog categories, topics, brands, headings, tags, and descriptions to Arabic when missing."
                scope="blog"
                job={jobs.blog}
                onStart={startConversion}
                loadingStart={loadingStart}
              />
              <JobCard
                title="Grab-Conversion"
                description="Scan and convert products, categories, subcategories, brands, banner/home content and related Arabic fields."
                scope="grab"
                job={jobs.grab}
                onStart={startConversion}
                loadingStart={loadingStart}
              />
            </div>
          )}

          {!showSelector && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
              Click <span className="font-semibold">Arabic Conversion</span> to choose <span className="font-semibold">Blog Conversion</span> or <span className="font-semibold">Grab-Conversion</span>.
            </div>
          )}

          {hasRunning && (
            <div className="rounded-lg border border-lime-200 bg-lime-50 p-4 text-sm text-lime-800">
              A conversion job is currently running. Progress updates refresh automatically every 2 seconds.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminArabicConversion
