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

Happy building!











