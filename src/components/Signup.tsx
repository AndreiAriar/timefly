import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/signup.css";
import { FaEye, FaEyeSlash, FaSpinner } from "react-icons/fa";
import { auth, googleProvider } from "../../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  fetchSignInMethodsForEmail,
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

  const [verificationStep, setVerificationStep] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const navigate = useNavigate();

  const sendVerificationCode = async () => {
    if (!email) {
      toast.error("👉 Please enter your email first", { autoClose: 10000, closeButton: true });
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      console.log("📩 send-code response:", data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send email");
      }

      toast.success("📩 A 6-digit verification code has been sent to your email.", { autoClose: 10000, closeButton: true });
      setVerificationStep(true);
    } catch (error) {
      console.error("Email sending failed:", error);
      toast.error("❌ Failed to send verification email.", { autoClose: 10000, closeButton: true });
    }
  };

  const verifyCodeAndCreate = async () => {
    if (!inputCode) {
      toast.error("👉 Please enter the code.", { autoClose: 10000, closeButton: true });
      return;
    }

    setIsVerifying(true);
    try {
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

      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods.length > 0) {
        toast.error("❌ This email is already registered. Please log in instead.", { autoClose: 10000, closeButton: true });
        navigate("/login", { replace: true });
        return;
      }

      await createUserWithEmailAndPassword(auth, email, password);
      toast.success("🎉 Account created successfully!", { autoClose: 10000, closeButton: true });

      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          navigate("/login", { replace: true });
        }
      }, 2000);
    } catch (err: any) {
      console.error("Verification error:", err);
      if (err.code === "auth/weak-password") {
        toast.error("❌ Password should be at least 6 characters.", { autoClose: 10000, closeButton: true });
      } else {
        toast.error(`❌ ${err.message || "Failed to verify code"}`, { autoClose: 10000, closeButton: true });
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
      toast.success("🎉 Signed up with Google successfully!", { autoClose: 10000, closeButton: true });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setIsGoogleLoading(false);
      toast.error(`❌ ${err.message || "Google sign-up failed"}`, { autoClose: 10000, closeButton: true });
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
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
              disabled={isGoogleLoading}
            />

            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                disabled={isGoogleLoading}
              />
              <span
                className={`toggle-password ${isGoogleLoading ? "disabled" : ""}`}
                onClick={() => !isGoogleLoading && setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

            <button type="submit" disabled={isGoogleLoading}>
              Sign Up
            </button>

            <div className="divider"><span>OR</span></div>

            <button
              type="button"
              className="google-btn"
              onClick={handleGoogleSignUp}
              disabled={isGoogleLoading}
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
                onChange={(e) => setInputCode(e.target.value)}
              />

              <button onClick={verifyCodeAndCreate} disabled={isVerifying}>
                {isVerifying ? <><FaSpinner className="spinner" /> Verifying...</> : "Verify & Create Account"}
              </button>

              <button className="resend-btn" onClick={sendVerificationCode}>
                Resend Code
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Signup;
