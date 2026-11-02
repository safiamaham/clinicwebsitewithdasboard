
const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const message = document.getElementById("loginMessage");
    const button = document.getElementById("loginButton");

    message.textContent = "";
    button.disabled = true;
    button.textContent = "Signing in...";

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Login failed.");
        }

        window.location.href = result.redirect || "/admin.html";

    } catch (error) {
        message.textContent = error.message;
        button.disabled = false;
        button.textContent = "Sign In to Dashboard";
    }
});
