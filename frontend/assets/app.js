document.addEventListener("DOMContentLoaded", function () {
    const coursesGrid = document.getElementById("coursesGrid");

    function createCourseCard(course, index) {
        const card = document.createElement("article");
        card.className = "course-card";
        if (index === 1) card.classList.add("featured-course");

        if (course.image_url) {
            const image = document.createElement("img");
            image.className = "course-image";
            image.src = course.image_url;
            image.alt = course.title;
            image.loading = "lazy";
            card.appendChild(image);
        } else {
            const icon = document.createElement("div");
            icon.className = "course-icon";
            icon.textContent = course.icon || "ق";
            card.appendChild(icon);
        }

        const level = document.createElement("p");
        level.className = "course-level";
        level.textContent = course.level;
        const title = document.createElement("h3");
        title.textContent = course.title;
        const description = document.createElement("p");
        description.textContent = course.short_description;
        const link = document.createElement("a");
        link.href = `/courses/${course.id}`;
        link.textContent = "Толук маалымат ";
        const arrow = document.createElement("span");
        arrow.textContent = "→";
        link.appendChild(arrow);
        card.append(level, title, description, link);
        return card;
    }

    async function loadCourses() {
        if (!coursesGrid) return;
        try {
            const response = await fetch("/api/courses");
            if (!response.ok) throw new Error("Courses request failed");
            const courses = await response.json();
            coursesGrid.textContent = "";
            courses.forEach((course, index) => coursesGrid.appendChild(createCourseCard(course, index)));
            if (courses.length === 0) {
                const message = document.createElement("p");
                message.className = "courses-message";
                message.textContent = "Азырынча жарыяланган курс жок.";
                coursesGrid.appendChild(message);
            }
        } catch (error) {
            coursesGrid.textContent = "";
            const message = document.createElement("p");
            message.className = "courses-message error";
            message.textContent = "Курстарды жүктөө мүмкүн болгон жок";
            coursesGrid.appendChild(message);
            console.error(error);
        }
    }

    loadCourses();

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
