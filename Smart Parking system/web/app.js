const GRACE_PERIOD_MINUTES = 15;
const EARLY_CHECKIN_MINUTES = 15;
const HOURLY_RATE = 80;
const STORAGE_KEY = "smart-parking-state-v1";
const DEFAULT_SLOT_IDS = ["A1", "A2", "A3", "B1", "B2", "C1", "C2", "D1"];
const credentials = {
  security: { username: "guard", password: "secure@123" },
  admin: { username: "admin", password: "admin@123" },
};

const state = {
  slots: DEFAULT_SLOT_IDS.map((id) => ({ id, status: "Available" })),
  bookings: [],
  selectedSlotId: null,
  currentRole: null,
};

const selectors = {
  views: {
    login: document.querySelector("#loginView"),
    user: document.querySelector("#userView"),
    security: document.querySelector("#securityView"),
    admin: document.querySelector("#adminView"),
  },
  loginForm: document.querySelector("#loginForm"),
  roleSelect: document.querySelector("#loginForm select[name='role']"),
  loginUsername: document.querySelector("#loginForm input[name='username']"),
  loginPassword: document.querySelector("#loginForm input[name='password']"),
  loginFields: document.querySelectorAll("[data-auth-field]"),
  loginHint: document.querySelector("[data-login-hint]"),
  loginError: document.querySelector("[data-login-error]"),
  logoutButtons: document.querySelectorAll("[data-action='logout']"),
  userSlotGrid: document.querySelector("#userSlotGrid"),
  userBookingForm: document.querySelector("#userBookingForm"),
  userSelectedSlot: document.querySelector("[data-selected-slot]"),
  bookingSummary: document.querySelector("#bookingSummary"),
  summaryFields: {
    slot: document.querySelector("#bookingSummary [data-field='slot']"),
    start: document.querySelector("#bookingSummary [data-field='start']"),
    name: document.querySelector("#bookingSummary [data-field='name']"),
    plate: document.querySelector("#bookingSummary [data-field='plate']"),
    otp: document.querySelector("#bookingSummary [data-field='otp']"),
    grace: document.querySelector("#bookingSummary [data-field='grace']"),
  },
  copyOtp: document.querySelector("[data-action='copy-otp']"),
  eventLog: document.querySelector("#eventLog"),
  securityCheckInForm: document.querySelector("#securityCheckInForm"),
  securityCheckOutForm: document.querySelector("#securityCheckOutForm"),
  adminSlotGrid: document.querySelector("#adminSlotGrid"),
  adminBookingTable: document.querySelector("#adminBookingTable"),
  addSlotForm: document.querySelector("#addSlotForm"),
  bookingRowTemplate: document.querySelector("#bookingRowTemplate"),
};

function init() {
  loadStateFromStorage();
  syncSlotStatuses();
  cleanupExpiredBookings({ silent: true });
  bindEvents();
  handleRoleChange();
  renderAll();
  addLog("System ready. Awaiting role selection.");
  setInterval(cleanupExpiredBookings, 30 * 1000);
}

function bindEvents() {
  selectors.loginForm.addEventListener("submit", handleLogin);
  selectors.roleSelect.addEventListener("change", handleRoleChange);
  selectors.logoutButtons.forEach((btn) =>
    btn.addEventListener("click", () => setRole(null)),
  );
  selectors.userBookingForm.addEventListener("submit", handleUserBooking);
  selectors.securityCheckInForm.addEventListener("submit", handleSecurityCheckIn);
  selectors.securityCheckOutForm.addEventListener("submit", handleSecurityCheckOut);
  selectors.addSlotForm.addEventListener("submit", handleAddSlot);
  selectors.copyOtp.addEventListener("click", copyLatestOtp);
  if (selectors.adminBookingTable) {
    selectors.adminBookingTable.addEventListener("click", handleAdminBookingClick);
  }
}

function handleLogin(event) {
  event.preventDefault();
  setLoginError("");
  const formData = new FormData(event.target);
  const role = formData.get("role");
  if (!role) {
    return;
  }
  if (role === "security" || role === "admin") {
    const username = selectors.loginUsername.value.trim();
    const password = selectors.loginPassword.value;
    const expected = credentials[role];
    if (
      !expected ||
      username.toLowerCase() !== expected.username.toLowerCase() ||
      password !== expected.password
    ) {
      setLoginError("Invalid username or password.");
      addLog(`Failed ${role} login attempt.`, "error");
      return;
    }
  }
  setRole(role);
  event.target.reset();
  handleRoleChange();
}

function setRole(role) {
  const previousRole = state.currentRole;
  state.currentRole = role;
  
  // Save current state before switching roles to ensure nothing is lost
  if (previousRole) {
    saveStateToStorage();
  }
  
  // Reload state from storage when switching roles to ensure latest data
  if (role) {
    loadStateFromStorage();
    syncSlotStatuses();
  }
  
  Object.entries(selectors.views).forEach(([key, element]) => {
    if (key === role) {
      element.classList.add("active");
    } else {
      element.classList.remove("active");
    }
  });

  if (role) {
    selectors.views.login.classList.add("hidden");
    addLog(`Logged in as ${capitalize(role)}.`);
  } else {
    selectors.views.login.classList.remove("hidden");
    addLog("Returned to login screen.");
    handleRoleChange();
  }
  renderAll();
}

function handleUserBooking(event) {
  event.preventDefault();
  if (state.currentRole !== "user") {
    addLog("Only users can create bookings.", "error");
    return;
  }
  const formData = new FormData(event.target);
  const slotId = state.selectedSlotId ?? formData.get("slotId");
  if (!slotId) {
    addLog("Select an available slot before booking.", "error");
    return;
  }

  const slot = getSlot(slotId);
  if (!slot || slot.status !== "Available") {
    addLog(`Slot ${slotId} is no longer available.`, "error");
    selectSlot(null);
    renderAll();
    return;
  }

  const date = formData.get("startDate");
  const time = formData.get("startTime");
  const name = formData.get("fullName").trim();
  const phone = formData.get("phone").trim();
  const plate = formData.get("plate").trim().toUpperCase();

  const startTime = combineDateTime(date, time);
  if (!startTime || Number.isNaN(startTime.getTime())) {
    addLog("Enter a valid date and time.", "error");
    return;
  }

  const now = new Date();
  if (startTime < now) {
    addLog("Booking time must be in the future.", "error");
    return;
  }

  const graceExpiry = new Date(startTime.getTime() + GRACE_PERIOD_MINUTES * 60000);
  const otp = String(generateOtp());
  const booking = {
    id: crypto.randomUUID(),
    slotId,
    user: { name, phone, plate },
    otp: otp,
    startTime,
    graceExpiry,
    entryTime: null,
    exitTime: null,
    status: "Booked",
    entryScanner: null,
    exitScanner: null,
  };

  state.bookings.push(booking);
  updateSlotStatus(slotId, "Booked");
  saveStateToStorage();
  selectSlot(null);
  event.target.reset();
  showBookingSummary(booking);
  renderAll();
  addLog(
    `Booking confirmed for ${booking.user.name} on slot ${slotId}. OTP ${booking.otp}.`,
  );
}

function handleSecurityCheckIn(event) {
  event.preventDefault();
  if (state.currentRole !== "security") {
    addLog("Security credentials required for check-in.", "error");
    return;
  }
  
  // Refresh state from storage to ensure we have latest bookings
  loadStateFromStorage();
  syncSlotStatuses();
  
  const formData = new FormData(event.target);
  const otp = sanitizeOtp(formData.get("otp"));
  const scannerId = formData.get("scannerId")?.trim();
  
  if (!otp || otp.length !== 6) {
    addLog(`Entry denied. Invalid OTP format.`, "error");
    return;
  }
  
  const booking = findBookingByOtp(otp);

  if (!booking) {
    addLog(`Entry denied. OTP ${otp} not found. (Total bookings: ${state.bookings.length})`, "error");
    return;
  }

  if (booking.status === "Completed" || booking.status === "Expired") {
    addLog(`Entry denied. Booking ${booking.id} is ${booking.status}.`, "error");
    return;
  }

  if (booking.status === "Occupied") {
    addLog(`Booking ${booking.id} already checked in.`, "error");
    return;
  }

  const now = new Date();
  const earliestCheckIn = new Date(
    booking.startTime.getTime() - EARLY_CHECKIN_MINUTES * 60000,
  );

  if (now < earliestCheckIn) {
    addLog(
      `Entry denied. Booking ${booking.id} opens for entry at ${formatDateTime(
        earliestCheckIn,
      )}.`,
      "error",
    );
    return;
  }

  if (now > booking.graceExpiry) {
    expireBooking(booking, true);
    return;
  }

  booking.status = "Occupied";
  booking.entryTime = now;
  booking.entryScanner = scannerId;
  updateSlotStatus(booking.slotId, "Occupied");
  saveStateToStorage();
  event.target.reset();
  renderAll();
  addLog(
    `Entry success. ${booking.user.name} activated slot ${booking.slotId} at ${scannerId}.`,
  );
}

function handleSecurityCheckOut(event) {
  event.preventDefault();
  if (state.currentRole !== "security") {
    addLog("Security credentials required for check-out.", "error");
    return;
  }
  
  // Refresh state from storage to ensure we have latest bookings
  loadStateFromStorage();
  syncSlotStatuses();
  
  const formData = new FormData(event.target);
  const otp = sanitizeOtp(formData.get("otp"));
  const booking = findBookingByOtp(otp);

  if (!booking) {
    addLog(`Exit denied. OTP ${otp} not found.`, "error");
    return;
  }

  if (booking.status !== "Occupied") {
    addLog(`Exit denied. Booking ${booking.id} is ${booking.status}.`, "error");
    return;
  }

  booking.status = "Completed";
  booking.exitTime = new Date();
  booking.exitScanner = "EXIT-GATE";
  updateSlotStatus(booking.slotId, "Available");
  saveStateToStorage();
  event.target.reset();
  renderAll();

  addLog(
    `Exit complete for ${booking.user.name}. Slot ${booking.slotId} released. Charge ₹${calculateCost(
      booking,
    )}.`,
  );
}

function handleAddSlot(event) {
  event.preventDefault();
  if (state.currentRole !== "admin") {
    addLog("Only admins can add new slots.", "error");
    return;
  }
  const formData = new FormData(event.target);
  const slotId = formData.get("slotId").trim().toUpperCase();

  if (!slotId) {
    addLog("Enter a valid slot label.", "error");
    return;
  }

  if (state.slots.some((slot) => slot.id === slotId)) {
    addLog(`Slot ${slotId} already exists.`, "error");
    return;
  }

  state.slots.push({ id: slotId, status: "Available" });
  saveStateToStorage();
  event.target.reset();
  renderAll();
  addLog(`Admin added new slot ${slotId}.`);
}

function renderAll() {
  syncSlotStatuses();
  renderUserSlots();
  renderAdminSlots();
  renderAdminBookingTable();
  saveStateToStorage();
}

function renderUserSlots() {
  if (!selectors.userSlotGrid) return;
  selectors.userSlotGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();

  state.slots.forEach((slot) => {
    const div = document.createElement("div");
    div.className = `slot slot--${slot.status.toLowerCase()}`;
    if (slot.status !== "Available") {
      div.classList.add("disabled");
    }
    if (state.selectedSlotId === slot.id) {
      div.classList.add("selected");
    }
    div.dataset.slotId = slot.id;
    div.innerHTML = `
      <div>${slot.id}</div>
      <div class="slot__status status--${slot.status.toLowerCase()}">${slot.status}</div>
    `;
    if (slot.status === "Available") {
      div.addEventListener("click", () => selectSlot(slot.id));
    }
    fragment.appendChild(div);
  });

  selectors.userSlotGrid.appendChild(fragment);
}

function renderAdminSlots() {
  if (!selectors.adminSlotGrid) return;
  selectors.adminSlotGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();

  state.slots
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((slot) => {
    const div = document.createElement("div");
    div.className = `slot slot--${slot.status.toLowerCase()}`;
    div.innerHTML = `
      <div>${slot.id}</div>
      <div class="slot__status status--${slot.status.toLowerCase()}">${slot.status}</div>
    `;
    fragment.appendChild(div);
    });

  selectors.adminSlotGrid.appendChild(fragment);
}

function selectSlot(slotId) {
  state.selectedSlotId = slotId;
  selectors.userBookingForm.elements.slotId.value = slotId ?? "";
  selectors.userSelectedSlot.textContent = slotId ?? "None";
  renderUserSlots();
}

function showBookingSummary(booking) {
  selectors.bookingSummary.classList.remove("hidden");
  selectors.summaryFields.slot.textContent = booking.slotId;
  selectors.summaryFields.start.textContent = formatDateTime(booking.startTime);
  selectors.summaryFields.name.textContent = booking.user.name;
  selectors.summaryFields.plate.textContent = booking.user.plate;
  selectors.summaryFields.otp.textContent = booking.otp;
  selectors.summaryFields.grace.textContent = formatTime(booking.graceExpiry);
}

function renderAdminBookingTable() {
  if (!selectors.adminBookingTable) return;
  const table = selectors.adminBookingTable;
  table.innerHTML = "";

  if (state.bookings.length === 0) {
    table.innerHTML =
      '<div class="table__empty">No bookings yet. Activity will appear here.</div>';
    return;
  }

  const header = document.createElement("div");
  header.className = "table__header";
  header.innerHTML = `
    <div>Booking ID</div>
    <div>Slot</div>
    <div>Status</div>
    <div>OTP</div>
    <div>Grace Expiry</div>
    <div>Entry Time</div>
    <div>Actions</div>
  `;
  table.appendChild(header);

  state.bookings
    .slice()
    .reverse()
    .map((booking) => [booking, getSlot(booking.slotId)?.id ?? booking.slotId])
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([booking]) => booking)
    .forEach((booking) => {
      const row = selectors.bookingRowTemplate.content.cloneNode(true);
      row.querySelector("[data-field='id']").textContent = truncateId(booking.id);
      row.querySelector("[data-field='slot']").textContent = booking.slotId;
      row.querySelector("[data-field='status']").textContent = booking.status;
      row.querySelector("[data-field='otp']").textContent =
        booking.status === "Completed" || booking.status === "Expired"
          ? "—"
          : booking.otp;
      row.querySelector("[data-field='grace']").textContent = formatTime(
        booking.graceExpiry,
      );
      row.querySelector("[data-field='entry']").textContent = booking.entryTime
        ? formatTime(booking.entryTime)
        : "—";
      const actionsCell = row.querySelector("[data-field='actions']");
      if (booking.status === "Booked" || booking.status === "Occupied") {
        actionsCell.innerHTML = `
          <button
            type="button"
            class="table__action"
            data-action="force-release"
            data-booking-id="${booking.id}"
          >
            Force Release
          </button>
        `;
      } else {
        actionsCell.textContent = "—";
      }
      if (booking.status === "Booked" || booking.status === "Occupied") {
        const checklist = document.createElement("ul");
        checklist.className = "otp-list";
        const entryItem = document.createElement("li");
        entryItem.textContent = `OTP: ${booking.otp}`;
        checklist.appendChild(entryItem);
        actionsCell.appendChild(checklist);
      }
      table.appendChild(row);
    });
}

function cleanupExpiredBookings(options = {}) {
  const { silent = false } = options;
  const now = new Date();
  state.bookings.forEach((booking) => {
    if (booking.status === "Booked" && now > booking.graceExpiry) {
      expireBooking(booking, false, silent);
    }
  });
  if (!silent) {
    saveStateToStorage();
  }
}

function expireBooking(booking, fromEntryAttempt = false, silent = false) {
  booking.status = "Expired";
  updateSlotStatus(booking.slotId, "Available");
  saveStateToStorage();
  renderAll();
  if (!silent) {
    const message = fromEntryAttempt
      ? `Entry denied. Booking ${booking.id} expired. Notify ${booking.user.name} to rebook.`
      : `Booking ${booking.id} expired. Message sent to ${booking.user.name}: please book again.`;
    addLog(message, "error");
  }
}

function updateSlotStatus(slotId, status) {
  const slot = getSlot(slotId);
  if (slot) {
    slot.status = status;
  }
}

function getSlot(slotId) {
  return state.slots.find((slot) => slot.id === slotId);
}

function findBookingByOtp(otp) {
  if (!otp) return null;
  const normalizedOtp = String(otp).trim();
  const found = state.bookings.find((booking) => {
    const bookingOtp = String(booking.otp ?? "").trim();
    return bookingOtp === normalizedOtp;
  });
  // Debug logging
  if (!found && state.bookings.length > 0) {
    console.log("OTP lookup failed:", {
      searchedOtp: normalizedOtp,
      availableOtps: state.bookings.map(b => String(b.otp ?? "")).filter(Boolean),
      bookings: state.bookings.map(b => ({ id: b.id, otp: String(b.otp ?? ""), status: b.status }))
    });
  }
  return found;
}

function loadStateFromStorage() {
  if (!supportsLocalStorage()) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw);

    if (Array.isArray(stored.slots)) {
      const defaultSlotMap = new Map(
        DEFAULT_SLOT_IDS.map((id) => [id, { id, status: "Available" }]),
      );
      stored.slots.forEach((slot) => {
        if (!slot?.id) return;
        defaultSlotMap.set(slot.id, {
          id: slot.id,
          status: slot.status ?? "Available",
        });
      });
      state.slots = Array.from(defaultSlotMap.values());
    }

    if (Array.isArray(stored.bookings)) {
      state.bookings = stored.bookings.map((booking) => ({
        ...booking,
        otp: String(booking.otp ?? ""), // Ensure OTP is always a string
        startTime: booking.startTime ? new Date(booking.startTime) : null,
        graceExpiry: booking.graceExpiry ? new Date(booking.graceExpiry) : null,
        entryTime: booking.entryTime ? new Date(booking.entryTime) : null,
        exitTime: booking.exitTime ? new Date(booking.exitTime) : null,
      }));
      console.log("State loaded:", { 
        bookingsCount: state.bookings.length,
        otps: state.bookings.map(b => String(b.otp ?? "")).filter(Boolean)
      });
    }
  } catch (error) {
    console.error("Failed to load saved parking data", error);
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function saveStateToStorage() {
  if (!supportsLocalStorage()) return;
  try {
    const payload = {
      slots: state.slots,
      bookings: state.bookings.map((booking) => ({
        ...booking,
        otp: String(booking.otp ?? ""), // Explicitly ensure OTP is saved as string
        startTime: booking.startTime ? booking.startTime.toISOString() : null,
        graceExpiry: booking.graceExpiry ? booking.graceExpiry.toISOString() : null,
        entryTime: booking.entryTime ? booking.entryTime.toISOString() : null,
        exitTime: booking.exitTime ? booking.exitTime.toISOString() : null,
      })),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    console.log("State saved:", { 
      bookingsCount: state.bookings.length,
      otps: state.bookings.map(b => String(b.otp ?? "")).filter(Boolean)
    });
  } catch (error) {
    console.error("Failed to persist parking data", error);
  }
}

function supportsLocalStorage() {
  try {
    const testKey = "__parking_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function syncSlotStatuses() {
  const slotMap = new Map(state.slots.map((slot) => [slot.id, slot]));
  DEFAULT_SLOT_IDS.forEach((id) => {
    if (!slotMap.has(id)) {
      const slot = { id, status: "Available" };
      slotMap.set(id, slot);
      state.slots.push(slot);
    }
  });
  state.slots.forEach((slot) => {
    slot.status = "Available";
  });
  state.bookings.forEach((booking) => {
    const slot = getSlot(booking.slotId);
    if (!slot) return;
    if (booking.status === "Booked" || booking.status === "Occupied") {
      slot.status = booking.status;
    }
  });
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function calculateCost(booking) {
  if (!booking.entryTime || !booking.exitTime) {
    return "0.00";
  }
  const diffMs = booking.exitTime - booking.entryTime;
  const hours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
  return (hours * HOURLY_RATE).toFixed(2);
}

async function copyLatestOtp() {
  const otp = selectors.summaryFields.otp.textContent;
  if (!otp) {
    addLog("No OTP to copy.", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(otp);
    addLog(`OTP ${otp} copied to clipboard.`);
  } catch (err) {
    addLog("Could not copy OTP automatically. Please copy it manually.", "error");
  }
}

function addLog(message, type = "info") {
  if (!selectors.eventLog) return;
  const li = document.createElement("li");
  li.className = "log-entry";
  li.dataset.type = type;
  const timestamp = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  li.innerHTML = `
    <small>${timestamp}</small>
    <span>${message}</span>
  `;
  selectors.eventLog.prepend(li);
  while (selectors.eventLog.children.length > 10) {
    selectors.eventLog.removeChild(selectors.eventLog.lastChild);
  }
}

function combineDateTime(date, time) {
  if (!date || !time) return null;
  return new Date(`${date}T${time}`);
}

function truncateId(id) {
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function formatDateTime(date) {
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sanitizeOtp(value) {
  return value ? value.toString().replace(/\D/g, "") : "";
}

function handleRoleChange() {
  if (!selectors.roleSelect) return;
  const role = selectors.roleSelect.value;
  const requiresCredentials = role === "security" || role === "admin";
  const credential = credentials[role];
  if (selectors.loginFields) {
    selectors.loginFields.forEach((field) => {
      field.classList.toggle("hidden", !requiresCredentials);
    });
  }
  if (selectors.loginUsername) {
    selectors.loginUsername.required = requiresCredentials;
    if (!requiresCredentials) {
      selectors.loginUsername.value = "";
    }
  }
  if (selectors.loginPassword) {
    selectors.loginPassword.required = requiresCredentials;
    if (!requiresCredentials) {
      selectors.loginPassword.value = "";
    }
  }
  if (selectors.loginHint) {
    if (requiresCredentials && credential) {
      const prettyRole = capitalize(role);
      selectors.loginHint.innerHTML = `Demo ${prettyRole} login &mdash; <strong>Username:</strong> <code>${credential.username}</code>, <strong>Password:</strong> <code>${credential.password}</code>`;
    } else {
      selectors.loginHint.textContent = "No password needed for user bookings.";
    }
  }
  setLoginError("");
}

function setLoginError(message) {
  if (selectors.loginError) {
    selectors.loginError.textContent = message ?? "";
  }
}

function handleAdminBookingClick(event) {
  const button = event.target.closest("button[data-action='force-release']");
  if (!button) {
    return;
  }
  if (state.currentRole !== "admin") {
    addLog("Only admins can force release slots.", "error");
    return;
  }
  const bookingId = button.dataset.bookingId;
  const booking = state.bookings.find((item) => item.id === bookingId);
  if (!booking) {
    addLog("Booking not found for release.", "error");
    return;
  }
  booking.status = "Completed";
  booking.exitTime = new Date();
  updateSlotStatus(booking.slotId, "Available");
  saveStateToStorage();
  renderAll();
  addLog(
    `Admin forced release of booking ${truncateId(
      booking.id,
    )}. Slot ${booking.slotId} now available.`,
  );
}

document.addEventListener("DOMContentLoaded", init);

