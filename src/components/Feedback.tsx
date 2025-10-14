import React, { useState } from "react";
import "../styles/feedback.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { db } from "../../firebase"; // ✅ Import Firebase config
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const Feedback: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rating || !comment.trim()) {
      toast.warning("⚠️ Please provide a rating and a comment.");
      return;
    }

    const feedbackData = { rating, comment, createdAt: new Date().toISOString() };

    try {
      setLoading(true);
      console.log("📤 Sending feedback to backend:", feedbackData);

      // ✅ Send to backend (for email auto-reply)
      const response = await fetch("http://localhost:5000/send-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackData),
      });

      console.log("📥 Server response status:", response.status);

      if (!response.ok) throw new Error(`Server responded with ${response.status}`);

      const result = await response.json();
      console.log("✅ Server response:", result);

      // ✅ Store in Firestore
      await addDoc(collection(db, "feedbacks"), {
        rating,
        comment,
        createdAt: serverTimestamp(),
      });

      if (result.success) {
        toast.success("✅ Thank you for your valuable feedback!");
        setRating(0);
        setComment("");
        setShowForm(false);
      } else {
        toast.error("❌ Failed to send feedback. Please try again.");
      }
    } catch (error) {
      console.error("❌ Error submitting feedback:", error);
      toast.error("⚠️ Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="feedback-page">
      <div className="feedback-container">
        {!showForm ? (
          <div className="feedback-intro">
            <div className="text-section">
              <h2>We Value Your Feedback</h2>
              <p>
                Your experience helps us improve our healthcare services.
                Please take a moment to share your thoughts and help us make
                TimeFly even better for everyone.
              </p>
              <button className="feedback-btn" onClick={() => setShowForm(true)}>
                Share Your Feedback
              </button>
            </div>

            <div className="image-section">
              <img
                src="/images/feedbacknobg.png"
                alt="Customer Feedback Illustration"
              />
            </div>
          </div>
        ) : (
          <div className="feedback-form-section">
            {/* ✅ Modal Image Placeholder */}
            <img
              src="/images/feedback_modal_nobg.png"
              alt="Feedback Visual"
              className="modal-feedback-image"
            />

            <h2>Share Your Experience</h2>
            <p>We'd love to hear how we're doing.</p>

            <form onSubmit={handleSubmit} className="feedback-form">
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={star <= rating ? "star filled" : "star"}
                    onClick={() => setRating(star)}
                  >
                    ★
                  </span>
                ))}
              </div>

              <textarea
                placeholder="Tell us what you liked or what we can improve..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
              />

              <div className="form-actions">
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? "Submitting..." : "Submit Feedback"}
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowForm(false)}
                  disabled={loading}
                >
                  Back
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ✅ Toast Notification Container */}
      <ToastContainer position="top-center" autoClose={2500} />
    </div>
  );
};

export default Feedback;