document.addEventListener("DOMContentLoaded", function () {
    // Катталуу формасы

    const registrationForm =
        document.getElementById("registrationForm");

    const formMessage =
        document.getElementById("formMessage");

    if (registrationForm && formMessage) {
        registrationForm.addEventListener(
            "submit",
            async function (event) {
                event.preventDefault();

                const studentName = document
                    .getElementById("studentName")
                    .value
                    .trim();

                const phoneNumber = document
                    .getElementById("phoneNumber")
                    .value
                    .trim();

                const courseName = document
                    .getElementById("courseName")
                    .value;

                const studyFormat = document
                    .getElementById("studyFormat")
                    .value;

                const submitButton =
                    registrationForm.querySelector(
                        'button[type="submit"]'
                    );

                if (
                    studentName.length < 3 ||
                    phoneNumber.length < 9 ||
                    !courseName ||
                    !studyFormat
                ) {
                    formMessage.textContent =
                        "Сураныч, бардык маалыматтарды туура толтуруңуз.";

                    formMessage.className =
                        "form-message error";

                    return;
                }

                submitButton.disabled = true;
                submitButton.textContent = "Жөнөтүлүүдө...";

                formMessage.className = "form-message";
                formMessage.textContent = "";

                try {
                    const response = await fetch(
                        "/api/registrations",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type": "application/json",
                            },

                            body: JSON.stringify({
                                student_name: studentName,
                                phone_number: phoneNumber,
                                course_name: courseName,
                                study_format: studyFormat,
                            }),
                        }
                    );

                    if (!response.ok) {
                        throw new Error(
                            "Маалымат сакталган жок."
                        );
                    }

                    const result = await response.json();

                    formMessage.textContent =
                        `${studentName}, өтүнүчүңүз №${result.id} менен кабыл алынды!`;

                    formMessage.className =
                        "form-message success";

                    registrationForm.reset();
                } catch (error) {
                    formMessage.textContent =
                        "Ката чыкты. Серверди текшерип, кайра аракет кылыңыз.";

                    formMessage.className =
                        "form-message error";

                    console.error(error);
                } finally {
                    submitButton.disabled = false;

                    submitButton.textContent =
                        "Катталуу өтүнүчүн жөнөтүү";
                }
            }
        );
    }

    // Мобилдик меню

    const menuButton =
        document.getElementById("menuButton");

    const mobileNavigation =
        document.getElementById("mobileNavigation");

    if (menuButton && mobileNavigation) {
        menuButton.addEventListener(
            "click",
            function () {
                const menuIsOpen =
                    mobileNavigation.classList.toggle("active");

                menuButton.setAttribute(
                    "aria-expanded",
                    String(menuIsOpen)
                );

                menuButton.textContent =
                    menuIsOpen ? "✕" : "☰";
            }
        );

        const mobileLinks =
            mobileNavigation.querySelectorAll("a");

        mobileLinks.forEach(function (link) {
            link.addEventListener("click", function () {
                mobileNavigation.classList.remove("active");

                menuButton.setAttribute(
                    "aria-expanded",
                    "false"
                );

                menuButton.textContent = "☰";
            });
        });
    }
});document.addEventListener("DOMContentLoaded", async () => {
    const guestLinks = document.querySelectorAll('[data-auth="guest"]');
    const userLinks = document.querySelectorAll('[data-auth="user"]');

    function showGuestNavigation() {
        guestLinks.forEach((link) => {
            link.hidden = false;
        });

        userLinks.forEach((link) => {
            link.hidden = true;
        });
    }

    function showUserNavigation() {
        guestLinks.forEach((link) => {
            link.hidden = true;
        });

        userLinks.forEach((link) => {
            link.hidden = false;
        });
    }

    try {
        const response = await fetch("/api/auth/me", {
            credentials: "same-origin",
        });

        if (response.ok) {
            showUserNavigation();
        } else {
            showGuestNavigation();
        }
    } catch {
        showGuestNavigation();
    }
});