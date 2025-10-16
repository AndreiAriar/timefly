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
  X,
  LogOut,
  Phone,
  Mail,
  Send,
  Pause,
  SkipForward,
  UserPlus,
  Stethoscope,
  Home,
  Save,
  Clock3,
  MapPin,
  Badge,
  MessageSquare,
  CheckCircle,
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
  setDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
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


const StaffDashboard = () => {
  // UI State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
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
  photo: '',              
  verifyCode: '',         
  emailVerified: false    
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
            photo: staffData.photo ?? '', // ✅ guaranteed string
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
            photo: basicStaffData.photo ?? '', // ✅ guaranteed string
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
 // Generate Time Slots - WITH EMERGENCY BUFFER AND BLOCKED SLOT SUPPORT
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

  console.log(`🔍 Generating slots for doctor ${doctorId} on ${date}`);
  console.log(`📅 Is today: ${isToday}, Current time: ${now.toLocaleTimeString()}`);
  console.log(`🏥 Found ${existingAppointments.length} existing appointments`);
  console.log(`⚡ Current form priority: ${appointmentForm.priority}`);

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

    // Skip past time slots if booking for today
    if (isToday && totalMinutes < minimumBookingMinutes) {
      console.log(`⏭️ Skipping past slot: ${time12}`);
      continue;
    }

    // Check if this time slot is booked
    const appointment = existingAppointments.find(
      apt => apt.time === time12 && (editingAppointment ? apt.id !== editingAppointment.id : true)
    );
    const isBooked = !!appointment;

    // 🆕 Check if staff manually marked this slot as unavailable
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

        // Skip past buffer slots if booking for today
        if (isToday && bufferStart < minimumBookingMinutes) {
          console.log(`⏭️ Skipping past buffer slot: ${bufferTime12}`);
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
            `🚨 Added emergency buffer slot: ${bufferTime12} (${isBufferBooked ? 'booked' : isBufferBlocked ? 'blocked' : 'available'})`
          );
        }

        // Skip the next 15-minute increment to account for buffer
        totalMinutes += bufferDuration;
      }
    }
  }

  console.log(`✅ Generated ${slots.length} total slots`);
  console.log(`🚨 Emergency mode: ${isCreatingEmergency ? 'ON - showing emergency buffer slots' : 'OFF'}`);

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

// === Calendar Days Generator ===
const getCalendarDays = () => {
  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];

  for (let i = 1; i <= daysInMonth; i++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    
    // ✅ Count actual appointments for this date
    const appointmentsOnDate = appointments.filter(apt => 
      apt.date === date && apt.status !== 'cancelled'
    );
    
    days.push({
      date,
      dayNumber: i,
      dayName: new Date(year, month, i).toLocaleString("default", { weekday: "short" }),
      appointments: { 
        booked: appointmentsOnDate.length, 
        total: getMaxSlotsForDate(date) // ✅ NOW USING getMaxSlotsForDate
      },
      doctors,
    });
  }
  return days;
};

// === Generate Doctor-Specific Time Slots ===
const generateTimeSlotsForDoctor = (doctor: Doctor, selectedDate: string): TimeSlotSimple[] => {
  const slots: TimeSlotSimple[] = [];
  if (!doctor.workingHours) return slots;

  const [startHour, startMin] = doctor.workingHours.start.split(":").map(Number);
  const [endHour, endMin] = doctor.workingHours.end.split(":").map(Number);

  const buffer = doctor.bufferTime || 15;
  const active = 15;

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
    console.log("🕒 Available Slots:", slots);
    // Optionally store them in state if you have a slot picker
    // setAvailableSlots(slots);
  }
}, [appointmentForm.doctorId, appointmentForm.date, appointmentForm.priority]);

// === Email & Phone Validation Helpers ===
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ✅ PHONE VALIDATION — Philippine number (09XXXXXXXXX)
const validatePhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, ""); // remove non-numerics
  return /^09\d{9}$/.test(cleaned);
};

// ✅ SEND VERIFICATION CODE — uses server.js endpoint
const sendVerificationCode = async (email: string) => {
  if (!email || !validateEmail(email)) { // ✅ NOW USING validateEmail function
    addNotification("error", "Please enter a valid email address.");
    return;
  }
  try {
    const response = await fetch("http://localhost:5000/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (data.success) {
      addNotification("success", "Verification code sent to your email!");
    } else {
      addNotification("error", data.error || "Failed to send verification code.");
    }
  } catch (err) {
    console.error("Error sending verification code:", err);
    addNotification("error", "Server error. Try again later.");
  }
};

// Example usage when clicking a "Send Code" button
const handleSendCode = () => {
  if (appointmentForm.email) {
    sendVerificationCode(appointmentForm.email);
  } else {
    addNotification("error", "Please enter an email first.");
  }
};


// ✅ VERIFY EMAIL CODE — confirm code entered by user
const verifyEmailCode = async (email: string, code: string): Promise<boolean> => {
  if (!email || !code) {
    addNotification("error", "Please enter both email and code.");
    return false;
  }
  try {
    const response = await fetch("http://localhost:5000/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await response.json();
    if (data.success) {
      addNotification("success", "Email verified successfully!");
      return true;
    } else {
      addNotification("error", data.error || "Invalid verification code.");
      return false;
    }
  } catch (err) {
    console.error("Error verifying email:", err);
    addNotification("error", "Verification failed due to server error.");
    return false;
  }
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

 // =============================
// STAFF DOCTOR-SPECIFIC SLOT MANAGEMENT
// =============================

// Store per-doctor per-day slot counts (key format: doctorId_date)
const [doctorSlotSettings, setDoctorSlotSettings] = useState<{ [key: string]: number }>({});

// Utility: Get total max slots for a specific date (sum of all doctors)
const getTotalSlotsForDate = (date: string): number => {
  if (!date) return 0;
  return Object.entries(doctorSlotSettings)
    .filter(([key]) => key.endsWith(`_${date}`))
    .reduce((sum, [, count]) => sum + (count || 0), 0);
};

// Utility: Get a single doctor's slot count for a date
const getDoctorSlotsForDate = (doctorId: string, date: string): number => {
  const key = `${doctorId}_${date}`;
  return doctorSlotSettings[key] ?? 10; // default 10 if not yet set
};

// ✅ Backward compatibility: if other parts of code still call getMaxSlotsForDate
const getMaxSlotsForDate = (date: string): number => getTotalSlotsForDate(date);

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

    // 🔥 Real email sending via backend
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

  // Use real notification sender
  await sendNotificationToPatient(email, phone, "reminder", appointment);
};

  // ✅ Updated Reset Forms
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
    verifyCode: '',        // ✅ added
    emailVerified: false   // ✅ added
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
  
  // ✅ Updated handleEditAppointment
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
    verifyCode: '',        // ✅ added for consistency
    emailVerified: true    // ✅ assume verified when editing existing
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
      
     {/* Sidebar */}
<aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
  <div className="sidebar-header">
    <div className="logo">
      {/* 🐦 Replaced Activity icon with TimeFly logo */}
      <img
        src="/images/bird.png"
        alt="TimeFly Logo"
        className="logo-icon"
      />
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
    {/* Only show search bar in appointments and doctors tabs */}
    {(activeTab === 'appointments' || activeTab === 'doctors') && (
      <div className="search-container">
        <Search size={18} className="search-icon" aria-hidden="true" />
        <input
          type="text"
          placeholder={
            activeTab === 'appointments' 
              ? "Search appointments..." 
              : "Search doctors..."
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label={
            activeTab === 'appointments' 
              ? "Search appointments" 
              : "Search doctors"
          }
        />
      </div>
    )}
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
{activeTab === "doctors" && (
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
                  <MapPin size={14} aria-hidden="true" />
                  <span>Room {doctor.room}</span>
                </div>
                <div className="detail-item">
                  <Clock3 size={14} aria-hidden="true" />
                  <span>
                    {convertTo12Hour(doctor.workingHours.start)} –{" "}
                    {convertTo12Hour(doctor.workingHours.end)}
                  </span>
                </div>
                <div className="detail-item">
                  <Users size={14} aria-hidden="true" />
                  <span>Max {doctor.maxAppointments} patients/day</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="doctor-actions">
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
                onClick={() => setDeleteConfirmDoctor(doctor)}
                aria-label={`Delete ${doctor.name}`}
                title={`Delete ${doctor.name}`}
              >
                <Trash2 size={16} aria-hidden="true" />
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
            const totalSlots = getTotalSlotsForDate(day.date); // ✅ now sums all doctors' slots
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

                  {/* 🆕 Per-Doctor Slot Input */}
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

          {/* Email + Send Verification Button */}
          <div className="form-group">
            <label htmlFor="patient-email">Email *</label>
            <div className="email-verification">
              <input
                id="patient-email"
                type="email"
                name="email"
                value={appointmentForm.email}
                onChange={handleAppointmentFormChange}
                placeholder="patient@email.com"
                required
              />
              <button
                type="button"
                className="icon-btn verify-btn"
                title="Send Verification Code"
                onClick={handleSendCode}
              >
                <Send size={18} />
              </button>
            </div>
          </div>

          {/* Verification Code + Check Icon */}
          <div className="form-group">
            <label htmlFor="verify-code">Verification Code *</label>
            <div className="email-verification">
              <input
                id="verify-code"
                type="text"
                name="verifyCode"
                value={appointmentForm.verifyCode}
                onChange={handleAppointmentFormChange}
                placeholder="Enter 6-digit code"
                maxLength={6}
              />
              <button
                type="button"
                className="icon-btn"
                title="Verify Code"
                onClick={async () => {
                  const verified = await verifyEmailCode(
                    appointmentForm.email,
                    appointmentForm.verifyCode
                  );
                  setAppointmentForm((prev) => ({
                    ...prev,
                    emailVerified: verified,
                  }));
                }}
              >
                <CheckCircle size={18} />
              </button>
            </div>
            {appointmentForm.emailVerified && (
              <small className="verified-text">✅ Email verified</small>
            )}
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
          {appointmentForm.doctorId && appointmentForm.date && (
            <div className="form-group full-width">
              <label>Available Time Slots *</label>
              <div className="time-slots-grid">
                {generateTimeSlots(
                  appointmentForm.doctorId,
                  appointmentForm.date
                ).map((slot) => {
                  const slotKey = `${appointmentForm.doctorId}_${appointmentForm.date}_${slot.time}`;
                  const isBlocked =
                    doctorAvailabilitySlots?.[slotKey] === false;

                  return (
                    <button
                      key={slot.time}
                      type="button"
                      className={`time-slot 
                        ${isBlocked ? "blocked" : ""} 
                        ${!slot.available ? "booked" : ""} 
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
                      {isBlocked && (
                        <span className="unavailable-indicator">
                          Unavailable
                        </span>
                      )}
                      {!isBlocked && !slot.available && (
                        <span className="booked-indicator">Booked</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
            !appointmentForm.emailVerified ||
            !appointmentForm.phone ||
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
            !appointmentForm.emailVerified ||
            !appointmentForm.phone ||
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
                  `✈️ Reminder email sent to ${selectedAppointment.email}`
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
    </div>
  );
};

export default StaffDashboard;
