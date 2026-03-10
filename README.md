## Smart Parking System

This is a browser-based **Smart Parking System**  demo with three roles:

- **User**: Books parking slots and receives an OTP.
- **Security**: Uses the OTP to validate vehicle entry and exit.
- **Admin**: Monitors all bookings and adds new parking slots.

### Features

- Real-time style parking grid (Available / Booked / Occupied / Expired).
- OTP-based booking and validation flow.
- Admin console with booking monitor and force-release actions.
- State persisted locally using `localStorage` so page refreshes keep data.

### Getting Started

You can run this project in two main ways:

#### 1. Using Live Server (recommended for quick demo)

1. Open the project folder `Smart Parking system` in VS Code.
2. Install the **Live Server** extension (if you don’t have it).
3. Right-click `web/index.html` and choose **“Open with Live Server”**.
4. Your browser will open (usually at `http://127.0.0.1:5500/...`) and the app will work fully from there.

> **Note:** This project is designed to work when opened through Live Server (or any simple HTTP server). Opening `index.html` directly from the file system (`file://`) may break some functionality.

#### 2. Using npm dev server

If you already have Node.js and npm installed:

1. Open a terminal in the project root (`Smart Parking system`).
2. Install dependencies (if any) and run:

   ```bash
   npm install
   npm run dev
   ```

3. Open the URL shown in the terminal (often `http://localhost:3000`).

### Demo Credentials

When you choose **Security** or **Admin**, the login form shows the demo username and password on screen. Current values (from `web/app.js`):

- **Security**
  - Username: `guard`
  - Password: `secure@123`
- **Admin**
  - Username: `admin`
  - Password: `admin@123`

The **User** role does **not** require a username or password.

# Smart Parking System – OTP Flow Demo

An interactive single-page website that demonstrates a smart parking experience using a one-time password (OTP) instead of QR codes. The UI walks through three phases: reservation, entry activation, and exit/billing, backed by a lightweight front-end simulation of the backend logic.

## Features

- Live parking map with dynamic slot states (`Available`, `Booked`, `Occupied`, `Expired`)
- Reservation form with automated OTP generation and 15-minute grace period
- Entry workflow that validates OTPs against bookings, enforces punctual arrivals, and logs system activity
- Exit workflow that finalizes billing, frees the slot, and archives the booking
- Background “cleanup daemon” simulation that expires bookings when the grace window lapses
- Rich UI styling with responsive layout, activity log, and booking table

## Getting Started

1. Open `web/index.html` in a modern browser (Chrome, Edge, Firefox, Safari). No build step is required.
2. Use the booking form to reserve an available slot. The system generates a 6-digit OTP and displays the grace expiry.
3. Enter the OTP in the “Activate Parking” form to simulate entry before the grace period ends.
4. Complete the exit flow with the same OTP to close the session and release the slot.

## Project Structure

```
web/
├─ index.html    # UI layout and content
├─ styles.css    # Styling and layout rules
└─ app.js        # Front-end state machine & OTP logic
```

## Notes & Extensions

- Clipboard APIs require https or localhost to work everywhere. Fallback messaging covers manual copying.
- Adjust the grace period by editing `GRACE_PERIOD_MINUTES` in `app.js`.
- Replace the simulated state machine with real API calls by swapping `state` interactions for `fetch` requests to your backend.
- Add persistence (localStorage or database) to survive page refreshes if needed.


