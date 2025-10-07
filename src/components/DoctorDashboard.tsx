import { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  Users,
  Search,
  User,
  XCircle,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Timer,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
  Activity,
  TrendingUp,
  History,
  Upload,
} from 'lucide-react';

// Firebase imports
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp,
  Timestamp,
  doc,
  updateDoc,
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { db, auth } from '../../firebase';
import '../styles/doctordashboard.css';

interface Appointment {
  id: string;
  name: string;
  type: string;
  time: string;
  date: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'in-progress';
  priority: 'normal' | 'urgent' | 'emergency';
  doctor: string;
  doctorId: string;
  photo?: string;
  email: string;
  phone: string;
  queueNumber?: number;
  gender?: string;
  age?: string;
  userId?: string;
  bookedBy: 'patient' | 'staff';
  staffUserId?: string;
  patientUserId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  available: boolean;
  bufferTime: number;
  maxAppointments: number;
  workingHours: {
    start: string;
    end: string;
  };
  offDays: string[];
  availableDates?: string[];
  unavailableDates?: string[];
  workingDays?: string[];
  scheduleSettings?: {
    [date: string]: {
      available: boolean;
      customHours?: {
        start: string;
        end: string;
      };
      maxAppointments?: number;
    };
  };
}

interface DaySchedule {
  date: string;
  dayName: string;
  dayNumber: number;
  appointments: {
    booked: number;
    total: number;
  };
  doctorAppointments: Appointment[];
}

interface UserProfile {
  name: string;
  email: string;
  role: string;
  phone: string;
  department: string;
  specialty?: string;
  photo?: string;
  uid: string;
  doctorId?: string;
}

interface Notification {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  timestamp: Date;
}

const DoctorDashboard = () => {
  const [showCalendarView, setShowCalendarView] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [calendarCurrentDate, setCalendarCurrentDate] = useState(new Date());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currentDoctor, setCurrentDoctor] = useState<Doctor | null>(null);
  const [viewMode, setViewMode] = useState<'today' | 'upcoming' | 'completed'>('today');
  const [_doctors, setDoctors] = useState<Doctor[]>([]);
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add notification function
  const addNotification = (
    type: 'success' | 'error' | 'info' | 'warning',
    message: string
  ) => {
    const newNotification: Notification = {
      id: Date.now(),
      type,
      message,
      timestamp: new Date()
    };
    setNotifications(prev => [newNotification, ...prev]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
    }, 5000);
  };

  // Remove notification function
  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Firebase auth state listener
 useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (!user) {
      setCurrentUser(null);
      setUserProfile(null);
      setIsLoading(false);
      window.location.href = '/login';
      return;
    }

    setCurrentUser(user);

    try {
      // 1) Load user profile
      const uQuery = query(collection(db, 'users'), where('uid', '==', user.uid));
      const uSnap = await getDocs(uQuery);
      if (uSnap.empty) throw new Error('User profile not found');

      const uDoc = uSnap.docs[0];
      const uData = uDoc.data();

      // 2) Resolve the correct doctorId
      const doctorsSnap = await getDocs(collection(db, 'doctors'));
      const hasValidId =
        typeof uData.doctorId === 'string' &&
        doctorsSnap.docs.some(d => d.id === uData.doctorId);

      let resolvedDoctorId: string | undefined = hasValidId ? uData.doctorId : undefined;

      if (!resolvedDoctorId) {
        // Try to match by email first, then by name
        const match = doctorsSnap.docs.find(d => {
          const dData = d.data() as any;
          return (
            (uData.email && dData.email === uData.email) ||
            (uData.name && dData.name === uData.name)
          );
        });
        if (match) {
          resolvedDoctorId = match.id;

          // 3) Persist the fix back to the user's profile so it stays correct
          await updateDoc(doc(db, 'users', uDoc.id), { doctorId: resolvedDoctorId });
        }
      }

      // 4) Set profile/state
      const profile: UserProfile = {
        name: uData.name || user.displayName || '',
        email: uData.email || user.email || '',
        role: uData.role || 'Doctor',
        phone: uData.phone || '',
        department: uData.department || '',
        specialty: uData.specialty || '',
        photo: uData.photo || '',
        uid: user.uid,
        doctorId: resolvedDoctorId || '' // may remain '' if not found
      };

      setUserProfile(profile);
      setPreviewPhoto(uData.photo || null);

      // Set currentDoctor if found
      if (resolvedDoctorId) {
        const doctorDoc = doctorsSnap.docs.find(d => d.id === resolvedDoctorId);
        if (doctorDoc) {
          setCurrentDoctor({ id: doctorDoc.id, ...(doctorDoc.data() as any) } as Doctor);
        }
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      addNotification('error', 'Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  });

  return () => unsubscribe();
}, []);

  // Fetch doctors
  useEffect(() => {
    if (!currentUser) return;
    const fetchDoctors = async () => {
      try {
        const doctorsQuery = query(collection(db, 'doctors'));
        const unsubscribe = onSnapshot(
          doctorsQuery,
          (snapshot) => {
            const doctorsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Doctor[];
            setDoctors(doctorsData);
          },
          (error) => {
            console.error('Error in doctors snapshot:', error);
            addNotification('error', 'Failed to load doctors');
          }
        );
        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting up doctors listener:', error);
        addNotification('error', 'Failed to set up doctor listener');
      }
    };
    fetchDoctors();
  }, [currentUser]);

 // ✅ Fetch appointments with real-time sync
useEffect(() => {
  if (!currentUser || !userProfile) {
    console.log('Missing currentUser or userProfile');
    return;
  }

  // 🔴 Must have doctorId
  if (!userProfile.doctorId) {
    console.error('Missing doctorId for user:', currentUser.uid);
    addNotification('error', 'Doctor ID not found. Cannot load appointments.');
    return;
  }

  // ✅ Create query using doctorId only
  const appointmentsQuery = query(
    collection(db, 'appointments'),
    where('doctorId', '==', userProfile.doctorId),
    where('status', '!=', 'cancelled'),
    orderBy('date', 'asc'),
    orderBy('time', 'asc')
  );

  // ✅ Set up real-time listener
  const unsubscribe = onSnapshot(
    appointmentsQuery,
    (snapshot) => {
      const appointmentsData: Appointment[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        appointmentsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt || serverTimestamp(),
          updatedAt: data.updatedAt || serverTimestamp(),
        } as Appointment);
      });

      setAppointments(appointmentsData);
      console.log(`✅ Loaded ${appointmentsData.length} appointment(s) for doctor: ${userProfile.doctorId}`);
    },
    (error) => {
      console.error('❌ Error in appointment listener:', error);
      addNotification('error', 'Failed to load appointments. Check connection or permissions.');
    }
  );

  // ✅ Clean up listener when component unmounts
  return () => unsubscribe();
}, [currentUser, userProfile]); // ✅ Correct dependencies

  // Handle photo upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Save profile changes (including photo)
const handleSaveProfile = async () => {
  if (!userProfile || !currentUser) return;

  try {
    let photoURL = userProfile.photo;

    // If a new photo was selected, use Base64 preview
    if (editPhoto && previewPhoto) {
      // ✅ Use Base64 only in Firestore — DO NOT update Firebase Auth
      photoURL = previewPhoto;
    }

    // ✅ Update Firestore with Base64 photo
    const userQuery = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
    const userDocs = await getDocs(userQuery);
    if (!userDocs.empty) {
      const userDocRef = doc(db, 'users', userDocs.docs[0].id);
      await updateDoc(userDocRef, {
        photo: photoURL,
        phone: userProfile.phone,
        name: userProfile.name,
        specialty: userProfile.specialty,
        updatedAt: serverTimestamp()
      });
    }

    // ✅ Update local state (so UI updates)
    setUserProfile({ ...userProfile, photo: photoURL });
    setIsEditingProfile(false);
    addNotification('success', 'Profile updated successfully!');
  } catch (error) {
    console.error('Error updating profile:', error);
    addNotification('error', 'Failed to update profile');
  }
};
  const handleLogout = async () => {
    try {
      await signOut(auth);
      addNotification('success', 'Logged out successfully');
    } catch (error) {
      console.error('Error logging out:', error);
      addNotification('error', 'Failed to log out');
    }
  };

  // Calendar days logic
  const getCalendarDays = (): DaySchedule[] => {
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: DaySchedule[] = [];
    const today = new Date();
    const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

      if (dateStr < todayDateStr) continue;

      const dayAppointments = appointments.filter(
        apt => apt.date === dateStr && apt.status !== 'cancelled'
      );

      const maxAppointments = currentDoctor?.maxAppointments || 8;

      days.push({
        date: dateStr,
        dayName,
        dayNumber: day,
        appointments: {
          booked: dayAppointments.length,
          total: maxAppointments
        },
        doctorAppointments: dayAppointments
      });
    }
    return days;
  };

  const getTodayDate = (): string => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  const getStatusStats = () => {
    const today = getTodayDate();
    const todayAppointments = appointments.filter(apt => apt.date === today);
    const upcomingAppointments = appointments.filter(apt => apt.date > today);
    const completedAppointments = appointments.filter(apt => apt.status === 'completed');

    return {
      today: todayAppointments.filter(apt => apt.status !== 'cancelled').length,
      pending: todayAppointments.filter(apt => apt.status === 'pending').length,
      completed: completedAppointments.length,
      upcoming: upcomingAppointments.length,
      inProgress: todayAppointments.filter(apt => apt.status === 'in-progress').length
    };
  };

  const getCurrentQueue = () => {
    const today = getTodayDate();
    const todayAppointments = appointments.filter(apt => {
      return apt.date === today && ['confirmed', 'pending', 'in-progress'].includes(apt.status);
    });
    return todayAppointments.sort((a, b) => {
      const priorityOrder = { emergency: 3, urgent: 2, normal: 1 };
      const aPriority = priorityOrder[a.priority] || 1;
      const bPriority = priorityOrder[b.priority] || 1;
      if (aPriority !== bPriority) return bPriority - aPriority;
      const aQueue = a.queueNumber || 999;
      const bQueue = b.queueNumber || 999;
      if (aQueue !== bQueue) return aQueue - bQueue;
      return a.time.localeCompare(b.time);
    });
  };

  const getFilteredAppointments = () => {
    let filtered = appointments;

    const today = getTodayDate();
    switch (viewMode) {
      case 'today':
        filtered = appointments.filter(apt => apt.date === today && apt.status !== 'cancelled');
        break;
      case 'upcoming':
        filtered = appointments.filter(apt => apt.date > today && apt.status !== 'cancelled');
        break;
      case 'completed':
        filtered = appointments.filter(apt => apt.status === 'completed');
        break;
      default:
        filtered = appointments.filter(apt => apt.status !== 'cancelled');
    }

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(apt =>
        apt.name.toLowerCase().includes(searchLower) ||
        apt.type.toLowerCase().includes(searchLower) ||
        apt.status.toLowerCase().includes(searchLower) ||
        apt.priority.toLowerCase().includes(searchLower) ||
        apt.date.includes(searchLower)
      );
    }
    return filtered;
  };

  const getMonthName = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCalendarCurrentDate(prev => {
      const newDate = new Date(prev);
      direction === 'prev'
        ? newDate.setMonth(prev.getMonth() - 1)
        : newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'urgent': return 'priority-urgent';
      case 'emergency': return 'priority-emergency';
      default: return 'priority-normal';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle size={16} />;
      case 'emergency': return <Timer size={16} />;
      default: return <CheckCircle2 size={16} />;
    }
  };

  const getAvailabilityColor = (booked: number, total: number): string => {
    if (total === 0) return 'availability-available';
    const ratio = booked / total;
    if (ratio >= 0.9) return 'availability-full';
    if (ratio >= 0.7) return 'availability-busy';
    return 'availability-available';
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={16} />;
      case 'error': return <XCircle size={16} />;
      case 'warning': return <AlertTriangle size={16} />;
      default: return <Calendar size={16} />;
    }
  };

  const stats = getStatusStats();
  const queue = getCurrentQueue();
  const currentPatient = queue.find(apt => apt.queueNumber === 1);
  const nextPatient = queue.find(apt => apt.queueNumber === 2);
  const filteredAppointments = getFilteredAppointments();
  const calendarDays = getCalendarDays();

  if (isLoading) {
    return (
      <div className="doctor-dashboard-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading doctor dashboard...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="doctor-dashboard-container">
        <div className="loading-state">
          <p>Please log in to access the doctor dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="doctor-dashboard-container">
      {/* Notifications */}
      <div className="notifications-container">
        {notifications.map((notification) => (
          <div key={notification.id} className={`notification notification-${notification.type}`}>
            <div className="notification-content">
              <div className="notification-icon">{getNotificationIcon(notification.type)}</div>
              <div className="notification-message">{notification.message}</div>
            </div>
            <button
              className="notification-close"
              onClick={() => removeNotification(notification.id)}
              aria-label="Close notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="doctor-header">
        <div className="header-left">
          <div className="doctor-info">
            <h1 className="doctor-title">Dr. {userProfile.name}</h1>
            <p className="doctor-specialty">{userProfile.specialty || userProfile.department}</p>
          </div>
          <div className="search-container">
            <Search className="search-icon" size={20} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search patients, appointments..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search patients and appointments"
            />
          </div>
        </div>
        <div className="header-right">
          <button
            className="calendar-btn"
            onClick={() => setShowCalendarView(true)}
            title="View calendar"
          >
            <CalendarDays size={20} />
            <span>Calendar</span>
          </button>
          <button
            className="profile-button"
            onClick={() => setShowProfileModal(true)}
            title="View profile"
          >
            <div className="user-profile">
              <div className="user-avatar">
                {userProfile.photo ? (
                  <img src={userProfile.photo} alt={userProfile.name} className="avatar-image" />
                ) : (
                  <User size={16} />
                )}
              </div>
            </div>
          </button>
          <button
            className="logout-button"
            onClick={handleLogout}
            title="Log out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="stats-section">
        <div className="stats-grid">
          <div className="stat-card stat-blue">
            <div className="stat-icon">
              <Calendar size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-title">Today's Patients</h3>
              <div className="stat-value">{stats.today}</div>
              <div className="stat-subtitle">Scheduled appointments</div>
            </div>
          </div>
          <div className="stat-card stat-orange">
            <div className="stat-icon">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-title">In Progress</h3>
              <div className="stat-value">{stats.inProgress}</div>
              <div className="stat-subtitle">Currently consulting</div>
            </div>
          </div>
          <div className="stat-card stat-green">
            <div className="stat-icon">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-title">Upcoming</h3>
              <div className="stat-value">{stats.upcoming}</div>
              <div className="stat-subtitle">Future appointments</div>
            </div>
          </div>
          <div className="stat-card stat-purple">
            <div className="stat-icon">
              <History size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-title">Completed</h3>
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-subtitle">Total consultations</div>
            </div>
          </div>
        </div>
      </section>
{/* Current Queue Status */}
<section className="queue-status-section">
  <div className="section-header">
    <div className="section-title">
      <Activity size={20} />
      Current Queue Status
    </div>
    <div className="section-subtitle">
      Real-time patient queue for today
    </div>
  </div>

  {/* Current + Next Patient Summary */}
  <div className="queue-summary">
    {/* Current Patient */}
    <div className="current-patient-card">
      <div className="patient-status">
        <span className="status-label">Currently Consulting</span>
        {currentPatient ? (
          <div className="patient-info">
            <div
              className="patient-avatar clickable"
              onClick={() => setPreviewPhoto(currentPatient.photo ?? null)}
            >
              {currentPatient.photo ? (
                <img src={currentPatient.photo} alt={currentPatient.name} />
              ) : (
                <User size={24} />
              )}
            </div>
            <div className="patient-details">
              <span className="queue-number">Queue #{currentPatient.queueNumber}</span>
              <span className="patient-name">Name: {currentPatient.name}</span>
              {currentPatient.age && (
                <span className="patient-age">Age: {currentPatient.age}</span>
              )}
              <span className="patient-condition">Condition: {currentPatient.type}</span>
              <span className="patient-date">
                Date:{" "}
                {new Date(currentPatient.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <div className={`booking-indicator booking-${currentPatient.bookedBy}`}>
                {currentPatient.bookedBy === "patient" ? "Patient Booking" : "Staff Booking"}
              </div>
            </div>
          </div>
        ) : (
          <div className="no-patient">
            <span>No patient currently being consulted</span>
          </div>
        )}
      </div>
    </div>

    {/* Next Patient */}
    {nextPatient && (
      <div className="next-patient-card">
        <div className="patient-status">
          <span className="status-label">Next Patient</span>
          <div className="patient-info">
            <div
              className="patient-avatar clickable"
              onClick={() => setPreviewPhoto(nextPatient.photo ?? null)}
            >
              {nextPatient.photo ? (
                <img src={nextPatient.photo} alt={nextPatient.name} />
              ) : (
                <User size={20} />
              )}
            </div>
            <div className="patient-details">
              <span className="queue-number">Queue #{nextPatient.queueNumber}</span>
              <span className="patient-name">Name: {nextPatient.name}</span>
              {nextPatient.age && (
                <span className="patient-age">Age: {nextPatient.age}</span>
              )}
              <span className="patient-condition">Condition: {nextPatient.type}</span>
              <span className="patient-date">
                Date:{" "}
                {new Date(nextPatient.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <div className={`booking-indicator booking-${nextPatient.bookedBy}`}>
                {nextPatient.bookedBy === "patient" ? "Patient Booking" : "Staff Booking"}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>

  {/* Queue List */}
  <div className="queue-list">
    <div className="queue-header">
      <span>Today's Queue ({queue.length} patients)</span>
    </div>

    {queue.length > 0 ? (
      <div className="todays-queue-list">
        {queue.map((patient) => (
          <div
            key={patient.id}
            className={`todays-queue-item ${getPriorityColor(patient.priority)}`}
          >
            {/* Avatar */}
            <div
              className="patient-avatar clickable"
              onClick={() => setPreviewPhoto(patient.photo ?? null)}
            >
              {patient.photo ? (
                <img src={patient.photo} alt={patient.name} />
              ) : (
                <User size={16} />
              )}
            </div>

            {/* Details */}
            <div className="patient-details">
              <span className="queue-number">Queue #{patient.queueNumber}</span>
              <span className="patient-name">Name: {patient.name}</span>
              {patient.age && <span className="patient-age">Age: {patient.age}</span>}
              <span className="patient-condition">Condition: {patient.type}</span>
              <span className="patient-date">
                Date:{" "}
                {new Date(patient.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <div className={`booking-indicator booking-${patient.bookedBy}`}>
                {patient.bookedBy === "patient" ? "Patient Booking" : "Staff Booking"}
              </div>
            </div>

            {/* Bottom-right Actions */}
            <div className="queue-actions-bottom">
              <span className="appointment-time">{patient.time}</span>
              <div className={`priority-status ${getPriorityColor(patient.priority)}`}>
                {getPriorityIcon(patient.priority)}
                <span>{patient.priority}</span>
              </div>
              <div className={`queue-status status-${patient.status}`}>
                {patient.status}
              </div>
              <button
                className="action-btn view-btn"
                onClick={() => {
                  setSelectedAppointment(patient);
                  setShowDetailsModal(true);
                }}
                title="View patient details"
              >
                <Eye size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="empty-queue">
        <p>No patients in queue for today</p>
      </div>
    )}
  </div>

  {/* Enhanced Photo Preview Modal */}
  {previewPhoto && (
    <div className="photo-preview-overlay" onClick={() => setPreviewPhoto(null)}>
      <div className="photo-preview" onClick={(e) => e.stopPropagation()}>
        <button
          className="close-preview"
          onClick={() => setPreviewPhoto(null)}
          aria-label="Close preview"
        >
          <X size={20} />
        </button>
        <img src={previewPhoto} alt="Patient Preview" />
      </div>
    </div>
  )}
</section>

      {/* Appointments Section */}
<section className="appointments-section">
  <div className="section-header">
    <div className="section-title">
      <Users size={20} />
      My Appointments
    </div>
    <div className="view-mode-tabs">
      <button
        className={`tab-btn ${viewMode === 'today' ? 'active' : ''}`}
        onClick={() => setViewMode('today')}
      >
        Today ({stats.today})
      </button>
      <button
        className={`tab-btn ${viewMode === 'upcoming' ? 'active' : ''}`}
        onClick={() => setViewMode('upcoming')}
      >
        Upcoming ({stats.upcoming})
      </button>
      <button
        className={`tab-btn ${viewMode === 'completed' ? 'active' : ''}`}
        onClick={() => setViewMode('completed')}
      >
        Completed ({stats.completed})
      </button>
    </div>
  </div>
  <div className="appointments-list">
    {filteredAppointments.length === 0 ? (
      <div className="empty-state">
        {searchTerm ? (
          <p>No appointments found matching "{searchTerm}"</p>
        ) : (
          <p>No {viewMode} appointments</p>
        )}
      </div>
    ) : (
      filteredAppointments.map((appointment) => (
        <div key={appointment.id} className="appointment-card doctor-view">
          <div className="patient-avatar-section">
            <div className="appointment-avatar">
              {appointment.photo ? (
                <img src={appointment.photo} alt={appointment.name} className="avatar-image" />
              ) : (
                <User size={24} />
              )}
            </div>
            <div className="queue-badge">#{appointment.queueNumber}</div>
          </div>

          <div className="appointment-details">
            <div className="patient-info">
              <div className="appointment-name">
                {appointment.name}
                {appointment.age && <span className="appointment-age"> (Age: {appointment.age})</span>}
              </div>
              <div className="appointment-type">{appointment.type}</div>
              <div className="patient-contact">
                <span>{appointment.email}</span>
                {appointment.phone && <span> • {appointment.phone}</span>}
              </div>
            </div>
          </div>

          <div className="appointment-schedule">
            <div className="appointment-date">{appointment.date}</div>
            <div className="appointment-time">{appointment.time}</div>
            <div className={`booking-source source-${appointment.bookedBy}`}>
              {appointment.bookedBy === 'patient' ? 'Patient Booking' : 'Staff Booking'}
            </div>
          </div>

          <div className="appointment-meta">
            <div className={`appointment-status status-${appointment.status}`}>
              {appointment.status}
            </div>
            <div className={`appointment-priority ${getPriorityColor(appointment.priority)}`}>
              {getPriorityIcon(appointment.priority)}
              {appointment.priority}
            </div>
          </div>

          <div className="appointment-actions">
            <button
              className="action-btn view-btn"
              onClick={() => {
                setSelectedAppointment(appointment);
                setShowDetailsModal(true);
              }}
              title="View patient details"
            >
              <Eye size={16} />
            </button>
          </div>
        </div>
      ))
    )}
  </div>
</section>

      {/* Calendar View Modal */}
      {showCalendarView && (
        <div className="modal-overlay" onClick={() => setShowCalendarView(false)}>
          <div className="calendar-modal doctor-calendar" onClick={e => e.stopPropagation()}>
            <div className="calendar-header">
              <div className="calendar-title-section">
                <h2>My Schedule Calendar</h2>
                <p>View your appointment schedule and availability</p>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowCalendarView(false)}
                aria-label="Close calendar view"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="calendar-navigation">
              <h3 className="month-title">{getMonthName(calendarCurrentDate)}</h3>
              <div className="nav-buttons">
                <button
                  className="nav-btn"
                  onClick={() => navigateMonth('prev')}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  className="nav-btn"
                  onClick={() => navigateMonth('next')}
                  aria-label="Next month"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            <div className="calendar-grid">
              {calendarDays.map((day) => (
                <div key={day.date} className="calendar-day-card doctor-day">
                  <div className="day-header">
                    <div className="day-info">
                      <span className="day-name">{day.dayName}</span>
                      <span className="day-number">{day.dayNumber}</span>
                    </div>
                    <div className="appointments-count">
                      <span className={`count-display ${getAvailabilityColor(day.appointments.booked, day.appointments.total)}`}>
                        {day.appointments.booked}/{day.appointments.total}
                      </span>
                      <span className="count-label">appointments</span>
                    </div>
                  </div>
                  <div className="day-appointments">
                    {day.doctorAppointments.length > 0 ? (
                      day.doctorAppointments.map((apt) => (
                        <div key={apt.id} className="mini-appointment">
                          <div className="mini-time">{apt.time}</div>
                          <div className="mini-patient">
                            <span className="mini-name">{apt.name}</span>
                            {apt.age && <span className="mini-age">({apt.age})</span>}
                          </div>
                          <div className={`mini-priority ${getPriorityColor(apt.priority)}`}>
                            {getPriorityIcon(apt.priority)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-appointments">
                        <span>No appointments</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
{showProfileModal && userProfile && (
  <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
    <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h3>{isEditingProfile ? 'Edit Profile' : 'Doctor Profile'}</h3>
        <button
          className="modal-close"
          onClick={() => {
            if (isEditingProfile) {
              // Reset edit state and photo preview
              setIsEditingProfile(false);
              setEditPhoto(null);
              setPreviewPhoto(userProfile.photo || null);
            } else {
              setShowProfileModal(false);
            }
          }}
          aria-label="Close profile"
        >
          <XCircle size={20} />
        </button>
      </div>

      <div className="profile-content">
        {/* Profile Photo Section */}
        <div className="profile-photo-section">
          <div className="profile-avatar">
            {previewPhoto ? (
              <img src={previewPhoto} alt="Profile Preview" className="profile-image" />
            ) : (
              <User size={48} />
            )}
          </div>

          {isEditingProfile && (
            <div className="photo-upload">
              <input
                type="file"
                accept="image/*"
                id="profile-photo-upload"
                onChange={handlePhotoChange}
                ref={fileInputRef}
                className="hidden-file-input"
                aria-label="Upload profile photo"
              />
              <label htmlFor="profile-photo-upload" className="upload-btn" role="button">
                <Upload size={16} />
                Change Photo
              </label>
            </div>
          )}

          <div className="doctor-credentials">
            <h4>Dr. {userProfile.name}</h4>
            <p>{userProfile.specialty || userProfile.department}</p>
          </div>
        </div>

        {/* View Mode */}
        {!isEditingProfile ? (
          <div className="profile-info-grid">
            <div className="info-item">
              <label>Full Name</label>
              <span>Dr. {userProfile.name}</span>
            </div>
            <div className="info-item">
              <label>Email</label>
              <span>{userProfile.email}</span>
            </div>
            <div className="info-item">
              <label>Phone</label>
              <span>{userProfile.phone || 'Not provided'}</span>
            </div>
            <div className="info-item">
              <label>Specialty</label>
              <span>{userProfile.specialty || userProfile.department}</span>
            </div>
            <div className="info-item">
              <label>Role</label>
              <span>{userProfile.role}</span>
            </div>
            {currentDoctor && (
              <>
                <div className="info-item">
                  <label>Working Hours</label>
                  <span>{currentDoctor.workingHours.start} - {currentDoctor.workingHours.end}</span>
                </div>
                <div className="info-item">
                  <label>Max Appointments/Day</label>
                  <span>{currentDoctor.maxAppointments}</span>
                </div>
                <div className="info-item">
                  <label>Buffer Time</label>
                  <span>{currentDoctor.bufferTime} minutes</span>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Edit Mode */
          <div className="profile-edit-form">
            <div className="form-group">
              <label htmlFor="edit-name">Full Name</label>
              <input
                id="edit-name"
                type="text"
                value={userProfile.name}
                onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                placeholder="Enter full name"
                aria-required="true"
              />
            </div>
            <div className="form-group">
              <label htmlFor="edit-phone">Phone</label>
              <input
                id="edit-phone"
                type="tel"
                value={userProfile.phone}
                onChange={(e) => setUserProfile({ ...userProfile, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
            <div className="form-group">
              <label htmlFor="edit-specialty">Specialty</label>
              <input
                id="edit-specialty"
                type="text"
                value={userProfile.specialty || ''}
                onChange={(e) => setUserProfile({ ...userProfile, specialty: e.target.value })}
                placeholder="Enter specialty"
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  setIsEditingProfile(false);
                  setEditPhoto(null);
                  setPreviewPhoto(userProfile.photo || null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-save"
                onClick={handleSaveProfile}
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Edit Profile Button (only shown when not editing) */}
        {!isEditingProfile && (
          <div className="edit-profile-footer">
            <button
              className="edit-profile-btn"
              onClick={() => setIsEditingProfile(true)}
              type="button"
            >
              Edit Profile
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
)}

      {/* Appointment Details Modal */}
      {showDetailsModal && selectedAppointment && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content details-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Patient Details</h3>
              <button
                className="modal-close"
                onClick={() => setShowDetailsModal(false)}
                aria-label="Close patient details"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="details-content">
              {selectedAppointment.photo && (
                <div className="detail-photo">
                  <img src={selectedAppointment.photo} alt={selectedAppointment.name} />
                </div>
              )}
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Patient Name</label>
                  <span>{selectedAppointment.name}</span>
                </div>
                <div className="detail-item">
                  <label>Age</label>
                  <span>{selectedAppointment.age || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <label>Gender</label>
                  <span>{selectedAppointment.gender || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <label>Medical Condition</label>
                  <span>{selectedAppointment.type}</span>
                </div>
                <div className="detail-item">
                  <label>Appointment Date</label>
                  <span>{selectedAppointment.date}</span>
                </div>
                <div className="detail-item">
                  <label>Appointment Time</label>
                  <span>{selectedAppointment.time}</span>
                </div>
                <div className="detail-item">
                  <label>Priority Level</label>
                  <span className={`priority-badge ${getPriorityColor(selectedAppointment.priority)}`}>
                    {getPriorityIcon(selectedAppointment.priority)}
                    {selectedAppointment.priority.toUpperCase()}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Status</label>
                  <span className={`status-badge status-${selectedAppointment.status}`}>
                    {selectedAppointment.status.toUpperCase()}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Queue Number</label>
                  <span className="queue-badge">#{selectedAppointment.queueNumber}</span>
                </div>
                <div className="detail-item">
                  <label>Email</label>
                  <span>{selectedAppointment.email}</span>
                </div>
                <div className="detail-item">
                  <label>Phone</label>
                  <span>{selectedAppointment.phone}</span>
                </div>
                <div className="detail-item">
                  <label>Booked By</label>
                  <span className={`booking-badge ${selectedAppointment.bookedBy}`}>
                    {selectedAppointment.bookedBy === 'patient' ? 'Patient Booking' : 'Staff Booking'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;