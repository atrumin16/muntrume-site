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
```

---

## 🚀 Installation & Setup

To run this project locally, follow these steps:

1. **Clone the repository:**
```bash
git clone [https://github.com/your-username/muntrume-motorsport.git](https://github.com/your-username/muntrume-motorsport.git)
cd muntrume-motorsport

```
2. **Configure Supabase:**
* Create a project at [Supabase.com](https://supabase.com).
* Execute the SQL Schema provided in `docs/schema.sql` (or see below) to create the `profiles` and `setups` tables.
* Enable **RLS (Row Level Security)** policies.

3. **Connect the App:**
* Open `assets/js/auth.js`.
* Replace `PROJECT_URL` and `ANON_KEY` with your specific project credentials.

```javascript
const PROJECT_URL = '[https://your-project-id.supabase.co](https://your-project-id.supabase.co)';
const ANON_KEY = 'your-anon-key';

```
4. **Run:**
* Simply open `index.html` in your browser (or use Live Server in VS Code).
---

## 🗄️ Database Schema (Quick Reference)

The project relies on two main tables in Supabase:

* **`profiles`**: Extends the default auth user with `full_name` and `role`.
* **`setups`**: Stores setup metadata (`car`, `track`, `link`, `author_id`).

> **Security Note:** This project uses RLS policies.
> * `SELECT`: Public (Anon).
> * `INSERT`: Authenticated Users only.
> * `DELETE`: Owners only (or Admins).
> 
> 

---

## 📞 Contact

**Muntrume Motorsport** - [Twitter/X](https://twitter.com/MuntrumeNVRCTM) | [Instagram](https://www.instagram.com/MuntrumeMotorsport/)

Project Link: [https://muntrumemotorsport.es/](https://muntru.me)

```

```
