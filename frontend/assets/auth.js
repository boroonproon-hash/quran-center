document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.querySelector("#login-form");
    const registerForm = document.querySelector("#register-form");
    const messageElement = document.querySelector("#form-message");

    function showMessage(message, type) {
        if (!messageElement) return;

        messageElement.textContent = message;
        messageElement.className = `form-message ${type}`;
    }

    function setButtonLoading(button, isLoading, normalText) {
        if (!button) return;

        button.disabled = isLoading;
        button.textContent = isLoading ? "Күтүңүз..." : normalText;
    }

    async function sendAuthRequest(url, data) {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "same-origin",
            body: JSON.stringify(data),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.detail || "Сурамды аткарууда ката чыкты."
            );
        }

        return result;
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const button = document.querySelector("#login-button");

            const data = {
                phone_number: document
                    .querySelector("#phone-number")
                    .value
                    .trim(),

                password: document
                    .querySelector("#password")
                    .value,
            };

            setButtonLoading(button, true, "Кирүү");
            showMessage("", "");

            try {
                await sendAuthRequest("/api/auth/login", data);

                showMessage(
                    "Ийгиликтүү кирдиңиз. Жеке кабинет ачылууда...",
                    "success"
                );

                window.setTimeout(() => {
                    window.location.href = "/dashboard";
                }, 700);
            } catch (error) {
                showMessage(error.message, "error");
            } finally {
                setButtonLoading(button, false, "Кирүү");
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const button = document.querySelector("#register-button");

            const data = {
                full_name: document
                    .querySelector("#full-name")
                    .value
                    .trim(),

                phone_number: document
                    .querySelector("#phone-number")
                    .value
                    .trim(),

                password: document
                    .querySelector("#password")
                    .value,
            };

            setButtonLoading(button, true, "Аккаунт түзүү");
            showMessage("", "");

            try {
                await sendAuthRequest("/api/auth/register", data);

                showMessage(
                    "Аккаунт ийгиликтүү түзүлдү. Жеке кабинет ачылууда...",
                    "success"
                );

                window.setTimeout(() => {
                    window.location.href = "/dashboard";
                }, 700);
            } catch (error) {
                showMessage(error.message, "error");
            } finally {
                setButtonLoading(button, false, "Аккаунт түзүү");
            }
        });
    }
});