import React, { useEffect, useState, useMemo } from "react";
import { Users, User, UserCheck, UserX, Clock, Search } from "lucide-react";
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
      <h1 className="doctors-title">
        <Users size={26} /> Our Doctors
      </h1>
      <p className="doctors-subtitle">
        Meet our dedicated medical professionals and check their availability
      </p>

      {/* 🔍 Search and Filter Controls */}
      <div className="doctor-controls">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search doctor or specialty..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search doctors"
          />
        </div>

        <label htmlFor="specialtyFilter" className="sr-only">
          Filter by Specialty
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

      {isLoading ? (
        <p className="loading-text">Loading doctors...</p>
      ) : displayedDoctors.length === 0 ? (
        <p className="no-doctors-text">No doctors match your search.</p>
      ) : (
        <div className="doctors-grid">
          {displayedDoctors.map((doctor) => (
            <div key={doctor.id} className="doctor-card">
              <div className="doctor-avatar">
                {doctor.photo ? (
                  <img src={doctor.photo} alt={doctor.name} />
                ) : (
                  <User size={40} />
                )}
                <span
                  className={`availability-badge ${
                    doctor.available ? "available" : "unavailable"
                  }`}
                  title={
                    doctor.available ? "Available" : "Currently Unavailable"
                  }
                >
                  {doctor.available ? <UserCheck size={16} /> : <UserX size={16} />}
                </span>
              </div>

              <div className="doctor-info">
                <div className="info-row">
                  <strong>Name:</strong> <span>{doctor.name}</span>
                </div>
                <div className="info-row">
                  <strong>Specialty:</strong> <span>{doctor.specialty}</span>
                </div>
                <div className="info-row">
                  <strong>Availability:</strong>{" "}
                  <span
                    className={
                      doctor.available ? "text-available" : "text-unavailable"
                    }
                  >
                    {doctor.available
                      ? "Available Today"
                      : "Unavailable Today"}
                  </span>
                </div>

                {doctor.workingHours && (
                  <p className="hours">
                    <Clock size={14} /> {doctor.workingHours.start} –{" "}
                    {doctor.workingHours.end}
                  </p>
                )}

                {doctor.workingDays && doctor.workingDays.length > 0 && (
                  <p className="days">
                    🗓️{" "}
                    {doctor.workingDays.length === 7
                      ? "Available All Week"
                      : `Available ${doctor.workingDays.join(", ")}`}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Doctors;
