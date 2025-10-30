import React, { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Search,
  User,
  Camera,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import {
  getAuth,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import "../styles/header.css";

/* ============================
   HEADER PROPS (UPDATED)
   ============================ */
interface HeaderProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  placeholder?: string; // ✅ added to allow dynamic placeholder
}

const Header: React.FC<HeaderProps> = ({
  searchTerm,
  setSearchTerm,
  placeholder,
}) => {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [searchActive, setSearchActive] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    name?: string;
    email?: string;
    photo?: string;
  }>({});
  const searchRef = useRef<HTMLDivElement>(null);

  const auth = getAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /* ===== USER PROFILE & THEME ===== */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      if (user) {
        const localPhoto = window.localStorage.getItem(`userPhoto-${user.uid}`);
        setUserProfile({
          name: user.displayName || undefined,
          email: user.email || undefined,
          photo: localPhoto || user.photoURL || undefined,
        });
      } else {
        setUserProfile({});
      }
    });
    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme") as
      | "light"
      | "dark"
      | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = storedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    window.localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };
/* ===== SEARCH AUTO-CLOSE BEHAVIOR - ESC KEY ONLY ===== */
useEffect(() => {
  const handleEsc = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setSearchActive(false);
    }
  };

  document.addEventListener("keydown", handleEsc);
  return () => {
    document.removeEventListener("keydown", handleEsc);
  };
}, []);

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && auth.currentUser) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Photo = reader.result as string;
        setUserProfile((prev) => ({ ...prev, photo: base64Photo }));
        window.localStorage.setItem(
          `userPhoto-${auth.currentUser?.uid}`,
          base64Photo
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  /* ===== DYNAMIC SEARCH PLACEHOLDER ===== */
  const getSearchPlaceholder = () => {
    if (placeholder) return placeholder; // ✅ prioritize prop placeholder
    if (location.pathname.includes("/doctors")) return "Search doctors...";
    if (location.pathname.includes("/appointments")) return "Search appointments...";
    return "Search appointments, patients...";
  };

  return (
    <>
      <header className="dashboard-header">
        <div className="header-left">
          <button
            className="hamburger-menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <NavLink to="/dashboard" className="logo-link" title="Dashboard" end>
            <img src="/images/bird.png" alt="TimeFly Logo" className="logo" />
            <span className="logo-title">TimeFly</span>
          </NavLink>

          <nav
            className="nav-links desktop-nav"
            role="navigation"
            aria-label="Main navigation"
          >
            {["/about", "/doctors", "/faq", "/feedback"].map((path) => {
              const labels: { [key: string]: string } = {
                "/about": "About Us",
                "/doctors": "Our Doctors",
                "/faq": "FAQ",
                "/feedback": "Feedback",
              };
              return (
                <NavLink
                  key={path}
                  to={path}
                  end
                  className={({ isActive }) =>
                    `nav-link${isActive ? " active" : ""}`
                  }
                >
                  {labels[path]}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="header-right">
          {/* ===== SEARCH LINE INPUT ===== */}
          <div
            ref={searchRef}
            className={`search-line-container ${searchActive ? "active" : ""}`}
          >
            {!searchActive ? (
              <button
                className="search-icon-button"
                onClick={() => setSearchActive(true)}
                aria-label="Open search"
              >
                <Search size={18} />
              </button>
            ) : (
              <div className="search-line-wrapper">
                <Search size={18} className="search-inline-icon" />
                <input
                  type="text"
                  className="search-line-input"
                  placeholder={getSearchPlaceholder()}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
                <button
                  className="close-search-button"
                  onClick={() => setSearchActive(false)}
                  aria-label="Close search"
                >
                  ✕
                </button>
                <span className="search-underline"></span>
              </div>
            )}
          </div>

          <div className="profile-dropdown-wrapper">
            <button
              className="profile-button"
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              aria-label="View user profile"
            >
              <div className="user-avatar">
                {userProfile?.photo ? (
                  <img
                    src={userProfile.photo}
                    alt={userProfile.name}
                    className="avatar-image"
                  />
                ) : (
                  <User size={16} />
                )}
              </div>
            </button>

          {showProfileDropdown && (
  <div className="profile-dropdown">
    <div className="profile-header">
      <div className="profile-avatar-lg">
        {userProfile?.photo ? (
          <img
            src={userProfile.photo}
            alt={userProfile.name}
            className="avatar-image"
          />
        ) : (
          <User size={32} />
        )}
      </div>
      <div className="profile-info">
        <p className="profile-name">{userProfile?.name}</p>
        <p className="profile-email">{userProfile?.email}</p>
      </div>
    </div>

    <input
      type="file"
      id="profilePhoto"
      accept="image/*"
      onChange={handleProfilePhotoUpload}
      className="hidden"
    />
    <label htmlFor="profilePhoto" className="action-link">
      <Camera size={16} /> Change Photo
    </label>

    <button className="action-link" onClick={toggleTheme}>
      {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
      {theme === "light" ? "Dark Mode" : "Light Mode"}
    </button>

    <button
      className="logout-action"
      onClick={() => setShowLogoutModal(true)}
    >
      <LogOut size={16} /> Logout
    </button>
  </div>
)}
          </div>
        </div>
      </header>

      {/* ===== MOBILE NAV ===== */}
      <nav
        className={`mobile-nav-drawer ${mobileMenuOpen ? "nav-open" : ""}`}
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="nav-drawer-content">
          {["/about", "/doctors", "/faq", "/feedback"].map((path) => {
            const labels: { [key: string]: string } = {
              "/about": "About Us",
              "/doctors": "Our Doctors",
              "/faq": "FAQ",
              "/feedback": "Feedback",
            };
            return (
              <NavLink
                key={path}
                to={path}
                end
                className={({ isActive }) =>
                  `nav-link${isActive ? " active" : ""}`
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                {labels[path]}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="nav-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* ===== LOGOUT MODAL ===== */}
      {showLogoutModal && (
        <div
          className="logout-modal-overlay"
          onClick={() => setShowLogoutModal(false)}
        >
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <p className="logout-message">
              Are you sure you want to log out of your account?
            </p>
            <div className="logout-modal-buttons">
              <button
                className="logout-btn-confirm"
                onClick={() => {
                  setShowLogoutModal(false);
                  handleLogout();
                }}
              >
                Logout
              </button>
              <button
                className="logout-btn-cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
