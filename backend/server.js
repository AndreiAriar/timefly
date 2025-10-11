import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import admin from "firebase-admin";

// ✅ Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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

// ============================
// 🔧 In-memory store for codes
// ============================
const codes = {};

// ============================
// 🔧 Nodemailer Transporter
// ============================
const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER || "yourbackup@gmail.com",
      pass: process.env.EMAIL_PASS || "yourapppassword",
    },
  });

// ============================
// 🛠️ Health Check
// ============================
app.get("/ping", (req, res) => {
  res.json({ success: true, message: "Backend is alive!" });
});

// ============================
// 🔑 Send Verification Code
// ============================
app.post("/send-code", async (req, res) => {
  const { email } = req.body;
  if (!email)
    return res.status(400).json({ success: false, error: "Email is required" });

  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    codes[email.toLowerCase()] = { code, createdAt: Date.now() };

    console.log(`📨 Code generated for ${email}: ${code}`);

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"TimeFly" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your TimeFly Verification Code",
      html: `<h2>Your verification code is:</h2><h1>${code}</h1>`,
    });

    res.json({ success: true, message: "Verification code sent!" });
  } catch (error) {
    console.error("❌ Error sending verification email:", error.message);
    res.status(500).json({ success: false, error: "Failed to send email" });
  }
});

// ============================
// 🔑 Verify Code
// ============================
app.post("/verify-code", (req, res) => {
  const { email, code } = req.body;
  console.log("🔍 Incoming verify-code request:", req.body);

  if (!email || !code) {
    return res
      .status(400)
      .json({ success: false, error: "Email and code are required" });
  }

  const record = codes[email.toLowerCase()];
  if (!record) {
    return res
      .status(400)
      .json({ success: false, error: "No code found for this email" });
  }

  const expired = Date.now() - record.createdAt > 5 * 60 * 1000;
  if (expired) {
    delete codes[email.toLowerCase()];
    return res
      .status(400)
      .json({ success: false, error: "Verification code expired" });
  }

  if (record.code !== code.trim()) {
    return res.status(400).json({ success: false, error: "Invalid code" });
  }

  delete codes[email.toLowerCase()];
  res.json({ success: true, message: "Code verified successfully" });
});

// ============================
// 📧 Send Appointment Reminder
// ============================
app.post("/send-reminder", async (req, res) => {
  const { email, name, date, time } = req.body;
  console.log("📩 Reminder request received:", req.body);

  if (!email || !date || !time) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"TimeFly Clinic" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "📅 Appointment Reminder - TimeFly Clinic",
      html: `
        <h2>Hello ${name || "Patient"},</h2>
        <p>This is a friendly reminder of your upcoming appointment:</p>
        <ul>
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Time:</strong> ${time}</li>
        </ul>
        <p>⏰ Please arrive at least <strong>10 minutes</strong> before your scheduled time.</p>
        <p>Thank you,<br/>TimeFly Clinic</p>
      `,
    });

    console.log(`✅ Reminder email sent to ${email}`);
    res.json({ success: true, message: "Reminder email sent!" });
  } catch (error) {
    console.error("❌ Error sending reminder email:", error.message);
    res.status(500).json({ success: false, error: "Failed to send reminder" });
  }
});

// ============================
// 💬 Send Feedback Message
// ============================
app.post("/send-feedback", async (req, res) => {
  const { rating, comment, name, email, subject, message } = req.body;
  console.log("💌 Feedback received:", req.body);

  if (!((rating && comment) || (name && email && subject && message))) {
    return res
      .status(400)
      .json({ success: false, error: "All feedback fields are required" });
  }

  try {
    const transporter = createTransporter();
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
        <div style="font-family: 'Poppins', sans-serif; color: #222;">
          <h2>📬 New Feedback Received</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <blockquote style="background:#f7f7f7; padding:15px; border-left:4px solid #00a896;">
            ${message}
          </blockquote>
          <hr style="border:none;border-top:1px solid #ccc; margin:20px 0;">
          <p style="font-size:0.9rem; color:#555;">This feedback was sent via the TimeFly Healthcare Feedback System.</p>
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
    console.log("📦 Feedback saved to Firestore:", feedbackData);

    await transporter.sendMail({
      from: `"TimeFly Feedback" <${process.env.EMAIL_USER}>`,
      to: "timefly.healthcare@gmail.com",
      replyTo: email || process.env.EMAIL_USER,
      subject: subject
        ? `🩺 New Feedback: ${subject}`
        : `🩺 New Rating Feedback: ${rating}/5`,
      html: emailContent,
    });

    if (email) {
      await transporter.sendMail({
        from: `"TimeFly Clinic" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "💬 Thanks for your feedback!",
        html: `
          <h2>Thank you, ${name || "Valued Patient"}!</h2>
          <p>We’ve received your feedback and truly appreciate your time and thoughts.</p>
          <p>Our team will review it shortly to improve your TimeFly experience. 💙</p>
          <br/>
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

  if (!appointmentId || !name || !reason) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });
  }

  try {
    const transporter = createTransporter();

    // Format the date nicely
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

    // Send email to clinic
    await transporter.sendMail({
      from: `"TimeFly Clinic" <${process.env.EMAIL_USER}>`,
      to: "timefly.healthcare@gmail.com",
      subject: `❌ Appointment Cancellation - ${name}`,
      html: `
        <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #991b1b; margin: 0;">⚠️ Appointment Cancelled</h2>
          </div>
          
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #374151;">Patient Information</h3>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email || "N/A"}</p>
            <p style="margin: 5px 0;"><strong>Appointment ID:</strong> ${appointmentId}</p>
          </div>

          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #374151;">Appointment Details</h3>
            <p style="margin: 5px 0;"><strong>Doctor:</strong> ${doctor || "N/A"}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${formattedDate || "N/A"}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${time || "N/A"}</p>
          </div>

          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #92400e;">Cancellation Reason</h3>
            <p style="color: #78350f; line-height: 1.6;">${reason}</p>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          
          <p style="font-size: 0.875rem; color: #6b7280; text-align: center;">
            This cancellation notification was automatically sent from TimeFly's appointment management system.
          </p>
        </div>
      `,
    });

    console.log(`✅ Cancellation email sent to clinic for appointment ${appointmentId}`);
    res.json({ success: true, message: "Cancellation email sent successfully!" });
  } catch (error) {
    console.error("❌ Error sending cancellation email:", error.message);
    res.status(500).json({ success: false, error: "Failed to send cancellation email" });
  }
});

// ============================
// 🛑 404 Handler
// ============================
app.use((req, res) => {
  console.warn(`⚠️ Route not found: ${req.originalUrl}`);
  res
    .status(404)
    .json({ success: false, error: `Route not found: ${req.originalUrl}` });
});

// ============================
// 🚀 Start Server
// ============================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
