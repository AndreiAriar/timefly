/**
 * One-time script to repair doctorId mismatches in Firestore
 *   - Fixes users/{doctor} profiles with correct doctorId
 *   - Fixes appointments/{id} doctorId if wrong
 *
 * Run with: node fixDoctorIdsAndAppointments.js
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Load service account using require()
import pkg from "module";
const { createRequire } = pkg;
const require = createRequire(import.meta.url);
const serviceAccount = require("./serviceAccountKey.json");

// --- Init Firebase Admin ---
initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id, // 👈 explicitly set
});

const db = getFirestore();

async function fixDoctorIdsAndAppointments() {
  console.log("🔍 Checking doctorId consistency...");

  const usersSnap = await db.collection("users").get();
  const doctorsSnap = await db.collection("doctors").get();
  const appointmentsSnap = await db.collection("appointments").get();

  const doctors = doctorsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // ✅ Map doctor email/name → doctorId
  const doctorLookup = {};
  for (const d of doctors) {
    if (d.email) doctorLookup[d.email] = d.id;
    if (d.name) doctorLookup[d.name] = d.id;
  }

  let fixedUsers = 0;
  let fixedAppointments = 0;

  // --- Fix Users (Doctors) ---
  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    if (userData.role !== "Doctor") continue;

    const hasValidId =
      typeof userData.doctorId === "string" &&
      doctors.some((d) => d.id === userData.doctorId);

    if (!hasValidId) {
      let resolvedId;

      // Match by email or name
      if (userData.email && doctorLookup[userData.email]) {
        resolvedId = doctorLookup[userData.email];
      } else if (userData.name && doctorLookup[userData.name]) {
        resolvedId = doctorLookup[userData.name];
      }

      if (resolvedId) {
        await userDoc.ref.update({ doctorId: resolvedId });
        console.log(
          `✅ Fixed doctorId for user "${userData.name}" (${userDoc.id}) → ${resolvedId}`
        );
        fixedUsers++;
      } else {
        console.warn(
          `⚠️ No matching doctor found for user "${userData.name}" (${userDoc.id})`
        );
      }
    }
  }

  // --- Fix Appointments ---
  for (const apptDoc of appointmentsSnap.docs) {
    const appt = apptDoc.data();

    if (!appt.doctorId) continue; // skip if no doctorId

    const hasValidId = doctors.some((d) => d.id === appt.doctorId);

    if (!hasValidId) {
      let resolvedId;

      if (appt.doctorEmail && doctorLookup[appt.doctorEmail]) {
        resolvedId = doctorLookup[appt.doctorEmail];
      } else if (appt.doctorName && doctorLookup[appt.doctorName]) {
        resolvedId = doctorLookup[appt.doctorName];
      }

      if (resolvedId) {
        await apptDoc.ref.update({ doctorId: resolvedId });
        console.log(
          `✅ Fixed doctorId for appointment "${apptDoc.id}" → ${resolvedId}`
        );
        fixedAppointments++;
      } else {
        console.warn(
          `⚠️ Could not resolve doctorId for appointment "${apptDoc.id}" (doctorName: ${appt.doctorName || "?"})`
        );
      }
    }
  }

  console.log(
    `🎉 Done! Fixed ${fixedUsers} doctor profile(s) and ${fixedAppointments} appointment(s).`
  );
}

fixDoctorIdsAndAppointments().catch((err) => {
  console.error("❌ Error fixing doctorIds:", err);
});
