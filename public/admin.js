
const table = document.getElementById("appointmentTable");
const message = document.getElementById("message");

let allAppointments = [];

// Securely display text in HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Load appointments from backend
async function loadAppointments() {
    try {
        if (message) message.textContent = "";

        const response = await fetch("/api/appointments");

        if (!response.ok) {
            throw new Error("Unable to load appointments.");
        }

        const result = await response.json();

        allAppointments = Array.isArray(result.appointments)
            ? result.appointments
            : [];

        updateStatistics();
        renderAppointments();

    } catch (error) {
        console.error(error);

        if (message) {
            message.textContent = error.message;
        }

        table.innerHTML = `
            <tr>
                <td colspan="6">Unable to load appointments.</td>
            </tr>
        `;
    }
}

// Update dashboard statistics
function updateStatistics() {
    const total = allAppointments.length;

    const pending = allAppointments.filter(
        a => (a.status || "Pending") === "Pending"
    ).length;

    const confirmed = allAppointments.filter(
        a => a.status === "Confirmed"
    ).length;

    const completed = allAppointments.filter(
        a => a.status === "Completed"
    ).length;

    document.getElementById("total").textContent = total;
    document.getElementById("pending").textContent = pending;
    document.getElementById("confirmed").textContent = confirmed;
    document.getElementById("completed").textContent = completed;
}

// Search and filter appointments
function renderAppointments() {
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const recordCount = document.getElementById("recordCount");

    const searchText = (searchInput?.value || "")
        .toLowerCase()
        .trim();

    const selectedStatus = (statusFilter?.value || "All")
        .toLowerCase()
        .trim();

    const filteredAppointments = allAppointments.filter(a => {
        const currentStatus = (a.status || "Pending")
            .toLowerCase()
            .trim();

        const matchesStatus =
            selectedStatus === "all" ||
            selectedStatus === "" ||
            currentStatus === selectedStatus;

        const searchableText = [
            a.name,
            a.phone,
            a.email,
            a.service,
            a.doctor
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(searchText);

        return matchesStatus && matchesSearch;
    });

    if (filteredAppointments.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:30px;">
                    No appointments found.
                </td>
            </tr>
        `;
    } else {
        table.innerHTML = filteredAppointments.map(a => {
            const status = a.status || "Pending";

            return `
                <tr>
                    <td>
                        <strong>${escapeHTML(a.name)}</strong><br>
                        <small>${escapeHTML(a.phone)}</small>
                    </td>

                    <td>${escapeHTML(a.service)}</td>

                    <td>${escapeHTML(a.doctor)}</td>

                    <td>${escapeHTML(a.date)}</td>

                    <td>
                        <select
                            class="status-select"
                            data-id="${escapeHTML(a.id)}"
                        >
                            ${["Pending", "Confirmed", "Completed", "Cancelled"]
                                .map(option => `
                                    <option value="${option}"
                                        ${status.toLowerCase() === option.toLowerCase() ? "selected" : ""}>
                                        ${option}
                                    </option>
                                `).join("")}
                        </select>
                    </td>

                    <td>
                        <button
                            class="action-btn view-btn"
                            data-action="view"
                            data-id="${escapeHTML(a.id)}">
                            View
                        </button>

                        <button
                            class="action-btn delete-btn"
                            data-action="delete"
                            data-id="${escapeHTML(a.id)}">
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }

    if (recordCount) {
        recordCount.textContent =
            `${filteredAppointments.length} appointments`;
    }
}

// Update appointment status
async function updateStatus(id, status) {
    try {
        const response = await fetch(
            `/api/appointments/${encodeURIComponent(id)}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ status })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Status update failed.");
        }

        if (message) {
            message.textContent = "Appointment status updated successfully!";
        }

        // Reload latest data and apply the selected filter again
        await loadAppointments();

    } catch (error) {
        alert(error.message);
        await loadAppointments();
    }
}

// Delete appointment
async function deleteAppointment(id) {
    const confirmed = confirm(
        "Are you sure you want to permanently delete this appointment?"
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            `/api/appointments/${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Delete failed.");
        }

        if (message) {
            message.textContent = "Appointment deleted successfully!";
        }

        await loadAppointments();

    } catch (error) {
        alert(error.message);
    }
}

// View appointment details
function viewAppointment(id) {
    const appointment = allAppointments.find(
        a => String(a.id) === String(id)
    );

    if (!appointment) return;

    const modal = document.getElementById("detailsModal");
    const modalContent = document.getElementById("modalContent");

    modalContent.innerHTML = `
        <div class="detail-row">
            <strong>Patient Name:</strong>
            <span>${escapeHTML(appointment.name)}</span>
        </div>

        <div class="detail-row">
            <strong>Email:</strong>
            <span>${escapeHTML(appointment.email)}</span>
        </div>

        <div class="detail-row">
            <strong>Phone:</strong>
            <span>${escapeHTML(appointment.phone)}</span>
        </div>

        <div class="detail-row">
            <strong>Service:</strong>
            <span>${escapeHTML(appointment.service)}</span>
        </div>

        <div class="detail-row">
            <strong>Doctor:</strong>
            <span>${escapeHTML(appointment.doctor)}</span>
        </div>

        <div class="detail-row">
            <strong>Date:</strong>
            <span>${escapeHTML(appointment.date)}</span>
        </div>

        <div class="detail-row">
            <strong>Status:</strong>
            <span>${escapeHTML(appointment.status || "Pending")}</span>
        </div>

        <div class="detail-row">
            <strong>Message:</strong>
            <span>${escapeHTML(appointment.message || "No message provided")}</span>
        </div>
    `;

    modal.classList.add("show");
}

// Close details modal
function closeDetailsModal() {
    document.getElementById("detailsModal")?.classList.remove("show");
}

// Search event
document.getElementById("searchInput")?.addEventListener(
    "input",
    renderAppointments
);

// Status filter event
document.getElementById("statusFilter")?.addEventListener(
    "change",
    renderAppointments
);

// Refresh button
document.getElementById("refreshBtn")?.addEventListener(
    "click",
    loadAppointments
);

// Table actions and status changes
table.addEventListener("change", event => {
    if (event.target.classList.contains("status-select")) {
        updateStatus(
            event.target.dataset.id,
            event.target.value
        );
    }
});

table.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === "view") {
        viewAppointment(id);
    }

    if (action === "delete") {
        deleteAppointment(id);
    }
});

// Modal close buttons
document.getElementById("closeModal")?.addEventListener(
    "click",
    closeDetailsModal
);

document.getElementById("detailsModal")?.addEventListener(
    "click",
    event => {
        if (event.target.id === "detailsModal") {
            closeDetailsModal();
        }
    }
);

// Mobile sidebar
document.getElementById("menuToggle")?.addEventListener(
    "click",
    () => {
        document.getElementById("sidebar")?.classList.toggle("open");
    }
);

// Initial loading
loadAppointments();


// Admin logout
const logoutBtn = document.getElementById("logoutBtn");

logoutBtn?.addEventListener("click", async () => {
    try {
        const response = await fetch("/api/logout", {
            method: "POST"
        });

        if (!response.ok) {
            throw new Error("Unable to logout.");
        }

        window.location.href = "/login.html";

    } catch (error) {
        alert(error.message);
    }
});