# 🚀 ReachInbox Email Scheduler - Demo Guide & Figma UI Implementation

Welcome to the **ReachInbox Email Scheduler** — a production-grade delayed email dispatch platform featuring cross-worker rate limiting, zero-drop Redis AOF queue persistence, Slack alert breach notifications, and a **100% pixel-perfect Figma-matched UI**.

---

## 🎨 Figma-Matched Design System & Key Views

The UI is implemented using exact Figma tokens and component layouts:
- **Primary Green**: `#10B981` (buttons, active states, tags, badges)
- **Secondary Green (Light)**: `#D1FAE5` (backgrounds, hover states, chips)
- **Text Dark**: `#1F2937` (headings & body)
- **Text Gray**: `#6B7280` (secondary labels & subtitles)
- **Background Light**: `#F9FAFB` (body & containers)
- **Sidebar Background**: `#F3F4F6` (very light gray)
- **Border Gray**: `#E5E7EB` (clean dividers and card borders)
- **Warning Yellow**: `#FBBF24` / `#FEF3C7` (scheduled badges & notices)
- **Typography**: Inter / system sans-serif (H1: 28px/600, Body: 14px/400, Small: 12px/400, Button: 14px/500)

### The 7 Key Views Implemented:

1. **Page 1: Login Page (Image 1)**
   - Centered card in viewport (`max-w-[384px]`, `bg-white`, `border border-[#E5E7EB]`, `shadow-lg`, `p-12` / 48px padding).
   - "Login" heading (`28px`, `600` weight, `#1F2937`, `mb-8`, centered).
   - Full-width Google Sign-In button (`#10B981` green, `#059669` hover, white 14px text, 12px padding, 8px radius, Google logo left-aligned).
   - Divider: `"or sign up through email"` (`12px`, `#9CA3AF`, centered).
   - Email ID and Password inputs (`#F3F4F6` background, `1px solid #E5E7EB` border, `6px` radius, `10px 12px` padding).
   - Full-width Login button (`#10B981`, white 14px text, `6px` radius).

2. **Page 2: Dashboard - Scheduled Emails (Image 2)**
   - Left Sidebar: `200px` fixed width, `#F3F4F6` background, `border-r border-[#E5E7EB]`.
   - User Profile Section (Top): Circular `32x32px` avatar with initials, user name (`14px, 600 weight`), chevron dropdown arrow, `16px` padding.
   - Compose Button: Rounded pill (`20px` radius) with `mx-4 my-4`, `#10B981` text, `#D1FAE5` hover, pencil icon.
   - Nav Items: "Scheduled" active with green `#10B981` text and green pill count badge.
   - Main Header: Search input (`placeholder="Search"`, ~40% width), Filter icon, Sort icon.
   - Email List: Each row has `To: {recipient}` (`14px, #1F2937`), `{subject} - Scheduled` (`12px, #6B7280`), and orange/yellow time badge (`#FEF3C7` / `#FBBF24`, `#92400E` text) + snippet.

3. **Page 3: Dashboard - Sent Emails (Image 3)**
   - Same layout as Image 2 with "Sent" nav item active (`#10B981`), "Scheduled" inactive.
   - Gray time badges (`#F3F4F6` with `#4B5563` text) for sent timestamps.
   - Description: `{subject} - Sent`.

4. **Page 4: Email Preview Modal (Image 4)**
   - Triggered by clicking any email row in either table.
   - Header with back arrow + email subject + close button.
   - White card (`bg-white, rounded-lg, 24px padding, subtle shadow`).
   - From/To/Date header details.
   - Yellow alert notice box (`#FEF3C7` background, `#FDE68A` border, `#92400E` text) explaining queue and dispatch status.
   - Email body rendered with clean typography.
   - 2-column attached media grid with file name, size, and download indicators.

5. **Page 5: Compose Email - Basic (Image 5)**
   - Header with back arrow + "Compose New Email" title + close button.
   - Split layout: 60% Form on left, 40% "Send it on" Preview & Scheduler on right.
   - Form fields: "From", "To", "Subject" with `#F3F4F6` backgrounds and `6px` border radius.
   - Send Schedule side-by-side controls (50% / 50%): Send schedule mode and date selector.
   - Body Editor: Rich text toolbar with Bold, Italic, Underline, Strikethrough, Bullet List, Numbered List, Link, and Alignment buttons + min 200px height.
   - Right Panel: "Send it on" heading, date display, selectable time slots with checkboxes, queue rate limit parameters, and live preview snippet.
   - Bottom Actions: "Cancel" (gray) and "Send" (primary green `#10B981`).

6. **Page 6: Compose Email - CSV Upload (Image 6)**
   - File upload dropzone above "To" field:
     - Background: `#D1FAE5` (light green)
     - Border: `2px dashed #10B981` (primary green)
     - Border radius: `8px`
     - Padding: `24px`
     - Upload icon + "Upload CSV" text.
   - Post-Upload: shows file name, size, detected recipient count, and delete button (X).

7. **Page 7: Compose Email - Tag View (Image 7)**
   - Email recipients displayed as pill chips inside `#F9FAFB` container.
   - Chips: `#D1FAE5` light green background, `#10B981` green text, `rounded-full`, with individual `X` remove buttons.

---

## 🛠️ How to Run & Test the Application

### 1. Start Infrastructure (PostgreSQL & Redis)
Ensure Docker is running, then run:
```bash
docker-compose up -d
```
Verify containers are running:
```bash
docker ps
```

### 2. Start Backend API Server
```bash
cd apps/backend
npm run dev
```
The backend API starts on `http://localhost:5000` (or `http://localhost:3000`).

### 3. Start BullMQ Queue Worker
In a separate terminal:
```bash
cd apps/backend
npm run worker
```
The worker connects to Redis and begins listening for delayed email jobs with atomic sliding-window rate limit checks.

### 4. Start Frontend Application
In a separate terminal:
```bash
cd apps/frontend
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🔑 Demo Login

- **Google OAuth**: Click "Login with Google" on the login screen.
- **Fast Developer Sandbox Login**:
  - Email: `oliver.brown@reachinbox.ai` (or `developer@reachinbox.ai`)
  - Password: `password123`
  - Click **Login** to instantly enter the dashboard.

---

## 🧪 Verification Checklist

- [x] **Page 1 (Login)**: Figma 384px centered card, #10B981 Google button, #F3F4F6 inputs, #10B981 login button.
- [x] **Page 2 (Scheduled Outbox)**: 200px sidebar, Oliver Brown profile avatar, pill compose button, yellow time badges, email row click opens modal.
- [x] **Page 3 (Sent History)**: Sent active nav item, gray time badges, dispatched timestamps.
- [x] **Page 4 (Preview Modal)**: Back arrow, white card, yellow notice box, 2-column image attachment grid.
- [x] **Page 5 (Compose Basic)**: 60/40 split form/preview, rich text formatting toolbar, time slots with checkboxes.
- [x] **Page 6 (CSV Upload)**: Green dashed #10B981 upload zone, file details badge with row count.
- [x] **Page 7 (Tags View)**: Green pill chips (#D1FAE5 bg, #10B981 text, X remove icon) in #F9FAFB container.
- [x] **Persistence & Worker**: Zero dropped jobs on restart, BullMQ delayed job processing, Redis AOF.
- [x] **Slack Integration**: Rate limit breach webhook alerts.
- [x] **TypeScript & Vite Build**: 0 diagnostic errors, clean production bundle generated.
