document.addEventListener("DOMContentLoaded", async () => {
    const loadingElement = document.querySelector("#dashboard-loading");
    const contentElement = document.querySelector("#dashboard-content");
    const messageElement = document.querySelector("#dashboard-message");
    const logoutButton = document.querySelector("#logout-button");

    function showError(message) {
        loadingElement.hidden = true;
        messageElement.textContent = message;
        messageElement.className = "form-message error";
    }

    async function loadProfile() {
        try {
            const response = await fetch("/api/auth/me", {
                credentials: "same-origin",
            });

            if (response.status === 401) {
                window.location.href = "/login";
                return;
            }

            const user = await response.json();

            if (!response.ok) {
                throw new Error(
                    user.detail || "Маалыматты алууда ката чыкты."
                );
            }

            document.querySelector("#profile-name").textContent =
                user.full_name;

            document.querySelector("#profile-full-name").textContent =
                user.full_name;

            document.querySelector("#profile-phone-number").textContent =
                user.phone_number;

            loadingElement.hidden = true;
            contentElement.hidden = false;
        } catch (error) {
            showError(error.message);
        }
    }

    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = "Күтүңүз...";

        try {
            await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin",
            });
        } finally {
            window.location.href = "/login";
        }
    });

    await loadProfile();
});