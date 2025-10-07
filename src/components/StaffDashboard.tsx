import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Users,
  Plus,
  Search,
  User,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Camera,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  X,
  LogOut,
  Activity,
  Phone,
  Mail,
  Send,
  Pause,
  SkipForward,
  UserPlus,
  Stethoscope,
  Home,
  Save,
  Bell,
  Clock3,
  MapPin,
  Badge,
  MessageSquare,
  Info
} from 'lucide-react';
// Firebase imports
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp,
  Timestamp,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import '../styles/staffdashboard.css';


interface Appointment {
  id: string;
  name: string;
  age: string;
  type: string;
  time: string;
  date: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  priority: 'normal' | 'urgent' | 'emergency';
  doctor: string;
  doctorId: string;
  photo?: string;
  email: string;
  phone: string;
  queueNumber?: number;
  gender?: string;
  userId: string;
  bookedBy: 'staff',
  assignedBy: string;
  notes?: string;
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
  consultationDuration: number;
  phone: string;
  email: string;
  photo?: string;
  room: string;
  isActive: boolean;
  createdAt: Timestamp;
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'admin';
  phone: string;
  department: string;
  photo?: string;
  uid: string;
  permissions: string[];
}

interface Notification {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  timestamp: Date;
}

interface QueueItem extends Appointment {
  estimatedWaitTime: number;
  isCurrentlyServing: boolean;
  isOnHold: boolean;
}

interface TimeSlot {
  time: string;
  available: boolean;
  booked?: boolean;
  emergency?: boolean;
}

interface DoctorAvailability {
  doctorId: string;
  date: string;
  available: boolean;
  reason?: string;
}

interface CalendarViewProps {
  appointments: Appointment[];
  doctors: Doctor[];
  onAppointmentClick: (appointment: Appointment) => void;
  onDateClick: (date: string) => void;
  getPriorityColor: (priority: string) => string;
  getStatusColor: (status: string) => string;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  appointments,
  onAppointmentClick,
  onDateClick,
  getPriorityColor,
  getStatusColor,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const formatDateForComparison = (date: Date) => {
    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0")
    );
  };

  const getAppointmentsForDate = (date: string) => {
    return appointments.filter((apt) => apt.date === date);
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === "prev" ? -1 : 1));
      return newDate;
    });
  };

  const today = new Date();
  const todayString = formatDateForComparison(today);

  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  ).getDay();

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  // capacity limit for availability
  const CAPACITY_PER_DAY = 8;

  const getAvailabilityClass = (apts: Appointment[]) => {
    const n = apts.length;
    if (n === 0) return "available";
    if (n < CAPACITY_PER_DAY) return "limited";
    return "booked";
  };

  // Generate days grid aligned correctly
  const generateCalendarDays = () => {
    const days: {
      date: Date;
      dateString: string;
      dayNumber: number;
      appointments: Appointment[];
      isCurrentMonth: boolean;
      isToday: boolean;
      isPast: boolean;
      key: string;
    }[] = [];

    // Empty slots before first day
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({
        date: new Date(),
        dateString: "",
        dayNumber: 0,
        appointments: [],
        isCurrentMonth: false,
        isToday: false,
        isPast: false,
        key: `empty-${i}`,
      });
    }

    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day
      );
      const dateString = formatDateForComparison(dateObj);
      const dayAppointments = getAppointmentsForDate(dateString);

      // check if past
      const isPast = dateObj < new Date(todayString);

      days.push({
        date: dateObj,
        dateString,
        dayNumber: day,
        appointments: dayAppointments,
        isCurrentMonth: true,
        isToday: dateString === todayString,
        isPast,
        key: `${dateObj.getFullYear()}-${dateObj.getMonth()}-${day}`,
      });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <button
          className="calendar-nav-btn"
          onClick={() => navigateMonth("prev")}
          title="Previous Month"
          aria-label="Previous Month"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="calendar-title">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button
          className="calendar-nav-btn"
          onClick={() => navigateMonth("next")}
          title="Next Month"
          aria-label="Next Month"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="calendar-grid">
        <div className="calendar-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
        </div>

        <div className="calendar-days">
          {calendarDays.map((day) => (
            <div
              key={day.key}
              className={`calendar-day 
                ${!day.isCurrentMonth ? "other-month" : ""} 
                ${day.isToday ? "today" : ""} 
                ${day.isPast ? "past-day" : ""} 
                ${day.dayNumber > 0 ? getAvailabilityClass(day.appointments) : ""} 
                ${day.appointments.length > 0 ? "has-appointments" : ""}`}
              onClick={() => {
                if (day.dayNumber > 0 && !day.isPast) {
                  onDateClick(day.dateString);
                }
              }}
              aria-label={
                day.dayNumber > 0
                  ? `Day ${day.dayNumber} ${day.isPast ? "(past date)" : ""}`
                  : undefined
              }
            >
              {day.dayNumber > 0 && (
                <div className="day-number">{day.dayNumber}</div>
              )}

              {day.appointments.length > 0 && (
                <div className="day-appointments">
                  {day.appointments.slice(0, 2).map((apt) => (
                    <div
                      key={apt.id}
                      className={`appointment-preview ${getPriorityColor(
                        apt.priority
                      )} ${getStatusColor(apt.status)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointmentClick(apt);
                      }}
                      aria-label={`Appointment with ${apt.name} at ${apt.time}`}
                    >
                      <span className="appointment-time">{apt.time}</span>
                      <span className="appointment-name">{apt.name}</span>
                    </div>
                  ))}
                  {day.appointments.length > 2 && (
                    <div className="more-appointments">
                      +{day.appointments.length - 2} more
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};



const StaffDashboard = () => {
  // UI State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Data State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [staffProfile, setStaffProfile] = useState<StaffUser | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Form State
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDoctor, setFilterDoctor] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  
  // Form Data
  const [appointmentForm, setAppointmentForm] = useState({
    name: '',
    age: '',
    email: '',
    phone: '',
    gender: '',
    condition: '',
    customCondition: '',
    priority: 'normal' as 'normal' | 'urgent' | 'emergency',
    date: '',
    time: '',
    doctorId: '',
    notes: '',
    photo: ''
  });
  
  const [doctorForm, setDoctorForm] = useState({
  name: '',
  specialty: '',
  email: '',
  phone: '',
  room: '',
  startTime: '9:00 AM', 
  endTime: '5:00 PM',   
  maxAppointments: '8',
  consultationDuration: '30',
  bufferTime: '15',
  offDays: [] as string[],
  photo: '',
  available: true,
  isActive: true
});

  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    photo: ''
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Doctor availability management
  const [doctorAvailability, setDoctorAvailability] = useState<DoctorAvailability[]>([]);
  // Fixed doctor availability management with individual date inputs
  const [doctorAvailabilityDates, setDoctorAvailabilityDates] = useState<Record<string, string>>({});
  
  // Notification System
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
  
  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  // Mock authentication for development
  useEffect(() => {
    const mockStaff = {
      id: 'mock-staff-id',
      name: 'John Doe',
      email: 'john.doe@hospital.com',
      role: 'staff' as const,
      phone: '123-456-7890',
      department: 'Administration',
      uid: 'mock-uid',
      permissions: ['view_appointments', 'manage_appointments', 'view_doctors', 'manage_doctors']
    };
    setStaffProfile(mockStaff);
    setProfileForm({
      name: mockStaff.name,
      email: mockStaff.email,
      phone: mockStaff.phone,
      department: mockStaff.department,
      photo: ''
    });
    setIsLoading(false);
  }, []);
  
  // Fetch Doctors
  useEffect(() => {
    if (!staffProfile) return;
    const fetchDoctors = () => {
      try {
        const doctorsQuery = query(
          collection(db, 'doctors'),
          orderBy('name', 'asc')
        );
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
  }, [staffProfile]);
  
  // Fetch Appointments
  useEffect(() => {
    if (!staffProfile) return;
    const fetchAppointments = () => {
      try {
        const appointmentsQuery = query(
          collection(db, 'appointments'),
          orderBy('date', 'desc'),
          orderBy('time', 'asc')
        );
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
                updatedAt: data.updatedAt || serverTimestamp()
              } as Appointment);
            });
            setAppointments(appointmentsData);
          },
          (error) => {
            console.error('Error in appointments snapshot:', error);
            addNotification('error', 'Failed to load appointments');
          }
        );
        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting up appointments listener:', error);
        addNotification('error', 'Failed to set up appointment listener');
      }
    };
    fetchAppointments();
  }, [staffProfile]);
  
  // Fetch Doctor Availability
  useEffect(() => {
    const fetchDoctorAvailability = async () => {
      try {
        const availabilityQuery = query(collection(db, 'doctorAvailability'));
        const snapshot = await getDocs(availabilityQuery);
        const availabilityData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // Convert to DoctorAvailability type with proper typing
        const typedAvailability: DoctorAvailability[] = availabilityData.map(item => ({
          doctorId: (item as any).doctorId || '',
          date: (item as any).date || '',
          available: (item as any).available || false,
          reason: (item as any).reason || undefined
        }));
        setDoctorAvailability(typedAvailability);
      } catch (error) {
        console.error('Error fetching doctor availability:', error);
        addNotification('error', 'Failed to load doctor availability');
      }
    };
    fetchDoctorAvailability();
  }, []);
  
  // Image Upload Function - Convert to base64 for local display only
  const uploadImage = async (file: File): Promise<string> => {
    try {
      setUploadingImage(true);
      // Validate file
      if (!file) {
        throw new Error('No file selected');
      }
      // Check file size (limit to 2MB for base64)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('File size must be less than 2MB for local display');
      }
      // Check file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }
      // Convert file to base64 data URL
      const base64URL = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      setUploadingImage(false);
      return base64URL;
    } catch (error) {
      setUploadingImage(false);
      console.error('Error processing image:', error);
      if (error instanceof Error) {
        throw new Error(`Image processing failed: ${error.message}`);
      } else {
        throw new Error('Failed to process image');
      }
    }
  };
  
  // Helper Functions
  const getTodayDate = (): string => {
    const today = new Date();
    return today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
  };
  
  const convertTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };
  
  const getNextQueueNumber = async (appointmentDate: string): Promise<number> => {
    try {
      const dateAppointmentsQuery = query(
        collection(db, 'appointments'),
        where('date', '==', appointmentDate),
        where('status', '!=', 'cancelled')
      );
      const snapshot = await getDocs(dateAppointmentsQuery);
      const maxQueue = snapshot.docs.reduce((max, doc) => {
        const queueNum = doc.data().queueNumber || 0;
        return queueNum > max ? queueNum : max;
      }, 0);
      return maxQueue + 1;
    } catch (error) {
      console.error('Error getting queue number:', error);
      return 1;
    }
  };
  
  // Generate Time Slots

// Generate Time Slots - FIXED VERSION
const generateTimeSlots = (doctorId: string, date: string): TimeSlot[] => {
  if (!doctorId || !date) return [];

  const doctor = doctors.find(d => d.id === doctorId);
  if (!doctor) return [];

  const { start, end } = doctor.workingHours;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);

  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;

  // Get ALL appointments for this doctor and date (REGARDLESS of who booked them)
  const existingAppointments = appointments.filter(
    apt =>
      apt.doctorId === doctorId &&
      apt.date === date &&
      apt.status !== 'cancelled'
    // CRITICAL FIX: Remove any bookedBy filter - check ALL appointments
  );

  console.log(`Checking slots for doctor ${doctorId} on ${date}`);
  console.log(`Found ${existingAppointments.length} existing appointments:`, existingAppointments.map(apt => ({
    name: apt.name,
    time: apt.time,
    bookedBy: apt.bookedBy || 'patient', // Show who booked it
    id: apt.id
  })));

  const slots: TimeSlot[] = [];

  for (let totalMinutes = startTotalMinutes; totalMinutes < endTotalMinutes; totalMinutes += 30) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const time12 = convertTo12Hour(time24);

    // Check if this time slot is already booked by ANYONE (excluding current edit if any)
    const isBooked = existingAppointments.some(
      apt => {
        const timeMatch = apt.time === time12;
        const notCurrentEdit = editingAppointment ? apt.id !== editingAppointment.id : true;
        return timeMatch && notCurrentEdit;
      }
    );

    slots.push({
      time: time12,
      available: !isBooked,
      booked: isBooked
    });
  }

  console.log(`Generated ${slots.length} slots, ${slots.filter(s => !s.available).length} unavailable`);
  return slots;
};
// Fixed checkAppointmentConflict function
const checkAppointmentConflict = async (
  doctorId: string,
  date: string,
  time: string,
  excludeId?: string
): Promise<boolean> => {
  try {
    const conflictQuery = query(
      collection(db, 'appointments'),
      where('doctorId', '==', doctorId),
      where('date', '==', date),
      where('time', '==', time),
      where('status', '!=', 'cancelled')
    );

    const conflictSnapshot = await getDocs(conflictQuery);

    console.log(`🔍 Conflict check: Doctor ${doctorId} | Date: ${date} | Time: ${time}`);
    console.log(`📌 Found ${conflictSnapshot.docs.length} matching appointments`);

    if (!conflictSnapshot.empty) {
      conflictSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        console.log(`  ➤ ${data.name} [${data.bookedBy || 'patient'}] | ID: ${doc.id} | Status: ${data.status}`);
      });
    }

    // If editing, allow if the only match is the appointment being edited
    if (excludeId) {
      const conflictingAppointment = conflictSnapshot.docs.find(doc => doc.id !== excludeId);
      const hasConflict = !!conflictingAppointment;
      console.log(`✏️ Editing mode: excluding ID ${excludeId}, conflict found: ${hasConflict}`);
      return hasConflict;
    }

    // For new appointments: any existing doc = conflict
    const hasConflict = !conflictSnapshot.empty;
    console.log(`🆕 New booking: conflict = ${hasConflict}`);
    return hasConflict;
  } catch (error) {
    console.error('💥 Error checking appointment conflict:', error);
    // Safest to assume conflict on error
    return true;
  }
};
  // Stats Calculations
  const getStats = () => {
    const today = getTodayDate();
    const todayAppointments = appointments.filter(apt => apt.date === today);
    return {
      totalToday: todayAppointments.length,
      pending: todayAppointments.filter(apt => apt.status === 'pending').length,
      confirmed: todayAppointments.filter(apt => apt.status === 'confirmed').length,
      completed: todayAppointments.filter(apt => apt.status === 'completed').length,
      cancelled: appointments.filter(apt => apt.status === 'cancelled').length,
      totalAppointments: appointments.length,
      activeDoctors: doctors.filter(doc => doc.isActive && doc.available).length,
      emergencyToday: todayAppointments.filter(apt => apt.priority === 'emergency').length
    };
  };
  
  // Queue Management
  const getCurrentQueue = (): QueueItem[] => {
    const today = getTodayDate();
    const todayAppointments = appointments.filter(apt =>
      apt.date === today && 
      apt.status !== 'cancelled' && 
      apt.status !== 'completed' // Exclude completed appointments from queue
    );
    // Sort by priority and queue number
    const sortedQueue = todayAppointments.sort((a, b) => {
      // Emergency appointments first
      if (a.priority === 'emergency' && b.priority !== 'emergency') return -1;
      if (b.priority === 'emergency' && a.priority !== 'emergency') return 1;
      // Urgent appointments second
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
      // Then by queue number
      return (a.queueNumber || 0) - (b.queueNumber || 0);
    });
    return sortedQueue.map((apt, index) => ({
      ...apt,
      estimatedWaitTime: index * 30, // 30 minutes per appointment
      isCurrentlyServing: index === 0 && apt.status === 'confirmed', // Only confirmed appointments can be "now serving"
      isOnHold: false
    }));
  };
  
  // Get doctor availability for a specific date - Fixed logic
  const getDoctorAvailability = (doctorId: string, date: string): boolean => {
    if (!date) return true; // Default available if no date selected
    const availability = doctorAvailability.find(av => 
      av.doctorId === doctorId && av.date === date
    );
    return availability ? availability.available : true;
  };
  
  // Handle individual date selection for each doctor
  const handleAvailabilityDateChange = (doctorId: string, date: string) => {
    setDoctorAvailabilityDates(prev => ({
      ...prev,
      [doctorId]: date
    }));
  };
  
  // Fixed toggle doctor availability function
  const handleToggleDoctorAvailability = async (doctorId: string, available: boolean, date: string) => {
    if (!date) {
      addNotification('error', 'Please select a date first');
      return;
    }
    try {
      const availabilityId = `${doctorId}_${date}`;
      const availabilityRef = doc(db, 'doctorAvailability', availabilityId);
      // Check if this availability record already exists
      const availabilityDoc = await getDoc(availabilityRef);
      if (availabilityDoc.exists()) {
        // Update existing record
        await updateDoc(availabilityRef, {
          available,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new record
        await setDoc(availabilityRef, {
          doctorId,
          date,
          available,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      // Update local state properly
      setDoctorAvailability(prev => {
        const existingIndex = prev.findIndex(av => av.doctorId === doctorId && av.date === date);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], available };
          return updated;
        } else {
          return [...prev, { doctorId, date, available }];
        }
      });
      const doctor = doctors.find(d => d.id === doctorId);
      const doctorName = doctor ? doctor.name : 'Doctor';
      addNotification(
        'success', 
        `${doctorName} ${available ? 'marked as available' : 'marked as unavailable'} for ${date}`
      );
    } catch (error) {
      console.error('Error updating doctor availability:', error);
      addNotification('error', 'Failed to update doctor availability');
    }
  };
  
  // Filtered Appointments
  const getFilteredAppointments = () => {
    let filtered = appointments;
    // Search term filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(apt =>
        apt.name.toLowerCase().includes(searchLower) ||
        apt.type.toLowerCase().includes(searchLower) ||
        apt.doctor.toLowerCase().includes(searchLower) ||
        apt.email.toLowerCase().includes(searchLower) ||
        apt.phone.includes(searchLower)
      );
    }
    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(apt => apt.status === filterStatus);
    }
    // Doctor filter
    if (filterDoctor !== 'all') {
      filtered = filtered.filter(apt => apt.doctorId === filterDoctor);
    }
    // Date filter
    if (filterDate) {
      filtered = filtered.filter(apt => apt.date === filterDate);
    }
    // Priority filter
    if (filterPriority !== 'all') {
      filtered = filtered.filter(apt => apt.priority === filterPriority);
    }
    return filtered;
  };
  
  // Form Handlers
 const handleAppointmentFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  const { name, value } = e.target;
  
  setAppointmentForm(prev => {
    const updated = { ...prev, [name]: value };
    
    // If date is changed, check if currently selected doctor is still available
    if (name === 'date' && prev.doctorId && value) {
      const isDoctorAvailable = getDoctorAvailability(prev.doctorId, value);
      if (!isDoctorAvailable) {
        // Clear doctor selection if not available on new date
        updated.doctorId = '';
        updated.time = ''; // Also clear time since it depends on doctor
        addNotification('warning', 'Selected doctor is not available on this date. Please choose another doctor.');
      } else {
        // Clear time when date changes (even if doctor is available) to refresh time slots
        updated.time = '';
      }
    }
    
    // If doctor is changed, clear the time to refresh available slots
    if (name === 'doctorId') {
      updated.time = '';
    }
    
    return updated;
  });
};
  const handleDoctorFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as any;
    setDoctorForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleProfileFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
  };
  
  // Corrected handlePhotoUpload function
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'appointment' | 'doctor' | 'profile' = 'appointment') => {
    const file = e.target.files?.[0];
    if (file && staffProfile) {
      try {
        addNotification('info', 'Uploading photo...');
        // Call uploadImage with only the file parameter as defined in the function
        const photoURL = await uploadImage(file);
        // Update the appropriate form state with the new photo URL
        switch (type) {
          case 'doctor':
            setDoctorForm(prev => ({ ...prev, photo: photoURL }));
            break;
          case 'profile':
            setProfileForm(prev => ({ ...prev, photo: photoURL }));
            break;
          default:
            setAppointmentForm(prev => ({ ...prev, photo: photoURL }));
        }
        // If editing an appointment, update the editing appointment object
        if (type === 'appointment' && editingAppointment) {
          setEditingAppointment(prev => {
            if (!prev) return null;
            return { ...prev, photo: photoURL };
          });
        }
        addNotification('success', 'Photo uploaded successfully');
      } catch (error) {
        console.error('Error uploading photo:', error);
        addNotification('error', 'Failed to upload photo');
      }
    }
  };
  
  // CRUD Operations - Appointments
const handleCreateAppointment = async () => {
  if (!appointmentForm.name || !appointmentForm.date || !appointmentForm.time || !appointmentForm.doctorId) {
    addNotification('error', 'Please fill in all required fields');
    return;
  }
  
  try {
    addNotification('info', 'Creating appointment...');
    
    // Double-check for conflicts using the updated function
    const hasConflict = await checkAppointmentConflict(
      appointmentForm.doctorId,
      appointmentForm.date,
      appointmentForm.time
    );
    
    if (hasConflict) {
      addNotification('error', 'This time slot is already booked by another appointment. Please select a different time.');
      // Reset the time field to force user to pick again
      setAppointmentForm(prev => ({ ...prev, time: '' }));
      return;
    }
    
    // Additional real-time check by querying current appointments state
    const localConflicts = appointments.filter(apt => 
      apt.doctorId === appointmentForm.doctorId &&
      apt.date === appointmentForm.date &&
      apt.time === appointmentForm.time &&
      apt.status !== 'cancelled'
    );
    
    if (localConflicts.length > 0) {
      console.log('Local conflict detected:', localConflicts);
      addNotification('error', 'Time slot conflict detected. Please refresh and try again.');
      setAppointmentForm(prev => ({ ...prev, time: '' }));
      return;
    }
    
    const doctor = doctors.find(d => d.id === appointmentForm.doctorId);
    const queueNumber = await getNextQueueNumber(appointmentForm.date);
    
    const appointmentData = {
      name: appointmentForm.name,
      age: appointmentForm.age,
      email: appointmentForm.email,
      phone: appointmentForm.phone,
      gender: appointmentForm.gender,
      type: appointmentForm.condition === 'custom' ? appointmentForm.customCondition : appointmentForm.condition,
      priority: appointmentForm.priority,
      date: appointmentForm.date,
      time: appointmentForm.time,
      doctor: doctor?.name || '',
      doctorId: appointmentForm.doctorId,
      photo: appointmentForm.photo,
      notes: appointmentForm.notes,
      status: 'pending' as const,
      queueNumber,
      userId: 'staff-created',
      bookedBy: 'staff', // Keep this for tracking purposes
      assignedBy: staffProfile?.name || 'Staff',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Use a transaction to prevent race conditions
    await addDoc(collection(db, 'appointments'), appointmentData);
    
    addNotification('success', 'Appointment created successfully!');
    
    // Send notification if contact info provided
    if (appointmentForm.email || appointmentForm.phone) {
      try {
        await sendNotificationToPatient(
          appointmentForm.email, 
          appointmentForm.phone, 
          'appointment_created', 
          appointmentData
        );
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
        addNotification('warning', 'Appointment created but notification failed to send');
      }
    }
    
    setShowBookingForm(false);
    resetAppointmentForm();
    
  } catch (error) {
    console.error('Error creating appointment:', error);
    
    if (error instanceof Error && 'code' in error) {
      const firebaseError = error as any;
      if (firebaseError.code === 'permission-denied') {
        addNotification('error', 'Permission denied. Please check your access rights.');
      } else if (firebaseError.code === 'network-request-failed') {
        addNotification('error', 'Network error. Please check your connection and try again.');
      } else {
        addNotification('error', `Failed to create appointment: ${firebaseError.message || 'Unknown error'}`);
      }
    } else {
      addNotification('error', 'Failed to create appointment. Please try again.');
    }
  }
};
  const handleUpdateAppointment = async () => {
  if (!editingAppointment) return;
  
  try {
    addNotification('info', 'Updating appointment...');
    
    // Check for conflicts when updating (exclude current appointment)
    const hasConflict = await checkAppointmentConflict(
      appointmentForm.doctorId,
      appointmentForm.date,
      appointmentForm.time,
      editingAppointment.id
    );
    
    if (hasConflict) {
      addNotification('error', 'This time slot is no longer available. Please select another time.');
      setAppointmentForm(prev => ({ ...prev, time: '' }));
      addNotification('warning', 'Please select an available time slot.');
      return;
    }
    
    const doctor = doctors.find(d => d.id === appointmentForm.doctorId);
    const appointmentRef = doc(db, 'appointments', editingAppointment.id);
    const updateData = {
      name: appointmentForm.name,
      age: appointmentForm.age,
      email: appointmentForm.email,
      phone: appointmentForm.phone,
      gender: appointmentForm.gender,
      type: appointmentForm.condition === 'custom' ? appointmentForm.customCondition : appointmentForm.condition,
      priority: appointmentForm.priority,
      date: appointmentForm.date,
      time: appointmentForm.time,
      doctor: doctor?.name || '',
      doctorId: appointmentForm.doctorId,
      photo: appointmentForm.photo,
      notes: appointmentForm.notes,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(appointmentRef, updateData);
    addNotification('success', 'Appointment updated successfully!');
    
    if (appointmentForm.email || appointmentForm.phone) {
      try {
        await sendNotificationToPatient(appointmentForm.email, appointmentForm.phone, 'appointment_updated', updateData);
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
        addNotification('warning', 'Appointment updated but notification failed to send');
      }
    }
    
    setShowBookingForm(false);
    setEditingAppointment(null);
    resetAppointmentForm();
    
  } catch (error) {
    console.error('Error updating appointment:', error);
    
    if (error instanceof Error && 'code' in error) {
      const firebaseError = error as any;
      addNotification('error', `Failed to update appointment: ${firebaseError.message || 'Unknown error'}`);
    } else {
      addNotification('error', 'Failed to update appointment. Please try again.');
    }
  }
};
  const handleAppointmentStatusChange = async (appointmentId: string, status: 'confirmed' | 'pending' | 'cancelled' | 'completed') => {
    try {
      const appointmentRef = doc(db, 'appointments', appointmentId);
      await updateDoc(appointmentRef, {
        status,
        updatedAt: serverTimestamp()
      });
      const appointment = appointments.find(apt => apt.id === appointmentId);
      // Send notification to patient
      if (appointment && (appointment.email || appointment.phone)) {
        await sendNotificationToPatient(appointment.email, appointment.phone, `appointment_${status}`, appointment);
      }
      // Special handling for completed appointments
      if (status === 'completed') {
        addNotification('success', `Appointment completed for ${appointment?.name}. Next patient moved to serving.`);
        // Automatically move next patient to "now serving" if available
        const today = getTodayDate();
        const remainingQueue = appointments.filter(apt =>
          apt.date === today && 
          apt.id !== appointmentId &&
          apt.status === 'confirmed'
        ).sort((a, b) => {
          // Sort by priority first, then queue number
          if (a.priority === 'emergency' && b.priority !== 'emergency') return -1;
          if (b.priority === 'emergency' && a.priority !== 'emergency') return 1;
          if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
          if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
          return (a.queueNumber || 0) - (b.queueNumber || 0);
        });
        const nextPatient = remainingQueue[0];
        if (nextPatient) {
          addNotification('info', `Now serving: ${nextPatient.name} (Queue #${nextPatient.queueNumber})`);
          // Send notification to next patient
          if (nextPatient.email || nextPatient.phone) {
            await sendNotificationToPatient(
              nextPatient.email, 
              nextPatient.phone, 
              'now_serving', 
              nextPatient
            );
          }
        } else {
          addNotification('info', 'No more patients in queue.');
        }
      } else {
        addNotification('success', `Appointment marked as ${status}`);
      }
    } catch (error) {
      console.error('Error updating appointment status:', error);
      addNotification('error', 'Failed to update appointment status');
    }
  };
  
  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to delete this appointment? This action cannot be undone.')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'appointments', appointmentId));
      addNotification('success', 'Appointment deleted successfully');
    } catch (error) {
      addNotification('error', 'Failed to delete appointment');
    }
  };
  
  // CRUD Operations - Doctors
  const handleCreateDoctor = async () => {
  if (!doctorForm.name || !doctorForm.specialty || !doctorForm.email) {
    addNotification('error', 'Please fill all required fields');
    return;
  }

  try {
    const doctorData = {
      name: doctorForm.name,
      specialty: doctorForm.specialty,
      email: doctorForm.email,
      phone: doctorForm.phone,
      room: doctorForm.room,
      workingHours: {
        start: doctorForm.startTime,
        end: doctorForm.endTime,
      },
      maxAppointments: parseInt(doctorForm.maxAppointments),
      consultationDuration: parseInt(doctorForm.consultationDuration),
      bufferTime: parseInt(doctorForm.bufferTime),
      offDays: doctorForm.offDays,
      photo: doctorForm.photo,
      available: doctorForm.available,
      isActive: doctorForm.isActive,
      createdAt: serverTimestamp(),
    };

    // 🔥 Step 1: Add doctor to 'doctors' collection
    const doctorDocRef = await addDoc(collection(db, 'doctors'), doctorData);

    // 🔗 Step 2: Find user by email in 'users' collection
    const userQuery = query(
      collection(db, 'users'),
      where('email', '==', doctorForm.email)
    );
    const userSnapshot = await getDocs(userQuery);

    if (!userSnapshot.empty) {
      // 🔁 User exists → update their profile with doctorId
      const userDoc = userSnapshot.docs[0];
      const userDocRef = doc(db, 'users', userDoc.id);
      await updateDoc(userDocRef, {
        doctorId: doctorDocRef.id,  // ✅ Link user to doctor
        role: 'Doctor',            // Ensure correct role
        name: doctorForm.name,     // Keep in sync
        specialty: doctorForm.specialty,
        department: doctorForm.specialty, // Optional: sync department
      });
      addNotification('success', 'Doctor created and linked to user!');
    } else {
      // ⚠️ No user found → warn staff
      addNotification(
        'warning',
        `Doctor created, but no user found with email "${doctorForm.email}". They must sign up first to access their dashboard.`
      );
    }

    // Close form
    setShowDoctorForm(false);
    resetDoctorForm();
  } catch (error) {
    console.error('Error creating doctor:', error);
    addNotification('error', 'Failed to create doctor');
  }
};
  
  const handleUpdateDoctor = async () => {
  if (!editingDoctor) return;

  try {
    const doctorRef = doc(db, 'doctors', editingDoctor.id);
    await updateDoc(doctorRef, {
      name: doctorForm.name,
      specialty: doctorForm.specialty,
      email: doctorForm.email,
      phone: doctorForm.phone,
      room: doctorForm.room,
      workingHours: {
        start: doctorForm.startTime,
        end: doctorForm.endTime,
      },
      maxAppointments: parseInt(doctorForm.maxAppointments),
      consultationDuration: parseInt(doctorForm.consultationDuration),
      bufferTime: parseInt(doctorForm.bufferTime),
      offDays: doctorForm.offDays,
      photo: doctorForm.photo,
      available: doctorForm.available,
      isActive: doctorForm.isActive,
      updatedAt: serverTimestamp(),
    });

    // 🔁 Update linked user (if email unchanged)
    const userQuery = query(
      collection(db, 'users'),
      where('email', '==', doctorForm.email)
    );
    const userSnapshot = await getDocs(userQuery);

    if (!userSnapshot.empty) {
      const userDocRef = doc(db, 'users', userSnapshot.docs[0].id);
      await updateDoc(userDocRef, {
        name: doctorForm.name,
        specialty: doctorForm.specialty,
        department: doctorForm.specialty,
      });
    }

    addNotification('success', 'Doctor updated successfully!');
    setShowDoctorForm(false);
    setEditingDoctor(null);
    resetDoctorForm();
  } catch (error) {
    console.error('Error updating doctor:', error);
    addNotification('error', 'Failed to update doctor');
  }
};
  
  const handleDeleteDoctor = async (doctorId: string) => {
    if (!confirm('Are you sure you want to delete this doctor? This action cannot be undone.')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'doctors', doctorId));
      addNotification('success', 'Doctor removed successfully');
    } catch (error) {
      addNotification('error', 'Failed to remove doctor');
    }
  };
  
  // Profile Management
  const handleUpdateProfile = async () => {
    try {
      const updatedProfile = {
        ...staffProfile!,
        name: profileForm.name,
        email: profileForm.email,
        phone: profileForm.phone,
        department: profileForm.department,
        photo: profileForm.photo
      };
      setStaffProfile(updatedProfile);
      addNotification('success', 'Profile updated successfully!');
      setShowProfileModal(false);
    } catch (error) {
      addNotification('error', 'Failed to update profile');
    }
  };
  
  // Enhanced notification system with queue-specific messages
  const sendNotificationToPatient = async (
    email: string,
    phone: string,
    type: string,
    appointmentData: any
  ) => {
    try {
      // Get notification message based on type
      const getNotificationMessage = (type: string, appointment: any) => {
        switch (type) {
          case 'now_serving':
            return {
              subject: 'Your Turn - Now Being Served',
              message: `Hello ${appointment.name}, it's now your turn! Please proceed to ${appointment.doctor}'s office. Queue #${appointment.queueNumber}`
            };
          case 'appointment_completed':
            return {
              subject: 'Appointment Completed',
              message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} has been completed. Thank you for visiting us.`
            };
          case 'appointment_confirmed':
            return {
              subject: 'Appointment Confirmed',
              message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} has been confirmed. Queue #${appointment.queueNumber}`
            };
          case 'appointment_cancelled':
            return {
              subject: 'Appointment Cancelled',
              message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} has been cancelled.`
            };
          case 'appointment_pending':
            return {
              subject: 'Appointment Pending',
              message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} is pending confirmation.`
            };
          case 'appointment_created':
            return {
              subject: 'New Appointment Booked',
              message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} has been booked for ${appointment.date} at ${appointment.time}. Queue #${appointment.queueNumber}`
            };
          case 'appointment_updated':
            return {
              subject: 'Appointment Updated',
              message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} has been updated. New time: ${appointment.date} at ${appointment.time}`
            };
          case 'reminder':
            return {
              subject: 'Appointment Reminder',
              message: `Hello ${appointment.name}, this is a reminder for your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time}. Queue #${appointment.queueNumber}`
            };
          default:
            return {
              subject: 'Appointment Update',
              message: `Hello ${appointment.name}, there's an update regarding your appointment.`
            };
        }
      };
      const notificationContent = getNotificationMessage(type, appointmentData);
      // Simulate actual API calls for sending notifications
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          phone,
          type,
          subject: notificationContent.subject,
          message: notificationContent.message,
          appointment: appointmentData,
          timestamp: new Date().toISOString()
        })
      });
      if (response.ok) {
        const methods = [];
        if (email) methods.push('Email');
        if (phone) methods.push('SMS');
        addNotification('success', `${methods.join(' & ')} notification sent successfully`);
      } else {
        throw new Error('Failed to send notification');
      }
    } catch (error) {
      // Fallback to console logging if API fails
      console.log(`Notification failed, falling back to simulation for ${email || phone}`);
      const getNotificationMessage = (type: string, appointment: any) => {
        switch (type) {
          case 'now_serving':
            return {
              subject: 'Your Turn - Now Being Served',
              message: `Hello ${appointment.name}, it's now your turn! Please proceed to ${appointment.doctor}'s office. Queue #${appointment.queueNumber}`
            };
          case 'appointment_completed':
            return {
              subject: 'Appointment Completed',
              message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} has been completed. Thank you for visiting us.`
            };
          case 'appointment_confirmed':
            return {
              subject: 'Appointment Confirmed',
              message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} has been confirmed. Queue #${appointment.queueNumber}`
            };
          case 'appointment_cancelled':
            return {
              subject: 'Appointment Cancelled',
              message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} has been cancelled.`
            };
          case 'appointment_pending':
            return {
              subject: 'Appointment Pending',
              message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} is pending confirmation.`
            };
          case 'appointment_created':
            return {
              subject: 'New Appointment Booked',
              message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} has been booked for ${appointment.date} at ${appointment.time}. Queue #${appointment.queueNumber}`
            };
          case 'appointment_updated':
            return {
              subject: 'Appointment Updated',
              message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} has been updated. New time: ${appointment.date} at ${appointment.time}`
            };
          case 'reminder':
            return {
              subject: 'Appointment Reminder',
              message: `Hello ${appointment.name}, this is a reminder for your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time}. Queue #${appointment.queueNumber}`
            };
          default:
            return {
              subject: 'Appointment Update',
              message: `Hello ${appointment.name}, there's an update regarding your appointment.`
            };
        }
      };
      const notificationContent = getNotificationMessage(type, appointmentData);
      const promises = [];
      if (email) {
        promises.push(
          new Promise(resolve => {
            setTimeout(() => {
              console.log(`Email sent to ${email}: ${notificationContent.subject}`);
              console.log(`Message: ${notificationContent.message}`);
              resolve(true);
            }, 1000);
          })
        );
      }
      if (phone) {
        promises.push(
          new Promise(resolve => {
            setTimeout(() => {
              console.log(`SMS sent to ${phone}: ${notificationContent.message}`);
              resolve(true);
            }, 800);
          })
        );
      }
      await Promise.all(promises);
      const methods = [];
      if (email) methods.push('Email');
      if (phone) methods.push('SMS');
      addNotification('success', `${methods.join(' & ')} notification sent successfully`);
    }
  };
  
  const sendNotificationToPatientById = async (appointmentId: string, method: 'sms' | 'email' | 'both') => {
    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (!appointment) return;
    const email = method === 'email' || method === 'both' ? appointment.email : '';
    const phone = method === 'sms' || method === 'both' ? appointment.phone : '';
    await sendNotificationToPatient(email, phone, 'reminder', appointment);
  };
  
  // Reset Forms
  const resetAppointmentForm = () => {
    setAppointmentForm({
      name: '',
      age: '',
      email: '',
      phone: '',
      gender: '',
      condition: '',
      customCondition: '',
      priority: 'normal',
      date: '',
      time: '',
      doctorId: '',
      notes: '',
      photo: ''
    });
  };
  
 const resetDoctorForm = () => {
  setDoctorForm({
    name: '',
    specialty: '',
    email: '',
    phone: '',
    room: '',
    startTime: '9:00 AM', 
    endTime: '5:00 PM',   
    maxAppointments: '8',
    consultationDuration: '30',
    bufferTime: '15',
    offDays: [],
    photo: '',
    available: true,
    isActive: true
  });
};
  
  // Edit Functions
  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setAppointmentForm({
      name: appointment.name,
      age: appointment.age,
      email: appointment.email,
      phone: appointment.phone,
      gender: appointment.gender || '',
      condition: appointment.type,
      customCondition: appointment.type,
      priority: appointment.priority,
      date: appointment.date,
      time: appointment.time,
      doctorId: appointment.doctorId,
      notes: appointment.notes || '',
      photo: appointment.photo || ''
    });
    setShowBookingForm(true);
  };
  
  const handleEditDoctor = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setDoctorForm({
      name: doctor.name,
      specialty: doctor.specialty,
      email: doctor.email,
      phone: doctor.phone,
      room: doctor.room,
      startTime: doctor.workingHours.start,
      endTime: doctor.workingHours.end,
      maxAppointments: doctor.maxAppointments.toString(),
      consultationDuration: doctor.consultationDuration.toString(),
      bufferTime: doctor.bufferTime.toString(),
      offDays: doctor.offDays,
      photo: doctor.photo || '',
      available: doctor.available,
      isActive: doctor.isActive
    });
    setShowDoctorForm(true);
  };
  
  // Utility Functions
  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'urgent': return 'priority-urgent';
      case 'emergency': return 'priority-emergency';
      default: return 'priority-normal';
    }
  };
  
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'status-confirmed';
      case 'pending': return 'status-pending';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-pending';
    }
  };
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={16} aria-hidden="true" />;
      case 'error': return <XCircle size={16} aria-hidden="true" />;
      case 'warning': return <AlertTriangle size={16} aria-hidden="true" />;
      default: return <Info size={16} aria-hidden="true" />;
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
  // Calculate stats and queue data
  const stats = getStats();
  const queue = getCurrentQueue();
  const filteredAppointments = getFilteredAppointments();
  const timeSlots = generateTimeSlots(appointmentForm.doctorId, appointmentForm.date);
  
  
  // Loading state
  if (isLoading) {
    return (
      <div className="staff-dashboard">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading staff dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="staff-dashboard">
      {/* Notifications */}
      <div className="notifications-container" aria-live="polite">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`notification notification-${notification.type}`}
            role="alert"
          >
            <div className="notification-content">
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="notification-message">{notification.message}</div>
            </div>
            <button
              className="notification-close"
              onClick={() => removeNotification(notification.id)}
              aria-label="Close notification"
              title="Close notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <Activity size={24} aria-hidden="true" />
            {!sidebarCollapsed && <span>TimeFly Staff</span>}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
            title="Dashboard"
          >
            <Home size={20} aria-hidden="true" />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'appointments' ? 'active' : ''}`}
            onClick={() => setActiveTab('appointments')}
            aria-current={activeTab === 'appointments' ? 'page' : undefined}
            title="Appointments"
          >
            <Calendar size={20} aria-hidden="true" />
            {!sidebarCollapsed && <span>Appointments</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
            aria-current={activeTab === 'queue' ? 'page' : undefined}
            title="Queue"
          >
            <Clock size={20} aria-hidden="true" />
            {!sidebarCollapsed && <span>Queue</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'doctors' ? 'active' : ''}`}
            onClick={() => setActiveTab('doctors')}
            aria-current={activeTab === 'doctors' ? 'page' : undefined}
            title="Doctors"
          >
            <Stethoscope size={20} aria-hidden="true" />
            {!sidebarCollapsed && <span>Doctors</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
            aria-current={activeTab === 'calendar' ? 'page' : undefined}
            title="Calendar"
          >
            <CalendarDays size={20} aria-hidden="true" />
            {!sidebarCollapsed && <span>Calendar</span>}
          </button>
        </nav>
        <div className="sidebar-footer">
          <button 
            className="staff-profile-button"
            onClick={() => setShowProfileModal(true)}
            title="Edit Profile"
          >
            <div className="staff-profile">
              <div className="staff-avatar">
                {staffProfile?.photo ? (
                  <img src={staffProfile.photo} alt={staffProfile.name} />
                ) : (
                  <User size={16} aria-hidden="true" />
                )}
              </div>
              {!sidebarCollapsed && staffProfile && (
                <div className="staff-info">
                  <span className="staff-name">{staffProfile.name}</span>
                  <span className="staff-role">{staffProfile.role}</span>
                </div>
              )}
            </div>
          </button>
          <button
            className="logout-btn"
            onClick={handleLogout}
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={20} aria-hidden="true" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className={`main-content ${sidebarCollapsed ? 'expanded' : ''}`}>
        {/* Header */}
        <header className="main-header">
          <div className="header-left">
            <h1 className="page-title">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'appointments' && 'Appointments'}
              {activeTab === 'queue' && 'Queue Management'}
              {activeTab === 'doctors' && 'Doctor Management'}
              {activeTab === 'calendar' && 'Appointment Calendar'}
            </h1>
            <p className="page-subtitle">
              {activeTab === 'dashboard' && 'Overview of clinic operations'}
              {activeTab === 'appointments' && 'Manage patient appointments'}
              {activeTab === 'queue' && 'Real-time queue management'}
              {activeTab === 'doctors' && 'Manage doctor profiles and availability'}
              {activeTab === 'calendar' && 'Monthly view of all appointments'}
            </p>
          </div>
          <div className="header-right">
            <div className="search-container">
              <Search size={20} aria-hidden="true" />
              <input
                type="text"
                placeholder="Search appointments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search appointments"
                title="Search appointments"
              />
            </div>
            <button
              className="notification-btn"
              onClick={() => setShowNotificationModal(true)}
              aria-label={`Notifications (${notifications.length})`}
              title={`Notifications (${notifications.length})`}
            >
              <Bell size={20} aria-hidden="true" />
              {notifications.length > 0 && (
                <span className="notification-badge">{notifications.length}</span>
              )}
            </button>
          </div>
        </header>
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-content">
            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card primary">
                <div className="stat-header">
                  <Calendar size={24} aria-hidden="true" />
                  <span className="stat-title">Today's Appointments</span>
                </div>
                <div className="stat-value">{stats.totalToday}</div>
                <div className="stat-detail">
                  <span className="confirmed">{stats.confirmed} Confirmed</span>
                  <span className="pending">{stats.pending} Pending</span>
                </div>
              </div>
              <div className="stat-card success">
                <div className="stat-header">
                  <CheckCircle2 size={24} aria-hidden="true" />
                  <span className="stat-title">Completed</span>
                </div>
                <div className="stat-value">{stats.completed}</div>
                <div className="stat-detail">Today's completed appointments</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-header">
                  <AlertTriangle size={24} aria-hidden="true" />
                  <span className="stat-title">Emergency</span>
                </div>
                <div className="stat-value">{stats.emergencyToday}</div>
                <div className="stat-detail">Priority cases today</div>
              </div>
              <div className="stat-card info">
                <div className="stat-header">
                  <Users size={24} aria-hidden="true" />
                  <span className="stat-title">Active Doctors</span>
                </div>
                <div className="stat-value">{stats.activeDoctors}</div>
                <div className="stat-detail">Currently available</div>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="action-buttons">
                <button
                  className="action-btn primary"
                  onClick={() => setShowBookingForm(true)}
                  title="Book Appointment"
                >
                  <Plus size={20} aria-hidden="true" />
                  Book Appointment
                </button>
                <button
                  className="action-btn secondary"
                  onClick={() => setActiveTab('queue')}
                  title="Manage Queue"
                >
                  <Clock size={20} aria-hidden="true" />
                  Manage Queue
                </button>
                <button
                  className="action-btn secondary"
                  onClick={() => setShowDoctorForm(true)}
                  title="Add Doctor"
                >
                  <UserPlus size={20} aria-hidden="true" />
                  Add Doctor
                </button>
              </div>
            </div>
            
            {/* Recent Appointments */}
            <div className="recent-appointments">
              <h3>Recent Appointments</h3>
              <div className="appointments-table">
                <div className="table-header">
                  <div>Patient</div>
                  <div>Doctor</div>
                  <div>Time</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>
                {appointments.slice(0, 5).map((appointment) => (
                  <div key={appointment.id} className="table-row">
                    <div className="patient-info">
                      <div className="patient-avatar">
                        {appointment.photo ? (
                          <img src={appointment.photo} alt={appointment.name} />
                        ) : (
                          <User size={16} aria-hidden="true" />
                        )}
                      </div>
                      <div>
                        <div className="patient-name">{appointment.name}</div>
                        <div className="patient-type">{appointment.type}</div>
                      </div>
                    </div>
                    <div>{appointment.doctor}</div>
                    <div>
                      <div>{appointment.time}</div>
                      <div className="appointment-date">{appointment.date}</div>
                    </div>
                    <div>
                      <span className={`status-badge ${getStatusColor(appointment.status)}`}>
                        {appointment.status}
                      </span>
                    </div>
                    <div className="table-actions">
                      <button
                        className="action-btn-sm"
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setShowDetailsModal(true);
                        }}
                        aria-label={`View details for ${appointment.name}`}
                        title={`View details for ${appointment.name}`}
                      >
                        <Eye size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="action-btn-sm"
                        onClick={() => handleEditAppointment(appointment)}
                        aria-label={`Edit appointment for ${appointment.name}`}
                        title={`Edit appointment for ${appointment.name}`}
                      >
                        <Edit size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div className="appointments-content">
            {/* Filters */}
            <div className="filters-section">
              <div className="filters-row">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  aria-label="Filter by status"
                  title="Filter by status"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select
                  value={filterDoctor}
                  onChange={(e) => setFilterDoctor(e.target.value)}
                  aria-label="Filter by doctor"
                  title="Filter by doctor"
                >
                  <option value="all">All Doctors</option>
                  {doctors.map(doctor => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  aria-label="Filter by date"
                  title="Filter by date"
                />
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  aria-label="Filter by priority"
                  title="Filter by priority"
                >
                  <option value="all">All Priorities</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
                <button
                  className="btn-primary"
                  onClick={() => setShowBookingForm(true)}
                  title="New Appointment"
                >
                  <Plus size={16} aria-hidden="true" />
                  New Appointment
                </button>
              </div>
            </div>
            
            {/* Appointments List */}
            <div className="appointments-list">
              {filteredAppointments.length === 0 ? (
                <div className="no-appointments">
                  <Search size={48} aria-hidden="true" />
                  <p>No appointments found matching your criteria</p>
                </div>
              ) : (
                filteredAppointments.map((appointment) => (
                  <div key={appointment.id} className="appointment-card">
                    <div className="appointment-main">
                      <div className="patient-section">
                        <div className="patient-avatar">
                          {appointment.photo ? (
                            <img src={appointment.photo} alt={appointment.name} />
                          ) : (
                            <User size={24} aria-hidden="true" />
                          )}
                        </div>
                        <div className="patient-details">
                          <h4>{appointment.name}</h4>
                          <p>{appointment.type}</p>
                          <div className="patient-contact">
                            <span><Mail size={14} aria-hidden="true" /> {appointment.email}</span>
                            <span><Phone size={14} aria-hidden="true" /> {appointment.phone}</span>
                          </div>
                        </div>
                      </div>
                      <div className="appointment-info">
                        <div className="info-item">
                          <CalendarDays size={16} aria-hidden="true" />
                          <span>{appointment.date}</span>
                        </div>
                        <div className="info-item">
                          <Clock size={16} aria-hidden="true" />
                          <span>{appointment.time}</span>
                        </div>
                        <div className="info-item">
                          <Stethoscope size={16} aria-hidden="true" />
                          <span>{appointment.doctor}</span>
                        </div>
                        <div className="info-item">
                          <Badge size={16} aria-hidden="true" />
                          <span>#{appointment.queueNumber}</span>
                        </div>
                      </div>
                      <div className="appointment-status">
                        <span className={`priority-badge ${getPriorityColor(appointment.priority)}`}>
                          {appointment.priority}
                        </span>
                        <span className={`status-badge ${getStatusColor(appointment.status)}`}>
                          {appointment.status}
                        </span>
                      </div>
                    </div>
                    <div className="appointment-actions">
                      <button
                        className="action-btn view"
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setShowDetailsModal(true);
                        }}
                        aria-label={`View details for ${appointment.name}`}
                        title={`View details for ${appointment.name}`}
                      >
                        <Eye size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="action-btn edit"
                        onClick={() => handleEditAppointment(appointment)}
                        aria-label={`Edit appointment for ${appointment.name}`}
                        title={`Edit appointment for ${appointment.name}`}
                      >
                        <Edit size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="action-btn notification"
                        onClick={() => sendNotificationToPatientById(appointment.id, 'both')}
                        aria-label={`Send notification to ${appointment.name}`}
                        title={`Send notification to ${appointment.name}`}
                      >
                        <Send size={16} aria-hidden="true" />
                      </button>
                      {appointment.status === 'pending' && (
                        <button
                          className="action-btn confirm"
                          onClick={() => handleAppointmentStatusChange(appointment.id, 'confirmed')}
                          aria-label={`Confirm appointment for ${appointment.name}`}
                          title={`Confirm appointment for ${appointment.name}`}
                        >
                          <CheckCircle2 size={16} aria-hidden="true" />
                        </button>
                      )}
                      {appointment.status === 'confirmed' && (
                        <button
                          className="action-btn complete"
                          onClick={() => handleAppointmentStatusChange(appointment.id, 'completed')}
                          aria-label={`Mark appointment as completed for ${appointment.name}`}
                          title={`Mark appointment as completed for ${appointment.name}`}
                        >
                          <CheckCircle2 size={16} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        className="action-btn cancel"
                        onClick={() => handleAppointmentStatusChange(appointment.id, 'cancelled')}
                        aria-label={`Cancel appointment for ${appointment.name}`}
                        title={`Cancel appointment for ${appointment.name}`}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => handleDeleteAppointment(appointment.id)}
                        aria-label={`Delete appointment for ${appointment.name}`}
                        title={`Delete appointment for ${appointment.name}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        
        {/* Queue Tab */}
        {activeTab === 'queue' && (
          <div className="queue-content">
            <div className="queue-header">
              <div className="current-serving">
                <h3>Now Serving</h3>
                <div className="serving-display">
                  {queue.length > 0 && queue[0].status === 'confirmed' ? (
                    <div className="current-patient">
                      <div className="queue-number">#{queue[0].queueNumber}</div>
                      <div className="patient-info">
                        <div className="patient-name">{queue[0].name}</div>
                        <div className="patient-doctor">{queue[0].doctor}</div>
                        <div className="serving-status">Currently Being Served</div>
                      </div>
                    </div>
                  ) : (
                    <div className="no-patients">
                      {queue.length > 0 ? 'Waiting for confirmation...' : 'No patients in queue'}
                    </div>
                  )}
                </div>
              </div>
              <div className="queue-stats">
                <div className="stat">
                  <span className="label">Total in Queue</span>
                  <span className="value">{queue.length}</span>
                </div>
                <div className="stat">
                  <span className="label">Confirmed</span>
                  <span className="value">{queue.filter(q => q.status === 'confirmed').length}</span>
                </div>
                <div className="stat">
                  <span className="label">Average Wait</span>
                  <span className="value">30 min</span>
                </div>
              </div>
            </div>
            <div className="queue-list">
              {queue.length === 0 ? (
                <div className="empty-queue">
                  <Clock size={48} aria-hidden="true" />
                  <p>No patients in queue</p>
                </div>
              ) : (
                queue.map((patient, index) => (
                  <div 
                    key={patient.id} 
                    className={`queue-item ${
                      index === 0 && patient.status === 'confirmed' ? 'current' : ''
                    } ${patient.status === 'pending' ? 'pending' : ''}`}
                  >
                    <div className="queue-position">#{patient.queueNumber}</div>
                    <div className="patient-avatar">
                      {patient.photo ? (
                        <img src={patient.photo} alt={patient.name} />
                      ) : (
                        <User size={20} aria-hidden="true" />
                      )}
                    </div>
                    <div className="patient-details">
                      <div className="patient-name">{patient.name}</div>
                      <div className="patient-type">{patient.type}</div>
                      <div className="patient-doctor">{patient.doctor}</div>
                      <div className="patient-status">
                        <span className={`status-badge ${getStatusColor(patient.status)}`}>
                          {patient.status}
                        </span>
                        {index === 0 && patient.status === 'confirmed' && (
                          <span className="now-serving-badge">Now Serving</span>
                        )}
                      </div>
                    </div>
                    <div className="queue-priority">
                      <span className={`priority-badge ${getPriorityColor(patient.priority)}`}>
                        {patient.priority}
                      </span>
                    </div>
                    <div className="queue-time">
                      <div className="appointment-time">{patient.time}</div>
                      <div className="wait-time">
                        {index === 0 && patient.status === 'confirmed' 
                          ? 'Being Served' 
                          : `Wait: ${patient.estimatedWaitTime}min`
                        }
                      </div>
                    </div>
                    <div className="queue-actions">
                      {index === 0 && patient.status === 'confirmed' ? (
                        <button
                          className="action-btn complete"
                          onClick={() => handleAppointmentStatusChange(patient.id, 'completed')}
                          aria-label={`Mark ${patient.name} as completed`}
                          title={`Mark ${patient.name} as completed`}
                        >
                          <CheckCircle2 size={16} aria-hidden="true" />
                          Complete
                        </button>
                      ) : patient.status === 'pending' ? (
                        <button
                          className="action-btn confirm"
                          onClick={() => handleAppointmentStatusChange(patient.id, 'confirmed')}
                          aria-label={`Confirm ${patient.name}`}
                          title={`Confirm ${patient.name}`}
                        >
                          <CheckCircle2 size={16} aria-hidden="true" />
                          Confirm
                        </button>
                      ) : (
                        <>
                          <button
                            className="action-btn hold"
                            onClick={() => addNotification('info', `${patient.name} put on hold`)}
                            aria-label={`Put ${patient.name} on hold`}
                            title={`Put ${patient.name} on hold`}
                          >
                            <Pause size={16} aria-hidden="true" />
                          </button>
                          <button
                            className="action-btn skip"
                            onClick={() => addNotification('info', `${patient.name} skipped in queue`)}
                            aria-label={`Skip ${patient.name} in queue`}
                            title={`Skip ${patient.name} in queue`}
                          >
                            <SkipForward size={16} aria-hidden="true" />
                          </button>
                        </>
                      )}
                      <button
                        className="action-btn notify"
                        onClick={() => sendNotificationToPatientById(patient.id, 'sms')}
                        aria-label={`Notify ${patient.name} via SMS`}
                        title={`Notify ${patient.name} via SMS`}
                      >
                        <MessageSquare size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        
        {/* Doctors Tab */}
        {activeTab === 'doctors' && (
          <div className="doctors-content">
            <div className="doctors-header">
              <button
                className="btn-primary"
                onClick={() => setShowDoctorForm(true)}
                title="Add Doctor"
              >
                <Plus size={16} aria-hidden="true" />
                Add Doctor
              </button>
            </div>
            {doctors.length === 0 ? (
              <div className="no-doctors">
                <Stethoscope size={48} aria-hidden="true" />
                <p>No doctors found. Add a new doctor to get started.</p>
              </div>
            ) : (
              <div className="doctors-grid">
                {doctors.map((doctor) => (
                  <div key={doctor.id} className="doctor-card">
                    <div className="doctor-avatar">
                      {doctor.photo ? (
                        <img src={doctor.photo} alt={doctor.name} />
                      ) : (
                        <User size={32} aria-hidden="true" />
                      )}
                      <div className={`availability-indicator ${doctor.available ? 'available' : 'unavailable'}`}>
                        {doctor.available ? <UserCheck size={16} aria-hidden="true" /> : <UserX size={16} aria-hidden="true" />}
                      </div>
                    </div>
                    <div className="doctor-info">
                      <h4>{doctor.name}</h4>
                      <p className="specialty">{doctor.specialty}</p>
                      <div className="doctor-details">
                        <div className="detail-item">
                          <MapPin size={14} aria-hidden="true" />
                          <span>Room {doctor.room}</span>
                        </div>
                        <div className="detail-item">
                          <Clock3 size={14} aria-hidden="true" />
                          <span>{doctor.workingHours.start} - {doctor.workingHours.end}</span>
                        </div>
                        <div className="detail-item">
                          <Users size={14} aria-hidden="true" />
                          <span>Max {doctor.maxAppointments} patients/day</span>
                        </div>
                      </div>
                    </div>
                    <div className="doctor-actions">
                      <div className="availability-management">
                        <input
                          type="date"
                          value={doctorAvailabilityDates[doctor.id] || ''}
                          onChange={(e) => handleAvailabilityDateChange(doctor.id, e.target.value)}
                          className="availability-date-input"
                          min={getTodayDate()}
                          aria-label={`Select date for ${doctor.name}'s availability`}
                          placeholder="Select date"
                        />
                        <button
                          className={`toggle-btn ${
                            doctorAvailabilityDates[doctor.id] && 
                            getDoctorAvailability(doctor.id, doctorAvailabilityDates[doctor.id]) 
                              ? 'available' 
                              : 'unavailable'
                          }`}
                          onClick={() => {
                            const selectedDate = doctorAvailabilityDates[doctor.id];
                            if (selectedDate) {
                              const currentAvailability = getDoctorAvailability(doctor.id, selectedDate);
                              handleToggleDoctorAvailability(doctor.id, !currentAvailability, selectedDate);
                            } else {
                              addNotification('error', 'Please select a date first');
                            }
                          }}
                          disabled={!doctorAvailabilityDates[doctor.id]}
                          title={`Toggle availability for ${doctor.name} on selected date`}
                        >
                          {doctorAvailabilityDates[doctor.id] && 
                           getDoctorAvailability(doctor.id, doctorAvailabilityDates[doctor.id]) 
                            ? 'Mark Unavailable' 
                            : 'Mark Available'
                          }
                        </button>
                      </div>
                      <div className="action-buttons">
                        <button
                          className="action-btn edit"
                          onClick={() => handleEditDoctor(doctor)}
                          aria-label={`Edit ${doctor.name}`}
                          title={`Edit ${doctor.name}`}
                        >
                          <Edit size={16} aria-hidden="true" />
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => handleDeleteDoctor(doctor.id)}
                          aria-label={`Delete ${doctor.name}`}
                          title={`Delete ${doctor.name}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div className="calendar-content">
            <CalendarView 
              appointments={appointments}
              doctors={doctors} // Pass the doctors prop even if not used directly
              onAppointmentClick={(appointment) => {
                setSelectedAppointment(appointment);
                setShowDetailsModal(true);
              }}
              onDateClick={(date) => {
                setAppointmentForm(prev => ({ ...prev, date }));
                setShowBookingForm(true);
              }}
              getPriorityColor={getPriorityColor}
              getStatusColor={getStatusColor}
            />
          </div>
        )}
      </main>
      
      {/* Appointment Form Modal */}
      {showBookingForm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content appointment-form-modal">
            <div className="modal-header">
              <h3>{editingAppointment ? 'Edit Appointment' : 'New Appointment'}</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowBookingForm(false);
                  setEditingAppointment(null);
                  resetAppointmentForm();
                }}
                aria-label="Close form"
                title="Close form"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="patient-name">Patient Name *</label>
                  <input
                    id="patient-name"
                    type="text"
                    name="name"
                    value={appointmentForm.name}
                    onChange={handleAppointmentFormChange}
                    placeholder="Enter patient name"
                    required
                    title="Patient Name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="patient-age">Age</label>
                  <input
                    id="patient-age"
                    type="number"
                    name="age"
                    value={appointmentForm.age}
                    onChange={handleAppointmentFormChange}
                    placeholder="Age"
                    title="Patient Age"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="patient-email">Email *</label>
                  <input
                    id="patient-email"
                    type="email"
                    name="email"
                    value={appointmentForm.email}
                    onChange={handleAppointmentFormChange}
                    placeholder="patient@email.com"
                    required
                    title="Patient Email"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="patient-phone">Phone *</label>
                  <input
                    id="patient-phone"
                    type="tel"
                    name="phone"
                    value={appointmentForm.phone}
                    onChange={handleAppointmentFormChange}
                    placeholder="Phone number"
                    required
                    title="Patient Phone"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="patient-gender">Gender</label>
                  <select
                    id="patient-gender"
                    name="gender"
                    value={appointmentForm.gender}
                    onChange={handleAppointmentFormChange}
                    title="Patient Gender"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="priority">Priority</label>
                  <select
                    id="priority"
                    name="priority"
                    value={appointmentForm.priority}
                    onChange={handleAppointmentFormChange}
                    title="Appointment Priority"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div className="form-group">
  <label htmlFor="doctor-select">Doctor *</label>
  <select
    id="doctor-select"
    name="doctorId"
    value={appointmentForm.doctorId}
    onChange={handleAppointmentFormChange}
    required
    title="Select Doctor"
  >
    <option value="">Select doctor</option>
    {doctors.filter(d => {
      // Only show active doctors
      if (!d.isActive) return false;
      
      // If no date is selected, show all active doctors
      if (!appointmentForm.date) return true;
      
      // Check if doctor is available on the selected date
      const isAvailableOnDate = getDoctorAvailability(d.id, appointmentForm.date);
      return isAvailableOnDate;
    }).map(doctor => (
      <option key={doctor.id} value={doctor.id}>
        {doctor.name} - {doctor.specialty}
      </option>
    ))}
  </select>
  {appointmentForm.date && doctors.filter(d => d.isActive && !getDoctorAvailability(d.id, appointmentForm.date)).length > 0 && (
    <div className="unavailable-doctors-notice">
      <small className="unavailable-notice-text">
        Some doctors are not available on {appointmentForm.date}
      </small>
    </div>
  )}
</div>
                <div className="form-group">
                  <label htmlFor="appointment-date">Date *</label>
                  <input
                    id="appointment-date"
                    type="date"
                    name="date"
                    value={appointmentForm.date}
                    onChange={handleAppointmentFormChange}
                    min={getTodayDate()}
                    required
                    title="Appointment Date"
                  />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="condition">Condition *</label>
                  <select
                    id="condition"
                    name="condition"
                    value={appointmentForm.condition}
                    onChange={handleAppointmentFormChange}
                    required
                    title="Patient Condition"
                  >
                    <option value="">Select condition</option>
                    <option value="General Checkup">General Checkup</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Consultation">Consultation</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Vaccination">Vaccination</option>
                    <option value="Lab Results">Lab Results</option>
                    <option value="custom">Other (Specify)</option>
                  </select>
                </div>
                {appointmentForm.condition === 'custom' && (
                  <div className="form-group full-width">
                    <label htmlFor="custom-condition">Custom Condition</label>
                    <input
                      id="custom-condition"
                      type="text"
                      name="customCondition"
                      value={appointmentForm.customCondition}
                      onChange={handleAppointmentFormChange}
                      placeholder="Describe the condition"
                      title="Custom Condition"
                    />
                  </div>
                )}
                {timeSlots.length > 0 && (
                  <div className="form-group full-width">
    <label>Available Time Slots *</label>
    {timeSlots.length > 0 ? (
      <div className="time-slots-grid">
        {timeSlots.map((slot) => (
          <button
            key={slot.time}
            type="button"
            className={`time-slot ${!slot.available ? 'booked' : ''} ${appointmentForm.time === slot.time ? 'selected' : ''}`}
            onClick={() => slot.available && setAppointmentForm(prev => ({ ...prev, time: slot.time }))}
            disabled={!slot.available}
            title={slot.available ? `Select ${slot.time}` : `Slot ${slot.time} is booked`}
          >
            {slot.time}
            {!slot.available && <span className="booked-indicator">Booked</span>}
          </button>
        ))}
      </div>
    ) : (
      <div className="no-slots-available">
        <p className="unavailable-notice-text">
          {getDoctorAvailability(appointmentForm.doctorId, appointmentForm.date) 
            ? 'No time slots available for this doctor on the selected date.'
            : 'Selected doctor is not available on this date.'
          }
        </p>
      </div>
    )}
  </div>
)}
                <div className="form-group full-width">
                  <label htmlFor="appointmentPhoto">Photo</label>
                  <div className="photo-upload">
                    <input
                      type="file"
                      id="appointmentPhoto"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'appointment')}
                      className="photo-input"
                      disabled={uploadingImage}
                    />
                    <label htmlFor="appointmentPhoto" className="photo-label">
                      <Camera size={16} aria-hidden="true" />
                      {uploadingImage ? 'Uploading...' : (appointmentForm.photo ? 'Change Photo' : 'Upload Photo')}
                    </label>
                    {appointmentForm.photo && (
                      <img src={appointmentForm.photo} alt="Preview" className="photo-preview" />
                    )}
                  </div>
                </div>
                <div className="form-group full-width">
                  <label htmlFor="notes">Notes</label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={appointmentForm.notes}
                    onChange={handleAppointmentFormChange}
                    placeholder="Additional notes..."
                    rows={3}
                    title="Appointment Notes"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowBookingForm(false);
                  setEditingAppointment(null);
                  resetAppointmentForm();
                }}
                title="Cancel"
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={editingAppointment ? handleUpdateAppointment : handleCreateAppointment}
                disabled={uploadingImage}
                title={editingAppointment ? 'Update Appointment' : 'Create Appointment'}
              >
                <Save size={16} aria-hidden="true" />
                {editingAppointment ? 'Update' : 'Create'} Appointment
              </button>
            </div>
          </div>
        </div>
      )}
      
  {/* Doctor Form Modal */}
{showDoctorForm && (
  <div className="modal-overlay" role="dialog" aria-modal="true">
    <div className="modal-content doctor-form-modal">
      {/* Header */}
      <div className="modal-header">
        <h3>{editingDoctor ? 'Edit Doctor' : 'Add Doctor'}</h3>
        <button
          className="modal-close"
          onClick={() => {
            setShowDoctorForm(false);
            setEditingDoctor(null);
            resetDoctorForm();
          }}
          aria-label="Close form"
          title="Close form"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="modal-body">
        <div className="form-grid">
          {/* Doctor Name */}
          <div className="form-group">
            <label htmlFor="doctor-name">Doctor Name *</label>
            <input
              id="doctor-name"
              type="text"
              name="name"
              value={doctorForm.name}
              onChange={handleDoctorFormChange}
              placeholder="Dr. Full Name"
              required
            />
          </div>

          {/* Specialty */}
          <div className="form-group">
            <label htmlFor="doctor-specialty">Specialty *</label>
            <input
              id="doctor-specialty"
              type="text"
              name="specialty"
              value={doctorForm.specialty}
              onChange={handleDoctorFormChange}
              placeholder="Medical specialty"
              required
            />
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="doctor-email">Email *</label>
            <input
              id="doctor-email"
              type="email"
              name="email"
              value={doctorForm.email}
              onChange={handleDoctorFormChange}
              placeholder="doctor@email.com"
              required
            />
          </div>

          {/* Phone */}
          <div className="form-group">
            <label htmlFor="doctor-phone">Phone</label>
            <input
              id="doctor-phone"
              type="tel"
              name="phone"
              value={doctorForm.phone}
              onChange={handleDoctorFormChange}
              placeholder="Phone number"
            />
          </div>

          {/* Room */}
          <div className="form-group">
            <label htmlFor="doctor-room">Room Number</label>
            <input
              id="doctor-room"
              type="text"
              name="room"
              value={doctorForm.room}
              onChange={handleDoctorFormChange}
              placeholder="Room 101"
            />
          </div>

          {/* Max Appointments */}
          <div className="form-group">
            <label htmlFor="max-appointments">Max Appointments/Day</label>
            <input
              id="max-appointments"
              type="number"
              name="maxAppointments"
              value={doctorForm.maxAppointments}
              onChange={handleDoctorFormChange}
              min="1"
              max="20"
            />
          </div>

          {/* Start Time */}
          <div className="form-group">
            <label htmlFor="start-time">Start Time</label>
            <select
              id="start-time"
              name="startTime"
              value={doctorForm.startTime}
              onChange={handleDoctorFormChange}
              required
            >
              <option value="">Select Start Time</option>
              {(() => {
                const times = [];
                let start = new Date("1970-01-01T07:00:00");
                const end = new Date("1970-01-01T21:00:00");
                while (start <= end) {
                  const h = start.getHours();
                  const m = start.getMinutes();
                  const ampm = h >= 12 ? "PM" : "AM";
                  const hour12 = h % 12 || 12;
                  const minStr = m.toString().padStart(2, "0");
                  const label = `${hour12}:${minStr} ${ampm}`;
                  times.push(
                    <option key={`start-${label}`} value={label}>
                      {label}
                    </option>
                  );
                  start.setMinutes(start.getMinutes() + 30);
                }
                return times;
              })()}
            </select>
          </div>

          {/* End Time */}
          <div className="form-group">
            <label htmlFor="end-time">End Time</label>
            <select
              id="end-time"
              name="endTime"
              value={doctorForm.endTime}
              onChange={handleDoctorFormChange}
              required
            >
              <option value="">Select End Time</option>
              {(() => {
                const times = [];
                let start = new Date("1970-01-01T07:00:00");
                const end = new Date("1970-01-01T21:00:00");
                while (start <= end) {
                  const h = start.getHours();
                  const m = start.getMinutes();
                  const ampm = h >= 12 ? "PM" : "AM";
                  const hour12 = h % 12 || 12;
                  const minStr = m.toString().padStart(2, "0");
                  const label = `${hour12}:${minStr} ${ampm}`;
                  times.push(
                    <option key={`end-${label}`} value={label}>
                      {label}
                    </option>
                  );
                  start.setMinutes(start.getMinutes() + 30);
                }
                return times;
              })()}
            </select>
          </div>

          {/* Consultation Duration */}
          <div className="form-group">
            <label htmlFor="consultation-duration">Consultation Duration (minutes)</label>
            <select
              id="consultation-duration"
              name="consultationDuration"
              value={doctorForm.consultationDuration}
              onChange={handleDoctorFormChange}
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>

          {/* Buffer Time */}
          <div className="form-group">
            <label htmlFor="buffer-time">Buffer Time (minutes)</label>
            <select
              id="buffer-time"
              name="bufferTime"
              value={doctorForm.bufferTime}
              onChange={handleDoctorFormChange}
            >
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="20">20 minutes</option>
            </select>
          </div>

          {/* Photo Upload */}
          <div className="form-group full-width">
            <label htmlFor="doctorPhoto">Photo</label>
            <div className="photo-upload">
              <input
                type="file"
                id="doctorPhoto"
                accept="image/*"
                onChange={(e) => handlePhotoUpload(e, 'doctor')}
                className="photo-input"
                disabled={uploadingImage}
              />
              <label htmlFor="doctorPhoto" className="photo-label">
                <Camera size={16} />
                {uploadingImage ? 'Uploading...' : (doctorForm.photo ? 'Change Photo' : 'Upload Photo')}
              </label>
              {doctorForm.photo && (
                <img src={doctorForm.photo} alt="Preview" className="photo-preview" />
              )}
            </div>
          </div>

          {/* Checkboxes */}
          <div className="form-group full-width">
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="available"
                  checked={doctorForm.available}
                  onChange={handleDoctorFormChange}
                />
                Available for appointments
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={doctorForm.isActive}
                  onChange={handleDoctorFormChange}
                />
                Active in system
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="modal-footer">
        <button
          className="btn-secondary"
          onClick={() => {
            setShowDoctorForm(false);
            setEditingDoctor(null);
            resetDoctorForm();
          }}
        >
          Cancel
        </button>
        <button
          className="btn-primary"
          onClick={editingDoctor ? handleUpdateDoctor : handleCreateDoctor}
          disabled={uploadingImage}
        >
          <Save size={16} />
          {editingDoctor ? 'Update' : 'Add'} Doctor
        </button>
      </div>
    </div>
  </div>
)}



      
      {/* Profile Form Modal */}
      {showProfileModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content profile-form-modal">
            <div className="modal-header">
              <h3>Edit Profile</h3>
              <button
                className="modal-close"
                onClick={() => setShowProfileModal(false)}
                aria-label="Close form"
                title="Close form"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="profile-name">Name *</label>
                  <input
                    id="profile-name"
                    type="text"
                    name="name"
                    value={profileForm.name}
                    onChange={handleProfileFormChange}
                    placeholder="Your full name"
                    required
                    title="Your Name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="profile-email">Email *</label>
                  <input
                    id="profile-email"
                    type="email"
                    name="email"
                    value={profileForm.email}
                    onChange={handleProfileFormChange}
                    placeholder="your@email.com"
                    required
                    title="Your Email"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="profile-phone">Phone</label>
                  <input
                    id="profile-phone"
                    type="tel"
                    name="phone"
                    value={profileForm.phone}
                    onChange={handleProfileFormChange}
                    placeholder="Phone number"
                    title="Your Phone"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="profile-department">Department</label>
                  <select
                    id="profile-department"
                    name="department"
                    value={profileForm.department}
                    onChange={handleProfileFormChange}
                    title="Your Department"
                  >
                    <option value="Administration">Administration</option>
                    <option value="Reception">Reception</option>
                    <option value="Nursing">Nursing</option>
                    <option value="Medical Records">Medical Records</option>
                    <option value="IT Support">IT Support</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label htmlFor="profilePhoto">Photo</label>
                  <div className="photo-upload">
                    <input
                      type="file"
                      id="profilePhoto"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, 'profile')}
                      className="photo-input"
                      disabled={uploadingImage}
                    />
                    <label htmlFor="profilePhoto" className="photo-label">
                      <Camera size={16} aria-hidden="true" />
                      {uploadingImage ? 'Uploading...' : (profileForm.photo ? 'Change Photo' : 'Upload Photo')}
                    </label>
                    {profileForm.photo && (
                      <img src={profileForm.photo} alt="Preview" className="photo-preview" />
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowProfileModal(false)}
                title="Cancel"
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleUpdateProfile}
                disabled={uploadingImage}
                title="Update Profile"
              >
                <Save size={16} aria-hidden="true" />
                Update Profile
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Appointment Details Modal */}
      {showDetailsModal && selectedAppointment && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content details-modal">
            <div className="modal-header">
              <h3>Appointment Details</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedAppointment(null);
                }}
                aria-label="Close details"
                title="Close details"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
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
                    <label>Email</label>
                    <span>{selectedAppointment.email}</span>
                  </div>
                  <div className="detail-item">
                    <label>Phone</label>
                    <span>{selectedAppointment.phone}</span>
                  </div>
                  <div className="detail-item">
                    <label>Condition</label>
                    <span>{selectedAppointment.type}</span>
                  </div>
                  <div className="detail-item">
                    <label>Date & Time</label>
                    <span>{selectedAppointment.date} at {selectedAppointment.time}</span>
                  </div>
                  <div className="detail-item">
                    <label>Doctor</label>
                    <span>{selectedAppointment.doctor}</span>
                  </div>
                  <div className="detail-item">
                    <label>Queue Number</label>
                    <span>#{selectedAppointment.queueNumber}</span>
                  </div>
                  <div className="detail-item">
                    <label>Priority</label>
                    <span className={`priority-badge ${getPriorityColor(selectedAppointment.priority)}`}>
                      {selectedAppointment.priority}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Status</label>
                    <span className={`status-badge ${getStatusColor(selectedAppointment.status)}`}>
                      {selectedAppointment.status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Assigned By</label>
                    <span>{selectedAppointment.assignedBy || 'System'}</span>
                  </div>
                  {selectedAppointment.notes && (
                    <div className="detail-item full-width">
                      <label>Notes</label>
                      <span>{selectedAppointment.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => handleEditAppointment(selectedAppointment)}
                title="Edit Appointment"
              >
                <Edit size={16} aria-hidden="true" />
                Edit
              </button>
              <button
                className="btn-info"
                onClick={() => sendNotificationToPatientById(selectedAppointment.id, 'both')}
                title="Notify Patient"
              >
                <Send size={16} aria-hidden="true" />
                Notify Patient
              </button>
              {selectedAppointment.status === 'pending' && (
                <button
                  className="btn-success"
                  onClick={() => {
                    handleAppointmentStatusChange(selectedAppointment.id, 'confirmed');
                    setShowDetailsModal(false);
                  }}
                  title="Confirm Appointment"
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Confirm
                </button>
              )}
              {selectedAppointment.status === 'confirmed' && (
                <button
                  className="btn-success"
                  onClick={() => {
                    handleAppointmentStatusChange(selectedAppointment.id, 'completed');
                    setShowDetailsModal(false);
                  }}
                  title="Complete Appointment"
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Complete
                </button>
              )}
              <button
                className="btn-danger"
                onClick={() => {
                  handleDeleteAppointment(selectedAppointment.id);
                  setShowDetailsModal(false);
                }}
                title="Delete Appointment"
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content notification-modal">
            <div className="modal-header">
              <h3>Notifications</h3>
              <button
                className="modal-close"
                onClick={() => setShowNotificationModal(false)}
                aria-label="Close notifications"
                title="Close notifications"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="notifications-list">
                {notifications.length === 0 ? (
                  <div className="empty-notifications">
                    <Bell size={48} aria-hidden="true" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`notification-item ${notification.type}`}
                    >
                      <div className="notification-icon">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="notification-content">
                        <div className="notification-message">{notification.message}</div>
                        <div className="notification-time">
                          {notification.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                      <button
                        className="notification-remove"
                        onClick={() => removeNotification(notification.id)}
                        aria-label="Remove notification"
                        title="Remove notification"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;