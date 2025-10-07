import React, { useEffect, useState, createContext, useContext } from "react";
import { Routes, Route, Navigate, useNavigate, Outlet } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/toastify-custom.css";
import "./styles/staff-isolation.css";
import "./styles/global-theme.css"; // ✅ Added for dark/light mode styling

// Components
import Login from "./components/Login";
import Signup from "./components/Signup";
import PatientDashboard from "./components/PatientDashboard";
import DoctorDashboard from "./components/DoctorDashboard";
import NotFound from "./components/NotFound";
import Header from "./components/Header";
import Footer from "./components/Footer"; // ✅ Global footer

// Public Pages
import About from "./components/About";
import Doctors from "./components/Doctors";
import FAQ from "./components/FAQ";
import Feedback from "./components/Feedback";

const StaffDashboard = React.lazy(() => import("./components/StaffDashboard"));

// Firebase
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// ✅ Import Search Context
import { SearchProvider, useSearch } from "./components/SearchContext";

// ------------------------
// TYPES
// ------------------------
interface UserData {
  role: "Patient" | "Doctor" | "Staff" | "Admin";
  uid: string;
}

// ------------------------
// THEME CONTEXT (Dark/Light Mode)
// ------------------------
const ThemeContext = createContext<any>(null);
export const useTheme = () => useContext(ThemeContext);

const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [darkMode, setDarkMode] = useState<boolean>(
    localStorage.getItem("theme") === "dark"
  );

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const toggleTheme = () => setDarkMode((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ------------------------
// MAIN LAYOUT
// ------------------------
const MainLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { searchTerm, setSearchTerm } = useSearch();
  return (
    <>
      <Header searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <main>{children ?? <Outlet />}</main>
      <Footer /> {/* ✅ Global footer */}
    </>
  );
};

// ------------------------
// APP CONTENT
// ------------------------
const AppContent = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const q = query(collection(db, "users"), where("uid", "==", firebaseUser.uid));
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            const role = userData.role || "Patient";
            setUser({ role, uid: firebaseUser.uid });

            const currentPath = window.location.pathname;
            if (currentPath === "/" || currentPath === "/login") {
              navigate(getRedirectPath({ role, uid: firebaseUser.uid }), { replace: true });
            }
          } else {
            setUser({ role: "Patient", uid: firebaseUser.uid });
            const currentPath = window.location.pathname;
            if (currentPath === "/" || currentPath === "/login") {
              navigate("/dashboard", { replace: true });
            }
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUser({ role: "Patient", uid: firebaseUser.uid });
        }
      } else {
        setUser(null);
        const currentPath = window.location.pathname;
        if (!["/login", "/signup"].includes(currentPath)) {
          navigate("/login", { replace: true });
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Auth routes */}
      <Route
        path="/login"
        element={user ? <Navigate to={getRedirectPath(user)} replace /> : <Login />}
      />
      <Route
        path="/signup"
        element={
          user ? (
            <Navigate to={getRedirectPath(user)} replace />
          ) : (
            <Signup
              onSuccess={async () => {
                await signOut(auth);
                navigate("/login", { replace: true });
              }}
            />
          )
        }
      />

      {/* Routes with header and footer */}
      <Route element={<MainLayout />}>
        <Route path="/about" element={<About />} />
        <Route path="/doctors" element={<Doctors />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/feedback" element={<Feedback />} />

        {/* Dashboards */}
        <Route
          path="/dashboard"
          element={
            user?.role === "Patient" ? (
              <PatientDashboard />
            ) : (
              <NotFound message="Access denied: Patients only." />
            )
          }
        />
        <Route
          path="/doctor-dashboard"
          element={
            user?.role === "Doctor" ? (
              <DoctorDashboard />
            ) : (
              <NotFound message="Access denied: Doctors only." />
            )
          }
        />
        <Route
          path="/staff-dashboard"
          element={
            user?.role === "Staff" || user?.role === "Admin" ? (
              <React.Suspense fallback={<div className="staff-loading">Loading Staff Dashboard...</div>}>
                <StaffDashboard />
              </React.Suspense>
            ) : (
              <NotFound message="Access denied: Staff/Admin only." />
            )
          }
        />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// ------------------------
// REDIRECT HELPER
// ------------------------
const getRedirectPath = (user: UserData): string => {
  if (user.role === "Doctor") return "/doctor-dashboard";
  if (user.role === "Staff" || user.role === "Admin") return "/staff-dashboard";
  return "/dashboard";
};

// ------------------------
// APP WRAPPER
// ------------------------
const App = () => (
  <ThemeProvider>
    <SearchProvider>
      <AppContent />
      <ToastContainer
        position="top-center"
        autoClose={10000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss={false}
        draggable
        pauseOnHover
        theme="colored"
        closeButton
        limit={3}
      />
    </SearchProvider>
  </ThemeProvider>
);

export default App;
