import { useState, useEffect } from "react"
import AdminSidebar from "../../components/admin/AdminSidebar"
import { useAuth } from "../../context/AuthContext"
import { adminAPI } from "../../services/api"
import { isSeoUnlockTokenValid } from "../../utils/seoUnlock"
import {
  Globe,
  Send,
  History,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  X
} from "lucide-react"
import Modal from "react-modal"

// Set App Element for Accessibility in react-modal
Modal.setAppElement("#root")

const AdminBingIndexer = () => {
  const { isSuperAdmin, hasPermission } = useAuth()
  
  // SEO Unlock state
  const [isSeoUnlocked, setIsSeoUnlocked] = useState(() => isSeoUnlockTokenValid())
  
  // IndexNow Status Verification State
  const [verificationStatus, setVerificationStatus] = useState({
    loading: false,
    verified: false,
    keyLocation: "",
    message: "",
  })

  // Manual Submission State
  const [customUrls, setCustomUrls] = useState("")
  const [submittingCustom, setSubmittingCustom] = useState(false)

  // Sitemap Submission State
  const [submittingSitemap, setSubmittingSitemap] = useState(false)

  // Logs History State
  const [indexLogs, setIndexLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotalPages, setLogsTotalPages] = useState(1)
  const [logsTotalCount, setLogsTotalCount] = useState(0)
  
  // URL details Modal State
  const [selectedLogUrls, setSelectedLogUrls] = useState(null)

  // Poll for token lock changes
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSeoUnlocked(isSeoUnlockTokenValid())
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Check verification key hosted on startup
  useEffect(() => {
    checkVerificationStatus()
    fetchIndexLogs(1)
  }, [])

  // Call backend to verify that IndexNow key file is hosted correctly
  const checkVerificationStatus = async () => {
    setVerificationStatus((prev) => ({ ...prev, loading: true }))
    try {
      const response = await adminAPI.getIndexNowStatus()
      if (response && response.success) {
        setVerificationStatus({
          loading: false,
          verified: true,
          keyLocation: response.keyLocation,
          message: response.message || "Key file is active and matches search engine expectations.",
        })
      } else {
        setVerificationStatus({
          loading: false,
          verified: false,
          keyLocation: response?.keyLocation || "",
          message: response?.message || "Verification failed. Key file could not be read or matched.",
        })
      }
    } catch (err) {
      setVerificationStatus({
        loading: false,
        verified: false,
        keyLocation: "",
        message: err.message || "Failed to reach verification endpoint. Check server configuration.",
      })
    }
  }

  // Fetch Indexing History logs
  const fetchIndexLogs = async (page = 1) => {
    setLogsLoading(true)
    try {
      const response = await adminAPI.getIndexNowLogs(page, 10)
      if (response && response.success) {
        setIndexLogs(response.logs || [])
        setLogsPage(response.pagination.page)
        setLogsTotalPages(response.pagination.totalPages)
        setLogsTotalCount(response.pagination.totalLogs)
      }
    } catch (err) {
      console.error("Failed to fetch IndexNow logs", err)
    } finally {
      setLogsLoading(false)
    }
  }

  // Handle custom URLs submission
  const handleCustomUrlSubmit = async (e) => {
    e.preventDefault()
    if (!customUrls.trim()) return

    if (!isSeoUnlocked) {
      window.alert("SEO configuration is locked. Please unlock it in the sidebar.")
      return
    }

    // Split input by lines/commas and filter empty paths
    const paths = customUrls
      .split(/[\n,]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    if (paths.length === 0) return

    setSubmittingCustom(true)
    try {
      const response = await adminAPI.submitIndexNowUrls(paths)
      if (response && response.success) {
        window.alert(`Successfully submitted ${paths.length} URLs to IndexNow!`)
        setCustomUrls("")
        fetchIndexLogs(1) // refresh history
      } else {
        window.alert(response?.message || "Failed to submit URLs.")
      }
    } catch (err) {
      window.alert(err.message || "An error occurred during manual URL submission.")
    } finally {
      setSubmittingCustom(false)
    }
  }

  // Handle sitemap submission
  const handleSitemapSubmit = async () => {
    if (!isSeoUnlocked) {
      window.alert("SEO configuration is locked. Please unlock it in the sidebar.")
      return
    }

    const confirmSubmit = window.confirm(
      "Are you sure you want to index your entire sitemap? This will query all active products, categories, subcategories, and blogs from the database and post them to Bing IndexNow in a bulk batch."
    )
    if (!confirmSubmit) return

    setSubmittingSitemap(true)
    try {
      const response = await adminAPI.submitIndexNowSitemap()
      if (response && response.success) {
        window.alert(`Successfully initiated full sitemap indexing. ${response.urlCount || 0} URLs submitted.`)
        fetchIndexLogs(1) // refresh logs
      } else {
        window.alert(response?.message || "Failed to submit sitemap.")
      }
    } catch (err) {
      window.alert(err.message || "An error occurred during sitemap index execution.")
    } finally {
      setSubmittingSitemap(false)
    }
  }

  const getTriggerLabel = (type) => {
    switch (type) {
      case "Manual":
        return "Manual Submit"
      case "Sitemap":
        return "Sitemap Bulk Index"
      case "Product_Mutation":
        return "Product Change (Auto)"
      case "Blog_Mutation":
        return "Blog Change (Auto)"
      case "Category_Mutation":
        return "Category Change (Auto)"
      case "SubCategory_Mutation":
        return "SubCategory Change (Auto)"
      default:
        return type
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <div className="flex-1 ml-64 overflow-auto animate-fadeIn">
        <div className="p-6 bg-gray-50 min-h-screen">
          <div className="max-w-7xl mx-auto">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">IndexNow Integration</h1>
                <p className="text-gray-600 mt-1">Manage Microsoft Bing and search engine real-time indexing status</p>
                {!isSeoUnlocked && (
                  <div className="flex items-center gap-1.5 mt-2 bg-amber-50 text-amber-800 text-xs px-2.5 py-1 rounded-md border border-amber-200 w-fit">
                    <AlertCircle size={14} className="text-amber-700" />
                    <span>SEO settings are locked. Click 'Unlock Potential' in the sidebar to perform modifications.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Integration Info & Status Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Status Verification Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:col-span-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Globe className="text-lime-500" size={20} />
                        IndexNow API Verification
                      </h2>
                      {verificationStatus.loading ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 animate-pulse">
                          Verifying...
                        </span>
                      ) : verificationStatus.verified ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-800 border border-green-200 gap-1">
                          <CheckCircle size={12} />
                          Key Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200 gap-1">
                          <AlertCircle size={12} />
                          Verify Failed
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-3.5 text-sm text-gray-700">
                      <p>
                        IndexNow allows you to instantly notify search engines (Bing, Yandex, etc.) of URL updates. 
                        The system automatically submits new products, blogs, and categories upon creation/update.
                      </p>
                      
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 font-mono text-xs break-all">
                        <div>
                          <span className="text-gray-500 font-semibold">Hosted Path:</span>
                          <span className="ml-1 text-blue-600 hover:underline">
                            <a href={verificationStatus.keyLocation || "https://www.irhaas.com/514fe7113eb04ed98d7e94f191678d37.txt"} target="_blank" rel="noreferrer">
                              {verificationStatus.keyLocation || "https://www.irhaas.com/514fe7113eb04ed98d7e94f191678d37.txt"}
                            </a>
                          </span>
                        </div>
                      </div>

                      {verificationStatus.message && (
                        <p className={`text-xs p-2.5 rounded border ${
                          verificationStatus.verified 
                            ? "bg-green-50 border-green-100 text-green-800" 
                            : "bg-red-50 border-red-100 text-red-800"
                        }`}>
                          {verificationStatus.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={checkVerificationStatus}
                    disabled={verificationStatus.loading}
                    className="mt-5 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 active:scale-[0.99] text-gray-700 font-semibold py-2 px-4 rounded-lg text-sm transition w-full disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={verificationStatus.loading ? "animate-spin" : ""} />
                    Re-Verify Hosted Key File
                  </button>
                </div>

                {/* Sitemap Submit Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
                      <Globe className="text-indigo-500" size={20} />
                      Sitemap Re-indexing
                    </h2>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">
                      Submit all active storefront products, blog posts, categories, and static pages in one bulk batch. 
                      Best used after a large site relaunch, import, or sitemap restructure.
                    </p>
                  </div>

                  <button
                    onClick={handleSitemapSubmit}
                    disabled={submittingSitemap || !isSeoUnlocked}
                    className="flex items-center justify-center gap-2 bg-lime-500 hover:bg-lime-600 text-white font-bold py-2.5 px-4 rounded-lg text-sm shadow-sm active:scale-[0.98] transition disabled:opacity-50"
                  >
                    {submittingSitemap ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        Indexing Site...
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        Index Entire Sitemap
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Manual Submission Form */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
                  <Send className="text-lime-500" size={20} />
                  Manual URL Submission
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Submit individual URLs or paths for indexing. Enter absolute or relative paths, one per line. Trailing slashes are resolved automatically.
                </p>
                
                <form onSubmit={handleCustomUrlSubmit} className="space-y-4">
                  <textarea
                    rows="4"
                    value={customUrls}
                    onChange={(e) => setCustomUrls(e.target.value)}
                    disabled={submittingCustom || !isSeoUnlocked}
                    placeholder="/product/apple-macbook-pro&#10;/blogs/latest-tech-news&#10;https://www.irhaas.com/about"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-lime-500 disabled:bg-gray-50"
                  />
                  
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingCustom || !isSeoUnlocked}
                      className="flex items-center gap-2 bg-lime-500 hover:bg-lime-600 text-white font-bold py-2.5 px-6 rounded-lg text-sm shadow-sm active:scale-[0.98] transition disabled:opacity-50"
                    >
                      {submittingCustom ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send size={15} />
                          Submit URLs
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* IndexNow Submission Log Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <History className="text-lime-500" size={20} />
                    Indexing Activity History
                  </h2>
                  <span className="text-xs text-gray-500 font-semibold bg-gray-100 py-1 px-2.5 rounded-full">
                    Total Runs: {logsTotalCount}
                  </span>
                </div>

                {logsLoading ? (
                  <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="animate-spin text-lime-500" size={24} />
                    <span>Loading indexing logs...</span>
                  </div>
                ) : indexLogs.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    No indexing submission logs recorded yet. Use the sitemap or manual tool above to initiate logs.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto font-sans">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Trigger</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Submitted URLs</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">API Response</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Initiator</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {indexLogs.map((log) => (
                            <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {new Date(log.createdAt).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                                {getTriggerLabel(log.triggerType)}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <button
                                  onClick={() => setSelectedLogUrls(log.urls)}
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-semibold flex items-center gap-1"
                                >
                                  {log.urls.length} URLs
                                  <ExternalLink size={12} />
                                </button>
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                                  log.responseStatus === 200 
                                    ? "bg-green-50 text-green-800 border-green-100" 
                                    : log.responseStatus === 429 
                                      ? "bg-amber-50 text-amber-800 border-amber-100"
                                      : "bg-red-50 text-red-800 border-red-100"
                                }`}>
                                  {log.responseStatus} {log.responseMessage}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {log.initiatedBy ? log.initiatedBy.name : "System Hook"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Logs Pagination */}
                    {logsTotalPages > 1 && (
                      <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <button
                          disabled={logsPage === 1}
                          onClick={() => fetchIndexLogs(logsPage - 1)}
                          className="px-3.5 py-1.5 border border-gray-300 rounded-md text-xs font-semibold bg-white hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-40"
                        >
                          Previous Page
                        </button>
                        <span className="text-xs text-gray-500">
                          Page {logsPage} of {logsTotalPages}
                        </span>
                        <button
                          disabled={logsPage === logsTotalPages}
                          onClick={() => fetchIndexLogs(logsPage + 1)}
                          className="px-3.5 py-1.5 border border-gray-300 rounded-md text-xs font-semibold bg-white hover:bg-gray-50 active:scale-[0.98] transition disabled:opacity-40"
                        >
                          Next Page
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* IndexNow URLs List Modal */}
            <Modal
              isOpen={selectedLogUrls !== null}
              onRequestClose={() => setSelectedLogUrls(null)}
              className="bg-white rounded-lg shadow-xl max-w-xl w-full mx-4 my-8 max-h-[80vh] overflow-y-auto"
              overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
              style={{
                content: {
                  position: 'relative',
                  inset: 'auto',
                }
              }}
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-1.5">
                    <Globe size={18} className="text-lime-500" />
                    Submitted URLs
                  </h3>
                  <button onClick={() => setSelectedLogUrls(null)} className="text-gray-500 hover:text-gray-700 transition">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {selectedLogUrls && selectedLogUrls.map((url, i) => (
                    <div key={i} className="flex items-center justify-between text-xs font-mono p-2 border border-gray-100 bg-gray-50 rounded select-all break-all">
                      <span>{url}</span>
                      <a href={url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 ml-2">
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-end pt-4 border-t border-gray-100 mt-4">
                  <button
                    onClick={() => setSelectedLogUrls(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg text-sm hover:bg-gray-200 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </Modal>

          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminBingIndexer
