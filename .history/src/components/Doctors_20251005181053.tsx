import React, { useEffect, useState, useMemo } from "react";
import { Users, User, UserCheck, UserX, Clock, Search, Calendar } from "lucide-react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../firebase";
import "../styles/doctors.css";

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  available: boolean;
  workingHours?: {
    start: string;
    end: string;
  };
  workingDays?: string[];
  photo?: string;
}

interface DoctorAvailability {
  doctorId: string;
  date: string;
  available: boolean;
}

const Doctors: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availabilities, setAvailabilities] = useState<DoctorAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("All");

  // ✅ Fetch doctors
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

  // ✅ Fetch availability updates
  useEffect(() => {
    const q = query(collection(db, "doctorAvailability"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          doctorId: doc.data().doctorId,
          date: doc.data().date,
          available: doc.data().available,
        })) as DoctorAvailability[];
        setAvailabilities(list);
      },
      (error) => console.error("Error loading availability:", error)
    );
    return () => unsubscribe();
  }, []);

  // ✅ Merge and filter data
  const displayedDoctors = useMemo(() => {
    return doctors
      .filter((d) => {
        const term = searchTerm.toLowerCase();
        const matchSearch =
          d.name.toLowerCase().includes(term) ||
          d.specialty.toLowerCase().includes(term);
        const matchSpecialty =
          filterSpecialty === "All" || d.specialty === filterSpecialty;
        return matchSearch && matchSpecialty;
      })
      .map((d) => {
        const unavailable =
          availabilities.find((a) => a.doctorId === d.id && !a.available) !=
          undefined;
        return { ...d, available: !unavailable && d.available };
      });
  }, [doctors, availabilities, searchTerm, filterSpecialty]);

  // ✅ Build specialty dropdown
  const specialties = useMemo(() => {
    const unique = Array.from(new Set(doctors.map((d) => d.specialty)));
    return ["All", ...unique];
  }, [doctors]);

  return (
    <div className="doctors-page">
      <div className="page-header">
        <h1 className="doctors-title">
          <Users size={32} /> Our Medical Team
        </h1>
        <p className="doctors-subtitle">
          Meet our dedicated healthcare professionals and check their availability for appointments
        </p>
      </div>

      {/* 🔍 Search and Filter Controls */}
      <div className="controls-section">
        <div className="search-container">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search by doctor name or specialty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search doctors"
            />
          </div>
        </div>

        <div className="filter-container">
          <label htmlFor="specialtyFilter" className="filter-label">
            Filter by Specialty:
          </label>
          <select
            id="specialtyFilter"
            className="filter-dropdown"
            value={filterSpecialty}
            onChange={(e) => setFilterSpecialty(e.target.value)}
            title="Filter by Specialty"
            aria-label="Filter by Specialty"
          >
            {specialties.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 📊 Results Summary */}
      {!isLoading && displayedDoctors.length > 0 && (
        <div className="results-summary">
          <span className="results-count">
            Showing {displayedDoctors.length} doctor{displayedDoctors.length !== 1 ? 's' : ''}
            {filterSpecialty !== 'All' && ` in ${filterSpecialty}`}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading our medical team...</p>
        </div>
      ) : displayedDoctors.length === 0 ? (
        <div className="empty-state">
          <User size={48} />
          <p className="no-doctors-text">No doctors found matching your criteria</p>
          <p className="empty-suggestion">Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="doctors-grid">
          {displayedDoctors.map((doctor) => (
            <div key={doctor.id} className="doctor-card">
              {/* Doctor Header */}
              <div className="doctor-header">
                <div className="doctor-avatar">
                  {doctor.photo ? (
                    <img src={doctor.photo} alt={doctor.name} />
                  ) : (
                    <User size={44} />
                  )}
                </div>
                <div className="doctor-basic-info">
                  <h3 className="doctor-name">{doctor.name}</h3>
                  <p className="doctor-specialty">{doctor.specialty}</p>
                </div>
                <div
                  className={`availability-status ${doctor.available ? "available" : "unavailable"}`}
                  title={doctor.available ? "Available for appointments" : "Currently unavailable"}
                >
                  {doctor.available ? <UserCheck size={20} /> : <UserX size={20} />}
                  <span>{doctor.available ? "Available" : "Unavailable"}</span>
                </div>
              </div>

              {/* Doctor Details */}
              <div className="doctor-details">
                {doctor.workingHours && (
                  <div className="detail-item">
                    <Clock size={16} />
                    <div className="detail-content">
                      <span className="detail-label">Working Hours:</span>
                      <span className="detail-value">
                        {doctor.workingHours.start} - {doctor.workingHours.end}
                      </span>
                    </div>
                  </div>
                )}

                {doctor.workingDays && doctor.workingDays.length > 0 && (
                  <div className="detail-item">
                    <Calendar size={16} />
                    <div className="detail-content">
                      <span className="detail-label">Available Days:</span>
                      <span className="detail-value">
                        {doctor.workingDays.length === 7
                          ? "Monday - Sunday"
                          : doctor.workingDays.join(", ")}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="doctor-actions">
                <button 
                  className={`appointment-btn ${doctor.available ? "available" : "disabled"}`}
                  disabled={!doctor.available}
                >
                  {doctor.available ? "Book Appointment" : "Not Available"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Doctors;