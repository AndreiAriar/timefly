import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Users,
  Plus,
  User,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Timer,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
  CloudSun,
  Moon,
  Sun
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
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth } from '../../firebase';
import "../styles/dashboard.css";
import { useSearch } from "./SearchContext"; 
import { useTheme } from "./ThemeContext";




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
  consultationDuration?: number; 
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
  photo?: string; 
}


// Extend Doctor type locally for UI rendering
interface DoctorWithPhoto extends Doctor {
  photo?: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  booked?: boolean;
  emergency?: boolean;
}

interface DaySchedule {
  date: string;
  dayName: string;
  dayNumber: number;
  appointments: {
    booked: number;
    total: number;
  };
  doctors: {
    id: string;
    name: string;
    specialty: string;
    available: boolean;
    appointmentsBooked: number;
    maxAppointments: number;
  }[];
}

interface UserProfile {
  name: string;
  email: string;
  role: string;
  phone: string;
  department: string;
  photo?: string;
  uid: string;
}

interface Notification {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  timestamp: Date;
}

const PatientDashboard = () => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { darkMode: isDarkMode, toggleDarkMode } = useTheme();
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showCalendarView, setShowCalendarView] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Appointment | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [calendarCurrentDate, setCalendarCurrentDate] = useState(new Date());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [calendarWizardStep, setCalendarWizardStep] = useState(1);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState('');
  const [selectedCalendarDoctor, setSelectedCalendarDoctor] = useState<Doctor | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    date: '',
    time: '',
    condition: '',
    customCondition: '',
    priority: 'normal' as 'normal' | 'urgent' | 'emergency',
    email: '',
    phone: '',
    doctor: '',
    photo: '',
    gender: ''
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isSendingCancellation, setIsSendingCancellation] = useState(false);


// Add this after imports
const getApiUrl = (endpoint: string) => {
  const baseUrl = window.location.hostname === 'localhost' 
    ? '' 
    : 'https://timefly.vercel.app';
  return `${baseUrl}/api/${endpoint}`;
};

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

  // Resize image to reduce size
  const resizeImage = (file: File, maxWidth: number = 300, maxHeight: number = 300, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      img.onerror = () => reject(new Error('Image loading failed'));
      img.src = URL.createObjectURL(file);
    });
  };
  

  // ✅ useSearch hook from context
  const { searchTerm } = useSearch();

  // ✅ Filtering logic updated to use searchTerm
  const getFilteredAppointments = () => {
    if (!currentUser) return [];

    let filtered = appointments.filter((apt) => {
      const isUserAppointment =
        apt.userId === currentUser.uid || apt.patientUserId === currentUser.uid;
      const isNotCancelled = apt.status !== "cancelled";
      return isUserAppointment && isNotCancelled;
    });

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (apt) =>
          apt.name.toLowerCase().includes(searchLower) ||
          apt.type.toLowerCase().includes(searchLower) ||
          apt.doctor.toLowerCase().includes(searchLower) ||
          apt.status.toLowerCase().includes(searchLower) ||
          apt.priority.toLowerCase().includes(searchLower) ||
          apt.date.includes(searchLower)
      );
    }

    return filtered;
  };

 // ✅ Keep this single declaration
const [doctorAvailability, setDoctorAvailability] = useState<
  { doctorId: string; date: string; available: boolean }[]
>([]);

useEffect(() => {
  const q = query(collection(db, "doctorAvailability"));
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const avail = snapshot.docs.map((doc) => ({
        doctorId: doc.data().doctorId,
        date: doc.data().date,
        available: doc.data().available,
      }));
      setDoctorAvailability(avail);
    },
    (error) => {
      console.error("Error loading doctor availability:", error);
    }
  );

  return () => unsubscribe();
}, []);

// 🆕 Add this new state for blocked/unavailable time slots
const [doctorAvailabilitySlots, setDoctorAvailabilitySlots] = useState<{ [key: string]: boolean }>({});

useEffect(() => {
  const slotsQuery = query(collection(db, "doctorAvailabilitySlots"));
  const unsubscribe = onSnapshot(slotsQuery, (snapshot) => {
    const slotsData: { [key: string]: boolean } = {};
    snapshot.docs.forEach((doc) => {
      const data: any = doc.data();
      const key = `${data.doctorId}_${data.date}_${data.time}`;
      slotsData[key] = typeof data.available === "boolean" ? data.available : true;
    });
    setDoctorAvailabilitySlots(slotsData);
  });

  return () => unsubscribe();
}, []);


const isDoctorAvailableOnDate = (doctorId: string, date: string): boolean => {
  const override = doctorAvailability.find(
    (item) => item.doctorId === doctorId && item.date === date
  );
  // If there's an override, use it. Otherwise, use the doctor's general `available` status.
  return override ? override.available : true;
};

const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  const { name, value } = e.target;
  setFormData((prev) => ({ ...prev, [name]: value }));
};

// Firebase auth state listener
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      setCurrentUser(user);
      try {
        const userQuery = query(collection(db, 'users'), where('uid', '==', user.uid));
        const userDocs = await getDocs(userQuery);

        if (!userDocs.empty) {
          const userData = userDocs.docs[0].data();

          setUserProfile({
            name: userData.name || user.displayName || 'Guest',
            email: userData.email || user.email || '',
            role: userData.role || 'Patient',
            phone: userData.phone || '',
            department: userData.department || '',
            photo: userData.photo || '',
            uid: user.uid
          });

          // Don't use localStorage for the greeting - rely on userProfile state
          console.log('✅ User profile loaded:', userData.name || user.displayName);
        } else {
          // User doesn't exist in Firestore - create new profile
          const newUserProfile = {
            name: user.displayName || user.email?.split('@')[0] || 'Guest',
            email: user.email || '',
            role: 'Patient',
            phone: '',
            department: '',
            photo: user.photoURL || '',
            uid: user.uid,
            createdAt: serverTimestamp()
          };

          const docRef = await addDoc(collection(db, 'users'), newUserProfile);
          console.log('✅ New user profile created:', docRef.id);
          
          setUserProfile(newUserProfile);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        addNotification('error', 'Failed to load user profile');
        
        // Fallback to basic user info
        setUserProfile({
          name: user.displayName || user.email?.split('@')[0] || 'Guest',
          email: user.email || '',
          role: 'Patient',
          phone: '',
          department: '',
          photo: user.photoURL || '',
          uid: user.uid
        });
      }

      setIsLoading(false);
    } else {
      setCurrentUser(null);
      setUserProfile(null);
      setIsLoading(false);
      window.location.href = '/login';
    }
  });

  return () => unsubscribe();
}, []);

  // Fetch doctors
  useEffect(() => {
    if (!currentUser) return;
    const fetchDoctors = async () => {
      try {
        const doctorsQuery = query(
          collection(db, 'doctors'),
          where('available', '==', true)
        );
        const unsubscribe = onSnapshot(
          doctorsQuery,
          (snapshot) => {
            const doctorsData = snapshot.docs.map(doc => {
              console.log('Doctor from Firebase:', {
                id: doc.id,
                name: doc.data().name,
                specialty: doc.data().specialty
              });
              return {
                id: doc.id,
                ...doc.data()
              };
            }) as Doctor[];
            
            if (doctorsData.length === 0) {
              console.log('No doctors found in Firebase, using fallback data');
              const fallbackDoctors: Doctor[] = [
                {
                  id: 'Rw21DkYhFW1c8A2LFrhd',
                  name: 'Dr. House',
                  specialty: 'Cardiology',
                  available: true,
                  bufferTime: 15,
                  maxAppointments: 8,
                  workingHours: { start: '09:00', end: '17:00' },
                  offDays: []
                },
                {
                  id: 'doc2',
                  name: 'Dr. Michael Lee',
                  specialty: 'Neurology',
                  available: true,
                  bufferTime: 15,
                  maxAppointments: 6,
                  workingHours: { start: '08:00', end: '16:00' },
                  offDays: []
                },
                {
                  id: 'doc3',
                  name: 'Dr. Emily Carter',
                  specialty: 'Pediatrics',
                  available: true,
                  bufferTime: 10,
                  maxAppointments: 10,
                  workingHours: { start: '09:00', end: '18:00' },
                  offDays: ['2025-04-05']
                }
              ];
              setDoctors(fallbackDoctors);
            } else {
              console.log('Found', doctorsData.length, 'doctors in Firebase');
              setDoctors(doctorsData);
            }
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

  // Fetch appointments - Modified to properly filter for current user
  useEffect(() => {
    if (!currentUser) return;
    const fetchAppointments = async () => {
      try {
        const appointmentsQuery = query(
          collection(db, 'appointments'),
          where('status', '!=', 'cancelled'),
          orderBy('status'),
          orderBy('date', 'asc'),
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
            console.log('All appointments loaded:', appointmentsData.length);
            console.log('Appointments for current user:', appointmentsData.filter(apt => 
              apt.userId === currentUser.uid || apt.patientUserId === currentUser.uid
            ).length);
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
  }, [currentUser]);
  


// 🔹 Store doctor-specific slots (availability state already declared earlier)
const [doctorSlotSettings, setDoctorSlotSettings] = useState<{ [key: string]: number }>({});

// 🔹 Get number of booked appointments for a specific date
const getFilledSlotsForDate = (date: string) => {
  return appointments.filter(
    (apt) => apt.date === date && apt.status !== "cancelled"
  ).length;
};

// ✅ Fetch doctor slot settings (shared with staff)
useEffect(() => {
  const fetchSlotSettings = async () => {
    try {
      const snap = await getDocs(collection(db, "doctorSlotSettings"));
      const settings: { [key: string]: number } = {};

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.doctorId && data.date && typeof data.maxSlots === "number") {
          settings[`${data.doctorId}_${data.date}`] = data.maxSlots;
        }
      });

      setDoctorSlotSettings(settings);
    } catch (error) {
      console.error("Error fetching doctor slot settings:", error);
    }
  };

  fetchSlotSettings();
}, []);

// ✅ Listen for staff manually blocked/unblocked time slots
useEffect(() => {
  const q = query(collection(db, "doctorAvailabilitySlots"));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const slotData: { [key: string]: boolean } = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const key = `${data.doctorId}_${data.date}_${data.time}`;
      slotData[key] = data.available !== false; // true = available, false = blocked
    });
    setDoctorAvailabilitySlots(slotData);
  });

  return () => unsubscribe();
}, []);

// Utility: Get a single doctor's slot count for a date
const getDoctorSlotsForDate = (doctorId: string, date: string): number => {
  const key = `${doctorId}_${date}`;
  
  // Check if staff has set a custom value
  if (doctorSlotSettings[key]) {
    return doctorSlotSettings[key];
  }
  
  // Otherwise calculate from working hours
  const doctor = doctors.find(d => d.id === doctorId);
  if (doctor) {
    return calculateDoctorDailySlots(doctor);
  }
  
  return 10; // Ultimate fallback
};


// ✅ Get total max slots for a specific date (sum of all doctors' actual slots)
const getTotalSlotsForDate = (date: string): number => {
  if (!date) return 0;

  let total = 0;

  // Loop through each doctor and get their slot count for this date
  doctors.forEach(doctor => {
    // Check if doctor is available on this date
    const availability = doctorAvailability.find(
      av => av.doctorId === doctor.id && av.date === date
    );
    
    const isAvailable = availability ? availability.available : doctor.available;
    
    if (isAvailable) {
      // Use getDoctorSlotsForDate which checks both custom settings and calculated slots
      const doctorSlots = getDoctorSlotsForDate(doctor.id, date);
      total += doctorSlots;
    }
  });

  return total;
};
const getCalendarDays = (): DaySchedule[] => {
  const end = new Date(
    calendarCurrentDate.getFullYear(),
    calendarCurrentDate.getMonth() + 1,
    0
  );
  const days: DaySchedule[] = [];

  for (let d = 1; d <= end.getDate(); d++) {
    const date = `${calendarCurrentDate.getFullYear()}-${String(
      calendarCurrentDate.getMonth() + 1
    ).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const booked = getFilledSlotsForDate(date);
    const total = getTotalSlotsForDate(date); // ✅ Now shows actual calculated slots
    
    days.push({
      date,
      dayName: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
      dayNumber: d,
      appointments: { booked, total },
      doctors: [],
    });
  }

  return days;
};
// ✅ Calculate how many appointment slots a doctor has based on working hours
const calculateDoctorDailySlots = (doctor: Doctor): number => {
  // Provide defaults if working hours are missing
  let workingHours = doctor.workingHours;
  if (!workingHours || !workingHours.start || !workingHours.end) {
    workingHours = { start: "9:00 AM", end: "5:00 PM" };
  }

  const parseTime = (timeStr: string): number => {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + (minutes || 0);
  };

  const startMinutes = parseTime(workingHours.start);
  const endMinutes = parseTime(workingHours.end);
  
  // Each slot = consultation duration (default 30 min) + buffer time (default 15 min)
  const consultationDuration = doctor.consultationDuration || 30;
  const bufferTime = doctor.bufferTime || 15;
  const slotDuration = consultationDuration + bufferTime;
  
  // Calculate total slots
  const totalWorkMinutes = endMinutes - startMinutes;
  const slots = Math.floor(totalWorkMinutes / slotDuration);
  
  return slots > 0 ? slots : 10; // Fallback to 10 if calculation fails
};

// ✅ Generate time slots (with block + emergency logic + fallback for new doctors + lunch break filter)
const generateTimeSlots = () => {
  const slots: TimeSlot[] = [];

  const doctorId = selectedCalendarDoctor?.id || formData.doctor;
  const dateToUse = selectedCalendarDate || formData.date;
  const selectedDoctor = doctors.find((doc) => doc.id === doctorId);

if (!selectedDoctor || !dateToUse) {
  // Return empty slots silently to avoid console spam
  return [];
}

  // 🚫 Helper function to check if time is lunch break (12:00 PM or 12:30 PM)
  const isLunchTime = (time12: string): boolean => {
    return time12 === '12:00 PM' || time12 === '12:30 PM';
  };

  // 🩺 Use custom schedule if available
  const scheduleForDate = selectedDoctor.scheduleSettings?.[dateToUse];
  let workingHours = selectedDoctor.workingHours;

  // ✅ Fallback for new doctors (no working hours yet)
  if (!workingHours || !workingHours.start || !workingHours.end) {
    workingHours = { start: "09:00", end: "17:00" }; // default 9 AM – 5 PM
  }

  // ✅ Apply custom hours override if any
  if (scheduleForDate?.customHours) {
    workingHours = scheduleForDate.customHours;
  }

  // ✅ Default buffer if missing
  const bufferTime = selectedDoctor.bufferTime ?? 15; // Default 15-minute buffer

  // Safely parse hours (supports both 24h "09:00" and "9:00 AM" formats)
  const parseTimeToMinutes = (timeStr: string) => {
    const hasPeriod = /AM|PM/i.test(timeStr);
    if (hasPeriod) {
      const [time, period] = timeStr.split(" ");
      let [hours, minutes] = time.split(":").map(Number);
      if (period.toUpperCase() === "PM" && hours !== 12) hours += 12;
      if (period.toUpperCase() === "AM" && hours === 12) hours = 0;
      return hours * 60 + (minutes || 0);
    } else {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours * 60 + (minutes || 0);
    }
  };

  const startTotalMinutes = parseTimeToMinutes(workingHours.start);
  const endTotalMinutes = parseTimeToMinutes(workingHours.end);

  const now = new Date();
  const philippinesNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
  const currentDateStr = philippinesNow.toISOString().split("T")[0];
  const currentTotalMinutes =
    philippinesNow.getHours() * 60 + philippinesNow.getMinutes();

  // Each cycle = 15 active mins + buffer time
  const activeDuration = 15;
  const slotDuration = activeDuration + bufferTime;

  for (
    let totalMinutes = startTotalMinutes;
    totalMinutes + slotDuration <= endTotalMinutes;
    totalMinutes += slotDuration
  ) {
    const appointmentStart = totalMinutes;
    const appointmentEnd = appointmentStart + activeDuration;
    const bufferStart = appointmentEnd;

    const time24 = `${Math.floor(appointmentStart / 60)
      .toString()
      .padStart(2, "0")}:${(appointmentStart % 60).toString().padStart(2, "0")}`;
    const time12 = convertTo12Hour(time24);

    // 🚫 Skip lunch time slots (12:00 PM and 12:30 PM)
    if (isLunchTime(time12)) {
      console.log(`⏰ Skipping lunch break: ${time12}`);
      continue;
    }

    // Skip past times if date is today
    if (dateToUse === currentDateStr && appointmentStart < currentTotalMinutes)
      continue;

    const isBooked = appointments.some(
      (apt) =>
        apt.date === dateToUse &&
        apt.doctorId === selectedDoctor.id &&
        apt.time === time12 &&
        apt.status !== "cancelled" &&
        (editingAppointment ? apt.id !== editingAppointment.id : true)
    );

    // 🧱 Check if slot is blocked
    const slotKey = `${doctorId}_${dateToUse}_${time12}`;
    const isBlocked = doctorAvailabilitySlots?.[slotKey] === false;

    // Normal slot
    slots.push({
      time: time12,
      available: !isBooked && !isBlocked,
      booked: isBooked,
      emergency: false,
    });

    // Emergency buffer slot
    const bufferTime24 = `${Math.floor(bufferStart / 60)
      .toString()
      .padStart(2, "0")}:${(bufferStart % 60).toString().padStart(2, "0")}`;
    const bufferTime12 = convertTo12Hour(bufferTime24);

    // 🚫 Skip lunch break buffer slots too
    if (isLunchTime(bufferTime12)) {
      console.log(`⏰ Skipping lunch break buffer: ${bufferTime12}`);
      continue; // Skip adding this buffer slot
    }

    const bufferKey = `${doctorId}_${dateToUse}_${bufferTime12}`;
    const bufferBlocked = doctorAvailabilitySlots?.[bufferKey] === false;

    slots.push({
      time: bufferTime12,
      available:
        formData.priority === "emergency" && !isBooked && !bufferBlocked,
      booked: isBooked,
      emergency: true,
    });
  }

  console.log(
    `✅ Generated ${slots.length} slots for ${selectedDoctor.name || "Doctor"}`
  );
  return slots;
};
  const convertTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
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

  const getTodayDate = (): string => {
    const today = new Date();
    return today.getFullYear() + '-' + 
      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
      String(today.getDate()).padStart(2, '0');
  };

  const getStatusStats = () => {
    const today = getTodayDate();
    const todayAppointments = appointments.filter(apt => {
      return apt.date === today && apt.status !== 'cancelled';
    });
    return {
      upcoming: todayAppointments.filter(apt => apt.status === 'confirmed').length,
      pending: todayAppointments.filter(apt => apt.status === 'pending').length,
      inProgress: todayAppointments.filter(apt => apt.status === 'in-progress').length,
      total: todayAppointments.length
    };
  };
const getCurrentQueue = () => {
  const today = getTodayDate();
  const todayAppointments = appointments.filter(apt => {
    return apt.date === today && ['confirmed', 'pending', 'in-progress'].includes(apt.status);
  });
  
  // ✅ Sort by: status → appointment time → priority
  return todayAppointments.sort((a, b) => {
    // 1️⃣ Confirmed status comes first
    if (a.status === 'confirmed' && b.status !== 'confirmed') return -1;
    if (b.status === 'confirmed' && a.status !== 'confirmed') return 1;
    
    // 2️⃣ Sort by appointment time
    const timeComparison = a.time.localeCompare(b.time);
    if (timeComparison !== 0) return timeComparison;
    
    // 3️⃣ Priority as tiebreaker
    const priorityOrder = { emergency: 3, urgent: 2, normal: 1 };
    const aPriority = priorityOrder[a.priority] || 1;
    const bPriority = priorityOrder[b.priority] || 1;
    return bPriority - aPriority;
  });
};


  const getNextPatient = () => {
    const queue = getCurrentQueue();
    return queue.find(apt => (apt.queueNumber || 0) > 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        addNotification('info', 'Processing photo...');
        const base64Photo = await resizeImage(file, 300, 300, 0.8);
        setFormData(prev => ({ ...prev, photo: base64Photo }));
        addNotification('success', 'Photo processed successfully');
      } catch (error) {
        console.error('Error processing photo:', error);
        addNotification('error', 'Failed to process photo');
      }
    }
  };

  // ✅ Drag & Drop handler
const handlePhotoDrop = async (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  const file = e.dataTransfer.files?.[0];
  if (file) {
    try {
      addNotification('info', 'Processing dropped photo...');
      const base64Photo = await resizeImage(file, 300, 300, 0.8);
      setFormData(prev => ({ ...prev, photo: base64Photo }));
      addNotification('success', 'Photo uploaded successfully via drag & drop');
    } catch (error) {
      console.error('Error processing dropped photo:', error);
      addNotification('error', 'Failed to upload dropped photo');
    }
  }
};

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUser && userProfile) {
      try {
        addNotification('info', 'Processing profile photo...');
        const base64Photo = await resizeImage(file, 200, 200, 0.8);
        const userQuery = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
        const userDocs = await getDocs(userQuery);
        if (!userDocs.empty) {
          const userDocRef = doc(db, 'users', userDocs.docs[0].id);
          await updateDoc(userDocRef, { 
            photo: base64Photo, 
            updatedAt: serverTimestamp() 
          });
        }
        setUserProfile(prev => prev ? { ...prev, photo: base64Photo } : null);
        addNotification('success', 'Profile photo updated successfully');
      } catch (error) {
        console.error('Error updating profile photo:', error);
        addNotification('error', 'Failed to update profile photo');
      }
    }
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

  // Add this helper function to check if daily limit is reached
const isDailyLimitReached = (doctorId: string, date: string): boolean => {
  // Get custom slot setting or calculate from working hours
  const customSlotKey = `${doctorId}_${date}`;
  const maxSlots = doctorSlotSettings[customSlotKey] || 
    (() => {
      const doctor = doctors.find(d => d.id === doctorId);
      return doctor ? calculateDoctorDailySlots(doctor) : 10;
    })();
  
  // Count existing appointments for this doctor on this date (excluding cancelled)
  const bookedCount = appointments.filter(
    apt => apt.doctorId === doctorId && 
           apt.date === date && 
           apt.status !== 'cancelled'
  ).length;
  
  console.log(`📊 Patient Dashboard - Daily limit check: ${bookedCount}/${maxSlots} for doctor ${doctorId} on ${date}`);
  
  return bookedCount >= maxSlots;
};

const handleSubmit = async () => {
  if (!formData.fullName || !formData.age || !formData.date || !formData.time || !formData.doctor || !currentUser) {
    addNotification('error', 'Please fill in all required fields including age');
    return;
  }

  const selectedDoctorInfo = doctors.find(doc => doc.id === formData.doctor);
  if (!selectedDoctorInfo) {
    addNotification('error', 'Selected doctor not found');
    return;
  }

  // ✅ Check if daily limit is reached and offer waiting list
  if (!editingAppointment && isDailyLimitReached(formData.doctor, formData.date)) {
    const userChoice = window.confirm(
      `${selectedDoctorInfo.name} is fully booked on ${formData.date}.\n\n` +
      `Would you like to join the waiting list? You'll be automatically notified if a slot becomes available.`
    );

    if (!userChoice) {
      addNotification('info', 'Please select another date or doctor.');
      return;
    }

    // Add to waiting list
    try {
      await addDoc(collection(db, 'waitingList'), {
        patientName: formData.fullName,
        patientEmail: formData.email,
        patientPhone: formData.phone,
        preferredDoctorId: formData.doctor,
        preferredDoctorName: selectedDoctorInfo.name,
        preferredDate: formData.date,
        priority: formData.priority,
        addedAt: serverTimestamp(),
        originalAppointmentData: {
          name: formData.fullName,
          age: formData.age,
          email: formData.email,
          phone: formData.phone,
          gender: formData.gender,
          type: formData.condition === 'custom' ? formData.customCondition : formData.condition,
          photo: formData.photo,
          notes: ''
        }
      });

      addNotification('success', `You've been added to the waiting list for ${selectedDoctorInfo.name}. We'll notify you when a slot opens.`);
      setShowBookingForm(false);
      setFormData({
        fullName: '',
        age: '',
        date: '',
        time: '',
        condition: '',
        customCondition: '',
        priority: 'normal',
        email: '',
        phone: '',
        doctor: '',
        photo: '',
        gender: ''
      });
      return;
    } catch (error) {
      console.error('Error adding to waiting list:', error);
      addNotification('error', 'Failed to add to waiting list');
      return;
    }
  }

  // Calculate adjusted time for emergency appointments
  let adjustedTime = formData.time;
  if (formData.priority === 'emergency' && selectedDoctorInfo) {
    const time12 = formData.time;
    const isPM = time12.includes('PM');
    let [hourStr, minuteStr] = time12.replace(' AM', '').replace(' PM', '').split(':');
    let hour = parseInt(hourStr);
    let minute = parseInt(minuteStr);
    
    if (isPM && hour !== 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    
    const totalMinutes = hour * 60 + minute - selectedDoctorInfo.bufferTime;
    const newHour = Math.floor(totalMinutes / 60);
    const newMinute = totalMinutes % 60;
    const newHour12 = newHour % 12 || 12;
    const newIsPM = newHour >= 12;
    
    adjustedTime = `${newHour12}:${newMinute.toString().padStart(2, '0')} ${newIsPM ? 'PM' : 'AM'}`;
  }

  try {
    addNotification('info', editingAppointment ? 'Updating appointment...' : 'Booking appointment...');

    // ✅ RACE CONDITION FIX: Final check right before creation
    if (!editingAppointment) {
      const lastSecondCheck = await getDocs(query(
        collection(db, 'appointments'),
        where('doctorId', '==', selectedDoctorInfo.id),
        where('date', '==', formData.date),
        where('time', '==', adjustedTime),
        where('status', '!=', 'cancelled')
      ));
      
      if (!lastSecondCheck.empty) {
        console.log('⚠️ Race condition prevented: Slot was taken during booking process');
        addNotification('error', 'This time slot was just taken by another user! Please refresh and choose another time.');
        
        // Force refresh time slots
        setFormData(prev => ({ ...prev, time: '' }));
        return;
      }
    }

    const appointmentData = {
      name: formData.fullName,
      age: formData.age,
      type: formData.condition === 'custom' ? formData.customCondition : formData.condition,
      time: adjustedTime,
      date: formData.date,
      status: 'pending' as const,
      priority: formData.priority,
      doctor: selectedDoctorInfo.name,
      doctorId: selectedDoctorInfo.id,
      email: formData.email,
      phone: formData.phone,
      photo: formData.photo,
      gender: formData.gender,
      userId: currentUser.uid,
      bookedBy: 'patient' as const,
      patientUserId: currentUser.uid,
      updatedAt: serverTimestamp()
    };

    if (editingAppointment) {
      // ✅ Check daily limit when updating (excluding current appointment)
      const customSlotKey = `${formData.doctor}_${formData.date}`;
      const maxSlots = doctorSlotSettings[customSlotKey] || 
        (() => {
          const doctor = doctors.find(d => d.id === formData.doctor);
          return doctor ? calculateDoctorDailySlots(doctor) : 10;
        })();
      
      const bookedCount = appointments.filter(
        apt => apt.doctorId === formData.doctor && 
               apt.date === formData.date && 
               apt.status !== 'cancelled' &&
               apt.id !== editingAppointment.id // ✅ Exclude current appointment
      ).length;
      
      if (bookedCount >= maxSlots) {
        addNotification('error', 'This doctor has reached their maximum appointments for this day. Please select another date or doctor.');
        return;
      }

      const appointmentRef = doc(db, "appointments", editingAppointment.id);
      await updateDoc(appointmentRef, appointmentData);
      addNotification("success", "Appointment rescheduled successfully!");
      setEditingAppointment(null);
    } else {
      const queueNumber = await getNextQueueNumber(formData.date);
      
      // ✅ Create appointment immediately after final check
      const docRef = await addDoc(collection(db, "appointments"), {
        ...appointmentData,
        queueNumber,
        createdAt: serverTimestamp(),
      });
      
      console.log("Appointment created with Firebase ID:", docRef.id);
      addNotification("success", "Appointment booked successfully!");
    }

    setShowBookingForm(false);
    setFormData({
      fullName: '',
      age: '',
      date: '',
      time: '',
      condition: '',
      customCondition: '',
      priority: 'normal',
      email: '',
      phone: '',
      doctor: '',
      photo: '',
      gender: ''
    });
  } catch (error) {
    console.error('Error saving appointment:', error);
    addNotification('error', 'Failed to save appointment');
  }
};
const handleCancelAppointment = async (id: string, reason: string) => {
  try {
    setIsSendingCancellation(true);
    
    const appointment = appointments.find(apt => apt.id === id);
    if (!appointment) {
      addNotification('error', 'Appointment not found');
      return;
    }

    // Update appointment status
    const appointmentRef = doc(db, 'appointments', id);
    await updateDoc(appointmentRef, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // ✅ NEW: Check waiting list for this doctor and date
    const waitingListQuery = query(
      collection(db, 'waitingList'),
      where('preferredDoctorId', '==', appointment.doctorId),
      where('preferredDate', '==', appointment.date),
      orderBy('priority', 'desc'),
      orderBy('addedAt', 'asc')
    );

    const waitingListSnapshot = await getDocs(waitingListQuery);

    if (!waitingListSnapshot.empty) {
      const nextInLine = waitingListSnapshot.docs[0];
      const waitingData = nextInLine.data();

      // Create appointment for waiting list patient
      const queueNumber = await getNextQueueNumber(appointment.date);
      
      await addDoc(collection(db, 'appointments'), {
        ...waitingData.originalAppointmentData,
        time: appointment.time,
        date: appointment.date,
        status: 'pending',
        priority: waitingData.priority,
        doctor: waitingData.preferredDoctorName,
        doctorId: waitingData.preferredDoctorId,
        userId: 'waiting-list-assigned',
        bookedBy: 'staff',
        assignedBy: 'System (Waiting List)',
        queueNumber,
        waitingListAssignment: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Remove from waiting list
      await deleteDoc(doc(db, 'waitingList', nextInLine.id));

      // Send notification to waiting list patient
 try {
  await fetch(getApiUrl('send-waiting-list-notification'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: waitingData.patientName,
      email: waitingData.patientEmail,
      phone: waitingData.patientPhone,
      doctor: waitingData.preferredDoctorName,
      date: appointment.date,
      time: appointment.time
    })
  });
} catch (notifError) {
  console.error('Error sending waiting list notification:', notifError);
}



      addNotification('info', 'Appointment cancelled. The slot has been offered to the next patient on the waiting list.');
    } else {
      addNotification('info', 'Appointment cancelled successfully');
    }

  
 // Send cancellation email to clinic
try {
  const response = await fetch(getApiUrl('send-cancellation'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appointmentId: id,
      name: appointment.name,
      email: appointment.email || currentUser?.email || 'N/A',
      date: appointment.date,
      time: appointment.time,
      doctor: appointment.doctor,
      reason: reason
    })
  });

      const data = await response.json();
      if (data.success) {
        console.log('✅ Cancellation email sent to clinic');
      }
    } catch (emailError) {
      console.error('❌ Error sending cancellation email:', emailError);
    }

    setShowCancelModal(false);
    setCancelReason('');
    setSelectedAppointment(null);
    
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    addNotification('error', 'Failed to cancel appointment');
  } finally {
    setIsSendingCancellation(false);
  }
};
  const handleReschedule = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setFormData({
      fullName: appointment.name,
      age: appointment.age || '',
      date: appointment.date,
      time: appointment.time,
      condition: appointment.type,
      customCondition: appointment.type,
      priority: appointment.priority,
      email: appointment.email,
      phone: appointment.phone,
      doctor: appointment.doctorId,
      photo: appointment.photo || '',
      gender: appointment.gender || ''
    });
    setShowBookingForm(true);
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

  // Calculate stats and queue data
  const stats = getStatusStats();
  const queue = getCurrentQueue();
  const nextPatient = getNextPatient();
  const currentPatient = queue.find(apt => apt.queueNumber === 1);
  const timeSlots = generateTimeSlots();
  const filteredAppointments = getFilteredAppointments();
  const calendarDays = getCalendarDays();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      addNotification('success', 'Logged out successfully');
    } catch (error) {
      console.error('Error logging out:', error);
      addNotification('error', 'Failed to log out');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="dashboard-container">
        <div className="loading-state">
          <p>Please log in to access the dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
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

{/* Hero Section */}
<section
  className="hero-section"
  data-time={
    new Date().getHours() < 12
      ? "morning"
      : new Date().getHours() < 18
      ? "afternoon"
      : "evening"
  }
>
  <div className="hero-content">
    <h1 className="hero-title">
      {(() => {
        const hour = new Date().getHours();
        let greeting = "Welcome";
        let IconComponent = Sun;
        let timePeriod = "morning";

        if (hour < 12) {
          greeting = "Good Morning";
          IconComponent = Sun;
          timePeriod = "morning";
        } else if (hour < 18) {
          greeting = "Good Afternoon";
          IconComponent = CloudSun;
          timePeriod = "afternoon";
        } else {
          greeting = "Good Evening";
          IconComponent = Moon;
          timePeriod = "evening";
        }

        // Show loading state while fetching user profile
        if (!userProfile) {
          return (
            <span className="hero-greeting" data-time={timePeriod}>
              <IconComponent className="greeting-icon" size={28} aria-hidden="true" />
              Loading...
            </span>
          );
        }

        // Get user's first name from userProfile (which is fetched from Firestore)
        const fullName = userProfile.name || "Guest";
        const firstName = fullName.trim().split(" ")[0] || "User";

        return (
          <span className="hero-greeting" data-time={timePeriod}>
            <IconComponent className="greeting-icon" size={28} aria-hidden="true" />
            {`${greeting}, ${firstName}`}
          </span>
        );
      })()}
    </h1>

    <p className="hero-subtitle">
      Manage your eye care appointments and checkups with real-time queue updates.
    </p>

    <div className="hero-actions">
      <button
        className="btn-primary"
        onClick={() => setShowBookingForm(true)}
        title="Book a new appointment"
      >
        <Plus size={20} aria-hidden="true" />
        Book Appointment
      </button>

      <button
        className="btn-secondary"
        onClick={() => setShowCalendarView(true)}
        title="View appointment calendar and doctor availability"
      >
        <CalendarDays size={20} aria-hidden="true" />
        View Calendar
      </button>
    </div>
  </div>
</section>



      {/* Stats Cards (Only the first one is kept) */}
      <section className="stats-section" aria-label="Dashboard statistics">
        <div className="stats-grid">
          <div className="stat-card stat-blue">
            <div className="stat-icon">
              <Calendar size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-title">Upcoming</h3>
              <div className="stat-value">{stats.upcoming}</div>
              <div className="stat-subtitle">Confirmed appointments</div>
              <div className="stat-change">Today</div>
            </div>
          </div>
          <div className="stat-card stat-orange">
            <div className="stat-icon">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-title">Pending</h3>
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-subtitle">Awaiting confirmation</div>
              <div className="stat-change">Needs attention</div>
            </div>
          </div>
          <div className="stat-card stat-green">
            <div className="stat-icon">
              <Users size={24} />
            </div>
            <div className="stat-content">
              <h3 className="stat-title">Total</h3>
              <div className="stat-value">{stats.total}</div>
              <div className="stat-subtitle">Today's appointments</div>
              <div className="stat-change">All statuses</div>
            </div>
          </div>
        </div>
      </section>
 {/* Main Content */}
<div className="main-content">
  {/* Left Column - Appointments */}
  <div className="appointments-column">
    {/* Today's Appointments */}
    <section className="appointments-section today-appointments">
      <div className="section-header">
        <div className="section-title">
          <Calendar size={20} /> Today's Appointments
        </div>
        <div className="section-subtitle">
          {(() => {
            const today = new Date();
            const formattedDate = today.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            return `Appointments scheduled for today (${formattedDate})`;
          })()}
          {(() => {
            const todayAppointments = filteredAppointments.filter(
              apt => apt.date === getTodayDate()
            );
            return searchTerm && todayAppointments.length > 0 ? (
              <span className="search-results">
                - Found {todayAppointments.length} result(s)
              </span>
            ) : null;
          })()}
        </div>
      </div>

      <div className="appointments-list">
        {(() => {
          const todayAppointments = filteredAppointments.filter(
            apt => apt.date === getTodayDate()
          );
          
          if (todayAppointments.length === 0) {
            return (
              <div className="empty-state">
                {searchTerm ? (
                  <p>No appointments found for today matching "{searchTerm}"</p>
                ) : (
                  <p>You have no appointments scheduled for today</p>
                )}
              </div>
            );
          }
          
         return todayAppointments.map((appointment) => (
  <div key={appointment.id} className="appointment-card">
    {/* Avatar */}
    <button
      className="appointment-avatar-btn"
      onClick={() => {
        setSelectedProfile(appointment);
        setShowDetailsModal(true);
      }}
      aria-label={`View profile for ${appointment.name}`}
      title={`View profile for ${appointment.name}`}
    >
      <div className="appointment-avatar">
        {appointment.photo ? (
          <img
            src={appointment.photo}
            alt={appointment.name}
            className="avatar-image"
          />
        ) : (
          <User size={20} />
        )}
      </div>
    </button>

    {/* Queue Number - MOVED OUTSIDE appointment-details */}
    <div className="queue-number">#{appointment.queueNumber}</div>

    {/* Patient Details */}
    <div className="appointment-details">
      <div className="appointment-name">
        {appointment.name}
        {appointment.age && (
          <span className="appointment-age"> (Age: {appointment.age})</span>
        )}
      </div>
      <div className="appointment-type">{appointment.type}</div>
      <div className="appointment-doctor">{appointment.doctor}</div>
    </div>

    {/* Meta Info with inline date/time */}
    <div className="appointment-meta">
      <div className="appointment-time">{appointment.time}</div>
      <div className="appointment-date-display">
        {(() => {
          const [year, month, day] = appointment.date.split('-');
          const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
          return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        })()}
      </div>
    </div>

    {/* Tags */}
    <div className="appointment-tags">
      <div className={`appointment-status status-${appointment.status}`}>
        {appointment.status}
      </div>
      <div className={`appointment-priority ${getPriorityColor(appointment.priority)}`}>
        {getPriorityIcon(appointment.priority)} {appointment.priority}
      </div>
    </div>

    {/* Actions */}
    <div className="appointment-actions">
      <button
        className="action-btn view-btn"
        onClick={() => {
          setSelectedAppointment(appointment);
          setShowDetailsModal(true);
        }}
        aria-label={`View details for ${appointment.name}`}
        title={`View details for ${appointment.name}`}
      >
        <Eye size={16} />
      </button>
      <button
        className="action-btn edit-btn"
        onClick={() => handleReschedule(appointment)}
        aria-label={`Reschedule appointment for ${appointment.name}`}
        title={`Reschedule appointment for ${appointment.name}`}
      >
        <Edit size={16} />
      </button>
      <button
        className="action-btn cancel-btn"
        onClick={() => {
          setSelectedAppointment(appointment);
          setShowCancelModal(true);
        }}
        aria-label={`Cancel appointment for ${appointment.name}`}
        title={`Cancel appointment for ${appointment.name}`}
      >
        <Trash2 size={16} />
      </button>
    </div>
  </div>
));
        })()}
      </div>
    </section>

    {/* My Appointments - ALL TIME */}
    <section className="appointments-section my-appointments">
      <div className="section-header">
        <div className="section-title">
          <CalendarDays size={20} /> My Appointments
        </div>
        <div className="section-subtitle">
          All your scheduled appointments
          {searchTerm && (
            <span className="search-results">
              - Found {filteredAppointments.length} result(s)
            </span>
          )}
        </div>
      </div>

      <div className="appointments-list">
        {filteredAppointments.length === 0 ? (
          <div className="empty-state">
            {searchTerm ? (
              <p>No appointments found matching "{searchTerm}"</p>
            ) : (
              <p>You have no appointments scheduled</p>
            )}
          </div>
        ) : (
        filteredAppointments.map((appointment) => (
  <div key={appointment.id} className="appointment-card">
    {/* Avatar */}
    <button
      className="appointment-avatar-btn"
      onClick={() => {
        setSelectedProfile(appointment);
        setShowDetailsModal(true);
      }}
      aria-label={`View profile for ${appointment.name}`}
      title={`View profile for ${appointment.name}`}
    >
      <div className="appointment-avatar">
        {appointment.photo ? (
          <img
            src={appointment.photo}
            alt={appointment.name}
            className="avatar-image"
          />
        ) : (
          <User size={20} />
        )}
      </div>
    </button>

    {/* Queue Number - MOVED OUTSIDE appointment-details */}
    <div className="queue-number">#{appointment.queueNumber}</div>

    {/* Patient Details */}
    <div className="appointment-details">
      <div className="appointment-name">
        {appointment.name}
        {appointment.age && (
          <span className="appointment-age"> (Age: {appointment.age})</span>
        )}
      </div>
      <div className="appointment-type">{appointment.type}</div>
      <div className="appointment-doctor">{appointment.doctor}</div>
    </div>

    {/* Meta Info with inline date/time */}
    <div className="appointment-meta">
      <div className="appointment-time">{appointment.time}</div>
      <div className="appointment-date-display">
        {(() => {
          const [year, month, day] = appointment.date.split('-');
          const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
          return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        })()}
      </div>
    </div>

    {/* Tags */}
    <div className="appointment-tags">
      <div className={`appointment-status status-${appointment.status}`}>
        {appointment.status}
      </div>
      <div className={`appointment-priority ${getPriorityColor(appointment.priority)}`}>
        {getPriorityIcon(appointment.priority)} {appointment.priority}
      </div>
    </div>

    {/* Actions */}
    <div className="appointment-actions">
      <button
        className="action-btn view-btn"
        onClick={() => {
          setSelectedAppointment(appointment);
          setShowDetailsModal(true);
        }}
        aria-label={`View details for ${appointment.name}`}
        title={`View details for ${appointment.name}`}
      >
        <Eye size={16} />
      </button>
      <button
        className="action-btn edit-btn"
        onClick={() => handleReschedule(appointment)}
        aria-label={`Reschedule appointment for ${appointment.name}`}
        title={`Reschedule appointment for ${appointment.name}`}
      >
        <Edit size={16} />
      </button>
      <button
        className="action-btn cancel-btn"
        onClick={() => {
          setSelectedAppointment(appointment);
          setShowCancelModal(true);
        }}
        aria-label={`Cancel appointment for ${appointment.name}`}
        title={`Cancel appointment for ${appointment.name}`}
      >
        <Trash2 size={16} />
      </button>
    </div>
  </div>
))
        )}
      </div>
    </section>
  </div>

 {/* Right Column - Current Queue */}
<section className="queue-section">
  <div className="section-header">
    <div className="section-title">
      <Clock size={20} />
      Current Queue
    </div>
    <div className="section-subtitle">
      Real-time queue status - All appointments for today
    </div>
  </div>
  {/* Now Serving */}
  <div className="queue-summary">
    <span className="serving-label">Now Serving</span>
    <span className="serving-number">
      #{currentPatient?.queueNumber || 'None'}
    </span>
  </div>
  {/* Next Patient */}
  {nextPatient && (
    <div className="queue-summary next-patient">
      <span className="serving-label">Up Next</span>
      <span className="serving-number">#{nextPatient.queueNumber}</span>
    </div>
  )}
  {/* Queue List */}
  <div className="queue-list">
    <div className="queue-header">
      <span>Queue showing all appointments</span>
    </div>
    {queue.length > 0 ? (
      queue.map((patient) => {
        // ✅ Calculate wait time for each patient
        const calculateWaitTime = () => {
          if (patient.status === 'confirmed') {
            return 'Being Served';
          }

          const now = new Date();
          const currentTime = now.getHours() * 60 + now.getMinutes();

          // Parse appointment time
          const [time, period] = patient.time.split(' ');
          let [hours, minutes] = time.split(':').map(Number);

          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;

          const appointmentTimeInMinutes = hours * 60 + minutes;
          const waitMinutes = Math.max(0, appointmentTimeInMinutes - currentTime);

          if (waitMinutes >= 60) {
            const hrs = Math.floor(waitMinutes / 60);
            const mins = waitMinutes % 60;
            return `Wait: ${hrs}h ${mins}min`;
          }
          return `Wait: ${waitMinutes}min`;
        };

        return (
          <div
            key={patient.id}
            className={`queue-card 
              status-${(patient.status || '').toLowerCase()} 
              priority-${(patient.priority || '').toLowerCase()} 
              ${patient.priority === 'emergency' ? 'emergency-blinking' : ''}`}
          >
            {/* Top Row */}
            <div className="queue-top">
              <span className="queue-number">#{patient.queueNumber}</span>
              <div className="queue-time">
                <div className="appointment-time">{patient.time}</div>
                <div className="appointment-date">
                  {(() => {
                    const [year, month, day] = patient.date.split('-');
                    const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
                    return dateObj.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });
                  })()}
                </div>
              </div>
            </div>
            {/* Middle */}
            <div className="queue-body">
              <div className="booking-status-row">
                {/* Status Pill */}
                <span
                  className={`status-pill ${patient.status?.toLowerCase() || ''}`}
                >
                  {patient.status}
                </span>
                {/* Priority Pill */}
                <span
                  className={`priority-pill ${patient.priority?.toLowerCase() || ''}`}
                >
                  {patient.priority === 'emergency' && '🚨 Emergency'}
                  {patient.priority === 'urgent' && '⚠️ Urgent'}
                  {patient.priority === 'normal' && 'Normal'}
                </span>
              </div>

              {/* ✅ NEW: Wait Time Display */}
              <div className="queue-wait-time">
                <Clock size={14} aria-hidden="true" />
                <span>{calculateWaitTime()}</span>
              </div>
            </div>
          </div>
        );
      })
    ) : (
      <div className="empty-queue">
        <p>No patients in queue for today</p>
      </div>
    )}
  </div>
</section>
</div>
{/* ✅ Close main-content div here */}
{/* Cancel Appointment Modal */}
{showCancelModal && selectedAppointment && (
  <div 
    className="modal-overlay" 
    onClick={() => {
      setShowCancelModal(false);
      setCancelReason('');
      setSelectedAppointment(null);
    }}
  >
    <div
      className="modal-content cancel-modal"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="modal-header">
        <h3>Cancel Appointment</h3>
        <button
          className="modal-close"
          onClick={() => {
            setShowCancelModal(false);
            setCancelReason('');
            setSelectedAppointment(null);
          }}
          aria-label="Close cancel modal"
          title="Close cancel modal"
        >
          <XCircle size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="cancel-modal-content">
        <div className="cancel-warning">
          <AlertTriangle size={48} className="warning-icon" />
          <h4>Are you sure you want to cancel this appointment?</h4>
          <p>This action cannot be undone.</p>
        </div>

        <div className="cancel-appointment-details">
          <p><strong>Patient:</strong> {selectedAppointment.name}</p>
          <p><strong>Doctor:</strong> {selectedAppointment.doctor}</p>
          <p><strong>Date:</strong> {selectedAppointment.date}</p>
          <p><strong>Time:</strong> {selectedAppointment.time}</p>
        </div>

        <div className="form-group">
          <label htmlFor="cancelReason">
            Reason for cancellation *
          </label>
          <textarea
            id="cancelReason"
            className="cancel-reason-input"
            placeholder="Please provide a reason for cancelling this appointment..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={4}
            required
          />
        </div>

        {/* Actions */}
        <div className="cancel-modal-actions">
          <button
            className="btn-secondary"
            onClick={() => {
              setShowCancelModal(false);
              setCancelReason('');
              setSelectedAppointment(null);
            }}
            disabled={isSendingCancellation}
          >
            No, Keep Appointment
          </button>
          <button
            className="btn-danger"
            onClick={() => {
              if (cancelReason.trim()) {
                handleCancelAppointment(selectedAppointment.id, cancelReason);
              } else {
                addNotification('error', 'Please provide a reason for cancellation');
              }
            }}
            disabled={!cancelReason.trim() || isSendingCancellation}
          >
            {isSendingCancellation ? (
              <>
                <div className="button-spinner"></div>
                Cancelling...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Yes, Cancel Appointment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* ===== CALENDAR VIEW MODAL (3-Step Wizard - Full Update) ===== */}
{showCalendarView && (
  <div
    className="modal-overlay"
    onClick={() => {
      setShowCalendarView(false);
      setCalendarWizardStep(1);
      setSelectedCalendarDate('');
      setSelectedCalendarDoctor(null);
    }}
  >
    <div
      className="calendar-modal calendar-wizard"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ===== HEADER ===== */}
      <div className="calendar-header">
        <div className="calendar-title-section">
          <h2>
            {calendarWizardStep === 1 && 'Select Date'}
            {calendarWizardStep === 2 && 'Choose Doctor'}
            {calendarWizardStep === 3 && 'Pick Time Slot'}
          </h2>
          <p>
            {calendarWizardStep === 1 &&
              'View appointment availability and select a date'}
            {calendarWizardStep === 2 && 'Select your preferred doctor'}
            {calendarWizardStep === 3 &&
              selectedCalendarDoctor &&
              `Available slots for ${selectedCalendarDoctor?.name} on ${selectedCalendarDate}`}
          </p>
        </div>

        <button
          className="modal-close"
          onClick={() => {
            setShowCalendarView(false);
            setCalendarWizardStep(1);
            setSelectedCalendarDate('');
            setSelectedCalendarDoctor(null);
          }}
          aria-label="Close calendar wizard"
          title="Close calendar wizard"
        >
          <XCircle size={20} />
        </button>
      </div>

      {/* ===== STEP PROGRESS BAR ===== */}
      <div className="wizard-progress">
        <div
          className={`progress-step ${calendarWizardStep >= 1 ? 'active' : ''} ${
            calendarWizardStep > 1 ? 'completed' : ''
          }`}
        >
          <div className="step-number">1</div>
          <div className="step-label">Date</div>
        </div>
        <div className="progress-line"></div>
        <div
          className={`progress-step ${calendarWizardStep >= 2 ? 'active' : ''} ${
            calendarWizardStep > 2 ? 'completed' : ''
          }`}
        >
          <div className="step-number">2</div>
          <div className="step-label">Doctor</div>
        </div>
        <div className="progress-line"></div>
        <div className={`progress-step ${calendarWizardStep >= 3 ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">Time</div>
        </div>
      </div>

      {/* ===== WIZARD CONTENT ===== */}
      <div className={`wizard-content wizard-step-${calendarWizardStep}`}>

{/* === STEP 1: CALENDAR GRID === */}
        <div className="wizard-step step-calendar">
          <div className="calendar-navigation">
            <button
              className="nav-btn"
              onClick={() => navigateMonth('prev')}
              aria-label="Previous month"
            >
              <ChevronLeft size={20} />
            </button>
            
            <h3 className="month-title">{getMonthName(calendarCurrentDate)}</h3>
            
            <button
              className="nav-btn"
              onClick={() => navigateMonth('next')}
              aria-label="Next month"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="weekday-label">
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-grid-wizard">
            {calendarDays.map((day) => {
              const isPast = new Date(day.date) < new Date(getTodayDate());
              const isToday = day.date === getTodayDate();

              return (
                <button
                  key={day.date}
                  className={`calendar-date-cell ${
                    isPast ? 'past-date' : ''
                  } ${isToday ? 'today' : ''} ${getAvailabilityColor(
                    day.appointments.booked,
                    day.appointments.total
                  )}`}
                  onClick={() => {
                    if (!isPast && day.appointments.total > 0) {
                      setSelectedCalendarDate(day.date);
                      setCalendarWizardStep(2);
                    }
                  }}
                  disabled={isPast || day.appointments.total === 0}
                >
                  <div className="date-number">{day.dayNumber}</div>
                  <div className="date-availability">
                    {day.appointments.total > 0 ? (
                      <span className="availability-text">
                        {day.appointments.booked}/{day.appointments.total}
                      </span>
                    ) : (
                      <span className="no-slots">No slots</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
{/* === STEP 2: DOCTOR SELECTION (UPDATED WITH ACCURATE SLOT COUNTER) === */}
<div className="wizard-step step-doctors">
  <button
    className="wizard-back-btn"
    onClick={() => {
      setCalendarWizardStep(1);
      setSelectedCalendarDate('');
    }}
  >
    <ChevronLeft size={20} />
    Back to Calendar
  </button>

  <div className="selected-date-display">
  <Calendar size={16} />
  <span>
    Selected Date: {(() => {
      const [year, month, day] = selectedCalendarDate.split('-');
      const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    })()}
  </span>
</div>

  <div className="doctors-grid-wizard">
    {doctors
      .filter(doctor => {
        // Check if doctor is manually marked unavailable by staff
        const manuallyUnavailable = doctorAvailability.find(
          entry =>
            entry.doctorId === doctor.id &&
            entry.date === selectedCalendarDate &&
            entry.available === false
        );
        if (manuallyUnavailable) return false;

        // Calculate available slots
        const bookedCount = appointments.filter(
          apt =>
            apt.doctorId === doctor.id &&
            apt.date === selectedCalendarDate &&
            apt.status !== 'cancelled'
        ).length;

        // Get max slots for this doctor on this date
        const customSlotKey = `${doctor.id}_${selectedCalendarDate}`;
        const maxSlots = doctorSlotSettings[customSlotKey] || calculateDoctorDailySlots(doctor);

        // Show doctor if they have available slots
        return bookedCount < maxSlots;
      })
      .map((doctor: DoctorWithPhoto) => {
        // Calculate booked slots for this doctor on selected date
        const bookedCount = appointments.filter(
          apt =>
            apt.doctorId === doctor.id &&
            apt.date === selectedCalendarDate &&
            apt.status !== 'cancelled'
        ).length;

        // Get max slots (either custom from staff or calculated)
        const customSlotKey = `${doctor.id}_${selectedCalendarDate}`;
        const maxSlots = doctorSlotSettings[customSlotKey] || calculateDoctorDailySlots(doctor);
        
        // Calculate available slots
        const availableSlots = maxSlots - bookedCount;

        return (
          <button
            key={doctor.id}
            className="doctor-card-wizard"
            onClick={() => {
              setSelectedCalendarDoctor(doctor);
              setFormData(prev => ({
                ...prev,
                date: selectedCalendarDate,
                doctor: doctor.id
              }));
              setCalendarWizardStep(3);
            }}
            aria-label={`Select ${doctor.name}`}
          >
            <div className="doctor-avatar-wizard">
              {doctor?.photo ? (
                <img
                  src={doctor.photo}
                  alt={doctor.name}
                  className="doctor-avatar-image"
                />
              ) : (
                <User size={32} />
              )}
            </div>
            <div className="doctor-info-wizard">
              <h4 className="doctor-name">{doctor.name}</h4>
              <p className="doctor-specialty">
                {doctor?.specialty || 'General Practitioner'}
              </p>
              <p className="doctor-availability-count">
                {availableSlots}/{maxSlots} slots available
              </p>
            </div>
            <ChevronRight size={20} className="doctor-arrow" />
          </button>
        );
      })}
  </div>

  {doctors.filter(doctor => {
    const manuallyUnavailable = doctorAvailability.find(
      entry =>
        entry.doctorId === doctor.id &&
        entry.date === selectedCalendarDate &&
        entry.available === false
    );
    if (manuallyUnavailable) return false;

    const bookedCount = appointments.filter(
      apt =>
        apt.doctorId === doctor.id &&
        apt.date === selectedCalendarDate &&
        apt.status !== 'cancelled'
    ).length;

    const customSlotKey = `${doctor.id}_${selectedCalendarDate}`;
    const maxSlots = doctorSlotSettings[customSlotKey] || calculateDoctorDailySlots(doctor);

    return bookedCount < maxSlots;
  }).length === 0 && (
    <div className="no-doctors-available">
      <Users size={48} />
      <p>No doctors available on {selectedCalendarDate}</p>
      <div className="no-doctors-suggestions">
        <p>All doctors may be fully booked or manually marked unavailable on this date.</p>
        <button
          className="btn-secondary"
          onClick={() => {
            setCalendarWizardStep(1);
            setSelectedCalendarDate('');
          }}
        >
          Choose Another Date
        </button>
      </div>
    </div>
  )}
</div>

       {/* === STEP 3: TIME SLOT SELECTION === */}
<div className="wizard-step step-timeslots">
  <button
    className="wizard-back-btn"
    onClick={() => {
      setCalendarWizardStep(2);
      setSelectedCalendarDoctor(null);
      setFormData(prev => ({
        ...prev,
        doctor: '',
        time: ''
      }));
    }}
  >
    <ChevronLeft size={20} />
    Back to Doctors
  </button>

  {selectedCalendarDoctor && (
    <>
      <div className="selected-doctor-info">
        <div className="doctor-avatar-small">
          {selectedCalendarDoctor?.photo ? (
            <img
              src={selectedCalendarDoctor.photo}
              alt={selectedCalendarDoctor.name}
              className="doctor-avatar-image-small"
            />
          ) : (
            <User size={24} />
          )}
        </div>
        <div>
          <h4>{selectedCalendarDoctor.name}</h4>
          <p>{selectedCalendarDoctor?.specialty || 'General Practitioner'}</p>
          <p className="working-hours-info">
            Hours: {selectedCalendarDoctor.workingHours.start} - {selectedCalendarDoctor.workingHours.end}
          </p>
        </div>
      </div>

      <div className="timeslots-grid-wizard">
        {(() => {
          const slots = generateTimeSlots();

          if (slots.length === 0) {
            return (
              <div className="no-slots-available">
                <Clock size={48} />
                <p>
                  No time slots available for {selectedCalendarDoctor.name} on{' '}
                  {selectedCalendarDate}
                </p>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setCalendarWizardStep(2);
                    setSelectedCalendarDoctor(null);
                    setFormData(prev => ({
                      ...prev,
                      doctor: '',
                      time: ''
                    }));
                  }}
                >
                  Choose Another Doctor
                </button>
              </div>
            );
          }

          // ✅ FILTER OUT EMERGENCY BUFFER SLOTS - ONLY SHOW REGULAR 30-MIN SLOTS
          const regularSlotsOnly = slots.filter(slot => !slot.emergency);

          return regularSlotsOnly.map((slot) => (
            <button
              key={slot.time}
              className={`timeslot-btn-wizard ${
                !slot.available ? 'booked' : ''
              }`}
              onClick={() => {
                if (slot.available) {
                  setFormData((prev) => ({
                    ...prev,
                    date: selectedCalendarDate,
                    time: slot.time,
                    doctor: selectedCalendarDoctor.id,
                  }));
                  setShowCalendarView(false);
                  setShowBookingForm(true);
                  setCalendarWizardStep(1);
                  setSelectedCalendarDate('');
                  setSelectedCalendarDoctor(null);
                }
              }}
              disabled={!slot.available}
              aria-label={`${slot.time} - ${slot.available ? 'Available' : 'Booked'}`}
            >
              <Clock size={16} />
              <span className="timeslot-time">{slot.time}</span>
              {!slot.available && (
                <span className="booked-badge">Booked</span>
              )}
            </button>
          ));
        })()}
      </div>
    </>
  )}
</div>
      </div>
    </div>
  </div>
)}


{/* Profile Modal */}
{showProfileModal && userProfile && (
  <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
    <div
      className="modal-content profile-modal"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="modal-header">
        <h3>User Profile</h3>
        <button
          className="modal-close"
          onClick={() => setShowProfileModal(false)}
          aria-label="Close profile"
          title="Close profile"
        >
          <XCircle size={20} />
        </button>
      </div>

      {/* Profile Top Section */}
      <div className="profile-top">
        <div className="profile-avatar-large">
          {userProfile.photo ? (
            <img
              src={userProfile.photo}
              alt={userProfile.name}
              className="profile-image"
            />
          ) : (
            <User size={48} />
          )}
        </div>
        <div className="profile-basic-info">
          <h4 className="profile-name">{userProfile.name}</h4>
          <p className="profile-email">{userProfile.email}</p>
        </div>
      </div>

      {/* Options */}
      <div className="profile-options">
        {/* Change Photo */}
        <div className="photo-upload">
          <input
            type="file"
            id="profilePhoto"
            accept="image/*"
            onChange={handleProfilePhotoUpload}
            className="photo-input"
          />
          <label htmlFor="profilePhoto" className="option-item">
            <Camera size={16} />
            <span>Change Photo</span>
          </label>
        </div>

        {/* Dark/Light Mode Toggle */}
        <button
          className="option-item"
          onClick={toggleDarkMode}
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
        </button>

        {/* Logout */}
        <button
          className="option-item logout-option"
          onClick={handleLogout}
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  </div>
)}
{/* Booking Form Modal */}
{showBookingForm && (
  <div className="modal-overlay" onClick={() => setShowBookingForm(false)}>
    <div
      className="modal-content booking-modal"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-labelledby="modal-title"
      aria-modal="true"
    >
      <div className="modal-header">
        <h3 id="modal-title">
          {editingAppointment
            ? "Reschedule Appointment"
            : "Book New Appointment"}
        </h3>
        <button
          className="modal-close"
          onClick={() => {
            setShowBookingForm(false);
            setEditingAppointment(null);
          }}
          aria-label="Close booking form"
          title="Close booking form"
        >
          <XCircle size={20} />
        </button>
      </div>

      <div className="booking-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="fullName">Full Name *</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              placeholder="Enter full name"
              value={formData.fullName}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="age">Age *</label>
            <input
              type="number"
              id="age"
              name="age"
              placeholder="Age"
              min="0"
              max="150"
              value={formData.age}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        {/* Photo Upload Section */}
        <div className="form-group">
          <label htmlFor="photo">Upload Photo (Optional)</label>
          <div
            className={`photo-upload-modern ${isDragOver ? "drag-over" : ""}`}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              handlePhotoDrop(e);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
          >
            <input
              type="file"
              id="photo"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="photo-input"
            />

            {!formData.photo ? (
              <label htmlFor="photo" className="photo-upload-box">
                <div className="upload-icon">
                  <Camera size={32} strokeWidth={1.5} />
                </div>
                <div className="upload-text">
                  <span className="upload-title">Click to upload</span>
                  <span className="upload-subtitle">or drag and drop</span>
                </div>
                <div className="upload-hint">PNG, JPG up to 5MB</div>
              </label>
            ) : (
              <div className="photo-preview-box">
                <img
                  src={formData.photo}
                  alt="Preview"
                  className="photo-preview-large"
                />
                <button
                  type="button"
                  className="remove-photo-btn-modern"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, photo: "" }))
                  }
                  aria-label="Remove photo"
                >
                  <X size={18} />
                </button>
                <label htmlFor="photo" className="change-photo-btn">
                  <Camera size={16} />
                  Change Photo
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
  <label htmlFor="doctor">Doctor *</label>
  <select
    id="doctor"
    name="doctor"
    value={formData.doctor}
    onChange={handleFormChange}
    required
  >
    <option value="">Select doctor</option>
    {doctors
      .filter((doc) => {
        // Filter out doctors who are not generally available
        if (!doc.available) return false;
        
        // If date is selected, check date-specific availability
        if (formData.date) {
          const availability = doctorAvailability.find(
            av => av.doctorId === doc.id && av.date === formData.date
          );
          // If there's a specific availability record for this date, use it
          // If available is explicitly set to false, exclude the doctor
          if (availability && availability.available === false) {
            return false;
          }
        }
        
        return true;
      })
      .map((doc) => (
        <option key={doc.id} value={doc.id}>
          {doc.name} - {doc.specialty}
        </option>
      ))}
  </select>
          {formData.date &&
            doctors.some(
              (doc) =>
                doc.available &&
                !isDoctorAvailableOnDate(doc.id, formData.date)
            ) && (
              <small className="form-hint">
                Some doctors are not available on {formData.date}.
              </small>
            )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="date">Appointment Date *</label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              min={new Date().toISOString().split("T")[0]}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="priority">Priority Level</label>
            <select
              id="priority"
              name="priority"
              value={formData.priority}
              onChange={handleInputChange}
            >
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="gender">Gender</label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
{/* ✅ Time Slots Section with Doctor Availability Warnings */}
{formData.date && formData.doctor && (() => {
  const isDoctorAvailable = isDoctorAvailableOnDate(formData.doctor, formData.date);
  const isFullyBooked = isDailyLimitReached(formData.doctor, formData.date);

  // ✅ If doctor is unavailable, show warning
  if (!isDoctorAvailable) {
    return (
      <div className="time-slots-section">
        <label>Available Time Slots *</label>
        <div className="doctor-unavailable-warning">
          <AlertTriangle size={24} />
          <p><strong>Doctor Not Available</strong></p>
          <p>This doctor is not available on {formData.date}.</p>
          <p className="sub-message">Please select another doctor or date.</p>
        </div>
      </div>
    );
  }

  // ✅ If doctor is fully booked, show warning WITH BUTTON
  if (isFullyBooked && !editingAppointment) {
    return (
      <div className="time-slots-section">
        <label>Available Time Slots *</label>
        <div className="doctor-fully-booked-warning">
          <XCircle size={24} />
          <p><strong>Doctor Fully Booked</strong></p>
          <p>This doctor has reached maximum appointments on {formData.date}.</p>
          <p className="sub-message">Would you like to join the waiting list?</p>
          
         {/* ✅ UPDATED WAITING LIST SECTION WITH VALIDATION */}
<div className="waiting-list-actions">
  <button
    type="button"
    className="btn-secondary"
    onClick={() => setShowBookingForm(false)}
  >
    Choose Another Doctor/Date
  </button>
  <button
    type="button"
    className="btn-primary"
    disabled={
      !formData.fullName ||
      !formData.age ||
      !formData.email ||
      !formData.phone ||
      !formData.gender ||
      !formData.condition ||
      (formData.condition === 'custom' && !formData.customCondition) ||
      !formData.doctor ||
      !formData.date ||
      !/^\+63\d{10}$/.test(formData.phone)
    }
    onClick={async () => {
      // Validate required fields before adding to waiting list
      if (!formData.fullName || !formData.age || !formData.email || 
          !formData.phone || !formData.gender || !formData.condition ||
          (formData.condition === 'custom' && !formData.customCondition) ||
          !formData.doctor || !formData.date) {
        addNotification('error', 'Please fill in all required fields before joining the waiting list');
        return;
      }

      // Validate phone number format
      if (!/^\+63\d{10}$/.test(formData.phone)) {
        addNotification('error', 'Please enter a valid Philippine phone number (+63XXXXXXXXXX)');
        return;
      }

      try {
        const selectedDoctorInfo = doctors.find(doc => doc.id === formData.doctor);
        
        await addDoc(collection(db, 'waitingList'), {
          patientName: formData.fullName,
          patientEmail: formData.email,
          patientPhone: formData.phone,
          preferredDoctorId: formData.doctor,
          preferredDoctorName: selectedDoctorInfo?.name || '',
          preferredDate: formData.date,
          priority: formData.priority,
          addedAt: serverTimestamp(),
          originalAppointmentData: {
            name: formData.fullName,
            age: formData.age,
            email: formData.email,
            phone: formData.phone,
            gender: formData.gender,
            type: formData.condition === 'custom' ? formData.customCondition : formData.condition,
            photo: formData.photo,
            notes: ''
          }
        });

        addNotification('success', `You've been added to the waiting list for ${selectedDoctorInfo?.name}. We'll notify you when a slot opens.`);
        setShowBookingForm(false);
        setFormData({
          fullName: '',
          age: '',
          date: '',
          time: '',
          condition: '',
          customCondition: '',
          priority: 'normal',
          email: '',
          phone: '',
          doctor: '',
          photo: '',
          gender: ''
        });
      } catch (error) {
        console.error('Error adding to waiting list:', error);
        addNotification('error', 'Failed to add to waiting list');
      }
    }}
  >
    Join Waiting List
  </button>
</div>
        </div>
      </div>
    );
  }

  // ✅ Show time slots if doctor is available and not fully booked
  return (
    <div className="time-slots-section">
      <label>Available Time Slots *</label>
      {timeSlots.length === 0 ? (
        <div className="no-slots-message">
          No available time slots for this date. Please select another date.
        </div>
      ) : (
        <div className="time-slots-grid">
          {timeSlots
            .filter((slot) =>
              formData.priority === "emergency" ? true : !slot.emergency
            )
            .map((slot) => {
              const slotKey = `${formData.doctor}_${formData.date}_${slot.time}`;
              const isBlocked = doctorAvailabilitySlots?.[slotKey] === false;

              return (
                <button
                  key={slot.time}
                  type="button"
                  className={`time-slot 
                    ${!slot.available ? "booked" : ""} 
                    ${isBlocked ? "blocked" : ""} 
                    ${slot.emergency ? "emergency-slot" : ""} 
                    ${formData.time === slot.time ? "selected" : ""}`}
                  onClick={() => {
                    if (!slot.available || isBlocked) return;
                    setFormData((prev) => ({
                      ...prev,
                      time: slot.time,
                    }));
                  }}
                  disabled={
                    !slot.available ||
                    isBlocked ||
                    (slot.emergency && formData.priority !== "emergency")
                  }
                  aria-label={`${slot.time} ${
                    isBlocked
                      ? "Blocked"
                      : slot.available
                      ? "available"
                      : "booked"
                  }`}
                  title={
                    isBlocked
                      ? "Unavailable – set by staff"
                      : slot.emergency
                      ? "Emergency Only"
                      : `${slot.time} ${
                          slot.available ? "available" : "booked"
                        }`
                  }
                >
                  {slot.time}
                  {isBlocked && (
                    <span className="blocked-indicator">Blocked</span>
                  )}
                  {slot.emergency && (
                    <span className="emergency-badge">
                      Emergency Only
                    </span>
                  )}
                  {!slot.available && !slot.emergency && !isBlocked && (
                    <span className="booked-indicator">Booked</span>
                  )}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
})()}
        {!formData.date && !formData.doctor && (
          <div className="form-hint-box">
            Please select a doctor and date to view available time slots.
          </div>
        )}

        <div className="form-group">
          <label htmlFor="condition">Medical Condition *</label>
          <select
            id="condition"
            name="condition"
            value={formData.condition}
            onChange={handleInputChange}
            required
          >
            <option value="">Select condition</option>
            <option value="Myopia (Nearsightedness)">
              Myopia (Nearsightedness)
            </option>
            <option value="Hyperopia (Farsightedness)">
              Hyperopia (Farsightedness)
            </option>
            <option value="Astigmatism">Astigmatism</option>
            <option value="Presbyopia">Presbyopia</option>
            <option value="Cataracts">Cataracts</option>
            <option value="Glaucoma">Glaucoma</option>
            <option value="Macular Degeneration">
              Macular Degeneration
            </option>
            <option value="Diabetic Retinopathy">
              Diabetic Retinopathy
            </option>
            <option value="Amblyopia (Lazy Eye)">
              Amblyopia (Lazy Eye)
            </option>
            <option value="Conjunctivitis (Pink Eye)">
              Conjunctivitis (Pink Eye)
            </option>
            <option value="custom">Other (Specify)</option>
          </select>
        </div>

        {formData.condition === "custom" && (
          <div className="form-group">
            <label htmlFor="customCondition">
              Please specify your condition *
            </label>
            <input
              type="text"
              id="customCondition"
              name="customCondition"
              placeholder="Describe your condition"
              value={formData.customCondition}
              onChange={handleInputChange}
              required
            />
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="phone">Phone *</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              placeholder="+63XXXXXXXXXX"
              value={formData.phone}
              onChange={(e) => {
                let value = e.target.value.replace(/[^0-9+]/g, "");
                if (!value.startsWith("+63")) value = "+63";
                setFormData((prev) => ({ ...prev, phone: value }));
              }}
              pattern="^\\+63\\d{10}$"
              maxLength={13}
              required
            />
            <small className="form-hint">
              Must be a valid PH number (e.g. +639123456789)
            </small>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setShowBookingForm(false);
              setEditingAppointment(null);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={
              !formData.fullName ||
              !formData.age ||
              !formData.date ||
              !formData.time ||
              !formData.doctor ||
              !formData.condition ||
              !/^\+63\d{10}$/.test(formData.phone)
            }
          >
            {editingAppointment ? "Update Appointment" : "Book Appointment"}
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{/* Appointment Details Modal */}
{showDetailsModal && (selectedAppointment || selectedProfile) && (
  <div
    className="modal-overlay"
    onClick={() => {
      setShowDetailsModal(false);
      setSelectedProfile(null);
    }}
  >
    <div
      className="modal-content details-modal"
      onClick={e => e.stopPropagation()}
    >
      <div className="modal-header">
        <h3>Appointment Details</h3>
        <button
          className="modal-close"
          onClick={() => {
            setShowDetailsModal(false);
            setSelectedProfile(null);
          }}
          aria-label="Close appointment details"
          title="Close appointment details"
        >
          <XCircle size={20} />
        </button>
      </div>
<div className="details-content">
  {/* Header with Photo */}
  <div className="detail-header">
    <div className="detail-photo">
      {(selectedAppointment || selectedProfile)?.photo ? (
        <img
          src={(selectedAppointment || selectedProfile)!.photo}
          alt={(selectedAppointment || selectedProfile)!.name}
        />
      ) : (
        <div className="detail-photo-placeholder">
          {(selectedAppointment || selectedProfile)!.name.charAt(0)}
        </div>
      )}
    </div>
    <h2 className="detail-title">Appointment Details</h2>
  </div>

  {/* Queue Number */}
  <div className="detail-queue-container">
    <span className="detail-queue-number">
      Queue #{(selectedAppointment || selectedProfile)!.queueNumber}
    </span>
  </div>

  {/* Details Grid */}
 <div className="detail-grid">
  <span className="detail-label">Patient Name</span>
  <span className="detail-value">
    {(selectedAppointment || selectedProfile)!.name}
  </span>

  <span className="detail-label">Age</span>
  <span className="detail-value">
    {(selectedAppointment || selectedProfile)!.age || "Not specified"}
  </span>

  <span className="detail-label">Appointment Type</span>
  <span className="detail-value">
    {(selectedAppointment || selectedProfile)!.type}
  </span>

  <span className="detail-label">Doctor</span>
  <span className="detail-value">
    {(selectedAppointment || selectedProfile)!.doctor}
  </span>

  <span className="detail-label">Date & Time</span>
  <span className="detail-value">
    {(() => {
      const apt = selectedAppointment || selectedProfile;
      if (!apt) return "";
      const [year, month, day] = apt.date.split("-");
      const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return `${formattedDate} at ${apt.time}`;
    })()}
  </span>

  <span className="detail-label">Email</span>
  <span className="detail-value">
    {(selectedAppointment || selectedProfile)!.email}
  </span>

  <span className="detail-label">Gender</span>
  <span className="detail-value">
    {(selectedAppointment || selectedProfile)!.gender || "Not specified"}
  </span>

  <span className="detail-label">Priority</span>
  <span className="detail-value">
    <span
      className={`detail-priority priority-${
        (selectedAppointment || selectedProfile)!.priority
      }`}
    >
      {(selectedAppointment || selectedProfile)!.priority}
    </span>
  </span>

  <span className="detail-label">Status</span>
  <span className="detail-value">
    <span
      className={`detail-status status-${
        (selectedAppointment || selectedProfile)!.status
      }`}
    >
      {(selectedAppointment || selectedProfile)!.status}
    </span>
  </span>
</div>

  {/* Actions */}
  <div className="detail-actions">
    <button
      className="detail-action-btn primary"
      onClick={() => {
        const appointment = selectedAppointment || selectedProfile;
        if (appointment) {
          setShowDetailsModal(false);
          setSelectedProfile(null);
          handleReschedule(appointment);
        }
      }}
    >
      <Edit size={16} /> Reschedule
    </button>
    <button
      className="detail-action-btn danger"
      onClick={() => {
        const appointment = selectedAppointment || selectedProfile;
        if (appointment) {
          setShowDetailsModal(false);
          setSelectedProfile(null);
          setSelectedAppointment(appointment);
          setShowCancelModal(true);
        }
      }}
    >
      <Trash2 size={16} /> Cancel Appointment
    </button>
  </div>
</div>

    </div>
  </div>
)}

    </div>
  );
};

export default PatientDashboard;