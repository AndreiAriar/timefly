import React, { useEffect, useState, useMemo } from "react";
import { Users, User, Clock, Filter } from "lucide-react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../firebase";
import { useSearch } from "./SearchContext"; // ✅ import global search context
import "../styles/doctors.css";

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  workingHours?: {
    start: string;
    end: string;
  };
  photo?: string;
}

interface DoctorsProps {}

const Doctors: React.FC<DoctorsProps> = () => {
  const { searchTerm } = useSearch(); // ✅ use global header search
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterSpecialty, setFilterSpecialty] = useState("All");

  /* =========================
     HELPER: CONVERT TO 12-HOUR FORMAT
  ========================== */
  const convertTo12Hour = (time24: string): string => {
    if (!time24) return '';
    
    // Handle if already in 12-hour format
    if (time24.includes('AM') || time24.includes('PM')) {
      return time24;
    }
    
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  /* =========================
     FETCH DOCTORS
  ========================== */
  useEffect(() => {
    const q = query(collection(db, "doctors"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Doctor[];
        setDoctors(list);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error loading doctors:", error);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  /* =========================
     FILTER DOCTORS
  ========================== */
  const displayedDoctors = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return doctors.filter((d) => {
      const matchSearch =
        d.name.toLowerCase().includes(term) ||
        d.specialty.toLowerCase().includes(term);
      const matchSpecialty =
        filterSpecialty === "All" || d.specialty === filterSpecialty;
      return matchSearch && matchSpecialty;
    });
  }, [doctors, searchTerm, filterSpecialty]);

  const specialties = useMemo(() => {
    const unique = Array.from(new Set(doctors.map((d) => d.specialty)));
    return ["All", ...unique];
  }, [doctors]);

  /* =========================
     RENDER
  ========================== */
  return (
    <div className="doctors-page">
      {/* ===== HEADER ===== */}
      <div className="page-header">
        <h1 className="doctors-title">
          <Users size={32} /> Our Medical Team
        </h1>
        <p className="doctors-subtitle">
          Meet our expert medical professionals
        </p>
      </div>

      {/* ===== FILTER ONLY ===== */}
      <div className="controls-section">
        <div className="filter-container">
          <div className="filter-header">
            <Filter className="filter-icon" size={16} />
            <label htmlFor="specialtyFilter" className="filter-label">
              Specialty:
            </label>
          </div>
          <select
            id="specialtyFilter"
            className="filter-dropdown"
            value={filterSpecialty}
            onChange={(e) => setFilterSpecialty(e.target.value)}
          >
            {specialties.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      {isLoading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading doctors...</p>
        </div>
      ) : displayedDoctors.length === 0 ? (
        <div className="empty-state">
          <User size={48} />
          <p className="no-doctors-text">No doctors found</p>
        </div>
      ) : (
        <div className="doctors-grid">
          {displayedDoctors.map((doctor) => (
            <div key={doctor.id} className="doctor-card">
              <div className="doctor-profile">
                <div className="doctor-avatar">
                  {doctor.photo ? (
                    <img src={doctor.photo} alt={doctor.name} />
                  ) : (
                    <User size={64} />
                  )}
                </div>

                {/* ===== Doctor Info ===== */}
                <div className="doctor-info">
                  <h3 className="doctor-name">{doctor.name}</h3>
                  <p className="doctor-specialty">{doctor.specialty}</p>
                  {doctor.workingHours && (
                    <div className="doctor-hours">
                      <Clock size={16} />
                      <span>
                        {convertTo12Hour(doctor.workingHours.start)} - {convertTo12Hour(doctor.workingHours.end)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Doctors;