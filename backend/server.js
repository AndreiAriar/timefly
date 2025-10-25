import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import admin from "firebase-admin";

// ✅ Load environment variables
dotenv.config();

const app = express();
app.use(cors());
// ✅ INCREASED PAYLOAD LIMIT TO HANDLE BASE64 IMAGES
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================
// 🔥 Initialize Firebase Admin SDK
// ============================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        : undefined,
    }),
  });
}

const db = getFirestore();
const authAdmin = getAuth();

// ============================
// 📧 In-memory store for codes
// ============================
const codes = {};

// ============================
// 📧 Nodemailer Transporter Setup
// ============================
let transporter = null;

const initializeTransporter = () => {
  console.log("🔧 Initializing email transporter...");
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("❌ EMAIL_USER or EMAIL_PASS not found in environment variables!");
    console.error("⚠️ Please set them in your .env file");
    return null;
  }

  console.log(`📧 Email User: ${process.env.EMAIL_USER}`);
  console.log(`🔑 Email Pass: ${process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET'}`);

  const newTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Verify configuration
  newTransporter.verify((error, success) => {
    if (error) {
      console.error("❌ Email transporter verification failed:", error.message);
      console.error("💡 Make sure you're using a Gmail App Password, not your regular password");
      console.error("💡 Generate one at: https://myaccount.google.com/apppasswords");
    } else {
      console.log("✅ Email transporter is ready to send messages");
    }
  });

  return newTransporter;
};

// Initialize transporter on startup
transporter = initializeTransporter();

// ============================
// 🛠️ Health Check
// ============================
app.get("/ping", (req, res) => {
  res.json({ 
    success: true, 
    message: "Backend is alive!",
    emailConfigured: !!transporter && !!process.env.EMAIL_USER
  });
});

// ============================
// 🧪 Test Email Endpoint
// ============================
app.get("/test-email", async (req, res) => {
  if (!transporter) {
    return res.status(500).json({ 
      success: false, 
      error: "Email transporter not configured. Check EMAIL_USER and EMAIL_PASS in .env" 
    });
  }

  try {
    console.log("🧪 Sending test email...");
    const info = await transporter.sendMail({
      from: `"TimeFly Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: "🧪 Test Email from TimeFly",
      html: "<h2>✅ Email configuration is working!</h2><p>If you received this, your email setup is correct.</p>",
    });
    
    console.log("✅ Test email sent! Message ID:", info.messageId);
    res.json({ success: true, message: "Test email sent! Check your inbox.", messageId: info.messageId });
  } catch (error) {
    console.error("❌ Test email failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================
// 🔍 Check if Email Exists
// ============================
app.post("/check-email", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const userRecord = await authAdmin.getUserByEmail(normalizedEmail);
    console.log(`⚠️ Email ${normalizedEmail} is already registered (UID: ${userRecord.uid})`);
    return res.json({ 
      success: true, 
      exists: true,
      message: "Email is already registered" 
    });
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log(`✅ Email ${normalizedEmail} is available`);
      return res.json({ 
        success: true, 
        exists: false,
        message: "Email is available" 
      });
    }
    
    console.error("❌ Error checking email:", error.message);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to check email availability" 
    });
  }
});

// ============================
// 📨 Send Verification Code
// ============================
app.post("/send-code", async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required" });
  }

  if (!transporter) {
    console.error("❌ Email transporter not initialized!");
    return res.status(500).json({ 
      success: false, 
      error: "Email service not configured. Please contact administrator." 
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Double-check email doesn't exist
    try {
      await authAdmin.getUserByEmail(normalizedEmail);
      return res.status(400).json({ 
        success: false, 
        error: "This email is already registered" 
      });
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    codes[normalizedEmail] = { 
      code, 
      createdAt: Date.now() 
    };

    console.log(`📨 Code generated for ${normalizedEmail}: ${code}`);

    // Send email with detailed logging
    const mailOptions = {
      from: `"TimeFly" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your TimeFly Verification Code",
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto;">
          <h2 style="color:#0056b3;">🔐 Your Verification Code</h2>
          <div style="background:#f0f8ff;padding:20px;border-radius:10px;text-align:center;margin:20px 0;">
            <div style="font-size:32px;font-weight:bold;color:#0056b3;letter-spacing:5px;">${code}</div>
          </div>
          <p style="font-size:16px;">This code will expire in <strong>5 minutes</strong>.</p>
          <p style="color:#666;font-size:14px;">If you didn't request this code, please ignore this email.</p>
          <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
          <p style="color:#999;font-size:12px;">© TimeFly Healthcare System</p>
        </div>
      `,
    };

    console.log(`📧 Attempting to send email to ${email}...`);
    console.log(`📧 From: ${mailOptions.from}`);
    console.log(`📧 To: ${mailOptions.to}`);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email sent successfully!`);
    console.log(`📬 Message ID: ${info.messageId}`);
    console.log(`📋 Response: ${info.response}`);

    res.json({ success: true, message: "Verification code sent!" });
  } catch (error) {
    console.error("❌ Error sending verification email:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    res.status(500).json({ 
      success: false, 
      error: `Failed to send email: ${error.message}` 
    });
  }
});

// ============================
// 🔓 Verify Code
// ============================
app.post("/verify-code", (req, res) => {
  const { email, code } = req.body;
  console.log("🔍 Incoming verify-code request:", req.body);

  if (!email || !code) {
    return res.status(400).json({ 
      success: false, 
      error: "Email and code are required" 
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim();

  const record = codes[normalizedEmail];
  if (!record) {
    return res.status(400).json({ 
      success: false, 
      error: "No code found for this email. Please request a new code." 
    });
  }

  const expired = Date.now() - record.createdAt > 5 * 60 * 1000;
  if (expired) {
    delete codes[normalizedEmail];
    return res.status(400).json({ 
      success: false, 
      error: "Verification code expired. Please request a new code." 
    });
  }

  if (record.code !== normalizedCode) {
    console.log(`❌ Code mismatch for ${normalizedEmail}: expected ${record.code}, got ${normalizedCode}`);
    return res.status(400).json({ 
      success: false, 
      error: "Invalid code. Please check and try again." 
    });
  }

  delete codes[normalizedEmail];
  console.log(`✅ Code verified successfully for ${normalizedEmail}`);
  
  res.json({ success: true, message: "Code verified successfully" });
});

// ============================
// 📧 Send Appointment Reminder
// ============================
app.post("/send-reminder", async (req, res) => {
  const { email, phone, name, date, time } = req.body;
  console.log("📩 Reminder request received:", req.body);

  if (!transporter) {
    return res.status(500).json({ success: false, error: "Email service not configured" });
  }

  if (!email && !phone) {
    return res.status(400).json({ success: false, error: "At least email or phone is required" });
  }
  
  if (!date || !time) {
    return res.status(400).json({ success: false, error: "Missing appointment date/time" });
  }

  try {
    if (email) {
      await transporter.sendMail({
        from: `"TimeFly Clinic" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "📅 Appointment Reminder - TimeFly Clinic",
        html: `
          <div style="font-family:Arial,sans-serif;padding:20px">
            <h2>Hello ${name || "Patient"},</h2>
            <p>This is a friendly reminder of your upcoming appointment:</p>
            <ul>
              <li><strong>Date:</strong> ${date}</li>
              <li><strong>Time:</strong> ${time}</li>
            </ul>
            <p>⏰ Please arrive at least <strong>10 minutes early</strong>.</p>
            <p>Thank you,<br/>TimeFly Clinic</p>
          </div>
        `,
      });
      console.log(`✅ Reminder email sent to ${email}`);
    }

    if (phone) {
      console.log(`📱 Reminder would be sent to phone: ${phone}`);
    }

    res.json({ success: true, message: "Reminder notification sent successfully!" });
  } catch (error) {
    console.error("❌ Error sending reminder:", error.message);
    res.status(500).json({ success: false, error: "Failed to send reminder" });
  }
});

// ============================
// 💬 Send Queue Position Notification
// ============================
app.post("/send-queue-notification", async (req, res) => {
  const { name, email, phone, queueNumber, totalQueue } = req.body;

  if (!email && !phone) {
    return res.status(400).json({ success: false, error: "Email or phone is required" });
  }

  if (!queueNumber) {
    return res.status(400).json({ success: false, error: "Queue number is required" });
  }

  try {
    // Email notification
    if (email && transporter) {
      await transporter.sendMail({
        from: `"TimeFly Clinic" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "⏱️ Queue Update - TimeFly Clinic",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Hi ${name || "Patient"},</h2>
            <p>You are currently <strong>#${queueNumber}</strong> in the queue${totalQueue ? ` out of ${totalQueue} patients` : ""}.</p>
            <p>⏰ Please arrive at least <strong>10 minutes early</strong> before your appointment.</p>
            <p>Thank you for your patience!</p>
            <p>— The TimeFly Clinic Team</p>
          </div>
        `,
      });
      console.log(`✅ Queue email sent to ${email}`);
    }

    // (Optional) SMS support placeholder
    if (phone) {
      console.log(`📱 Queue SMS would be sent to ${phone}: You are #${queueNumber} in queue. Please arrive 10 minutes early.`);
      // Future: integrate Twilio API here if SMS is enabled
    }

    res.json({ success: true, message: "Queue notification sent successfully!" });
  } catch (error) {
    console.error("❌ Error sending queue notification:", error.message);
    res.status(500).json({ success: false, error: "Failed to send queue notification" });
  }
});

// ============================
// 💬 Send Feedback Message
// ============================
app.post("/send-feedback", async (req, res) => {
  const { rating, comment, name, email, subject, message } = req.body;
  console.log("💌 Feedback received:", req.body);

  if (!transporter) {
    return res.status(500).json({ success: false, error: "Email service not configured" });
  }

  if (!((rating && comment) || (name && email && subject && message))) {
    return res.status(400).json({ success: false, error: "All feedback fields are required" });
  }

  try {
    let emailContent = "";

    if (rating && comment) {
      emailContent = `
        <h2>🩺 New Feedback Received</h2>
        <p><strong>Rating:</strong> ${rating} ⭐</p>
        <p><strong>Comments:</p>
        <blockquote style="background:#f4f4f4;padding:10px;border-radius:8px;">
          ${comment}
        </blockquote>
        <p>💌 Sent via TimeFly Feedback Form</p>
      `;
    } else {
      emailContent = `
        <div style="font-family:'Poppins',sans-serif;color:#222;">
          <h2>📬 New Feedback Received</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <blockquote style="background:#f7f7f7;padding:15px;border-left:4px solid #00a896;">
            ${message}
          </blockquote>
          <p style="font-size:0.9rem;color:#555;">Sent via TimeFly Healthcare Feedback System.</p>
        </div>
      `;
    }

    const feedbackData = {
      name: name || "Anonymous",
      email: email || "N/A",
      subject: subject || "Rating Feedback",
      message: message || comment,
      rating: rating || null,
      createdAt: new Date().toISOString(),
    };
    await db.collection("feedbacks").add(feedbackData);
    console.log("📦 Feedback saved to Firestore");

    await transporter.sendMail({
      from: `"TimeFly Feedback" <${process.env.EMAIL_USER}>`,
      to: "timefly.healthcare@gmail.com",
      replyTo: email || process.env.EMAIL_USER,
      subject: subject ? `🩺 New Feedback: ${subject}` : `🩺 New Rating Feedback: ${rating}/5`,
      html: emailContent,
    });

    if (email) {
      await transporter.sendMail({
        from: `"TimeFly Clinic" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "💬 Thanks for your feedback!",
        html: `
          <h2>Thank you, ${name || "Valued Patient"}!</h2>
          <p>We've received your feedback and truly appreciate your time.</p>
          <p>Our team will review it shortly. 💙</p>
          <p>Warm regards,<br/><strong>The TimeFly Team</strong></p>
        `,
      });
      console.log(`📨 Auto-reply sent to ${email}`);
    }

    res.json({ success: true, message: "Feedback sent and saved successfully!" });
  } catch (error) {
    console.error("❌ Error sending feedback:", error.message);
    res.status(500).json({ success: false, error: "Failed to send feedback" });
  }
});

// ============================
// ❌ Send Appointment Cancellation Email
// ============================
app.post("/send-cancellation", async (req, res) => {
  const { appointmentId, name, email, date, time, doctor, reason } = req.body;
  console.log("📩 Cancellation request:", req.body);

  if (!transporter) {
    return res.status(500).json({ success: false, error: "Email service not configured" });
  }

  if (!appointmentId || !name || !reason) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    let formattedDate = date;
    if (date) {
      const [year, month, day] = date.split("-");
      const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
      formattedDate = dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    await transporter.sendMail({
      from: `"TimeFly Clinic" <${process.env.EMAIL_USER}>`,
      to: "timefly.healthcare@gmail.com",
      subject: `❌ Appointment Cancellation - ${name}`,
      html: `
        <div style="font-family:'Poppins',sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#991b1b;">⚠️ Appointment Cancelled</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email || "N/A"}</p>
          <p><strong>Doctor:</strong> ${doctor || "N/A"}</p>
          <p><strong>Date:</strong> ${formattedDate || "N/A"}</p>
          <p><strong>Time:</strong> ${time || "N/A"}</p>
          <h3>Reason:</h3>
          <blockquote>${reason}</blockquote>
        </div>
      `,
    });

    console.log(`✅ Cancellation email sent for appointment ${appointmentId}`);
    res.json({ success: true, message: "Cancellation email sent successfully!" });
  } catch (error) {
    console.error("❌ Error sending cancellation email:", error.message);
    res.status(500).json({ success: false, error: "Failed to send cancellation email" });
  }
});

// ============================
// 👨‍⚕️ Create Doctor Account (NEW ENDPOINT)
// ============================
app.post('/create-doctor-account', async (req, res) => {
  const { email, name, specialty, doctorId, phone } = req.body; // ✅ Photo removed from destructuring
  
  console.log('👨‍⚕️ Creating doctor account for:', email);

  if (!email || !name || !specialty || !doctorId) {
    return res.status(400).json({ 
      success: false, 
      error: "Missing required fields: email, name, specialty, or doctorId" 
    });
  }

  if (!transporter) {
    return res.status(500).json({ 
      success: false, 
      error: "Email service not configured" 
    });
  }

  try {
    // Step 1: Check if user already exists
    let userExists = false;
    try {
      await authAdmin.getUserByEmail(email);
      userExists = true;
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    if (userExists) {
      return res.status(400).json({ 
        success: false, 
        error: "A user with this email already exists" 
      });
    }

    // Step 2: Create Firebase Auth user
    console.log('🔐 Creating Firebase Auth account...');
    const userRecord = await authAdmin.createUser({
      email: email,
      displayName: name,
      // photoURL removed - will be updated separately from frontend
    });
    console.log('✅ Firebase Auth user created:', userRecord.uid);

    // Step 3: Create user document in Firestore
    console.log('📝 Creating Firestore user document...');
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: email,
      name: name,
      role: 'Doctor',
      specialty: specialty,
      department: specialty,
      doctorId: doctorId,
      phone: phone || '',
      photo: '', // Empty initially - will be updated by frontend if photo exists
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      permissions: [
        'view_own_appointments',
        'manage_own_appointments',
        'view_own_schedule'
      ]
    });
    console.log('✅ Firestore user document created');

    // Step 4: Generate and send password reset email
    console.log('📧 Generating password reset link...');
    const passwordResetLink = await authAdmin.generatePasswordResetLink(email);
    console.log('✅ Password reset link generated');
    
    console.log('📨 Sending welcome email...');
    await transporter.sendMail({
      from: `"TimeFly Medical" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🩺 Welcome! Set Your Password - TimeFly Medical',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #0056b3; margin-bottom: 20px;">Welcome to TimeFly Medical, Dr. ${name}!</h2>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Your doctor account has been created by our staff team. We're excited to have you on board!
            </p>
            
            <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>📧 Email:</strong> ${email}</p>
              <p style="margin: 5px 0;"><strong>🩺 Specialty:</strong> ${specialty}</p>
            </div>
            
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              To access your dashboard and start viewing your appointments, please set your password by clicking the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${passwordResetLink}" 
                 style="background-color: #4CAF50; color: white; padding: 14px 35px; 
                        text-decoration: none; border-radius: 5px; display: inline-block; 
                        font-size: 16px; font-weight: bold;">
                🔐 Set Your Password
              </a>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                ⏰ <strong>Important:</strong> This link will expire in 1 hour for security reasons.
              </p>
            </div>
            
            <p style="font-size: 14px; color: #666; line-height: 1.6;">
              If you need a new link, please contact our support team or use the "Forgot Password" option on the login page.
            </p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            
            <p style="color: #999; font-size: 12px; line-height: 1.5;">
              If you didn't expect this email, please contact our support team immediately at 
              <a href="mailto:${process.env.EMAIL_USER}" style="color: #0056b3;">${process.env.EMAIL_USER}</a>
            </p>
            
            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
              © ${new Date().getFullYear()} TimeFly Healthcare System. All rights reserved.
            </p>
          </div>
        </div>
      `
    });
    console.log('✅ Welcome email sent successfully');

    res.json({ 
      success: true, 
      message: 'Doctor account created and password setup email sent',
      uid: userRecord.uid 
    });

  } catch (error) {
    console.error('❌ Error creating doctor account:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create doctor account';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'This email is already registered in the system';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address format';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage
    });
  }
});

// ============================
// 🛑 404 Handler
// ============================
app.use((req, res) => {
  console.warn(`⚠️ Route not found: ${req.originalUrl}`);
  res.status(404).json({ success: false, error: `Route not found: ${req.originalUrl}` });
});

// ============================
// 🚀 Start Server
// ============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📧 Email User: ${process.env.EMAIL_USER || 'NOT SET'}`);
  console.log(`🔑 Email Pass: ${process.env.EMAIL_PASS ? 'SET (' + process.env.EMAIL_PASS.length + ' chars)' : 'NOT SET'}`);
  console.log(`\n🧪 Test endpoints:`);
  console.log(`   - Health Check: http://localhost:${PORT}/ping`);
  console.log(`   - Test Email: http://localhost:${PORT}/test-email`);
});