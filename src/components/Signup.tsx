import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/signup.css";
import { FaEye, FaEyeSlash, FaSpinner } from "react-icons/fa";
import { auth, googleProvider } from "../../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface SignupProps {
  onSuccess?: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const [verificationStep, setVerificationStep] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const navigate = useNavigate();

  const sendVerificationCode = async () => {
    if (!email) {
      toast.error("👉 Please enter your email first", { autoClose: 10000, closeButton: true });
      return;
    }

    if (!password) {
      toast.error("👉 Please enter your password first", { autoClose: 10000, closeButton: true });
      return;
    }

    if (password.length < 6) {
      toast.error("⚠️ Password must be at least 6 characters", { autoClose: 10000, closeButton: true });
      return;
    }

    setIsSendingCode(true);

    try {
      // ✅ STEP 1: Check if email exists using backend (more reliable)
      const checkResponse = await fetch("http://localhost:5000/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const checkData = await checkResponse.json();
      console.log("🔍 check-email response:", checkData);

      if (!checkResponse.ok || !checkData.success) {
        throw new Error(checkData.error || "Failed to check email");
      }

      if (checkData.exists) {
        toast.error("❌ This email is already registered. Please log in instead.", { 
          autoClose: 10000, 
          closeButton: true 
        });
        setIsSendingCode(false);
        setTimeout(() => navigate("/login", { replace: true }), 2000);
        return;
      }

      // ✅ STEP 2: Email is available, send verification code
      const response = await fetch("http://localhost:5000/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();
      console.log("📩 send-code response:", data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send email");
      }

      toast.success("📩 A 6-digit verification code has been sent to your email.", { 
        autoClose: 10000, 
        closeButton: true 
      });
      setVerificationStep(true);
    } catch (error: any) {
      console.error("Email sending failed:", error);
      toast.error(`❌ ${error.message || "Failed to send verification email"}`, { 
        autoClose: 10000, 
        closeButton: true 
      });
    } finally {
      setIsSendingCode(false);
    }
  };

  const verifyCodeAndCreate = async () => {
    if (!inputCode) {
      toast.error("👉 Please enter the code.", { autoClose: 10000, closeButton: true });
      return;
    }

    if (inputCode.trim().length !== 6) {
      toast.error("⚠️ Code must be 6 digits", { autoClose: 10000, closeButton: true });
      return;
    }

    setIsVerifying(true);
    try {
      // ✅ STEP 1: Verify the code with backend
      const response = await fetch("http://localhost:5000/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: inputCode.trim(),
        }),
      });

      const data = await response.json();
      console.log("✅ verify-code response:", data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Verification failed");
      }

      // ✅ STEP 2: Code verified successfully, create Firebase account
      console.log("🔥 Creating Firebase account...");
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      toast.success("🎉 Account created successfully!", { 
        autoClose: 10000, 
        closeButton: true 
      });

      // ✅ STEP 3: Navigate to login or dashboard
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          navigate("/login", { replace: true });
        }
      }, 2000);
      
    } catch (err: any) {
      console.error("❌ Verification error:", err);
      
      if (err.code === "auth/weak-password") {
        toast.error("❌ Password should be at least 6 characters.", { 
          autoClose: 10000, 
          closeButton: true 
        });
      } else if (err.code === "auth/email-already-in-use") {
        // This shouldn't happen since we check before, but just in case
        toast.error("❌ This email is already registered. Redirecting to login...", { 
          autoClose: 10000, 
          closeButton: true 
        });
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      } else if (err.code === "auth/invalid-email") {
        toast.error("❌ Invalid email format.", { 
          autoClose: 10000, 
          closeButton: true 
        });
      } else if (err.code === "auth/network-request-failed") {
        toast.error("❌ Network error. Please check your connection.", { 
          autoClose: 10000, 
          closeButton: true 
        });
      } else {
        toast.error(`❌ ${err.message || "Failed to create account"}`, { 
          autoClose: 10000, 
          closeButton: true 
        });
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("🎉 Signed up with Google successfully!", { 
        autoClose: 10000, 
        closeButton: true 
      });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setIsGoogleLoading(false);
      console.error("❌ Google sign-up error:", err);
      
      if (err.code === "auth/popup-closed-by-user") {
        toast.info("ℹ️ Sign-up cancelled", { autoClose: 5000, closeButton: true });
      } else if (err.code === "auth/popup-blocked") {
        toast.error("❌ Popup blocked. Please allow popups for this site.", { 
          autoClose: 10000, 
          closeButton: true 
        });
      } else {
        toast.error(`❌ ${err.message || "Google sign-up failed"}`, { 
          autoClose: 10000, 
          closeButton: true 
        });
      }
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        {/* Logo */}
        <img src="../images/logo.jpg" alt="TimeFly Logo" className="signup-logo" />
        
        <h1>Create Your Account</h1>

        {!verificationStep ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendVerificationCode();
            }}
          >
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={isGoogleLoading || isSendingCode}
            />

            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                disabled={isGoogleLoading || isSendingCode}
              />
              <span
                className={`toggle-password ${(isGoogleLoading || isSendingCode) ? "disabled" : ""}`}
                onClick={() => !(isGoogleLoading || isSendingCode) && setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

            <button type="submit" disabled={isGoogleLoading || isSendingCode}>
              {isSendingCode ? (
                <>
                  <FaSpinner className="spinner" /> Checking...
                </>
              ) : (
                "Sign Up"
              )}
            </button>

            <div className="divider"><span>or</span></div>

            <button
              type="button"
              className="google-btn"
              onClick={handleGoogleSignUp}
              disabled={isGoogleLoading || isSendingCode}
            >
              {isGoogleLoading ? (
                <>
                  <FaSpinner className="spinner" /> Signing up...
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

            <p className="login-link">
              Already have an account?{" "}
              <Link to="/login" className="link-text">Login</Link>
            </p>
          </form>
        ) : (
          <div className="verification-overlay">
            <div className="verification-card">
              <h2>Email Verification</h2>
              <p>
                We've sent a <b>6-digit code</b> to <span>{email}</span>. Enter it below.
              </p>

              <input
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
                disabled={isVerifying}
              />

              <button onClick={verifyCodeAndCreate} disabled={isVerifying}>
                {isVerifying ? (
                  <>
                    <FaSpinner className="spinner" /> Verifying...
                  </>
                ) : (
                  "Verify & Create Account"
                )}
              </button>

              <button 
                className="resend-btn" 
                onClick={sendVerificationCode}
                disabled={isVerifying || isSendingCode}
              >
                {isSendingCode ? "Sending..." : "Resend Code"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Signup;