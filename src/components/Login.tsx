import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import { FaEye, FaEyeSlash, FaSpinner } from "react-icons/fa";
import { auth, googleProvider, db } from "../../firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const navigate = useNavigate();

  const checkUserRoleAndRedirect = async (user: any) => {
    try {
      const userQuery = query(collection(db, "users"), where("uid", "==", user.uid));
      const userDocs = await getDocs(userQuery);

      if (!userDocs.empty) {
        const userData = userDocs.docs[0].data();
        const role = userData.role;

        if (role === "Doctor") {
          toast.success("🎉 Welcome Doctor!", { autoClose: 10000, closeButton: true });
          setTimeout(() => {
            toast.dismiss();
            toast.info("Redirecting to doctor dashboard...", { autoClose: 10000, closeButton: true });
            setTimeout(() => navigate("/doctor-dashboard"), 2000);
          }, 2000);
        } else if (role === "Staff" || role === "Admin") {
          toast.success("🎉 Welcome Staff!", { autoClose: 10000, closeButton: true });
          setTimeout(() => {
            toast.dismiss();
            toast.info("Redirecting to staff dashboard...", { autoClose: 10000, closeButton: true });
            setTimeout(() => navigate("/staff-dashboard"), 2000);
          }, 2000);
        } else {
          toast.success("🎉 Logged in successfully!", { autoClose: 10000, closeButton: true });
          setTimeout(() => {
            toast.dismiss();
            toast.info("Redirecting to patient dashboard...", { autoClose: 10000, closeButton: true });
            setTimeout(() => navigate("/dashboard"), 2000);
          }, 2000);
        }
        return;
      }

      toast.success("🎉 Logged in successfully!", { autoClose: 10000, closeButton: true });
      setTimeout(() => {
        toast.dismiss();
        toast.info("Redirecting to dashboard...", { autoClose: 10000, closeButton: true });
        setTimeout(() => navigate("/dashboard"), 2000);
      }, 2000);
    } catch (error) {
      console.error("Error checking user role:", error);
      toast.error("Failed to verify role. Redirecting to patient dashboard.", { autoClose: 10000, closeButton: true });
      setTimeout(() => navigate("/dashboard"), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await checkUserRoleAndRedirect(userCredential.user);
    } catch (err: any) {
      setIsLoading(false);
      toast.error(`❌ ${err.message || "Login failed"}`, { autoClose: 10000, closeButton: true });
    }
  };

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      await checkUserRoleAndRedirect(userCredential.user);
    } catch (err: any) {
      setIsGoogleLoading(false);
      toast.error(`❌ ${err.message || "Google sign-in failed"}`, { autoClose: 10000, closeButton: true });
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast.error("👉 Please enter your email.", { autoClose: 10000, closeButton: true });
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success("📩 Password reset email sent! Check your inbox.", { autoClose: 10000, closeButton: true });
      setIsModalOpen(false);
      setResetEmail("");
    } catch (err: any) {
      toast.error(`❌ ${err.message || "Failed to send reset email"}`, { autoClose: 10000, closeButton: true });
    } finally {
      setResetLoading(false);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setResetEmail("");
    setResetLoading(false);
  };

  const isFormDisabled = isLoading || isGoogleLoading;

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>TimeFly Login</h1>
        <form onSubmit={handleSubmit}>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={isFormDisabled}
            className={isFormDisabled ? "disabled" : ""}
          />

          <div className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={isFormDisabled}
              className={isFormDisabled ? "disabled" : ""}
            />
            <span
              className={`toggle-password ${isFormDisabled ? "disabled" : ""}`}
              onClick={() => !isFormDisabled && setShowPassword(!showPassword)}
              role="button"
              tabIndex={isFormDisabled ? -1 : 0}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <p className="forgot-password">
            <span
              className={`link-text ${isFormDisabled ? "disabled" : ""}`}
              onClick={() => !isFormDisabled && setIsModalOpen(true)}
            >
              Forgot Password?
            </span>
          </p>

          <button
            type="submit"
            disabled={isFormDisabled}
            className={`submit-btn ${isFormDisabled ? "loading" : ""}`}
          >
            {isLoading ? (
              <>
                <FaSpinner className="spinner" /> Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        <div className="divider"><span>OR</span></div>

        <button
          onClick={handleGoogleSignIn}
          className={`google-btn ${isGoogleLoading ? "loading" : ""}`}
          disabled={isFormDisabled}
        >
          {isGoogleLoading ? (
            <>
              <FaSpinner className="spinner" /> Signing in...
            </>
          ) : (
            <>
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="google-icon"
              />
              Continue with Google
            </>
          )}
        </button>

        <div className="bottom-navigation">
          <p className="redirect-text">
            Don’t have an account?{" "}
            <span
              className={`link-text ${isFormDisabled ? "disabled" : ""}`}
              onClick={() => !isFormDisabled && navigate("/signup")}
            >
              Sign Up
            </span>
          </p>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Reset Password</h2>
            <input
              type="email"
              placeholder="Enter your email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              disabled={resetLoading}
            />
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={handleModalClose}
                disabled={resetLoading}
              >
                Cancel
              </button>
              <button
                className="reset-btn"
                onClick={handlePasswordReset}
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <>
                    <FaSpinner className="spinner" /> Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
