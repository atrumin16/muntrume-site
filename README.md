# 🏁 Muntrume Motorsport: Official Team Portal

Welcome to the official repository for **Muntrume Motorsport**.  
Created by **Alberto Trujillo**, this project has evolved from a simple showcase into a **dynamic management platform** for our iRacing team. It combines public information for fans with private tools for our drivers to share telemetry and setups securely.

![Status](https://img.shields.io/badge/Status-Active-success)
![Tech](https://img.shields.io/badge/Stack-HTML%20%7C%20JS%20%7C%20Supabase-blue)

---

## 🌟 About the Project

This web application serves a dual purpose:
1.  **Public Showcase:** The online home for fans to meet the drivers, follow race results, and view our media gallery.
2.  **Team Garage (Internal):** A secure area where authenticated team members can manage the **Setup Database**.

### Key Features
* **🏎️ Setup Database:** A searchable library of car setups (Ferrari 296 GT3, Porsche 911, etc.) filtered by car, track, and simulator.
* **🔐 User Authentication:** Secure Login and Registration system powered by **Supabase Auth**.
* **🛡️ Role-Based Access Control (RBAC):**
    * **Guests:** Can view public pages.
    * **Drivers (Users):** Can upload setups and delete *only* their own files.
    * **Admins:** Have full control to manage content (via database roles).
* **📱 Responsive Design:** Optimized for desktop, tablets, and mobile devices.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3 (Custom Grid/Flexbox), Vanilla JavaScript (ES6+).
* **Backend / Database:** [Supabase](https://supabase.com/) (PostgreSQL).
* **Authentication:** Supabase Auth (Email/Password).
* **Security:** Row Level Security (RLS) policies to protect data integrity.

---

## 📂 Project Structure

The project follows a clean, asset-based structure:

```plaintext
muntrume-motorsport/
├── assets/
│   ├── css/            # Global styles and responsive definitions
│   ├── img/            # Logos, car liveries, and optimized webp images
│   ├── js/             # Application logic
│   │   ├── auth.js     # Global auth state handler & Supabase config
│   │   ├── script.js   # UI interactions (menu, animations)
│   │   └── index.js    # Homepage specific logic
│   └── video/          # Hero background videos
├── index.html          # Landing Page (Public)
├── setups.html         # Garage / Setup Database (Protected/Dynamic)
├── login.html          # Authentication Gateway
├── team.html           # Team Roster
├── news.html           # Latest Results
└── README.md           # Documentation
