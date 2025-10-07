import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Search, User, Camera, Moon, Sun, LogOut } from "lucide-react";
import { getAuth, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

interface HeaderProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const Header: React.FC<HeaderProps> = ({ searchTerm, setSearchTerm }) => {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [userProfile, setUserProfile] = useState<{ name?: string; email?: string; photo?: string }>({});
  const auth = getAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      if (user) {
        const localPhoto = localStorage.getItem(`userPhoto-${user.uid}`);
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
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = storedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && auth.currentUser) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Photo = reader.result as string;
        setUserProfile((prev) => ({ ...prev, photo: base64Photo }));
        localStorage.setItem(`userPhoto-${auth.currentUser?.uid}`, base64Photo);
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

  return (
    <header className="dashboard-header">
      {/* Left: Logo + Nav */}
      <div className="header-left">
        <NavLink to="/dashboard" className="logo-link" title="Dashboard" end>
          <img src="/images/bird.png" alt="TimeFly Logo" className="logo" />
          <span className="logo-title">TimeFly</span>
        </NavLink>

        <nav className="nav-links" role="navigation" aria-label="Main navigation">
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
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                {labels[path]}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Right: Search + Profile */}
      <div className="header-right">
        {/* ✅ Search bar in header */}
        <div className="search-container">
          <Search className="search-icon" size={18} aria-hidden="true" />
          <input
            type="text"
            placeholder="Search appointments, patients..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search appointments and patients"
          />
        </div>

        <div className="profile-dropdown-wrapper">
          <button
            className="profile-button"
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            aria-label="View user profile"
          >
            <div className="user-avatar">
              {userProfile?.photo ? (
                <img src={userProfile.photo} alt={userProfile.name} className="avatar-image" />
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
                    <img src={userProfile.photo} alt={userProfile.name} className="avatar-image" />
                  ) : (
                    <User size={32} />
                  )}
                </div>
                <div className="profile-info">
                  <p className="profile-name">{userProfile?.name}</p>
                  <p className="profile-email">{userProfile?.email}</p>
                </div>
              </div>

              <div className="profile-action">
                <input
                  type="file"
                  id="profilePhoto"
                  accept="image/*"
                  onChange={handleProfilePhotoUpload}
                  className="hidden"
                />
                <label htmlFor="profilePhoto" className="action-link">
                  <Camera size={14} /> Change Photo
                </label>
              </div>

              <button className="action-link" onClick={toggleTheme}>
                {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
                {theme === "light" ? "Dark Mode" : "Light Mode"}
              </button>

              <button className="logout-action" onClick={handleLogout}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
