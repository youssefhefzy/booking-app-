# 📅 Bookly — Smart Appointment Booking PWA

A production-ready, installable appointment booking Progressive Web App built for service businesses. Clients book online in minutes; owners manage everything from a live admin dashboard.

**Live Demo:** [your-deploy-url.vercel.app](https://your-deploy-url.vercel.app)  
**Admin Panel:** [your-deploy-url.vercel.app/admin.html](https://your-deploy-url.vercel.app/admin.html)

---

## ✨ Features

### Client Side
- **3-step booking wizard** — Service → Date & Time → Details
- **Smart calendar** — Weekends and past dates are disabled automatically
- **Real-time slot availability** — Booked times are blocked instantly
- **PWA installable** — Add to home screen, works offline
- **Mobile-first** — Fully responsive on all devices

### Admin Dashboard
- **Live bookings feed** — Real-time updates via Supabase subscriptions
- **Booking management** — Confirm, complete, or cancel with one click
- **Stats overview** — Total bookings, pending count, revenue
- **Search & filter** — By name, email, date, or status
- **Calendar view** — See appointment density at a glance
- **CSV export** — Download all bookings as a spreadsheet
- **Simple auth** — Password-protected admin access

---

## 🛠 Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | Vanilla HTML, CSS, JavaScript (ES6+)|
| Database   | Supabase (PostgreSQL)               |
| Real-time  | Supabase Realtime                   |
| PWA        | Service Worker + Web App Manifest   |
| Hosting    | Vercel / Netlify                    |
| Auth       | Password-protected admin page       |

---

## 🚀 Setup Guide

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/bookly.git
cd bookly
```

### 2. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Open the **SQL Editor** and paste the contents of `supabase-schema.sql`
3. Click **Run** — this creates all tables, seeds demo services, and sets up RLS

### 3. Add your Supabase credentials

Open `app.js` and replace the placeholder values at the top:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
```

Find these in your Supabase dashboard under **Project Settings → API**.

### 4. Change the admin password

Open `admin.js` and change:

```javascript
const ADMIN_PASSWORD = 'admin123'; // ← change this!
```

> For production, move auth to Supabase Auth or a server-side check.

### 5. Deploy

#### Vercel
```bash
npx vercel --prod
```
Or connect your GitHub repo in the Vercel dashboard.

#### Netlify
```bash
npx netlify deploy --prod --dir .
```
Or drag-and-drop the folder into [app.netlify.com](https://app.netlify.com).

---

## 📁 Project Structure

```
bookly/
├── index.html          # Client booking page
├── admin.html          # Owner dashboard
├── style.css           # Shared design system
├── app.js              # Booking wizard + Supabase logic
├── admin.js            # Admin dashboard logic
├── sw.js               # Service worker (PWA + offline)
├── manifest.json       # PWA manifest
├── vercel.json         # Vercel deployment config
├── netlify.toml        # Netlify deployment config
├── supabase-schema.sql # Full database schema + seed data
└── icons/              # PWA icons (add your own)
```

---

## 🎨 Customization

### Change business name / branding
- Update `"name"` and `"short_name"` in `manifest.json`
- Change `Bookly` in `index.html` and `admin.html` navbars
- Update the `--gold` color in `style.css` to match your brand

### Modify services
Edit the seed data in `supabase-schema.sql`, or manage directly in the Supabase Table Editor.

### Adjust working hours / slot interval
In `app.js`, update the `generateSlots()` call:
```javascript
generateSlots(workStart = 9, workEnd = 18, interval = 30)
```

### Customize availability (days off, holidays)
The `availability` table in Supabase controls which days of the week are open. You can extend this to support holidays with a `blocked_dates` table.

---

## 🗄️ Database Schema

```
services        — id, name, description, duration_minutes, price, is_active
availability    — id, day_of_week (0-6), start_time, end_time, is_active
bookings        — id, service_id, client_name, client_email, client_phone,
                  booking_date, booking_time, status, notes, created_at
```

**Booking statuses:** `pending` → `confirmed` → `completed` / `cancelled`

---

## 📱 PWA Icons

Add your icons to the `icons/` folder:
- `icon-192.png` — 192×192px
- `icon-512.png` — 512×512px

You can generate these from any image at [maskable.app](https://maskable.app).

---

## 🔒 Security Notes

- Row Level Security (RLS) is enabled on all tables
- Anonymous users can only **read** services and **insert** bookings
- All admin actions happen client-side with password auth — for higher security, replace with Supabase Auth
- HTML output is escaped to prevent XSS

---

## 📄 License

MIT — free to use for client projects.

---

Built by [Your Name](https://github.com/YOUR_USERNAME) · Part of a freelance PWA portfolio
