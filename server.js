
require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

const dataFile = path.join(__dirname, "appointments.json");
const publicFolder = path.join(__dirname, "public");

// Admin configuration
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !SESSION_SECRET) {
    console.error("Missing ADMIN_EMAIL, ADMIN_PASSWORD or SESSION_SECRET in .env");
    process.exit(1);
}

// Hash admin password
const adminPasswordHash = bcrypt.hashSync(ADMIN_PASSWORD, 12);

// Middleware
app.use(express.json());

app.use(session({
    name: "medicare.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // Local development only. Use true with HTTPS in production.
        sameSite: "lax",
        maxAge: 1000 * 60 * 60
    }
}));

// Read appointments
function getAppointments() {
    try {
        if (!fs.existsSync(dataFile)) {
            fs.writeFileSync(dataFile, "[]");
        }

        const data = fs.readFileSync(dataFile, "utf8");
        const appointments = JSON.parse(data);

        return Array.isArray(appointments) ? appointments : [];
    } catch (error) {
        console.error("Read error:", error);
        return [];
    }
}

// Save appointments
function saveAppointments(appointments) {
    fs.writeFileSync(
        dataFile,
        JSON.stringify(appointments, null, 2)
    );
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.admin) {
        return next();
    }

    if (req.path.startsWith("/api/")) {
        return res.status(401).json({
            status: "error",
            message: "Please login to access this resource."
        });
    }

    return res.redirect("/login.html");
}

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "success",
        message: "MediCare Plus server is running"
    });
});

// Login page
app.get("/login.html", (req, res) => {
    if (req.session.admin) {
        return res.redirect("/admin.html");
    }

    res.sendFile(path.join(publicFolder, "login.html"));
});

// Login CSS and JS remain public
app.use("/login.css", express.static(path.join(publicFolder, "login.css")));
app.use("/login.js", express.static(path.join(publicFolder, "login.js")));

// Login API
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: "error",
                message: "Email and password are required."
            });
        }

        const emailMatches =
            email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();

        const passwordMatches = await bcrypt.compare(
            password,
            adminPasswordHash
        );

        if (!emailMatches || !passwordMatches) {
            return res.status(401).json({
                status: "error",
                message: "Invalid email or password."
            });
        }

        // Regenerate session after successful login
        req.session.regenerate(error => {
            if (error) {
                return res.status(500).json({
                    status: "error",
                    message: "Unable to create login session."
                });
            }

            req.session.admin = {
                email: ADMIN_EMAIL
            };

            req.session.save(error => {
                if (error) {
                    return res.status(500).json({
                        status: "error",
                        message: "Unable to save login session."
                    });
                }

                res.json({
                    status: "success",
                    message: "Login successful.",
                    redirect: "/admin.html"
                });
            });
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            status: "error",
            message: "Login failed."
        });
    }
});

// Check login status
app.get("/api/auth/status", (req, res) => {
    res.json({
        authenticated: !!req.session.admin,
        email: req.session.admin?.email || null
    });
});

// Logout
app.post("/api/logout", (req, res) => {
    req.session.destroy(error => {
        if (error) {
            return res.status(500).json({
                status: "error",
                message: "Logout failed."
            });
        }

        res.clearCookie("medicare.sid");

        res.json({
            status: "success",
            message: "Logged out successfully."
        });
    });
});

// Protected admin dashboard
app.get("/admin.html", requireAuth, (req, res) => {
    res.sendFile(path.join(publicFolder, "admin.html"));
});

// Protected admin JavaScript
app.get("/admin.js", requireAuth, (req, res) => {
    res.sendFile(path.join(publicFolder, "admin.js"));
});

// Public website static files
app.use(express.static(publicFolder, {
    index: "index.html"
}));

// Public appointment booking
app.post("/api/appointments", (req, res) => {
    const {
        name,
        email,
        phone,
        service,
        doctor,
        date,
        message
    } = req.body;

    if (!name || !email || !phone ||
        !service || !doctor || !date) {
        return res.status(400).json({
            status: "error",
            message: "Please fill in all required fields."
        });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        return res.status(400).json({
            status: "error",
            message: "Please enter a valid email address."
        });
    }

    const requestedDate = new Date(`${date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(requestedDate.getTime()) ||
        requestedDate < today) {
        return res.status(400).json({
            status: "error",
            message: "Please select a valid future date."
        });
    }

    const appointments = getAppointments();

    const newAppointment = {
        id: Date.now().toString(),
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        service,
        doctor,
        date,
        message: message || "",
        status: "Pending",
        createdAt: new Date().toISOString()
    };

    appointments.push(newAppointment);

    try {
        saveAppointments(appointments);

        res.status(201).json({
            status: "success",
            message: "Appointment request submitted successfully!",
            appointment: newAppointment
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            status: "error",
            message: "Unable to save appointment."
        });
    }
});

// Protected: Get appointments
app.get("/api/appointments", requireAuth, (req, res) => {
    const appointments = getAppointments();

    res.json({
        status: "success",
        total: appointments.length,
        appointments
    });
});

// Protected: Update appointment
app.patch("/api/appointments/:id", requireAuth, (req, res) => {
    const { status } = req.body;

    const allowedStatuses = [
        "Pending",
        "Confirmed",
        "Completed",
        "Cancelled"
    ];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            status: "error",
            message: "Invalid appointment status."
        });
    }

    const appointments = getAppointments();

    const index = appointments.findIndex(
        a => a.id === req.params.id
    );

    if (index === -1) {
        return res.status(404).json({
            status: "error",
            message: "Appointment not found."
        });
    }

    appointments[index].status = status;

    try {
        saveAppointments(appointments);

        res.json({
            status: "success",
            message: "Appointment updated successfully.",
            appointment: appointments[index]
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Unable to update appointment."
        });
    }
});

// Protected: Delete appointment
app.delete("/api/appointments/:id", requireAuth, (req, res) => {
    const appointments = getAppointments();

    const filtered = appointments.filter(
        a => a.id !== req.params.id
    );

    if (filtered.length === appointments.length) {
        return res.status(404).json({
            status: "error",
            message: "Appointment not found."
        });
    }

    try {
        saveAppointments(filtered);

        res.json({
            status: "success",
            message: "Appointment deleted successfully."
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "Unable to delete appointment."
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`MediCare Plus running at http://localhost:${PORT}`);
    console.log(`Admin login: http://localhost:${PORT}/login.html`);
});
