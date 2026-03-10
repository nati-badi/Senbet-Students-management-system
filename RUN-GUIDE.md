# 🚀 Senbet Student Management: Run Guide

This project consists of three "portals" and a unified cloud database. Here is how to run and verify everything.

---

## 1. 🖥️ Admin Portal (Desktop & Web)
The Admin Portal is the master control center for student registration, ID generation, and system settings.

- **To run in the Browser**:
  1. Open a terminal in the root folder.
  2. Run: `npm run dev`
  3. Open: `http://localhost:5173/admin`
- **To run as a Desktop App**:
  1. Open a terminal in the root folder.
  2. Run: `npm run tauri:dev` (This opens the local desktop window).

---

## 2. 📱 Teacher Portal (Mobile App)
The Teacher Portal is used in the classroom for marking attendance and recording assessment marks.

- **Setup**: Download the **Expo Go** app on your phone (Android or iOS).
- **Run**:
  1. Open a terminal in the root folder.
  2. Run: `cd mobile`
  3. Run: `npx expo start`
  4. Scan the QR code with your phone's camera (iOS) or the Expo Go app (Android).

---

## 3. 👨‍👩‍👧‍👦 Parent Portal (Web App)
The Parent Portal allows parents to view their child's progress using a Student ID.

- **To run**:
  1. Run the same `npm run dev` command from the root.
  2. Open: `http://localhost:5173/parent`

---

## 4. 🗄️ Unified Database (Supabase)
All three portals sync to the same cloud database in real-time.

- **How to check the data**:
  1. Go to your **Supabase Dashboard** (https://supabase.com).
  2. Select your project.
  3. Click the **Table Editor** (grid icon on the left).
  4. Select tables like `students`, `attendance`, or `marks` to see the live records.
- **Sync Logic**:
  - The **Admin Desktop** app has a "Sync" button (top right) to push/pull data.
  - The **Mobile App** pulls data automatically on refresh.
  - The **Parent Portal** queries the database directly.

---

## 🛠️ Troubleshooting
- **Syntax Error?** Make sure you have renamed `.env.example` to `.env` and added your Supabase keys.
- **Network Error?** Ensure your PC and Phone are on the same Wi-Fi for the Mobile QR code to work.
