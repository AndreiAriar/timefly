import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/signup.css";
import { FaEye, FaEyeSlash, FaSpinner } from "react-icons/fa";
import { auth, googleProvider, db } from "../../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface SignupProps {
  onSuccess?: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSuccess }) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [verificationStep, setVerificationStep] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const navigate = useNavigate();

  // === sendVerificationCode ===
  const sendVerificationCode = async () => {
    if (!fullName.trim()) {
      toast.error("👉 Please enter your full name first", { autoClose: 10000, closeButton: true });
      return;
    }

    if (!email.trim()) {
      toast.error("👉 Please enter your email first", { autoClose: 10000, closeButton: true });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("⚠️ Please enter a valid email address", { autoClose: 10000, closeButton: true });
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
      const normalizedEmail = email.trim().toLowerCase();
      const checkResponse = await fetch("http://localhost:5000/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const checkData = await checkResponse.json();

      if (!checkResponse.ok || !checkData.success) throw new Error(checkData.error || "Failed to check email");

      if (checkData.exists) {
        toast.error("❌ This email is already registered. Please log in instead.", { autoClose: 10000 });
        setIsSendingCode(false);
        setTimeout(() => navigate("/login", { replace: true }), 2000);
        return;
      }

      const response = await fetch("http://localhost:5000/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) throw new Error(data.error || "Failed to send email");

      toast.success("📩 A 6-digit verification code has been sent to your email.", { autoClose: 10000 });
      setVerificationStep(true);
    } catch (error: any) {
      toast.error(`❌ ${error.message || "Failed to send verification email"}`, { autoClose: 10000 });
    } finally {
      setIsSendingCode(false);
    }
  };

  // === verifyCodeAndCreate ===
  const verifyCodeAndCreate = async () => {
    if (!inputCode.trim()) {
      toast.error("👉 Please enter the verification code.", { autoClose: 10000 });
      return;
    }

    if (inputCode.trim().length !== 6) {
      toast.error("⚠️ Code must be exactly 6 digits", { autoClose: 10000 });
      return;
    }

    if (!fullName.trim()) {
      toast.error("❌ Full name is missing. Please go back and re-enter.", { autoClose: 10000 });
      setVerificationStep(false);
      return;
    }

    setIsVerifying(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedCode = inputCode.trim();

      const response = await fetch("http://localhost:5000/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, code: normalizedCode }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Invalid code.");

      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: fullName.trim() });

      await addDoc(collection(db, "users"), {
        uid: user.uid,
        name: fullName.trim(),
        email: normalizedEmail,
        role: "Patient",
        phone: "",
        department: "",
        photo: "",
        createdAt: serverTimestamp(),
      });

      await signOut(auth);

      toast.success("🎉 Account created successfully! Please log in.", { autoClose: 3000 });
      setTimeout(() => (onSuccess ? onSuccess() : navigate("/login", { replace: true })), 1500);
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        toast.error("❌ Email already registered. Redirecting...", { autoClose: 10000 });
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      } else {
        toast.error(`❌ ${err.message || "Failed to create account"}`, { autoClose: 10000 });
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleGoogleSignUp = async () => {
  if (isGoogleLoading) return;
  setIsGoogleLoading(true);

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    const userQuery = await getDocs(query(collection(db, "users"), where("uid", "==", user.uid)));

    if (userQuery.empty) {
      await addDoc(collection(db, "users"), {
        uid: user.uid,
        name: user.displayName || user.email?.split("@")[0] || "User",
        email: user.email || "",
        role: "Patient",
        phone: "",
        department: "",
        photo: user.photoURL || "",
        createdAt: serverTimestamp(),
      });
    }

    // ✅ Immediately sign them out after account creation
    await signOut(auth);

    toast.success("🎉 Account created successfully! Please log in.", { autoClose: 4000 });
    setTimeout(() => navigate("/login", { replace: true }), 1500);
  } catch (err: any) {
    setIsGoogleLoading(false);
    if (err.code === "auth/popup-closed-by-user") {
      toast.info("ℹ️ Sign-up cancelled", { autoClose: 5000 });
    } else {
      toast.error(`❌ ${err.message || "Google sign-up failed"}`, { autoClose: 10000 });
    }
  }
};

  return (
    <div className="signup-container">
      <div className="signup-card">
        <img src="../images/logo.jpg" alt="TimeFly Logo" className="signup-logo" />
        <h1>Create Your Account</h1>

        {!verificationStep ? (
          <form onSubmit={(e) => { e.preventDefault(); sendVerificationCode(); }}>
            <input type="text" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={isGoogleLoading || isSendingCode} />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isGoogleLoading || isSendingCode} />

            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isGoogleLoading || isSendingCode}
              />
              <span className={`toggle-password ${isGoogleLoading || isSendingCode ? "disabled" : ""}`} onClick={() => !(isGoogleLoading || isSendingCode) && setShowPassword(!showPassword)}>
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

            <button type="submit" disabled={isGoogleLoading || isSendingCode}>
              {isSendingCode ? <><FaSpinner className="spinner" /> Sending Code...</> : "Sign Up"}
            </button>

            <div className="divider"><span>or</span></div>

            <button type="button" className="google-btn" onClick={handleGoogleSignUp} disabled={isGoogleLoading || isSendingCode}>
              {isGoogleLoading ? (
                <>
                  <FaSpinner className="spinner" /> Signing up...
                </>
              ) : (
                <>
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="google-icon" />
                  Continue with Google
                </>
              )}
            </button>

            <p className="login-link">
              Already have an account? <Link to="/login" className="link-text">Login</Link>
            </p>
          </form>
        ) : (
          <div className="verification-overlay">
            <div className="verification-card">
              <h2>Email Verification</h2>
              <p>
                We've sent a <b>6-digit code</b> to <span className="email-highlight">{email}</span>. Please enter it below.
              </p>

              <input
                type="text"
                maxLength={6}
                className="verification-input"
                placeholder="Enter 6-digit code"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
                disabled={isVerifying}
              />

              <button onClick={verifyCodeAndCreate} disabled={isVerifying}>
                {isVerifying ? <><FaSpinner className="spinner" /> Verifying...</> : "Verify & Create Account"}
              </button>

              <button className="resend-btn" onClick={sendVerificationCode} disabled={isVerifying || isSendingCode}>
                {isSendingCode ? <><FaSpinner className="spinner" /> Sending...</> : "Resend Code"}
              </button>

              <button
                className="back-btn"
                onClick={() => { setVerificationStep(false); setInputCode(""); }}
                disabled={isVerifying || isSendingCode}
              >
                ← Back to Sign Up
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Signup;
