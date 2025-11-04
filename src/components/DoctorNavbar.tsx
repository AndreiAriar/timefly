// src/components/DoctorNavbar.tsx
import { useState, useEffect, useRef } from 'react';
import { User, LogOut, Search, X, Activity, Users } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import '../styles/doctornavbar.css';

interface NavbarProps {
  userProfile: {
    name: string;
    email: string;
    photo?: string;
  } | null;
  onLogout: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  stats: {
    today: number;
    inProgress: number;
    upcoming: number;
    completed: number;
  };
  currentView: 'home' | 'queue' | 'appointments';
  onViewChange: (view: 'home' | 'queue' | 'appointments') => void;
  onPhotoUpdate?: (photoUrl: string) => void;
}

const DoctorNavbar = ({
  userProfile,
  onLogout,
  searchTerm,
  onSearchChange,
  currentView,
  onViewChange,
  onPhotoUpdate,
}: NavbarProps) => {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ Handle scroll for blur effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onLogout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleSearchToggle = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      onSearchChange('');
    }
  };

  // ✅ Handle photo upload with Base64 conversion
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      alert('Image size must be less than 5MB. Please choose a smaller image.');
      e.target.value = '';
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      e.target.value = '';
      return;
    }

    try {
      // Convert to Base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        
        // Store in localStorage
        if (auth.currentUser) {
          localStorage.setItem(`doctorPhoto_${auth.currentUser.uid}`, base64String);
          
          // Call the callback to update parent component
          if (onPhotoUpdate) {
            onPhotoUpdate(base64String);
          } else {
            // Fallback: reload page if no callback provided
            window.location.reload();
          }
        }
      };

      reader.onerror = () => {
        console.error('Error reading file');
        alert('Failed to upload photo. Please try again.');
      };

      reader.readAsDataURL(file);
      
      // Reset input and close dropdown
      e.target.value = '';
      setShowProfileDropdown(false);
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
      e.target.value = '';
    }
  };

  return (
    <nav className={`doctor-dashboard-navbar ${isScrolled ? 'doctor-navbar-scrolled' : ''}`}>
      <div className="doctor-navbar-container">
        {/* Logo and Navigation Links Section */}
        <div className="doctor-navbar-left">
          {/* Logo Section */}
          <div className="doctor-navbar-logo" onClick={() => onViewChange('home')}>
            <img
              src="/images/bird.png"
              alt="TimeFly Logo"
              className="doctor-navbar-logo-image"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <h1 className="doctor-navbar-logo-text">TimeFly</h1>
          </div>

          {/* Navigation Links - Moved closer to logo */}
          <div className="doctor-navbar-links">
            <button
              className={`doctor-nav-link ${currentView === 'queue' ? 'doctor-nav-active' : ''}`}
              onClick={() => onViewChange('queue')}
            >
              <Activity size={18} />
              <span>Current Queue</span>
            </button>

            <button
              className={`doctor-nav-link ${currentView === 'appointments' ? 'doctor-nav-active' : ''}`}
              onClick={() => onViewChange('appointments')}
            >
              <Users size={18} />
              <span>My Appointments</span>
            </button>
          </div>
        </div>

        {/* Right Section */}
        <div className="doctor-navbar-right">
          {/* Search - Expandable */}
          <div className={showSearch ? "doctor-navbar-search-expanded" : ""}>
            {showSearch && (
              <div className="doctor-search-wrapper">
                <Search className="doctor-search-icon-left" size={18} />
                <input
                  id="doctorNavbarSearch"
                  type="text"
                  placeholder="Search patients, appointments..."
                  className="doctor-search-input"
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  aria-label="Search patients and appointments"
                />
                <button
                  className="doctor-search-close-btn"
                  onClick={handleSearchToggle}
                  title="Close search"
                  aria-label="Close search"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {!showSearch && (
              <button
                className="doctor-search-toggle-btn"
                onClick={handleSearchToggle}
                title="Search"
                aria-label="Open search"
              >
                <Search size={20} />
              </button>
            )}
          </div>

          {/* Profile Dropdown */}
          <div
            className="doctor-profile-dropdown-container"
            ref={dropdownRef}
          >
            <button
              className="doctor-profile-button"
              onClick={() => setShowProfileDropdown((prev) => !prev)}
              title="Profile menu"
              aria-label="Open profile menu"
            >
              <div className="doctor-user-avatar">
                {userProfile?.photo ? (
                  <img
                    src={userProfile.photo}
                    alt={userProfile.name || 'Profile photo'}
                    className="doctor-avatar-image"
                  />
                ) : (
                  <User size={20} />
                )}
              </div>
            </button>

            <div
              className={`doctor-profile-dropdown ${
                showProfileDropdown ? 'doctor-dropdown-show' : ''
              }`}
            >
              <div className="doctor-dropdown-header">
                <p className="doctor-dropdown-name">{userProfile?.name}</p>
                <p className="doctor-dropdown-email">{userProfile?.email}</p>
              </div>

              <label htmlFor="doctorPhotoUpload" className="doctor-hidden-file-label">
                Upload Profile Photo
              </label>
              <input
                type="file"
                id="doctorPhotoUpload"
                accept="image/*"
                className="doctor-hidden-file-input"
                onChange={handlePhotoUpload}
                title="Upload profile photo"
                aria-label="Upload profile photo"
              />

              <button
                className="doctor-dropdown-item"
                onClick={() => {
                  const input = document.getElementById(
                    'doctorPhotoUpload'
                  ) as HTMLInputElement;
                  input?.click();
                }}
                title="Change profile photo"
                aria-label="Change profile photo"
              >
                <User size={16} />
                Change Photo
              </button>

              <button
                className="doctor-dropdown-item doctor-dropdown-logout"
                onClick={handleLogout}
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default DoctorNavbar;