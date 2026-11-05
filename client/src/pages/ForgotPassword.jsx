import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../services/api";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      // Convert email to lowercase before sending
      await authAPI.forgotPassword(email.trim().toLowerCase());
      setSuccess("If this email is registered, a reset link has been sent.");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-2">Forgot Password</h2>
          <p className="text-gray-600 text-sm mb-4">Enter your email to receive a password reset link.</p>
        </div>
        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 mb-2">{error}</div>}
        {success && <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm border border-green-100 mb-2">{success}</div>}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500 transition-colors"
              placeholder="Enter your email"
            />
          </div>
          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-lime-500 hover:bg-lime-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lime-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
        <button
          className="mt-4 text-sm text-gray-600 hover:text-lime-600 transition-colors"
          onClick={() => navigate("/login")}
        >
          Back to Sign In
        </button>
      </div>
    </div>
  );
};

export default ForgotPassword;