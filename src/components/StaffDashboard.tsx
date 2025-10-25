import { useState, useEffect, useRef } from 'react';
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
  X,
  LogOut,
  Phone,
  Mail,
  Send,
  UserPlus,
  Stethoscope,
  Save,
  Badge,
  MessageSquare,
  CheckCircle,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
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
  setDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import '../styles/staffdashboard.css';
import '../styles/reports.css';

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

interface TimeSlotSimple {
  time: string;
  available: boolean;
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


const StaffDashboard = () => {
  // UI State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
 const [showLogoutModal, setShowLogoutModal] = useState(false);



  const profileDropdownRef = useRef<HTMLDivElement | null>(null);


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
  photo: '',                
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
  const [doctorAvailabilitySlots, setDoctorAvailabilitySlots] = useState<{[key: string]: boolean}>({});
  



// Close profile dropdown when clicking outside
useEffect(() => {
  const handleOutsideClick = (e: MouseEvent) => {
    if (!profileDropdownRef.current) return;
    // If click is outside the dropdown wrapper, close it
    if (showProfileDropdown && !profileDropdownRef.current.contains(e.target as Node)) {
      setShowProfileDropdown(false);
    }
  };
  document.addEventListener('mousedown', handleOutsideClick);
  return () => document.removeEventListener('mousedown', handleOutsideClick);
}, [showProfileDropdown]);

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
  
useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        // Fetch user profile from Firestore (removed unused userDocRef)
        const userQuery = query(collection(db, 'users'), where('uid', '==', user.uid));
        const userDocSnap = await getDocs(userQuery);

        if (!userDocSnap.empty) {
          const userData = userDocSnap.docs[0].data();

          const staffData: StaffUser = {
            id: userDocSnap.docs[0].id,
            name: userData.name ?? user.displayName ?? 'Staff User',
            email: userData.email ?? user.email ?? '',
            role: userData.role ?? 'staff',
            phone: userData.phone ?? '',
            department: userData.department ?? 'General',
            photo: (userData.photo ?? user.photoURL ?? '') as string,
            uid: user.uid,
            permissions: userData.permissions ?? [
              'view_appointments',
              'manage_appointments',
              'view_doctors',
              'manage_doctors',
            ],
          };

          setStaffProfile(staffData);
          setProfileForm({
            name: staffData.name,
            email: staffData.email,
            phone: staffData.phone,
            department: staffData.department,
            photo: staffData.photo ?? '', // Ã¢Å“â€¦ guaranteed string
          });
        } else {
          // If no user document exists, create a basic profile from auth
          const basicStaffData: StaffUser = {
            id: user.uid,
            name: user.displayName ?? 'Staff User',
            email: user.email ?? '',
            role: 'staff',
            phone: '',
            department: 'General',
            photo: (user.photoURL ?? '') as string,
            uid: user.uid,
            permissions: [
              'view_appointments',
              'manage_appointments',
              'view_doctors',
              'manage_doctors',
            ],
          };

          setStaffProfile(basicStaffData);
          setProfileForm({
            name: basicStaffData.name,
            email: basicStaffData.email,
            phone: basicStaffData.phone,
            department: basicStaffData.department,
            photo: basicStaffData.photo ?? '', // Ã¢Å“â€¦ guaranteed string
          });
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        addNotification('error', 'Failed to load user profile');
        setIsLoading(false);
      }
    } else {
      // No user logged in, redirect to login
      setIsLoading(false);
      addNotification('error', 'Please log in to access the dashboard');
      // Optional: navigate('/login');
    }
  });

  return () => unsubscribe();
}, []);

useEffect(() => {
  console.log('Doctors list updated:', doctors.length, 'doctors');
  doctors.forEach(doc => {
    console.log(`  - ${doc.name}: ${doc.workingHours?.start || 'NO START'} to ${doc.workingHours?.end || 'NO END'}`);
  });
}, [doctors]);

// Dynamic chart styling
useEffect(() => {
  // Weekly bar chart
  document.querySelectorAll('.bar[data-height-percentage]').forEach((bar) => {
    const percentage = bar.getAttribute('data-height-percentage');
    if (percentage) {
      (bar as HTMLElement).style.height = `${parseFloat(percentage) * 2}px`;
    }
  });

  // Condition bars
  document.querySelectorAll('.condition-bar[data-width-percentage]').forEach((bar) => {
    const percentage = bar.getAttribute('data-width-percentage');
    if (percentage) {
      (bar as HTMLElement).style.width = `${percentage}%`;
    }
  });

  // Monthly trend bars
  document.querySelectorAll('.line-chart-bar[data-height-percentage]').forEach((bar) => {
    const percentage = bar.getAttribute('data-height-percentage');
    if (percentage) {
      (bar as HTMLElement).style.height = `${parseFloat(percentage) * 1.5}px`;
    }
  });
}, [appointments, activeTab]); // Re-run when appointments change or tab switches

// Clear search term when switching tabs
useEffect(() => {
  setSearchTerm('');
}, [activeTab]);

  const [deleteConfirmDoctor, setDeleteConfirmDoctor] = useState<any | null>(null);
  const handleConfirmDelete = async (doctorId: string) => {
  try {
    await deleteDoc(doc(db, "doctors", doctorId));
    setDoctors((prev) => prev.filter((doc) => doc.id !== doctorId));
    addNotification("success", "Doctor deleted successfully");
  } catch (error) {
    console.error("Error deleting doctor:", error);
    addNotification("error", "Failed to delete doctor");
  } finally {
    setDeleteConfirmDoctor(null);
  }
};

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
  
 
// properly type the ref
const profileButtonRef = useRef<HTMLButtonElement | null>(null);

useEffect(() => {
  if (profileButtonRef.current) {
    profileButtonRef.current.setAttribute(
      "aria-expanded",
      showProfileDropdown ? "true" : "false"
    );
  }
}, [showProfileDropdown]);
// âœ… FIXED: Fetch Appointments - Ordered by Date ASC, Queue Number ASC
useEffect(() => {
  if (!staffProfile) return;
  const fetchAppointments = () => {
    try {
      const appointmentsQuery = query(
        collection(db, 'appointments'),
        orderBy('date', 'asc'),        // Oldest dates first
        orderBy('queueNumber', 'asc')  // Then by queue number
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

  // Fetch Doctor Availability Slots
  useEffect(() => {
    const fetchDoctorAvailabilitySlots = async () => {
      try {
        const slotsQuery = query(collection(db, 'doctorAvailabilitySlots'));
        const snapshot = await getDocs(slotsQuery);
        const slotsData: {[key: string]: boolean} = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const key = `${data.doctorId}_${data.date}_${data.time}`;
          slotsData[key] = data.available;
        });
        setDoctorAvailabilitySlots(slotsData);
      } catch (error) {
        console.error('Error fetching doctor availability slots:', error);
        addNotification('error', 'Failed to load time slot availability');
      }
    };
    fetchDoctorAvailabilitySlots();
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
 // Generate Time Slots - WITH EMERGENCY BUFFER, BLOCKED SLOT SUPPORT, AND LUNCH BREAK FILTER
const generateTimeSlots = (doctorId: string, date: string): TimeSlot[] => {
  if (!doctorId || !date) return [];

  const doctor = doctors.find(d => d.id === doctorId);
  if (!doctor) return [];

  const { start, end } = doctor.workingHours;
  
  // Parse 12-hour format (e.g., "9:00 AM")
  const parseTime12Hour = (timeStr: string): number => {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  };

  // 🚫 Helper function to check if time is lunch break (12:00 PM or 12:30 PM)
  const isLunchTime = (time12: string): boolean => {
    return time12 === '12:00 PM' || time12 === '12:30 PM';
  };

  const startTotalMinutes = parseTime12Hour(start);
  const endTotalMinutes = parseTime12Hour(end);

  // Get current date and time for filtering past slots
  const now = new Date();
  const selectedDate = new Date(date);
  const isToday = selectedDate.toDateString() === now.toDateString();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  // Add 30 minute buffer to current time (avoid booking too soon)
  const minimumBookingMinutes = isToday ? currentMinutes + 30 : 0;

  // Get ALL appointments for this doctor and date
  const existingAppointments = appointments.filter(
    apt =>
      apt.doctorId === doctorId &&
      apt.date === date &&
      apt.status !== 'cancelled'
  );

  console.log(`Generating slots for doctor ${doctorId} on ${date}`);
  console.log(` Is today: ${isToday}, Current time: ${now.toLocaleTimeString()}`);
  console.log(` Found ${existingAppointments.length} existing appointments`);
  console.log(` Current form priority: ${appointmentForm.priority}`);

  const slots: TimeSlot[] = [];
  const appointmentDuration = 30; // minutes per regular slot
  const bufferDuration = 15; // minutes of emergency buffer slot
  
  // Check if current form has emergency priority selected
  const isCreatingEmergency = appointmentForm.priority === 'emergency';

  for (let totalMinutes = startTotalMinutes; totalMinutes < endTotalMinutes; totalMinutes += appointmentDuration) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const time12 = convertTo12Hour(time24);

    // 🚫 Skip lunch time slots (12:00 PM and 12:30 PM)
    if (isLunchTime(time12)) {
      console.log(`⏰ Skipping lunch break: ${time12}`);
      continue;
    }

    // Skip past time slots if booking for today
    if (isToday && totalMinutes < minimumBookingMinutes) {
      console.log(`Skipping past slot: ${time12}`);
      continue;
    }

    // Check if this time slot is booked
    const appointment = existingAppointments.find(
      apt => apt.time === time12 && (editingAppointment ? apt.id !== editingAppointment.id : true)
    );
    const isBooked = !!appointment;

    // Check if staff manually marked this slot as unavailable
    const slotKey = `${doctorId}_${date}_${time12}`;
    const isBlocked = doctorAvailabilitySlots?.[slotKey] === false;

    // Add regular 30-minute slot
    slots.push({
      time: time12,
      available: !isBooked && !isBlocked,
      booked: isBooked,
      emergency: false
    });

    // Add emergency buffer slot (15-min) ONLY when emergency priority is selected
    if (isCreatingEmergency && !isBooked && !isBlocked) {
      const bufferStart = totalMinutes + appointmentDuration;
      
      // Make sure buffer doesn't exceed working hours
      if (bufferStart < endTotalMinutes) {
        const bufferHour = Math.floor(bufferStart / 60);
        const bufferMinute = bufferStart % 60;
        const bufferTime24 = `${bufferHour.toString().padStart(2, '0')}:${bufferMinute
          .toString()
          .padStart(2, '0')}`;
        const bufferTime12 = convertTo12Hour(bufferTime24);

        // 🚫 Skip lunch break buffer slots too
        if (isLunchTime(bufferTime12)) {
          console.log(`⏰ Skipping lunch break buffer: ${bufferTime12}`);
          // Don't add buffer duration here since we're skipping this slot
        } else if (isToday && bufferStart < minimumBookingMinutes) {
          // Skip past buffer slots if booking for today
          console.log(`Skipping past buffer slot: ${bufferTime12}`);
        } else {
          // Check if buffer slot is already booked or blocked
          const bufferAppointment = existingAppointments.find(
            apt => apt.time === bufferTime12 && (editingAppointment ? apt.id !== editingAppointment.id : true)
          );
          
          const isBufferBooked = !!bufferAppointment;
          const bufferKey = `${doctorId}_${date}_${bufferTime12}`;
          const isBufferBlocked = doctorAvailabilitySlots?.[bufferKey] === false;

          slots.push({
            time: bufferTime12,
            available: !isBufferBooked && !isBufferBlocked,
            booked: isBufferBooked,
            emergency: true
          });

          console.log(
            ` Added emergency buffer slot: ${bufferTime12} (${isBufferBooked ? 'booked' : isBufferBlocked ? 'blocked' : 'available'})`
          );
        }

        // Skip the next 15-minute increment to account for buffer
        totalMinutes += bufferDuration;
      }
    }
  }

  console.log(`Generated ${slots.length} total slots`);
  console.log(`Emergency mode: ${isCreatingEmergency ? 'ON - showing emergency buffer slots' : 'OFF'}`);

  return slots;
};

// === Calendar States ===
const [calendarCurrentDate, setCalendarCurrentDate] = useState(new Date());
const [showCalendarModal, setShowCalendarModal] = useState(false);
const [selectedCalendarDate, setSelectedCalendarDate] = useState("");

// === Calendar Navigation ===
const navigateMonth = (direction: "prev" | "next") => {
  setCalendarCurrentDate((prevDate) => {
    const newDate = new Date(prevDate);
    newDate.setMonth(prevDate.getMonth() + (direction === "next" ? 1 : -1));
    return newDate;
  });
};

const getMonthName = (date: Date) =>
  date.toLocaleString("default", { month: "long", year: "numeric" });

// Calendar Helper Functions Single Correct Versions

// Count filled appointment slots for a specific date
const getFilledSlotsForDate = (date: string): number => {
  return appointments.filter(
    (apt) => apt.date === date && apt.status !== "cancelled"
  ).length;
};

// === Calendar Days Generator ===
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
    const total = getTotalSlotsForDate(date); // Now shows actual calculated slots
    
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

// Ã¢Å“â€¦ Calculate how many appointment slots a doctor has based on working hours
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

// === Generate Doctor-Specific Time Slots ===
const generateTimeSlotsForDoctor = (doctor: Doctor, selectedDate: string): TimeSlotSimple[] => {
  const slots: TimeSlotSimple[] = [];
  
  // Ã¢Å“â€¦ Enhanced safety check
  if (!doctor.workingHours || !doctor.workingHours.start || !doctor.workingHours.end) {
    console.warn(` Doctor ${doctor.name} has no working hours defined`);
    return slots;
  }

  // Ã¢Å“â€¦ Parse 12-hour format (e.g., "9:00 AM", "5:00 PM")
  const parseTime12Hour = (timeStr: string): { hour: number; minute: number } => {
    const [time, period] = timeStr.trim().split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return { hour: hours, minute: minutes || 0 };
  };

  // Ã¢Å“â€¦ Handle both 12-hour format ("9:00 AM") and 24-hour format ("09:00")
  let startHour: number, startMin: number, endHour: number, endMin: number;

  if (doctor.workingHours.start.includes('AM') || doctor.workingHours.start.includes('PM')) {
    // 12-hour format
    const start = parseTime12Hour(doctor.workingHours.start);
    const end = parseTime12Hour(doctor.workingHours.end);
    startHour = start.hour;
    startMin = start.minute;
    endHour = end.hour;
    endMin = end.minute;
  } else {
    // 24-hour format fallback
    [startHour, startMin] = doctor.workingHours.start.split(":").map(Number);
    [endHour, endMin] = doctor.workingHours.end.split(":").map(Number);
  }

  const buffer = doctor.bufferTime || 15;
  const active = doctor.consultationDuration || 30; // Ã¢Å“â€¦ Use consultation duration

  // Get existing appointments for this doctor on this date
  const existingAppointments = appointments.filter(
    apt =>
      apt.doctorId === doctor.id &&
      apt.date === selectedDate &&
      apt.status !== 'cancelled'
  );

  for (
    let total = startHour * 60 + startMin;
    total + active <= endHour * 60 + endMin;
    total += active + buffer
  ) {
    const hour = Math.floor(total / 60);
    const minute = total % 60;
    const time = convertTo12Hour(
      `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
    );
    
    // Check if this slot is already booked by an appointment
    const isBooked = existingAppointments.some(apt => apt.time === time);
    
    // Check if this slot has been manually disabled by staff
    const slotKey = `${doctor.id}_${selectedDate}_${time}`;
    const isManuallyDisabled = doctorAvailabilitySlots[slotKey] === false;
    
    // Slot is available only if not booked AND not manually disabled
    slots.push({ 
      time, 
      available: !isBooked && !isManuallyDisabled 
    });
  }

  console.log(`Ã°Å¸â€¢Â Generated ${slots.length} time slots for ${doctor.name} on ${selectedDate}`);
  return slots;
};
// === Toggle Doctor Availability for the Day ===
const handleToggleDoctorAvailability = async (
  doctorId: string,
  available: boolean,
  date: string
) => {
  try {
    const ref = doc(db, "doctorAvailability", `${doctorId}_${date}`);
    await setDoc(ref, {
      doctorId,
      date,
      available,
      updatedAt: serverTimestamp(),
    });
    
    // Update local state immediately
    setDoctorAvailability(prev => {
      const updated = prev.filter(av => !(av.doctorId === doctorId && av.date === date));
      return [...updated, { doctorId, date, available }];
    });
    
    addNotification("success", `Doctor marked as ${available ? "available" : "unavailable"} on ${date}`);
  } catch (error) {
    console.error(error);
    addNotification("error", "Failed to update doctor availability");
  }
};

// === Toggle Time Slot ===
const handleToggleTimeSlot = async (
  doctorId: string,
  date: string,
  time: string,
  available: boolean
) => {
  try {
    const slotRef = doc(db, "doctorAvailabilitySlots", `${doctorId}_${date}_${time}`);
    await setDoc(slotRef, {
      doctorId,
      date,
      time,
      available,
      updatedAt: serverTimestamp(),
    });
    
    // Update local state immediately
    const slotKey = `${doctorId}_${date}_${time}`;
    setDoctorAvailabilitySlots(prev => ({
      ...prev,
      [slotKey]: available
    }));
    
    addNotification("success", `Time slot ${time} ${available ? "enabled" : "disabled"} successfully`);
  } catch (err) {
    console.error(err);
    addNotification("error", "Failed to update time slot");
  }
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

    console.log(`Conflict check: Doctor ${doctorId} | Date: ${date} | Time: ${time}`);
    console.log(`Found ${conflictSnapshot.docs.length} matching appointments`);

    if (!conflictSnapshot.empty) {
      conflictSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        console.log(`  ${data.name} [${data.bookedBy || 'patient'}] | ID: ${doc.id} | Status: ${data.status}`);
      });
    }

    // If editing, allow if the only match is the appointment being edited
    if (excludeId) {
      const conflictingAppointment = conflictSnapshot.docs.find(doc => doc.id !== excludeId);
      const hasConflict = !!conflictingAppointment;
      console.log(` Editing mode: excluding ID ${excludeId}, conflict found: ${hasConflict}`);
      return hasConflict;
    }

    // For new appointments: any existing doc = conflict
    const hasConflict = !conflictSnapshot.empty;
    console.log(`New booking: conflict = ${hasConflict}`);
    return hasConflict;
  } catch (error) {
    console.error('Error checking appointment conflict:', error);
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
  
    // =============================
  // REPORTS ANALYTICS FUNCTIONS
  // =============================
  
  const getWeeklyPatientData = () => {
    const weeks = [];
    const today = new Date();
    
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7) - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekAppointments = appointments.filter(apt => {
        const aptDate = new Date(apt.date);
        return aptDate >= weekStart && aptDate <= weekEnd && apt.status !== 'cancelled';
      });
      
      weeks.push({
        label: `Week ${4 - i}`,
        dateRange: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        count: weekAppointments.length,
        appointments: weekAppointments
      });
    }
    
    return weeks;
  };

  const getConditionStats = () => {
    const conditionMap: { [key: string]: number } = {};
    
    appointments.forEach(apt => {
      if (apt.status !== 'cancelled') {
        const condition = apt.type || 'Unspecified';
        conditionMap[condition] = (conditionMap[condition] || 0) + 1;
      }
    });
    
    return Object.entries(conditionMap)
      .map(([condition, count]) => ({ condition, count }))
      .sort((a, b) => b.count - a.count);
  };

  const getMonthlyTrend = () => {
    const months = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      
      const monthAppointments = appointments.filter(apt => {
        const aptDate = new Date(apt.date);
        return aptDate >= monthStart && aptDate <= monthEnd && apt.status !== 'cancelled';
      });
      
      months.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        count: monthAppointments.length
      });
    }
    
    return months;
  };

  const getDoctorPerformance = () => {
    return doctors.map(doctor => {
      const doctorAppointments = appointments.filter(apt => 
        apt.doctorId === doctor.id && apt.status !== 'cancelled'
      );
      
      const completed = doctorAppointments.filter(apt => apt.status === 'completed').length;
      
      return {
        name: doctor.name,
        specialty: doctor.specialty,
        totalPatients: doctorAppointments.length,
        completed,
        pending: doctorAppointments.filter(apt => apt.status === 'pending').length,
        confirmed: doctorAppointments.filter(apt => apt.status === 'confirmed').length
      };
    }).sort((a, b) => b.totalPatients - a.totalPatients);
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
    // Confirmed appointments (being served) should come first
    if (a.status === 'confirmed' && b.status !== 'confirmed') return -1;
    if (b.status === 'confirmed' && a.status !== 'confirmed') return 1;
    
    // Then by priority
    if (a.priority === 'emergency' && b.priority !== 'emergency') return -1;
    if (b.priority === 'emergency' && a.priority !== 'emergency') return 1;
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
    
    // Then by queue number
    return (a.queueNumber || 0) - (b.queueNumber || 0);
  });
  
  return sortedQueue.map((apt, index) => ({
    ...apt,
    estimatedWaitTime: index * 30,
    isCurrentlyServing: apt.status === 'confirmed', // âœ… All confirmed are "being served"
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
  
  // Filtered Appointments and Doctors
const getFilteredAppointments = () => {
  let filtered = appointments;
  // Search term filter - now includes doctor search
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

// Add new function for filtering doctors
const getFilteredDoctors = () => {
  let filtered = doctors;
  if (searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase().trim();
    filtered = filtered.filter(doc =>
      doc.name.toLowerCase().includes(searchLower) ||
      doc.specialty.toLowerCase().includes(searchLower) ||
      doc.email.toLowerCase().includes(searchLower) ||
      doc.phone.includes(searchLower) ||
      doc.room.toLowerCase().includes(searchLower)
    );
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

// Auto-generate available time slots whenever doctor or date changes
useEffect(() => {
  if (appointmentForm.doctorId && appointmentForm.date) {
    const slots = generateTimeSlots(appointmentForm.doctorId, appointmentForm.date);
    console.log(" Available Slots:", slots);
    // Optionally store them in state if you have a slot picker
    // setAvailableSlots(slots);
  }
}, [appointmentForm.doctorId, appointmentForm.date, appointmentForm.priority]);


// âœ… PHONE VALIDATION â€“ Philippine number (09XXXXXXXXX)
const validatePhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, ""); // remove non-numerics
  return /^09\d{9}$/.test(cleaned);
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
 const handlePhotoUpload = async (
  e: React.ChangeEvent<HTMLInputElement>,
  type: 'appointment' | 'doctor' | 'profile' | 'profileDropdown' = 'appointment'
) => {
  const file = e.target.files?.[0];
  if (file && staffProfile) {
    try {
      addNotification('info', 'Uploading photo...');
      const photoURL = await uploadImage(file);

      switch (type) {
        case 'doctor':
          setDoctorForm(prev => ({ ...prev, photo: photoURL }));
          addNotification('success', 'Doctor photo uploaded!');
          break;
        case 'profile':
          setProfileForm(prev => ({ ...prev, photo: photoURL }));
          addNotification('success', 'Profile photo uploaded!');
          break;
        case 'profileDropdown':
          // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Update BOTH form and visible profile immediately
          setProfileForm(prev => ({ ...prev, photo: photoURL }));
          setStaffProfile(prev => prev ? { ...prev, photo: photoURL } : prev);
          
          // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Persist to Firestore
          try {
            const userQuery = query(
              collection(db, 'users'),
              where('uid', '==', staffProfile.uid)
            );
            const userSnapshot = await getDocs(userQuery);
            
            if (!userSnapshot.empty) {
              const userDocRef = doc(db, 'users', userSnapshot.docs[0].id);
              await updateDoc(userDocRef, { photo: photoURL });
            }
          } catch (dbError) {
            console.error('Error saving photo to database:', dbError);
          }
          
          addNotification('success', 'Profile photo updated!');
          // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Keep dropdown open to see the change
          break;
        default:
          setAppointmentForm(prev => ({ ...prev, photo: photoURL }));
          addNotification('success', 'Photo uploaded!');
      }
      
      // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Reset file input
      e.target.value = '';
      
    } catch (error) {
      console.error('Error uploading photo:', error);
      addNotification('error', 'Failed to upload photo');
    }
  } else if (!file) {
    addNotification('error', 'No file selected');
  }
};

 // =============================
// STAFF DOCTOR-SPECIFIC SLOT MANAGEMENT
// =============================

// Store per-doctor per-day slot counts (key format: doctorId_date)
const [doctorSlotSettings, setDoctorSlotSettings] = useState<{ [key: string]: number }>({});

// Ã¢Å“â€¦ Get total max slots for a specific date (sum of all doctors' actual slots)
const getTotalSlotsForDate = (date: string): number => {
  if (!date) return 0;

  // First check if staff has set custom slot counts for this date
  const customTotal = Object.entries(doctorSlotSettings)
    .filter(([key]) => key.endsWith(`_${date}`))
    .reduce((sum, [, count]) => sum + (count || 0), 0);
  
  if (customTotal > 0) {
    return customTotal;
  }

  // Otherwise, calculate based on each doctor's working hours
  let total = 0;
  doctors.forEach(doctor => {
    // Check if doctor is available on this date
    const availability = doctorAvailability.find(
      av => av.doctorId === doctor.id && av.date === date
    );
    
    const isAvailable = availability ? availability.available : doctor.available;
    
    if (isAvailable) {
      total += calculateDoctorDailySlots(doctor);
    }
  });

  return total;
};

// Utility: Get a single doctor's slot count for a date
// Ã¢Å“â€¦ Get a single doctor's slot count for a date
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


// Update slot count for a specific doctor and date
const handleDoctorSlotChange = async (doctorId: string, date: string, newCount: number) => {
  if (!doctorId || !date) return;

  const key = `${doctorId}_${date}`;
  try {
    const ref = doc(db, "doctorSlotSettings", key);
    await setDoc(
      ref,
      {
        doctorId,
        date,
        maxSlots: newCount,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Update local state immediately for smooth UX
    setDoctorSlotSettings((prev) => ({
      ...prev,
      [key]: newCount,
    }));

    addNotification("success", `Updated slots for ${date}`);
  } catch (error) {
    console.error("Error updating doctor slot count:", error);
    addNotification("error", "Failed to update slot count");
  }
};

// Load all doctor slot settings from Firestore on mount
useEffect(() => {
  const fetchDoctorSlotSettings = async () => {
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

  fetchDoctorSlotSettings();
}, []);

const handleCreateAppointment = async () => {
  if (!appointmentForm.name || !appointmentForm.date || !appointmentForm.time || !appointmentForm.doctorId) {
    addNotification('error', 'Please fill in all required fields');
    return;
  }
  
  try {
    addNotification('info', 'Creating appointment...');
    
    // âœ… CRITICAL: Check if daily limit is reached BEFORE creating
    if (isDailyLimitReached(appointmentForm.doctorId, appointmentForm.date)) {
      addNotification('error', 'This doctor has reached their maximum appointments for this day. Please select another date or doctor.');
      return;
    }
    
    // âœ… Double-check for time slot conflicts
    const hasConflict = await checkAppointmentConflict(
      appointmentForm.doctorId,
      appointmentForm.date,
      appointmentForm.time
    );
    
    if (hasConflict) {
      addNotification('error', 'This time slot is already booked by another appointment. Please select a different time.');
      setAppointmentForm(prev => ({ ...prev, time: '' }));
      return;
    }
    
    // âœ… Additional real-time check by querying current appointments state
    const localConflicts = appointments.filter(apt => 
      apt.doctorId === appointmentForm.doctorId &&
      apt.date === appointmentForm.date &&
      apt.time === appointmentForm.time &&
      apt.status !== 'cancelled'
    );
    
    if (localConflicts.length > 0) {
      console.log('âš ï¸ Local conflict detected:', localConflicts);
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
      bookedBy: 'staff',
      assignedBy: staffProfile?.name || 'Staff',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Use addDoc to prevent race conditions
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
    
    // âœ… CRITICAL: Check if daily limit is reached (excluding current appointment)
    const customSlotKey = `${appointmentForm.doctorId}_${appointmentForm.date}`;
    const maxSlots = doctorSlotSettings[customSlotKey] || 
      (() => {
        const doctor = doctors.find(d => d.id === appointmentForm.doctorId);
        return doctor ? calculateDoctorDailySlots(doctor) : 10;
      })();
    
    const bookedCount = appointments.filter(
      apt => apt.doctorId === appointmentForm.doctorId && 
             apt.date === appointmentForm.date && 
             apt.status !== 'cancelled' &&
             apt.id !== editingAppointment.id // âœ… Exclude current appointment from count
    ).length;
    
    if (bookedCount >= maxSlots) {
      addNotification('error', 'This doctor has reached their maximum appointments for this day. Please select another date or doctor.');
      return;
    }
    
    // Check for conflicts when updating (exclude current appointment)
    const hasConflict = await checkAppointmentConflict(
      appointmentForm.doctorId,
      appointmentForm.date,
      appointmentForm.time,
      editingAppointment.id // âœ… Pass the current appointment ID to exclude it
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
// Add this helper function near your other helper functions (around line 950)
const isDailyLimitReached = (doctorId: string, date: string): boolean => {
  // Get custom slot setting or calculate from working hours
  const customSlotKey = `${doctorId}_${date}`;
  const maxSlots = doctorSlotSettings[customSlotKey] || 
    (() => {
      const doctor = doctors.find(d => d.id === doctorId);
      return doctor ? calculateDoctorDailySlots(doctor) : 10;
    })();
  
  // Count existing appointments for this doctor on this date
  const bookedCount = appointments.filter(
    apt => apt.doctorId === doctorId && 
           apt.date === date && 
           apt.status !== 'cancelled'
  ).length;
  
  console.log(`ðŸ“Š Daily limit check: ${bookedCount}/${maxSlots} for doctor ${doctorId} on ${date}`);
  
  return bookedCount >= maxSlots;
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

 // Ã¢Å“â€¦ Create Doctor
const handleCreateDoctor = async () => {
  if (!doctorForm.name || !doctorForm.specialty || !doctorForm.email) {
    addNotification('error', 'Please fill all required fields');
    return;
  }

  try {
    addNotification('info', 'Creating doctor account...');

    const doctorData = {
      name: doctorForm.name,
      specialty: doctorForm.specialty,
      email: doctorForm.email,
      phone: doctorForm.phone,
      room: doctorForm.room,

      // Ã¢Å“â€¦ Default working hours if missing
      workingHours: {
        start: doctorForm.startTime || "9:00 AM",
        end: doctorForm.endTime || "5:00 PM",
      },

      maxAppointments: parseInt(doctorForm.maxAppointments) || 10,

      // Ã¢Å“â€¦ Default durations if missing
      consultationDuration: parseInt(doctorForm.consultationDuration) || 30,
      bufferTime: parseInt(doctorForm.bufferTime) || 15,

      offDays: doctorForm.offDays || [],
      photo: doctorForm.photo || "",
      available: doctorForm.available ?? true,
      isActive: doctorForm.isActive ?? true,
      createdAt: serverTimestamp(),
    };

    // Ã°Å¸â€Â¥ Step 1: Add doctor to 'doctors' collection
    const doctorDocRef = await addDoc(collection(db, 'doctors'), doctorData);

    // Ã¢Å“â€¦ IMPORTANT: Update local state immediately so slots can be generated
    const newDoctor: Doctor = {
      id: doctorDocRef.id,
      ...doctorData,
      createdAt: Timestamp.now(), // Use current timestamp for immediate display
    } as Doctor;

    setDoctors(prev => [...prev, newDoctor]);

    // Ã°Å¸â€â€” Step 2: Create Firebase Auth account + User document via backend
    try {
      const response = await fetch('http://localhost:5000/create-doctor-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: doctorForm.email,
          name: doctorForm.name,
          specialty: doctorForm.specialty,
          doctorId: doctorDocRef.id,
          phone: doctorForm.phone,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        addNotification(
          'success',
          `Ã¢Å“â€¦ Doctor account created! Password setup email sent to ${doctorForm.email}`
        );

        // Ã¢Å“â€¦ Update doctor document with userId
        await updateDoc(doc(db, 'doctors', doctorDocRef.id), {
          userId: result.uid,
        });

        // Ã¢Å“â€¦ Update local state with userId
        setDoctors(prev => 
          prev.map(d => 
            d.id === doctorDocRef.id 
              ? { ...d, userId: result.uid } 
              : d
          )
        );

        // Ã¢Å“â€¦ If photo exists, update user document
        if (doctorForm.photo) {
          try {
            const userDocRef = doc(db, 'users', result.uid);
            await updateDoc(userDocRef, { photo: doctorForm.photo });
            console.log('Photo added to user profile');
          } catch (photoError) {
            console.warn('Failed to add photo to user profile:', photoError);
          }
        }
      } else {
        addNotification(
          'warning',
          `Doctor profile created, but failed to create login account: ${
            result.error || 'Unknown error'
          }. Please try creating the account manually.`
        );
      }
    } catch (emailError) {
      console.error('Error creating auth account:', emailError);
      addNotification(
        'warning',
        'Doctor profile created, but failed to send setup email. The doctor may need to use password reset to access their account.'
      );
    }

    setShowDoctorForm(false);
    resetDoctorForm();
  } catch (error) {
    console.error('Error creating doctor:', error);
    addNotification('error', 'Failed to create doctor profile');
  }
};

// Ã¢Å“â€¦ Update Doctor
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

      // Ã¢Å“â€¦ Keep safe defaults even when updating
      workingHours: {
        start: doctorForm.startTime || "9:00 AM",
        end: doctorForm.endTime || "5:00 PM",
      },

      maxAppointments: parseInt(doctorForm.maxAppointments) || 10,
      consultationDuration: parseInt(doctorForm.consultationDuration) || 30,
      bufferTime: parseInt(doctorForm.bufferTime) || 15,

      offDays: doctorForm.offDays || [],
      photo: doctorForm.photo || "",
      available: doctorForm.available ?? true,
      isActive: doctorForm.isActive ?? true,
      updatedAt: serverTimestamp(),
    });

    // Ã°Å¸â€Â Update linked user (if email unchanged)
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
        case "now_serving":
          return {
            subject: "Your Turn - Now Being Served",
            message: `Hello ${appointment.name}, it's now your turn! Please proceed to ${appointment.doctor}'s office. Queue #${appointment.queueNumber}`,
          };
        case "appointment_completed":
          return {
            subject: "Appointment Completed",
            message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} has been completed. Thank you for visiting us.`,
          };
        case "appointment_confirmed":
          return {
            subject: "Appointment Confirmed",
            message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} has been confirmed. Queue #${appointment.queueNumber}`,
          };
        case "appointment_cancelled":
          return {
            subject: "Appointment Cancelled",
            message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} has been cancelled.`,
          };
        case "appointment_pending":
          return {
            subject: "Appointment Pending",
            message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} is pending confirmation.`,
          };
        case "appointment_created":
          return {
            subject: "New Appointment Booked",
            message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} has been booked for ${appointment.date} at ${appointment.time}. Queue #${appointment.queueNumber}`,
          };
        case "appointment_updated":
          return {
            subject: "Appointment Updated",
            message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} has been updated. New time: ${appointment.date} at ${appointment.time}`,
          };
        case "reminder":
          return {
            subject: "Appointment Reminder",
            message: `Hello ${appointment.name}, this is a reminder for your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time}. Queue #${appointment.queueNumber}`,
          };
        default:
          return {
            subject: "Appointment Update",
            message: `Hello ${appointment.name}, there's an update regarding your appointment.`,
          };
      }
    };

    const notificationContent = getNotificationMessage(type, appointmentData);

    // Ã°Å¸â€Â¥ Real email sending via backend
    const response = await fetch("http://localhost:5000/send-reminder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        name: appointmentData.name,
        doctor: appointmentData.doctor,
        date: appointmentData.date,
        time: appointmentData.time,
        message: notificationContent.message,
        subject: notificationContent.subject,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const methods = [];
      if (email) methods.push("Email");
      if (phone) methods.push("SMS");
      addNotification("success", `${methods.join(" & ")} notification sent successfully`);
    } else {
      throw new Error(data.error || "Failed to send notification via backend");
    }
  } catch (error) {
    console.log("Notification fallback triggered:", error);

    // Fallback simulation (kept for structure)
    const getNotificationMessage = (type: string, appointment: any) => {
      switch (type) {
        case "now_serving":
          return {
            subject: "Your Turn - Now Being Served",
            message: `Hello ${appointment.name}, it's now your turn! Please proceed to ${appointment.doctor}'s office. Queue #${appointment.queueNumber}`,
          };
        case "appointment_completed":
          return {
            subject: "Appointment Completed",
            message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} has been completed. Thank you for visiting us.`,
          };
        case "appointment_confirmed":
          return {
            subject: "Appointment Confirmed",
            message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} has been confirmed. Queue #${appointment.queueNumber}`,
          };
        case "appointment_cancelled":
          return {
            subject: "Appointment Cancelled",
            message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} has been cancelled.`,
          };
        case "appointment_pending":
          return {
            subject: "Appointment Pending",
            message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time} is pending confirmation.`,
          };
        case "appointment_created":
          return {
            subject: "New Appointment Booked",
            message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} has been booked for ${appointment.date} at ${appointment.time}. Queue #${appointment.queueNumber}`,
          };
        case "appointment_updated":
          return {
            subject: "Appointment Updated",
            message: `Hello ${appointment.name}, your appointment with ${appointment.doctor} has been updated. New time: ${appointment.date} at ${appointment.time}`,
          };
        case "reminder":
          return {
            subject: "Appointment Reminder",
            message: `Hello ${appointment.name}, this is a reminder for your appointment with ${appointment.doctor} on ${appointment.date} at ${appointment.time}. Queue #${appointment.queueNumber}`,
          };
        default:
          return {
            subject: "Appointment Update",
            message: `Hello ${appointment.name}, there's an update regarding your appointment.`,
          };
      }
    };

    const notificationContent = getNotificationMessage(type, appointmentData);

    const promises = [];
    if (email) {
      promises.push(
        new Promise((resolve) => {
          setTimeout(() => {
            console.log(`Email simulated to ${email}: ${notificationContent.subject}`);
            console.log(`Message: ${notificationContent.message}`);
            resolve(true);
          }, 1000);
        })
      );
    }
    if (phone) {
      promises.push(
        new Promise((resolve) => {
          setTimeout(() => {
            console.log(`SMS simulated to ${phone}: ${notificationContent.message}`);
            resolve(true);
          }, 800);
        })
      );
    }

    await Promise.all(promises);
    const methods = [];
    if (email) methods.push("Email");
    if (phone) methods.push("SMS");
    addNotification("success", `${methods.join(" & ")} notification sent successfully`);
  }
};
// Helper to trigger notification by appointment ID
const sendNotificationToPatientById = async (
  appointmentId: string,
  method: "sms" | "email" | "both"
) => {
  const appointment = appointments.find((apt) => apt.id === appointmentId);
  if (!appointment) return;

  const email = method === "email" || method === "both" ? appointment.email : "";
  const phone = method === "sms" || method === "both" ? appointment.phone : "";

  // 🧮 Calculate queue position
  const activeAppointments = appointments.filter(
    (apt) => apt.status === "confirmed" || apt.status === "pending"
  );

  const queueNumber =
    activeAppointments.findIndex((apt) => apt.id === appointmentId) + 1;
  const totalQueue = activeAppointments.length;

  try {
    // ✅ Send queue position notification to backend
    const response = await fetch("http://localhost:5000/send-queue-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: appointment.name,
        email,
        phone,
        queueNumber,
        totalQueue,
      }),
    });

    const result = await response.json();
    if (result.success) {
      alert(
        `✅ Notification sent to ${appointment.name}: You are #${queueNumber} in the queue.`
      );
    } else {
      alert(`⚠️ Failed to send notification: ${result.error}`);
    }
  } catch (error) {
    console.error("❌ Error sending queue notification:", error);
    alert("❌ Failed to send queue notification. Please check your server.");
  }
};

  //  Updated Reset Forms
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
    photo: '',
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
  
  //Updated handleEditAppointment
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
    photo: appointment.photo || '',
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
        
{/* Main Content */}
<main className={`main-content-full ${activeTab === 'dashboard' ? 'dashboard-active' : ''}`}>
  {/* Header with Navbar */}
 {/* Ã¢Å“â€¦ UPDATED - Fixed Header with Profile Dropdown */}
<header className="staff-main-header">
  <div className="staff-header-container">
    {/* Logo - Left */}
    <button 
      className="staff-header-logo" 
      onClick={() => setActiveTab('dashboard')}
      aria-label="Go to Dashboard"
    >
      <img src="/images/bird.png" alt="TimeFly Logo" className="staff-logo-icon" />
      <span className="staff-logo-text">TimeFly</span>
    </button>

    {/* Navigation Links - Center */}
    <nav className="staff-header-nav">
      <button
        className={`staff-nav-link ${activeTab === 'appointments' ? 'active' : ''}`}
        onClick={() => setActiveTab('appointments')}
      >
        <Calendar size={18} aria-hidden="true" />
        Appointments
      </button>
      <button
        className={`staff-nav-link ${activeTab === 'queue' ? 'active' : ''}`}
        onClick={() => setActiveTab('queue')}
      >
        <Clock size={18} aria-hidden="true" />
        Current Queue
      </button>
      <button
        className={`staff-nav-link ${activeTab === 'doctors' ? 'active' : ''}`}
        onClick={() => setActiveTab('doctors')}
      >
        <Stethoscope size={18} aria-hidden="true" />
        Doctors
      </button>
      <button
        className={`staff-nav-link ${activeTab === 'calendar' ? 'active' : ''}`}
        onClick={() => setActiveTab('calendar')}
      >
        <CalendarDays size={18} aria-hidden="true" />
        Calendar
      </button>
      <button
        className={`staff-nav-link ${activeTab === 'reports' ? 'active' : ''}`}
        onClick={() => setActiveTab('reports')}
      >
        <MessageSquare size={18} aria-hidden="true" />
        Reports
      </button>
    </nav>

    {/* Right Side - Search and Profile */}
    <div className="staff-header-right">
      {/* Search - visible in appointments and doctors tabs */}
      {(activeTab === 'appointments' || activeTab === 'doctors') && (
        <div className="staff-search-container">
          <Search size={18} className="staff-search-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder={activeTab === 'appointments' ? "Search appointments..." : "Search doctors..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label={activeTab === 'appointments' ? "Search appointments" : "Search doctors"}
          />
        </div>
      )}
      
{/* Ã¢Å“â€¦ FIXED Profile Dropdown (no ARIA warnings, no inline styles) */}
<div className="staff-profile-dropdown-wrapper" ref={profileDropdownRef}>
  <button
    ref={profileButtonRef} // Ã¢Å“â€¦ added ref to control aria-expanded via JS
    className="staff-profile-button"
    onClick={() => setShowProfileDropdown(prev => !prev)}
    aria-label="Profile menu"
  >
    <div className="staff-user-avatar">
      {staffProfile?.photo ? (
        <img
          src={staffProfile.photo}
          alt={staffProfile.name}
          className="staff-avatar-image"
        />
      ) : (
        <User size={20} aria-hidden="true" />
      )}
    </div>
  </button>

  {showProfileDropdown && (
    <div className="staff-profile-dropdown">
      <div className="staff-profile-header">
        <div className="staff-profile-avatar-lg">
          {staffProfile?.photo ? (
            <img
              src={staffProfile.photo}
              alt={staffProfile.name}
              className="staff-avatar-image"
            />
          ) : (
            <User size={24} aria-hidden="true" />
          )}
        </div>
        <div className="staff-profile-info">
          <p className="staff-profile-name">{staffProfile?.name}</p>
          <p className="staff-profile-email">{staffProfile?.email}</p>
        </div>
      </div>

      {/* Ã¢Å“â€¦ Hidden file input with external CSS (no inline styles) */}
      <input
        type="file"
        id="profilePhotoUploadDropdown"
        accept="image/*"
        onChange={(e) => handlePhotoUpload(e, "profileDropdown")}
        className="hidden-file-input"
        aria-label="Upload new profile picture"
      />

      <button
        className="staff-profile-action"
        onClick={() => {
          const fileInput = document.getElementById("profilePhotoUploadDropdown") as HTMLInputElement;
          if (fileInput) {
            fileInput.click();
          }
        }}
      >
        <Camera size={16} aria-hidden="true" />
        Change Photo
      </button>

      {/* Ã°Å¸Å¡Âª Logout opens confirmation modal instead of direct logout */}
      <button
        className="staff-logout-action"
        onClick={() => {
          setShowProfileDropdown(false);
          setShowLogoutModal(true); // Ã°Å¸â€Â¥ open modal
        }}
      >
        <LogOut size={16} aria-hidden="true" />
        Logout
      </button>
    </div>
  )}

  {/* Ã°Å¸â€â€™ Logout Confirmation Modal */}
  {showLogoutModal && (
    <div className="logout-modal-overlay">
      <div className="logout-modal">
        <h3>Are you sure you want to logout?</h3>
        <div className="logout-modal-actions">
          <button
            className="btn-confirm"
            onClick={() => {
              setShowLogoutModal(false);
              handleLogout(); // proceed logout
            }}
          >
            Yes
          </button>
          <button
            className="btn-cancel"
            onClick={() => setShowLogoutModal(false)}
          >
            No
          </button>
        </div>
      </div>
    </div>
  )}
</div>
</div>
</div>
</header>



  {/* Dashboard Tab */}
  {activeTab === 'dashboard' && (
    <div className="dashboard-content-wrapper">
      {/* Background Image */}
      <div className="dashboard-background">
        <img
          src="/images/staffbg.png"
          alt=""
          className="dashboard-bg-image"
        />
        <div className="dashboard-overlay"></div>
      </div>

      {/* Content Over Background */}
      <div className="dashboard-content">
        {/* Welcome Section */}
        <div className="dashboard-welcome">
          {(() => {
            const hour = new Date().getHours();
            let greeting = "Good Evening";
            if (hour < 12) greeting = "Good Morning";
            else if (hour < 18) greeting = "Good Afternoon";
            return (
              <>
                <h1>{greeting},</h1>
                <h2>{staffProfile?.name || 'Staff'}</h2>
                <p>Manage your eye care appointments and checkups with real-time queue updates</p>
              </>
            );
          })()}
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card glass">
            <div className="stat-icon">
              <Calendar size={24} aria-hidden="true" />
            </div>
            <div className="stat-content">
              <div className="stat-label">TODAY'S PATIENTS</div>
              <div className="stat-value">{stats.totalToday}</div>
              <div className="stat-detail">Scheduled appointments</div>
            </div>
          </div>

          <div className="stat-card glass">
            <div className="stat-icon progress">
              <Clock size={24} aria-hidden="true" />
            </div>
            <div className="stat-content">
              <div className="stat-label">IN PROGRESS</div>
              <div className="stat-value">{stats.confirmed}</div>
              <div className="stat-detail">Currently consulting</div>
            </div>
          </div>

          <div className="stat-card glass">
            <div className="stat-icon upcoming">
              <Users size={24} aria-hidden="true" />
            </div>
            <div className="stat-content">
              <div className="stat-label">UPCOMING</div>
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-detail">Future appointments</div>
            </div>
          </div>

          <div className="stat-card glass">
            <div className="stat-icon completed">
              <CheckCircle2 size={24} aria-hidden="true" />
            </div>
            <div className="stat-content">
              <div className="stat-label">COMPLETED</div>
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-detail">Total consultations</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions-section">
          <button
            className="quick-action-btn primary"
            onClick={() => setShowBookingForm(true)}
          >
            <Plus size={20} aria-hidden="true" />
            Book Appointment
          </button>
          <button
            className="quick-action-btn secondary"
            onClick={() => setActiveTab('queue')}
          >
            <Clock size={20} aria-hidden="true" />
            Manage Queue
          </button>
          <button
            className="quick-action-btn tertiary"
            onClick={() => setShowDoctorForm(true)}
          >
            <UserPlus size={20} aria-hidden="true" />
            Add Doctor
          </button>
        </div>

        {/* Recent Appointments */}
        <div className="recent-appointments glass">
          <div className="section-header">
            <h3>Recent Appointments</h3>
            <button
              className="view-all-btn"
              onClick={() => setActiveTab('appointments')}
            >
              View All
            </button>
          </div>
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
    </div>
  )}{/* Appointments Tab */}
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
          {doctors.map((doctor) => (
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
        filteredAppointments.map((appointment) => {
          const formattedDate = new Date(appointment.date).toLocaleDateString(
            'en-US',
            { year: 'numeric', month: 'long', day: 'numeric' }
          );

          return (
            <div key={appointment.id} className="appointment-card">
              <div className="appointment-main">
                {/* LEFT: Patient Info */}
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
                      <span className="contact-item">
                        <Phone size={14} aria-hidden="true" /> {appointment.phone}
                      </span>
                      <span className="contact-item">
                        <Mail size={14} aria-hidden="true" /> {appointment.email}
                      </span>
                    </div>
                  </div>
                </div>

                {/* MIDDLE: Appointment Info */}
                <div className="appointment-info">
                  <div className="info-item">
                    <Badge size={16} aria-hidden="true" />
                    <span>#{appointment.queueNumber}</span>
                  </div>
                  <div className="info-item">
                    <Stethoscope size={16} aria-hidden="true" />
                    <span>{appointment.doctor}</span>
                  </div>
                  <div className="info-item">
                    <Clock size={16} aria-hidden="true" />
                    <span>{appointment.time}</span>
                  </div>
                  <div className="info-item">
                    <CalendarDays size={16} aria-hidden="true" />
                    <span>{formattedDate}</span>
                  </div>
                </div>

                {/* RIGHT: Status + Actions */}
                <div className="appointment-right">
                  <div className="appointment-status">
                    <span className={appointment.priority}>
                      {appointment.priority}
                    </span>
                    <span className={appointment.status}>
                      {appointment.status}
                    </span>
                  </div>

                  <div className="appointment-actions">
                    <button
                      className="icon-btn"
                      onClick={() => {
                        setSelectedAppointment(appointment);
                        setShowDetailsModal(true);
                      }}
                      title={`View details for ${appointment.name}`}
                    >
                      <Eye size={20} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => handleEditAppointment(appointment)}
                      title={`Edit appointment for ${appointment.name}`}
                    >
                      <Edit size={20} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() =>
                        sendNotificationToPatientById(appointment.id, 'both')
                      }
                      title={`Send notification to ${appointment.name}`}
                    >
                      <Send size={20} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() =>
                        handleAppointmentStatusChange(appointment.id, 'cancelled')
                      }
                      title={`Cancel appointment for ${appointment.name}`}
                    >
                      <X size={20} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => handleDeleteAppointment(appointment.id)}
                      title={`Delete appointment for ${appointment.name}`}
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })
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

        {/* UPDATED CODE (Show Any Confirmed Patient) */}
        <div className="serving-display">
          {(() => {
            const confirmedPatient = queue.find(q => q.status === 'confirmed');

            if (confirmedPatient) {
              return (
                <div className="current-patient">
                  <div className="queue-number">#{confirmedPatient.queueNumber}</div>
                  <div className="patient-info">
                    <div className="patient-name">{confirmedPatient.name}</div>
                    <div className="patient-doctor">{confirmedPatient.doctor}</div>
                    <div className="serving-status">Currently Being Served</div>
                  </div>
                </div>
              );
            } else if (queue.length > 0) {
              return (
                <div className="no-patients-in-serving">
                  <Clock size={48} aria-hidden="true" />
                  <p>Waiting for confirmation...</p>
                </div>
              );
            } else {
              return (
                <div className="no-patients-in-serving">
                  <Clock size={48} aria-hidden="true" />
                  <p>No patients in queue</p>
                </div>
              );
            }
          })()}
        </div>
      </div>

      {/* Queue Stats */}
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

    {/* Queue List */}
    <div className="queue-list">
      {queue.length > 0 && queue.map((patient) => (
        <div
          key={patient.id}
          className={`queue-item ${
            patient.status === 'confirmed' ? 'current' : ''
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
              {patient.status === 'confirmed' && (
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
              {patient.status === 'confirmed'
                ? 'Being Served'
                : `Wait: ${patient.estimatedWaitTime}min`}
            </div>
          </div>

          {/* UPDATED CODE (Show Complete Button for All Confirmed) */}
          <div className="queue-actions">
            {patient.status === 'confirmed' ? (
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
            ) : null}

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
      ))}
    </div>
  </div>
)}

{/* Doctors Tab */}
{activeTab === "doctors" && (
  <div className="doctors-content">
    <div className="doctors-header">
      <h2 className="doctors-title">Medical Team</h2>
      <button
        className="btn-primary"
        onClick={() => setShowDoctorForm(true)}
        title="Add Doctor"
      >
        <Plus size={16} aria-hidden="true" />
        Add Doctor
      </button>
    </div>
    
{getFilteredDoctors().length === 0 ? (
  <div className="no-doctors">
    <Stethoscope size={48} aria-hidden="true" />
    <p>{searchTerm ? 'No doctors match your search.' : 'No doctors found. Add a new doctor to get started.'}</p>
  </div>
) : (
  <div className="doctors-grid">
    {getFilteredDoctors().map((doctor) => (
          <div key={doctor.id} className="doctor-card">
            <div className="doctor-avatar">
              {doctor.photo ? (
                <img src={doctor.photo} alt={doctor.name} />
              ) : (
                <User size={40} aria-hidden="true" />
              )}
            </div>

 <div className="doctor-info">
  <h4>{doctor.name}</h4>
  <p className="specialty">{doctor.specialty}</p>
  <div className="doctor-details">
    <div className="detail-item">
      <Calendar size={14} aria-hidden="true" />
      <span>
        {(() => {
          const today = getTodayDate();
          const totalSlots = getDoctorSlotsForDate(doctor.id, today);
          const bookedSlots = appointments.filter(
            (apt) =>
              apt.doctorId === doctor.id &&
              apt.date === today &&
              apt.status !== "cancelled"
          ).length;

          const isFull = bookedSlots >= totalSlots;
          return (
            <>
              {`${bookedSlots}/${totalSlots} slots booked`}
              {isFull && (
                <span className="fully-booked-label"> — Fully Booked</span>
              )}
            </>
          );
        })()}
      </span>
    </div>

    <div className="detail-item">
      <Clock size={14} aria-hidden="true" />
      <span>
        Available:{" "}
        {(() => {
          const today = getTodayDate();
          const totalSlots = getDoctorSlotsForDate(doctor.id, today);
          const bookedSlots = appointments.filter(
            (apt) =>
              apt.doctorId === doctor.id &&
              apt.date === today &&
              apt.status !== "cancelled"
          ).length;

          const available = totalSlots - bookedSlots;
          return available > 0 ? available : <span className="fully-booked-label">0 (Fully Booked)</span>;
        })()}
      </span>
    </div>
  </div>
</div>

            {/* Action Buttons - Moved Below */}
            <div className="doctor-actions">
              <button
                className="action-btn edit"
                onClick={() => handleEditDoctor(doctor)}
                aria-label={`Edit ${doctor.name}`}
                title={`Edit ${doctor.name}`}
              >
                <Edit size={22} aria-hidden="true" />
              </button>
              <button
                className="action-btn delete"
                onClick={() => setDeleteConfirmDoctor(doctor)}
                aria-label={`Delete ${doctor.name}`}
                title={`Delete ${doctor.name}`}
              >
                <Trash2 size={22} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    )}

    {/* Delete Confirmation Modal */}
    {deleteConfirmDoctor && (
      <div className="modal-overlay">
        <div className="modal fade-in">
          <h3>Are you sure you want to delete this doctor?</h3>
          <p className="modal-doctor-name">{deleteConfirmDoctor.name}</p>
          <div className="modal-actions">
            <button
              className="btn-secondary"
              onClick={() => setDeleteConfirmDoctor(null)}
            >
              No
            </button>
            <button
              className="btn-primary"
              onClick={() => handleConfirmDelete(deleteConfirmDoctor.id)}
            >
              Yes
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
)}

{/* Calendar Tab */}
{activeTab === "calendar" && (
  <div
    className="calendar-section"
    role="region"
    aria-label="Calendar Management"
  >
    {/* === Calendar Header === */}
    <div className="calendar-header">
      <div
        className="calendar-navigation"
        role="group"
        aria-label="Month navigation"
      >
        <button
          className="btn-icon"
          title="Previous month"
          aria-label="Previous month"
          onClick={() => navigateMonth("prev")}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>

        {/* Centered Month Display */}
        <h3 className="month-display" aria-live="polite">
          {getMonthName(calendarCurrentDate)}
        </h3>

        <button
          className="btn-icon"
          title="Next month"
          aria-label="Next month"
          onClick={() => navigateMonth("next")}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>

    {/* === Calendar Grid === */}
    <div className="calendar-grid-wrapper">
      <div className="calendar-weekdays">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="calendar-weekday">
            {day}
          </div>
        ))}
      </div>

      <div className="calendar-grid" aria-label="Doctor availability calendar">
        {(() => {
          const days = getCalendarDays();
          const firstDayOfMonth = new Date(
            calendarCurrentDate.getFullYear(),
            calendarCurrentDate.getMonth(),
            1
          ).getDay();

          const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => (
            <div key={`blank-${i}`} className="calendar-blank"></div>
          ));

          const dayButtons = days.map((day: any) => {
            const isPastDate = new Date(day.date) < new Date(getTodayDate());
            const isToday = day.date === getTodayDate();
            const totalSlots = getTotalSlotsForDate(day.date); // Ã¢Å“â€¦ now sums all doctors' slots
            const isFull =
              day.appointments.booked >= totalSlots && totalSlots > 0;

            return (
              <button
                key={day.date}
                type="button"
                className={`calendar-day ${isPastDate ? "past-date" : ""} ${
                  isToday ? "today" : ""
                } ${isFull ? "full" : ""}`}
                title={
                  isPastDate
                    ? `Past date: ${day.date}`
                    : isFull
                    ? `${day.date} - Fully booked`
                    : `View details for ${day.date}`
                }
                aria-label={`Day ${day.dayNumber}, ${
                  isPastDate
                    ? "Past date"
                    : `${day.appointments.booked} of ${totalSlots} appointments booked`
                }`}
                onClick={() => {
                  if (!isPastDate) {
                    setSelectedCalendarDate(day.date);
                    setShowCalendarModal(true);
                  }
                }}
                disabled={isPastDate}
              >
                <span className="day-number" aria-hidden="true">
                  {day.dayNumber}
                </span>

                {!isPastDate && (
                  <span className="day-appointments" aria-hidden="true">
                    {day.appointments.booked}/{totalSlots}
                  </span>
                )}
                {isPastDate && <span className="past-label">Past</span>}
              </button>
            );
          });

          return [...blanks, ...dayButtons];
        })()}
      </div>
    </div>

    {/* === Calendar Modal === */}
    {showCalendarModal && selectedCalendarDate && (
      <div
        className="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-content calendar-modal">
          <div className="modal-header">
            <div>
              <h3 id="modal-title">Manage Doctor Availability</h3>
              <p className="modal-date">{selectedCalendarDate}</p>
            </div>
            <button
              className="modal-close"
              title="Close modal"
              aria-label="Close modal"
              onClick={() => setShowCalendarModal(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="modal-body">
            {doctors.map((doctor: any) => {
              const slots = generateTimeSlotsForDoctor(
                doctor,
                selectedCalendarDate
              );
              const inputId = `toggle-${doctor.id}`;
              const doctorAvailableToday = getDoctorAvailability(
                doctor.id,
                selectedCalendarDate
              );
              const currentDoctorSlots = getDoctorSlotsForDate(
                doctor.id,
                selectedCalendarDate
              );

              return (
                <div key={doctor.id} className="doctor-schedule-card">
                  <div className="doctor-schedule-header">
                    <div className="doctor-info">
                      <User size={20} aria-hidden="true" />
                      <div>
                        <h4>{doctor.name}</h4>
                        <p>{doctor.specialty}</p>
                      </div>
                    </div>

                    {/* Toggle Switch with Label */}
                    <div className="availability-toggle">
                      <label className="switch">
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={doctorAvailableToday}
                          onChange={(e) => {
                            const newAvailability = e.target.checked;
                            handleToggleDoctorAvailability(
                              doctor.id,
                              newAvailability,
                              selectedCalendarDate
                            );
                          }}
                          aria-label={`Toggle ${doctor.name} availability for ${selectedCalendarDate}`}
                        />
                        <span className="slider round"></span>
                      </label>
                      <span className="toggle-status">
                        {doctorAvailableToday ? "Available" : "Unavailable"}
                      </span>
                    </div>
                  </div>

                  {/* Ã°Å¸â€ â€¢ Per-Doctor Slot Input */}
                  <div className="slot-control">
                    <label htmlFor={`slot-count-${doctor.id}`}>
                      Max Slots for this Day:
                    </label>
                    <input
                      id={`slot-count-${doctor.id}`}
                      type="number"
                      min={1}
                      max={50}
                      value={currentDoctorSlots}
                      onChange={(e) =>
                        handleDoctorSlotChange(
                          doctor.id,
                          selectedCalendarDate,
                          Number(e.target.value)
                        )
                      }
                      className="slot-input"
                    />
                  </div>

                  {/* Time slots */}
                  {doctorAvailableToday ? (
                    <div
                      className="time-slots-grid"
                      role="group"
                      aria-label={`Time slots for ${doctor.name}`}
                    >
                      {slots.map((slot: any) => {
                        const isBooked = appointments.some(
                          (apt) =>
                            apt.doctorId === doctor.id &&
                            apt.date === selectedCalendarDate &&
                            apt.time === slot.time &&
                            apt.status !== "cancelled"
                        );

                        const slotKey = `${doctor.id}_${selectedCalendarDate}_${slot.time}`;
                        const isManuallyDisabled =
                          doctorAvailabilitySlots[slotKey] === false;

                        let slotClass = "time-slot";
                        if (isBooked) slotClass += " booked";
                        else if (isManuallyDisabled)
                          slotClass += " manually-disabled";
                        else slotClass += " available";

                        return (
                          <button
                            key={slot.time}
                            type="button"
                            className={slotClass}
                            disabled={isBooked}
                            title={
                              isBooked
                                ? `${slot.time} - Booked`
                                : isManuallyDisabled
                                ? `${slot.time} - Click to enable`
                                : `${slot.time} - Click to disable`
                            }
                            aria-label={isBooked
                              ? `${slot.time} - Booked`
                              : isManuallyDisabled
                              ? `${slot.time} - Disabled, click to enable`
                              : `${slot.time} - Available, click to disable`}
                            onClick={() => {
                              if (!isBooked) {
                                handleToggleTimeSlot(
                                  doctor.id,
                                  selectedCalendarDate,
                                  slot.time,
                                  isManuallyDisabled
                                );
                              }
                            }}
                          >
                            {slot.time}
                            {isBooked && (
                              <span className="slot-badge booked-badge">
                                Booked
                              </span>
                            )}
                            {!isBooked && isManuallyDisabled && (
                              <span className="slot-badge disabled-badge">
                                Unavailable
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="unavailable-message">
                      Doctor is marked unavailable for this date
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}
  </div>
)}
{/* Reports Tab - Updated with Healthcare-Focused Analytics */}
{activeTab === 'reports' && (
  <div className="reports-content">

    {/* Summary Cards */}
    <div className="report-summary-grid">
      {/* Total Patients */}
      <div className="report-card summary-card">
        <div className="report-card-header">
          <Users size={24} className="report-icon" />
          <span>Total Patients</span>
        </div>
        <div className="report-value">
          {appointments.filter(apt => apt.status !== 'cancelled').length}
        </div>
        <div className="report-subtitle">All time appointments</div>
        <div className="report-trend">
          <span className="trend-positive">
            {Math.round(
              (appointments.filter(apt => apt.status !== 'cancelled').length /
                Math.max(appointments.length, 1)) * 100
            )}
            % active
          </span>
        </div>
      </div>

      {/* Completed */}
      <div className="report-card summary-card">
        <div className="report-card-header">
          <CheckCircle size={24} className="report-icon success" />
          <span>Completed</span>
        </div>
        <div className="report-value">
          {appointments.filter(apt => apt.status === 'completed').length}
        </div>
        <div className="report-subtitle">Successfully finished</div>
        <div className="report-trend">
          <span className="trend-neutral">
            {appointments.length > 0
              ? Math.round(
                  (appointments.filter(apt => apt.status === 'completed').length /
                    appointments.length) * 100
                )
              : 0}
            % completion rate
          </span>
        </div>
      </div>

      {/* This Month */}
      <div className="report-card summary-card">
        <div className="report-card-header">
          <Clock size={24} className="report-icon warning" />
          <span>This Month</span>
        </div>
        <div className="report-value">
          {appointments.filter(apt => {
            const aptDate = new Date(apt.date);
            const now = new Date();
            return (
              aptDate.getMonth() === now.getMonth() &&
              aptDate.getFullYear() === now.getFullYear() &&
              apt.status !== 'cancelled'
            );
          }).length}
        </div>
        <div className="report-subtitle">Current month activity</div>
        <div className="report-trend">
          <span className="trend-info">
            {(() => {
              const thisMonth = appointments.filter(apt => {
                const aptDate = new Date(apt.date);
                const now = new Date();
                return (
                  aptDate.getMonth() === now.getMonth() &&
                  aptDate.getFullYear() === now.getFullYear() &&
                  apt.status !== 'cancelled'
                );
              }).length;

              const lastMonth = appointments.filter(apt => {
                const aptDate = new Date(apt.date);
                const now = new Date();
                const lastMonthDate = new Date(
                  now.getFullYear(),
                  now.getMonth() - 1
                );
                return (
                  aptDate.getMonth() === lastMonthDate.getMonth() &&
                  aptDate.getFullYear() === lastMonthDate.getFullYear() &&
                  apt.status !== 'cancelled'
                );
              }).length;

              const diff = thisMonth - lastMonth;
              return diff > 0
                ? `${diff} from last month`
                : diff < 0
                ? `${Math.abs(diff)} from last month`
                : 'Same as last month';
            })()}
          </span>
        </div>
      </div>

      {/* Priority Cases */}
      <div className="report-card summary-card">
        <div className="report-card-header">
          <AlertTriangle size={24} className="report-icon error" />
          <span>Priority Cases</span>
        </div>
        <div className="report-value">
          {appointments.filter(
            apt => apt.priority === 'emergency' || apt.priority === 'urgent'
          ).length}
        </div>
        <div className="report-subtitle">
          {appointments.filter(apt => apt.priority === 'emergency').length} emergency,{' '}
          {appointments.filter(apt => apt.priority === 'urgent').length} urgent
        </div>
        <div className="report-trend">
          <span className="trend-warning">Requires attention</span>
        </div>
      </div>
    </div>

    {/* Weekly Patient Volume */}
    <div className="report-section">
      <div className="report-section-header">
        <h3>Weekly Patient Volume</h3>
        <p>Last 4 weeks appointment distribution</p>
      </div>
      <div className="report-card chart-card">
        <svg className="chart-svg" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet">
          {(() => {
            const weeklyData = getWeeklyPatientData();
            const maxCount = Math.max(...weeklyData.map(w => w.count), 1);
            const padding = 40;
            const chartWidth = 800 - padding * 2;
            const chartHeight = 300 - padding * 2;

            const points = weeklyData.map((week, index) => {
              const x = padding + (index / (weeklyData.length - 1)) * chartWidth;
              const y = padding + chartHeight - (week.count / maxCount) * chartHeight;
              return { x, y, count: week.count, label: week.label };
            });

            const createSmoothPath = (pts: typeof points): string => {
              if (pts.length === 0) return '';
              let path = `M ${pts[0].x} ${pts[0].y}`;
              for (let i = 0; i < pts.length - 1; i++) {
                const current = pts[i];
                const next = pts[i + 1];
                const controlX = (current.x + next.x) / 2;
                path += ` Q ${controlX} ${current.y}, ${next.x} ${next.y}`;
              }
              return path;
            };

            const linePath = createSmoothPath(points);
            return (
              <>
                <path d={linePath} className="weekly-line" />
                {points.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="5" className="weekly-dot" />
                    <text x={p.x} y={p.y - 15} className="weekly-text-count">{p.count}</text>
                    <text x={p.x} y={padding + chartHeight + 25} className="weekly-text-label">{p.label}</text>
                  </g>
                ))}
              </>
            );
          })()}
        </svg>
      </div>
    </div>

    {/* 6-Month Patient Trend */}
    <div className="report-section">
      <div className="report-section-header">
        <h3>6-Month Patient Trend</h3>
        <p>Appointment volume over the last 6 months</p>
      </div>
      <div className="report-card chart-card">
        <svg className="chart-svg" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet">
          {(() => {
            const monthlyTrend = getMonthlyTrend();
            const maxCount = Math.max(...monthlyTrend.map(m => m.count), 1);
            const padding = 40;
            const chartWidth = 800 - padding * 2;
            const chartHeight = 300 - padding * 2;

            const points = monthlyTrend.map((m, i) => {
              const x = padding + (i / (monthlyTrend.length - 1)) * chartWidth;
              const y = padding + chartHeight - (m.count / maxCount) * chartHeight;
              return { x, y, count: m.count, month: m.month };
            });

            const createSmoothPath = (pts: typeof points): string => {
              if (pts.length === 0) return '';
              let path = `M ${pts[0].x} ${pts[0].y}`;
              for (let i = 0; i < pts.length - 1; i++) {
                const current = pts[i];
                const next = pts[i + 1];
                const controlX = (current.x + next.x) / 2;
                path += ` Q ${controlX} ${current.y}, ${next.x} ${next.y}`;
              }
              return path;
            };

            const linePath = createSmoothPath(points);
            return (
              <>
                <path d={linePath} className="trend-line" />
                {points.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="5" className="trend-dot" />
                    <text x={p.x} y={p.y - 15} className="trend-text-count">{p.count}</text>
                    <text x={p.x} y={padding + chartHeight + 25} className="trend-text-month">{p.month}</text>
                  </g>
                ))}
              </>
            );
          })()}
        </svg>
      </div>
    </div>

    {/* Common Medical Conditions */}
    <div className="report-section">
      <div className="report-section-header">
        <h3>Common Medical Conditions</h3>
        <p>Distribution of most frequently diagnosed conditions</p>
      </div>
      <div className="report-card piechart-card">
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={getConditionStats()}
              dataKey="count"
              nameKey="condition"
              cx="50%"
              cy="50%"
              outerRadius={120}
              labelLine={false}
              label={(props) =>
                props && typeof props.name === 'string' && typeof props.percent === 'number'
                  ? `${props.name} ${(props.percent * 100).toFixed(1)}%`
                  : ''
              }
            >
              {getConditionStats().map((_, index) => {
                const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
                return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
              })}
            </Pie>
            <Tooltip formatter={(value: number) => `${value} cases`} />
            <Legend layout="horizontal" verticalAlign="bottom" align="center" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
{/* Priority Level Analysis */}
<div className="report-section">
  <div className="report-section-header">
    <h3>Priority Level Analysis</h3>
    <p>Breakdown of appointment urgency levels</p>
  </div>
  <div className="priority-cards-grid">
    {[
      { priority: 'emergency', label: 'Emergency', color: '#ef4444', icon: AlertTriangle },
      { priority: 'urgent', label: 'Urgent', color: '#f59e0b', icon: Clock },
      { priority: 'normal', label: 'Normal', color: '#10b981', icon: CheckCircle2 },
    ].map(({ priority, label, color, icon: Icon }) => {
      const count = appointments.filter(
        apt => apt.priority === priority && apt.status !== 'cancelled'
      ).length;
      const total = appointments.filter(apt => apt.status !== 'cancelled').length;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

      return (
        <div key={priority} className="priority-mini-card" data-color={color} data-percentage={percentage}>
          <div className="priority-card-header">
            <Icon className="priority-icon" />
            <span className="priority-card-label">{label}</span>
          </div>
          <div className="priority-card-value">{count}</div>
          <div className="priority-card-footer">
            <div className="priority-progress-bar">
              <div className="priority-progress-fill" data-width={percentage}></div>
            </div>
            <span className="priority-percentage">{percentage}%</span>
          </div>
        </div>
      );
    })}
  </div>
</div>

{/* Doctor Performance */}
<div className="report-section">
  <div className="report-section-header">
    <h3>Doctor Performance</h3>
    <p>Patient distribution and completion rates by doctor</p>
  </div>
  <div className="report-card">
    <div className="doctor-performance-list">
      {getDoctorPerformance().map((doctor, index) => {
        return (
          <div key={index} className="doctor-performance-item">
            <div className="doctor-performance-header">
              <div className="doctor-performance-info">
                <div className="doctor-rank-badge">{index + 1}</div>
                <div className="doctor-avatar-small doctor-icon-colored">
                  <Stethoscope size={20} />
                </div>
                <div>
                  <div className="doctor-performance-name">{doctor.name}</div>
                  <div className="doctor-performance-specialty">{doctor.specialty}</div>
                </div>
              </div>

              {/* Updated Metrics Section */}
              <div className="doctor-performance-metrics">
                <div className="metric-badge total">
                  <span className="metric-label">Total</span>
                  <span className="metric-value">{doctor.totalPatients}</span>
                </div>
              </div>
            </div>

            {/* Updated Stats Section */}
            <div className="doctor-performance-stats">
              <div className="stat-bar-container">
                {['completed', 'confirmed', 'pending'].map(type => {
                  const value = doctor[type as keyof typeof doctor] as number;
                  const percentage =
                    doctor.totalPatients > 0
                      ? Math.round((value / doctor.totalPatients) * 100)
                      : 0;
                  const barClass =
                    type === 'completed'
                      ? 'success'
                      : type === 'confirmed'
                      ? 'info'
                      : 'warning';
                  const labelColor =
                    type === 'completed'
                      ? 'text-success'
                      : type === 'confirmed'
                      ? 'text-info'
                      : 'text-warning';
                  return (
                    <div key={type} className="stat-bar-row">
                      <span className={`stat-bar-label ${labelColor}`}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </span>
                      <div className="stat-bar-track">
                        <div className={`stat-bar-fill ${barClass}`} data-width={percentage}></div>
                      </div>
                      <span className={`stat-bar-value ${labelColor}`}>{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
</div>
</div>
)}
</main>

{/* Appointment Form Modal */}
{showBookingForm && (
  <div className="modal-overlay" role="dialog" aria-modal="true">
    <div className="modal-content appointment-form-modal">
      <div className="modal-header">
        <h3>{editingAppointment ? "Edit Appointment" : "New Appointment"}</h3>
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
          {/* Patient Name */}
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
            />
          </div>

          {/* Age */}
          <div className="form-group">
            <label htmlFor="patient-age">Age</label>
            <input
              id="patient-age"
              type="number"
              name="age"
              value={appointmentForm.age}
              onChange={handleAppointmentFormChange}
              placeholder="Age"
            />
          </div>

          {/* Email */}
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
            />
          </div>

          {/* Phone */}
          <div className="form-group">
            <label htmlFor="patient-phone">Phone *</label>
            <input
              id="patient-phone"
              type="tel"
              name="phone"
              value={appointmentForm.phone}
              onChange={(e) =>
                setAppointmentForm((prev) => ({
                  ...prev,
                  phone: e.target.value.replace(/\D/g, ""),
                }))
              }
              onBlur={(e) => {
                if (!validatePhoneNumber(e.target.value)) {
                  addNotification(
                    "error",
                    "Please enter a valid PH number (09XXXXXXXXX)."
                  );
                }
              }}
              placeholder="09XXXXXXXXX"
              maxLength={11}
              required
            />
          </div>

          {/* Gender */}
          <div className="form-group">
            <label htmlFor="patient-gender">Gender</label>
            <select
              id="patient-gender"
              name="gender"
              value={appointmentForm.gender}
              onChange={handleAppointmentFormChange}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Medical Condition */}
          <div className="form-group">
            <label htmlFor="condition">Medical Condition *</label>
            <select
              id="condition"
              name="condition"
              value={appointmentForm.condition}
              onChange={handleAppointmentFormChange}
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

          {/* Custom Condition (appears only when "custom" is selected) */}
          {appointmentForm.condition === "custom" && (
            <div className="form-group">
              <label htmlFor="customCondition">
                Please specify your condition *
              </label>
              <input
                type="text"
                id="customCondition"
                name="customCondition"
                placeholder="Describe your condition"
                value={appointmentForm.customCondition}
                onChange={handleAppointmentFormChange}
                required
              />
            </div>
          )}

          {/* Priority */}
          <div className="form-group">
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              name="priority"
              value={appointmentForm.priority}
              onChange={handleAppointmentFormChange}
            >
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>

          {/* Doctor */}
          <div className="form-group">
            <label htmlFor="doctor-select">Doctor *</label>
            <select
              id="doctor-select"
              name="doctorId"
              value={appointmentForm.doctorId}
              onChange={handleAppointmentFormChange}
              required
            >
              <option value="">Select doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} - {d.specialty}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
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
            />
          </div>

         {/* Time Slots */}
{appointmentForm.doctorId && appointmentForm.date && (() => {
  // ✅ Check if doctor is available on this date
  const isDoctorAvailable = getDoctorAvailability(appointmentForm.doctorId, appointmentForm.date);
  
  // ✅ Check if doctor is fully booked
  const isFullyBooked = isDailyLimitReached(appointmentForm.doctorId, appointmentForm.date);

  // ✅ If doctor is unavailable, show message
  if (!isDoctorAvailable) {
    return (
      <div className="form-group full-width">
        <label>Available Time Slots *</label>
        <div className="doctor-unavailable-message">
          <AlertTriangle size={24} />
          <p>This doctor is not available on {appointmentForm.date}</p>
          <p className="sub-message">Please select another doctor or date</p>
        </div>
      </div>
    );
  }

  // ✅ If doctor is fully booked, show message
  if (isFullyBooked) {
    return (
      <div className="form-group full-width">
        <label>Available Time Slots *</label>
        <div className="doctor-fully-booked-message">
          <XCircle size={24} />
          <p>This doctor is fully booked on {appointmentForm.date}</p>
          <p className="sub-message">Please select another doctor or date</p>
        </div>
      </div>
    );
  }

  // ✅ Show time slots with emergency buffer labels
  return (
    <div className="form-group full-width">
      <label>Available Time Slots *</label>
      <div className="time-slots-grid">
        {generateTimeSlots(
          appointmentForm.doctorId,
          appointmentForm.date
        ).map((slot) => {
          const slotKey = `${appointmentForm.doctorId}_${appointmentForm.date}_${slot.time}`;
          const isBlocked = doctorAvailabilitySlots?.[slotKey] === false;

          return (
            <button
              key={slot.time}
              type="button"
              className={`time-slot 
                ${isBlocked ? "blocked" : ""} 
                ${!slot.available ? "booked" : ""} 
                ${slot.emergency ? "emergency-buffer" : ""}
                ${appointmentForm.time === slot.time ? "selected" : ""}`}
              onClick={() =>
                slot.available &&
                !isBlocked &&
                setAppointmentForm((prev) => ({
                  ...prev,
                  time: slot.time,
                }))
              }
              disabled={!slot.available || isBlocked}
            >
              {slot.time}
              
              {/* ✅ Emergency Buffer Label */}
              {slot.emergency && slot.available && !isBlocked && (
                <span className="emergency-buffer-label">Emergency Buffer</span>
              )}
              
              {/* Blocked Label */}
              {isBlocked && (
                <span className="unavailable-indicator">Unavailable</span>
              )}
              
              {/* Booked Label */}
              {!isBlocked && !slot.available && (
                <span className="booked-indicator">Booked</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
})()}

          {/* Notes (Optional) */}
          <div className="form-group full-width">
            <label htmlFor="appointment-notes">Additional Notes</label>
            <textarea
              id="appointment-notes"
              name="notes"
              value={appointmentForm.notes}
              onChange={handleAppointmentFormChange}
              placeholder="Any additional information..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="modal-footer">
        <button
          className="btn-secondary"
          onClick={() => {
            setShowBookingForm(false);
            setEditingAppointment(null);
            resetAppointmentForm();
          }}
        >
          Cancel
        </button>
        <button
          className={`btn-primary ${
            !appointmentForm.name ||
            !appointmentForm.email ||
            !appointmentForm.phone ||
            !appointmentForm.condition ||
            (appointmentForm.condition === "custom" && !appointmentForm.customCondition) ||
            !appointmentForm.doctorId ||
            !appointmentForm.date ||
            !appointmentForm.time
              ? "disabled"
              : ""
          }`}
          onClick={
            editingAppointment
              ? handleUpdateAppointment
              : handleCreateAppointment
          }
          disabled={
            !appointmentForm.name ||
            !appointmentForm.email ||
            !appointmentForm.phone ||
            !appointmentForm.condition ||
            (appointmentForm.condition === "custom" && !appointmentForm.customCondition) ||
            !appointmentForm.doctorId ||
            !appointmentForm.date ||
            !appointmentForm.time
          }
        >
          <Save size={16} />
          {editingAppointment ? "Update" : "Create"} Appointment
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

          {/* Photo Upload - Updated with centered label and dashed border */}
          <div className="form-group full-width">
            <label htmlFor="doctorPhoto" className="centered-label">Photo</label>
            <div className="photo-upload-container">
              <input
                type="file"
                id="doctorPhoto"
                accept="image/*"
                onChange={(e) => handlePhotoUpload(e, 'doctor')}
                className="photo-input"
                disabled={uploadingImage}
              />
              <label htmlFor="doctorPhoto" className="photo-upload-box">
                <Camera size={24} />
                <span className="upload-text">
                  {uploadingImage ? 'Uploading...' : (doctorForm.photo ? 'Change Photo' : 'Upload Photo')}
                </span>
              </label>
              {doctorForm.photo && (
                <div className="photo-preview-container">
                  <img src={doctorForm.photo} alt="Preview" className="photo-preview" />
                </div>
              )}
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
 

      {/* =============================== */}
      {/* Appointment Details Modal - UPDATED */}
      {/* =============================== */}
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
                    <span>{selectedAppointment.age || "Not specified"}</span>
                  </div>
                  <div className="detail-item">
                    <label>Gender</label>
                    <span>{selectedAppointment.gender || "Not specified"}</span>
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
                    <label>Date</label>
                    <span>
                      {new Date(selectedAppointment.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Time</label>
                    <span>{selectedAppointment.time}</span>
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
                    <span
                      className={`priority-badge ${getPriorityColor(selectedAppointment.priority)}`}
                    >
                      {selectedAppointment.priority}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Status</label>
                    <span
                      className={`status-badge ${getStatusColor(selectedAppointment.status)}`}
                    >
                      {selectedAppointment.status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Assigned By</label>
                    <span>{selectedAppointment.assignedBy || "System"}</span>
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
                className="btn-secondary"
                title="Notify Patient"
                onClick={async () => {
                  try {
                    const response = await fetch("http://localhost:5000/send-reminder", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: selectedAppointment.email,
                        phone: selectedAppointment.phone,
                        name: selectedAppointment.name,
                        doctor: selectedAppointment.doctor,
                        date: selectedAppointment.date,
                        time: selectedAppointment.time,
                      }),
                    });

                    const data = await response.json();
                    if (response.ok && data.success) {
                      addNotification(
                        "success",
                        `Reminder email sent to ${selectedAppointment.email}`
                      );
                    } else {
                      addNotification("error", data.error || "Failed to send reminder.");
                    }
                  } catch (error) {
                    console.error("Email send error:", error);
                    addNotification("error", "Server error: Could not send email notification.");
                  }
                }}
              >
                <Send size={16} aria-hidden="true" />
                Notify Patient
              </button>

              {selectedAppointment.status === "pending" && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    handleAppointmentStatusChange(selectedAppointment.id, "confirmed");
                    setShowDetailsModal(false);
                  }}
                  title="Confirm Appointment"
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Confirm
                </button>
              )}

              {selectedAppointment.status === "confirmed" && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    handleAppointmentStatusChange(selectedAppointment.id, "completed");
                    setShowDetailsModal(false);
                  }}
                  title="Complete Appointment"
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Complete
                </button>
              )}

              <button
                className="btn-secondary"
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

     {/* FOOTER - Inside main container */}
<footer className="staff-footer">
  <div className="staff-footer-content">
    <div className="staff-footer-brand">
      <img
        src="/images/bird.png"
        alt="TimeFly Logo"
        className="staff-footer-logo"
      />
      <h3 className="staff-footer-title">TimeFly</h3>
    </div>

    <p className="staff-footer-tagline">
      Making your time for care smoother and faster
    </p>

    <div className="staff-footer-copyright">
      <p>2025 TimeFly. All rights reserved.</p>
    </div>
  </div>
</footer>
    </div> 
  );
};

export default StaffDashboard;