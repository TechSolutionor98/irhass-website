"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import axios from "axios"
import config from "../config/config.js"
import { getFullImageUrl } from "../utils/imageUtils.js"
import { Star, X, ThumbsUp, Flag, User, ImageIcon, CheckCircle, Mail, Shield, ChevronDown, ChevronUp } from "lucide-react"

const ReviewSection = ({ productId, onStatsUpdate }) => {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [reviews, setReviews] = useState([])
  const [stats, setStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  })

  const [loading, setLoading] = useState(true)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [guestReviewIds, setGuestReviewIds] = useState([])
  const [expandedReviews, setExpandedReviews] = useState(new Set())
  const fileInputRef = useRef(null)

  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [verificationId, setVerificationId] = useState(null)
  const [verificationCode, setVerificationCode] = useState(["", "", "", "", "", ""])
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [resendingCode, setResendingCode] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const verificationInputRefs = useRef([])

  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    comment: "",
    name: user?.name || "",
    email: user?.email || "",
  })

  useEffect(() => {
    const storedGuestReviews = localStorage.getItem(`guestReviews_${productId}`)
    if (storedGuestReviews) {
      try {
        setGuestReviewIds(JSON.parse(storedGuestReviews))
      } catch (error) {
        console.error("Error parsing guest reviews from localStorage:", error)
      }
    }
  }, [productId])

  useEffect(() => {
    if (productId) {
      fetchReviews()
    }
  }, [productId, currentPage, guestReviewIds])

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const fetchReviews = async () => {
    try {
      setLoading(true)

      const requestConfig = {}
      if (user) {
        const token = localStorage.getItem("token")
        if (token) {
          requestConfig.headers = {
            Authorization: `Bearer ${token}`,
          }
        }
      }

      let url = `${config.API_URL}/api/reviews/product/${productId}?page=${currentPage}&limit=10`
      if (!user && guestReviewIds.length > 0) {
        url += `&guestReviewIds=${guestReviewIds.join(",")}`
      }

      const response = await axios.get(url, requestConfig)

      const filteredReviews = response.data.reviews || []
      setReviews(filteredReviews)
      const newStats = {
        averageRating: response.data.stats?.averageRating || 0,
        totalReviews: response.data.stats?.totalReviews || 0,
        ratingDistribution: response.data.stats?.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      }
      setStats(newStats)

      if (onStatsUpdate) {
        onStatsUpdate(newStats)
      }

      setTotalPages(response.data.pagination?.totalPages || 1)
    } catch (error) {
      console.error("Error fetching reviews:", error)
      showToast("Error loading reviews", "error")
      setReviews([])
      const emptyStats = {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      }
      setStats(emptyStats)

      if (onStatsUpdate) {
        onStatsUpdate(emptyStats)
      }

      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()

    if (!reviewForm.comment.trim()) {
      showToast("Please write a review comment", "error")
      return
    }

    if (!user && (!reviewForm.name.trim() || !reviewForm.email.trim())) {
      showToast("Please provide your name and email", "error")
      return
    }

    try {
      setSubmittingReview(true)

      const formData = new FormData()
      formData.append("productId", productId)
      formData.append("rating", reviewForm.rating)
      formData.append("comment", reviewForm.comment.trim())

      if (!user) {
        formData.append("name", reviewForm.name.trim())
        formData.append("email", reviewForm.email.trim())
      }

      if (selectedImage) {
        formData.append("image", selectedImage)
      }

      const requestConfig = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }

      if (user) {
        const token = localStorage.getItem("token")
        if (token) {
          requestConfig.headers.Authorization = `Bearer ${token}`
        }
      }

      const response = await axios.post(`${config.API_URL}/api/reviews`, formData, requestConfig)

      if (user) {
        showToast("Review submitted and published successfully!", "success")

        setReviewForm({
          rating: 5,
          comment: "",
          name: user?.name || "",
          email: user?.email || "",
        })
        removeImage()
        setShowReviewForm(false)

        setTimeout(() => {
          fetchReviews()
        }, 500)
      } else {
        if (response.data.requiresVerification) {
          setVerificationId(response.data.verificationId)
          setShowVerificationModal(true)
          setShowReviewForm(false)
          showToast("Please check your email for a verification code", "info")
        }
      }
    } catch (error) {
      console.error("Error submitting review:", error)
      const message = error.response?.data?.message || "Error submitting review"
      showToast(message, "error")
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleVerificationInputChange = (index, value) => {
    if (!/^\d*$/.test(value)) return

    const newCode = [...verificationCode]
    newCode[index] = value

    setVerificationCode(newCode)

    if (value && index < 5) {
      verificationInputRefs.current[index + 1]?.focus()
    }

    if (newCode.every((digit) => digit !== "") && newCode.join("").length === 6) {
      handleVerifyCode(newCode.join(""))
    }
  }

  const handleVerificationKeyDown = (index, e) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      verificationInputRefs.current[index - 1]?.focus()
    }

    if (e.key === "ArrowLeft" && index > 0) {
      verificationInputRefs.current[index - 1]?.focus()
    }
    if (e.key === "ArrowRight" && index < 5) {
      verificationInputRefs.current[index + 1]?.focus()
    }
  }

  const handleVerificationPaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)

    if (pastedData.length === 6) {
      const newCode = pastedData.split("")
      setVerificationCode(newCode)
      verificationInputRefs.current[5]?.focus()
      handleVerifyCode(pastedData)
    }
  }

  const handleVerifyCode = async (code) => {
    if (!verificationId || code.length !== 6) {
      showToast("Please enter all 6 digits", "error")
      return
    }

    setVerifyingCode(true)

    try {
      const response = await axios.post(`${config.API_URL}/api/reviews/verify-email`, {
        verificationId,
        code,
      })

      if (response.data.review) {
        const reviewId = response.data.review.id
        const newGuestReviewIds = [...guestReviewIds, reviewId]
        setGuestReviewIds(newGuestReviewIds)
        localStorage.setItem(`guestReviews_${productId}`, JSON.stringify(newGuestReviewIds))
      }

      showToast("Email verified successfully! Your review has been published.", "success")

      setReviewForm({
        rating: 5,
        comment: "",
        name: "",
        email: "",
      })
      removeImage()
      setShowVerificationModal(false)
      setVerificationCode(["", "", "", "", "", ""])
      setVerificationId(null)

      setTimeout(() => {
        fetchReviews()
      }, 500)
    } catch (error) {
      console.error("Error verifying code:", error)
      const message = error.response?.data?.message || "Invalid or expired verification code"
      showToast(message, "error")
      setVerificationCode(["", "", "", "", "", ""])
      verificationInputRefs.current[0]?.focus()
    } finally {
      setVerifyingCode(false)
    }
  }

  const handleResendVerificationCode = async () => {
    if (!verificationId) {
      showToast("Verification session expired. Please submit your review again.", "error")
      setShowVerificationModal(false)
      return
    }

    setResendingCode(true)

    try {
      await axios.post(`${config.API_URL}/api/reviews/resend-verification`, {
        verificationId,
      })

      showToast("Verification code sent successfully!", "success")
      setResendCooldown(60)
    } catch (error) {
      console.error("Error resending code:", error)
      const message = error.response?.data?.message || "Failed to resend code. Please try again."
      showToast(message, "error")
    } finally {
      setResendingCode(false)
    }
  }

  const handleImageSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        showToast("Please select an image file", "error")
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast("Image size must be less than 5MB", "error")
        return
      }

      setSelectedImage(file)

      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const toggleReviewExpansion = (reviewId) => {
    const newExpanded = new Set(expandedReviews)
    if (newExpanded.has(reviewId)) {
      newExpanded.delete(reviewId)
    } else {
      newExpanded.add(reviewId)
    }
    setExpandedReviews(newExpanded)
  }

  const renderStars = (rating, interactive = false, onRate = null) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && onRate && onRate(star)}
            className={`${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}
            disabled={!interactive}
          >
            <Star
              className={`h-[18px] w-[18px] ${star <= rating ? "fill-current text-brand-500" : "text-stone-300"}`}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
    )
  }

  const renderRatingDistribution = () => {
    return (
      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = stats.ratingDistribution[rating] || 0
          const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0

          return (
            <div key={rating} className="flex items-center gap-3">
              <span className="w-3 text-xs text-stone-500">{rating}</span>
              <Star className="h-3 w-3 fill-current text-stone-400" />
              <div className="h-[3px] flex-1 bg-stone-200">
                <div
                  className="h-[3px] bg-brand-500 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs tabular-nums text-stone-500">{count}</span>
            </div>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-stone-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Score beside the breakdown, divided by a hairline rather than boxed in grey --
          the page around it is already white and panelled. */}
      <div className="grid grid-cols-1 gap-8 border border-stone-200 p-6 sm:grid-cols-[auto_1fr] sm:gap-10 md:p-8">
        <div className="sm:border-r sm:border-stone-200 sm:pr-10">
          <div className="text-5xl font-light leading-none text-stone-900">
            {(stats?.averageRating || 0).toFixed(1)}
          </div>
          <div className="mt-3">{renderStars(Math.round(stats?.averageRating || 0))}</div>
          <p className="mt-3 text-xs uppercase tracking-[0.12em] text-stone-500">
            {stats?.totalReviews || 0} review{(stats?.totalReviews || 0) !== 1 ? "s" : ""}
          </p>
        </div>

        <div>{renderRatingDistribution()}</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-900">Customer reviews</h3>
        {!showReviewForm && (
          <button
            onClick={() => setShowReviewForm(true)}
            className="border border-stone-900 px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
          >
            Write a review
          </button>
        )}
      </div>

      {showReviewForm && (
        <div className="border border-stone-200 bg-white p-6 md:p-8">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-medium text-gray-900">Write a Review</h4>
            <button
              onClick={() => {
                setShowReviewForm(false)
                removeImage()
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {user ? (
            <div className="mb-5 flex items-center gap-2 border-l-2 border-emerald-600 bg-emerald-50 px-4 py-3">
              <Shield className="h-4 w-4 text-emerald-700" strokeWidth={1.6} />
              <span className="text-sm text-emerald-800">
                <strong>Logged in as {user.name}</strong> - Your review will be published immediately
              </span>
            </div>
          ) : (
            <div className="mb-5 flex items-center gap-2 border-l-2 border-stone-400 bg-stone-50 px-4 py-3">
              <Mail className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800 text-sm">
                <strong>Guest Review</strong> - We'll send a verification code to your email before publishing
              </span>
            </div>
          )}

          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Rating</label>
              {renderStars(reviewForm.rating, true, (rating) => setReviewForm((prev) => ({ ...prev, rating })))}
            </div>

            {!user && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                  <input
                    type="text"
                    value={reviewForm.name}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-stone-300 px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-stone-900 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Email *</label>
                  <input
                    type="email"
                    value={reviewForm.email}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-stone-300 px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-stone-900 focus:outline-none"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Review *</label>
              <textarea
                value={reviewForm.comment}
                onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                rows={4}
                className="w-full border border-stone-300 px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-stone-900 focus:outline-none"
                placeholder="Share your experience with this product..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Add Photo (Optional)</label>

              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer border border-dashed border-stone-300 p-5 text-center text-sm text-stone-500 transition-colors hover:border-stone-900 hover:text-stone-900"
                >
                  <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Click to upload an image</p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                </div>
              ) : (
                <div className="relative inline-block">
                  <img
                    src={imagePreview || "/placeholder.svg"}
                    alt="Review preview"
                    className="h-28 w-28 border border-stone-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -right-2 -top-2 rounded-full bg-stone-900 p-1 text-white transition-colors hover:bg-brand-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowReviewForm(false)
                  removeImage()
                }}
                className="border border-stone-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition-colors hover:border-stone-900 hover:text-stone-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReview}
                className="flex items-center gap-2 bg-footer-bg px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
              >
                {submittingReview && (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                )}
                <span>{submittingReview ? "Submitting..." : "Submit Review"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {showVerificationModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto w-11/12 max-w-md border border-stone-200 bg-white p-6 shadow-xl">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Verify Your Email</h3>
                <button
                  onClick={() => {
                    setShowVerificationModal(false)
                    setVerificationCode(["", "", "", "", "", ""])
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="text-center mb-6">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
                  <Mail className="h-6 w-6 text-stone-700" strokeWidth={1.5} />
                </div>
                <p className="text-sm text-gray-600">
                  We've sent a 6-digit verification code to your email address. Please enter it below to publish your
                  review.
                </p>
              </div>

              <div className="mb-6">
                <div className="flex justify-center space-x-2">
                  {verificationCode.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (verificationInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleVerificationInputChange(index, e.target.value)}
                      onKeyDown={(e) => handleVerificationKeyDown(index, e)}
                      onPaste={handleVerificationPaste}
                      className="h-12 w-12 border border-stone-300 text-center text-2xl font-semibold text-stone-900 outline-none transition-colors focus:border-stone-900"
                      disabled={verifyingCode}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col space-y-3">
                <button
                  onClick={() => handleVerifyCode(verificationCode.join(""))}
                  disabled={verifyingCode || verificationCode.some((digit) => digit === "")}
                  className="flex w-full items-center justify-center gap-2 bg-footer-bg px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
                >
                  {verifyingCode && (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  )}
                  <span>{verifyingCode ? "Verifying..." : "Verify & Publish Review"}</span>
                </button>

                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Didn't receive the code?{" "}
                    <button
                      type="button"
                      onClick={handleResendVerificationCode}
                      disabled={resendingCode || resendCooldown > 0}
                      className="font-medium text-stone-900 underline underline-offset-4 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resendingCode
                        ? "Sending..."
                        : resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : "Resend Code"}
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {reviews.length === 0 ? (
          <div className="border border-stone-200 py-14 text-center">
            <User className="mx-auto mb-4 h-10 w-10 text-stone-300" strokeWidth={1.25} />
            <p className="text-sm text-stone-500">No reviews yet. Be the first to review this piece.</p>
          </div>
        ) : (
          reviews.map((review) => {
            const isExpanded = expandedReviews.has(review._id)
            const shouldTruncate = review.comment.length > 250
            const displayComment = isExpanded || !shouldTruncate 
              ? review.comment 
              : review.comment.slice(0, 250) + '...'

            return (
              <div key={review._id} className="border-b border-stone-200 py-7 first:pt-0 last:border-b-0">
                {/* Header Section */}
                <div className="mb-3 flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold uppercase text-stone-600">
                    {(review.name || "?").trim().charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-stone-900">{review.name}</h4>

                    {/* Rating and Date Row */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {renderStars(review.rating)}
                      <span className="text-xs text-stone-500">
                        {new Date(review.createdAt).toLocaleDateString("en-PK", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Product Variant and Verified Badge Row */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {review.productVariant && (
                        <span className="bg-stone-100 px-2 py-1 text-[11px] uppercase tracking-[0.1em] text-stone-600">
                          {review.productVariant}
                        </span>
                      )}

                      {/* Gated on the stored flag. It used to be `{true && ...}`, which
                          labelled every review a verified purchase whether it was one or
                          not -- a claim the shop cannot stand behind. */}
                      {review.isVerifiedPurchase && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-emerald-700">
                          <CheckCircle className="h-3 w-3" strokeWidth={2} />
                          Verified purchase
                        </span>
                      )}

                      {review.status === "pending" && (
                        <span className="bg-amber-50 px-2 py-1 text-[11px] uppercase tracking-[0.1em] text-amber-700">
                          Pending approval
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Review Comment */}
                <div className="mb-4">
                  <p className="text-sm leading-relaxed text-stone-700">
                    {displayComment}
                  </p>
                  {shouldTruncate && (
                    <button
                      onClick={() => toggleReviewExpansion(review._id)}
                      className="mt-2 flex items-center gap-1 text-xs font-medium uppercase tracking-[0.1em] text-stone-900 underline underline-offset-4 hover:text-brand-600"
                    >
                      <span>{isExpanded ? 'Show less' : 'Read more'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Review Image */}
                {review.image && (
                  <div className="mb-4">
                    <img
                      src={getFullImageUrl(review.image.startsWith("/") || review.image.includes("uploads") ? review.image : `/uploads/reviews/${review.image}`)}
                      alt="Review"
                      className="h-28 w-28 cursor-pointer border border-stone-200 object-cover transition-colors hover:border-stone-900"
                      onClick={() => window.open(getFullImageUrl(review.image.startsWith("/") || review.image.includes("uploads") ? review.image : `/uploads/reviews/${review.image}`), "_blank")}
                    />
                  </div>
                )}

                {/* Helpful and Report Actions */}
                <div className="flex items-center gap-6 text-xs uppercase tracking-[0.1em] text-stone-500">
                  <button className="flex items-center gap-2 transition-colors hover:text-stone-900">
                    <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span>Helpful ({review.helpfulCount || 0})</span>
                  </button>
                  <button className="flex items-center gap-2 transition-colors hover:text-stone-900">
                    <Flag className="h-3.5 w-3.5" strokeWidth={1.5} />
                    <span>Report</span>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="border border-stone-300 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 transition-colors hover:border-stone-900 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`min-w-[40px] border px-3 py-2.5 text-xs font-semibold transition-colors ${
                page === currentPage
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900"
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="border border-stone-300 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 transition-colors hover:border-stone-900 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export default ReviewSection