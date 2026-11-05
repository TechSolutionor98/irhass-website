import React, { useState } from "react";
import axios from "axios";
import { Bell, Tag, Calendar } from "lucide-react";

const options = [
  { label: "All Updates", value: "all", icon: <Bell className="inline mr-2 w-4 h-4" /> },
  { label: "Promotions Only", value: "promotions", icon: <Tag className="inline mr-2 w-4 h-4" /> },
  { label: "Events Only", value: "events", icon: <Calendar className="inline mr-2 w-4 h-4" /> },
];

const NewsletterModal = ({ email, onClose }) => {
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSelect = (value) => {
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await axios.post("/api/newsletter/subscribe", {
        email,
        preferences: selected,
      });
      setSuccess(true);
    } catch (err) {
      setError("Failed to subscribe. Please try again.");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
          <h2 className="text-lg font-bold mb-2 text-black">Thank you for subscribing!</h2>
          <p className="mb-4 text-black">A confirmation email has been sent to {email}.</p>
          <button className="bg-lime-500 text-white px-4 py-2 rounded" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
        <h2 className="text-lg font-bold mb-2 text-black">Newsletter Preferences</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            {options.map((opt) => (
              <label key={opt.value} className="block mb-2 text-black font-normal">
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={selected.includes(opt.value)}
                  onChange={() => handleSelect(opt.value)}
                  className="mr-2"
                />
                {opt.icon}
                {opt.label}
              </label>
            ))}
          </div>
          {error && <div className="text-red-500 mb-2">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="px-4 py-2 rounded bg-gray-200 text-black" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="px-4 py-2 rounded bg-lime-500 text-white" disabled={loading || selected.length === 0}>
              {loading ? "Subscribing..." : "Subscribe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewsletterModal; 