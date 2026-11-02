
const table = document.getElementById("appointmentTable");
const message = document.getElementById("message");

let allAppointments = [];

const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);

// LOAD APPOINTMENTS
async function loadAppointments() {
    try {
        message.textContent = "Loading appointments...";

        const response = await fetch("/api/appointments");

        if (!response.ok) {
            throw new Error("Unable to load appointments.");
        }

        const result = await response.json();
        allAppointments = result.appointments;

        updateStatistics();
        renderAppointments();

        message.textContent = "Appointment data updated successfully.";

    } catch (error) {
        message.textContent = error.message;
    }
}

// DASHBOARD STATISTICS
function updateStatistics() {
    document.getElementById("total").textContent =
        allAppointments.length;

    document.getElementById("pending").textContent =
        allAppointments.filter(a => a.status === "Pending").length;

    document.getElementById("confirmed").textContent =
        allAppointments.filter(a => a.status === "Confirmed").length;

    document.getElementById("completed").textContent =
        allAppointments.filter(a => a.status === "Completed").length;
}

// SEARCH AND FILTER
function renderAppointments() {
    const search = document.getElementById("searchInput")
        .value.toLowerCase().trim();

    const filter = document.getElementById("statusFilter").value;

    const filtered = allAppointments.filter(a => {
        const matchesSearch = [
            a.name, a.phone, a.email, a.doctor, a.service
        ].some(value =>
            String(value ?? "").toLowerCase().includes(search)
        );

        const matchesStatus =
            filter === "All" || a.status === filter;

        return matchesSearch && matchesStatus;
    });

    document.getElementById("recordCount").textContent =
        `${filtered.length} appointments`;

    if (!filtered.length) {
        table.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:30px">
                    No appointments found.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = filtered.map(a => `
        <tr>
            <td>
                <div class="patient-name">${escapeHTML(a.name)}</div>
                <span class="patient-phone">${escapeHTML(a.phone)}</span>
            </td>

            <td>${escapeHTML(a.service)}</td>

            <td>${escapeHTML(a.doctor)}</td>

            <td>${escapeHTML(a.date)}</td>

            <td>
                <select class="status-select"
                    data-id="${escapeHTML(a.id)}"
                    aria-label="Appointment status">
                    ${["Pending", "Confirmed", "Completed", "Cancelled"]
                        .map(s => `
                            <option value="${s}"
                                ${a.status === s ? "selected" : ""}>
                                ${s}
                            </option>
                        `).join("")}
                </select>
            </td>

            <td>
                <div class="action-buttons">
                    <button class="action-btn view-btn"
                        data-action="view"
                        data-id="${escapeHTML(a.id)}">
                        View
                    </button>

                    <button class="action-btn delete-btn"
                        data-action="delete"
                        data-id="${escapeHTML(a.id)}">
                        Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
}

// CHANGE STATUS
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

        message.textContent = "Appointment status updated!";
        await loadAppointments();

    } catch (error) {
        message.textContent = error.message;
    }
}

// DELETE APPOINTMENT
async function deleteAppointment(id) {
    if (!confirm("Are you sure you want to delete this appointment?")) {
        return;
    }

    try {
        const response = await fetch(
            `/api/appointments/${encodeURIComponent(id)}`,
            { method: "DELETE" }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Delete failed.");
        }

        message.textContent = "Appointment deleted successfully!";
        await loadAppointments();

    } catch (error) {
        message.textContent = error.message;
    }
}

// VIEW APPOINTMENT DETAILS
function viewAppointment(id) {
    const a = allAppointments.find(item => item.id === id);

    if (!a) return;

    const details = {
        "Patient Name": a.name,
        "Email": a.email,
        "Phone": a.phone,
        "Service": a.service,
        "Doctor": a.doctor,
        "Preferred Date": a.date,
        "Status": a.status,
        "Message": a.message || "No additional message",
        "Submitted": a.createdAt
            ? new Date(a.createdAt).toLocaleString()
            : "Not available"
    };

    document.getElementById("modalContent").innerHTML =
        Object.entries(details).map(([label, value]) => `
            <div class="detail-row">
                <strong>${escapeHTML(label)}</strong>
                ${escapeHTML(value)}
            </div>
        `).join("");

    document.getElementById("detailsModal").classList.add("show");
}

// EVENT LISTENERS
document.getElementById("searchInput")
    .addEventListener("input", renderAppointments);

document.getElementById("statusFilter")
    .addEventListener("change", renderAppointments);

document.getElementById("refreshBtn")
    .addEventListener("click", loadAppointments);

table.addEventListener("change", event => {
    if (event.target.classList.contains("status-select")) {
        updateStatus(
            event.target.dataset.id,
            event.target.value
        );
    }
});

table.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");

    if (!button) return;

    const id = button.dataset.id;

    if (button.dataset.action === "view") {
        viewAppointment(id);
    }

    if (button.dataset.action === "delete") {
        deleteAppointment(id);
    }
});

document.getElementById("closeModal")
    .addEventListener("click", () => {
        document.getElementById("detailsModal")
            .classList.remove("show");
    });

document.getElementById("detailsModal")
    .addEventListener("click", event => {
        if (event.target.id === "detailsModal") {
            event.currentTarget.classList.remove("show");
        }
    });

document.getElementById("menuToggle")
    .addEventListener("click", () => {
        document.getElementById("sidebar")
            .classList.toggle("open");
    });

// INITIALIZE
loadAppointments();
