document.addEventListener("DOMContentLoaded", function () {
    const tableBody =
        document.getElementById("registrationsTable");

    const loadingText =
        document.getElementById("loadingText");

    const emptyMessage =
        document.getElementById("emptyMessage");

    const totalCount =
        document.getElementById("totalCount");

    const onlineCount =
        document.getElementById("onlineCount");

    const offlineCount =
        document.getElementById("offlineCount");

    const refreshButton =
        document.getElementById("refreshButton");

    const searchInput =
        document.getElementById("searchInput");

    const statusFilter =
        document.getElementById("statusFilter");


    function createCell(value) {
        const cell = document.createElement("td");
        cell.textContent = value;
        return cell;
    }


    function applyFilters() {
        const searchValue =
            searchInput.value.trim().toLowerCase();

        const selectedStatus =
            statusFilter.value;

        const rows =
            tableBody.querySelectorAll("tr");

        let visibleCount = 0;

        rows.forEach(function (row) {
            const rowSearchText =
                row.dataset.search || "";

            const statusSelect =
                row.querySelector(".status-select");

            const rowStatus =
                statusSelect ? statusSelect.value : "";

            const matchesSearch =
                rowSearchText.includes(searchValue);

            const matchesStatus =
                selectedStatus === "" ||
                rowStatus === selectedStatus;

            const shouldShow =
                matchesSearch && matchesStatus;

            row.hidden = !shouldShow;

            if (shouldShow) {
                visibleCount += 1;
            }
        });

        loadingText.textContent =
            `${visibleCount} өтүнүч көрсөтүлдү`;
    }


    function createStatusSelect(registration) {
        const statusSelect =
            document.createElement("select");

        statusSelect.className = "status-select";

        const availableStatuses = [
            "Жаңы",
            "Байланыштык",
            "Окууга кабыл алынды",
        ];

        availableStatuses.forEach(function (status) {
            const option =
                document.createElement("option");

            option.value = status;
            option.textContent = status;

            statusSelect.appendChild(option);
        });

        statusSelect.value =
            registration.status || "Жаңы";

        statusSelect.dataset.status =
            statusSelect.value;

        statusSelect.dataset.previousStatus =
            statusSelect.value;

        statusSelect.addEventListener(
            "change",
            async function () {
                const previousStatus =
                    statusSelect.dataset.previousStatus;

                statusSelect.disabled = true;

                try {
                    const response = await fetch(
                        `/api/registrations/${registration.id}`,
                        {
                            method: "PATCH",

                            headers: {
                                "Content-Type": "application/json",
                            },

                            body: JSON.stringify({
                                status: statusSelect.value,
                            }),
                        }
                    );

                    if (!response.ok) {
                        throw new Error(
                            "Статус сакталган жок."
                        );
                    }

                    registration.status =
                        statusSelect.value;

                    statusSelect.dataset.previousStatus =
                        statusSelect.value;

                    statusSelect.dataset.status =
                        statusSelect.value;

                    applyFilters();

                } catch (error) {
                    statusSelect.value =
                        previousStatus;

                    statusSelect.dataset.status =
                        previousStatus;

                    alert(
                        "Статусту өзгөртүүдө ката чыкты."
                    );

                    console.error(error);
                } finally {
                    statusSelect.disabled = false;
                }
            }
        );

        return statusSelect;
    }


    function renderRegistrations(registrations) {
        tableBody.textContent = "";

        registrations.forEach(function (registration) {
            const row = document.createElement("tr");

            row.dataset.search = [
                registration.student_name,
                registration.phone_number,
                registration.course_name,
                registration.study_format,
            ].join(" ").toLowerCase();

            row.appendChild(
                createCell(registration.id)
            );

            row.appendChild(
                createCell(registration.student_name)
            );

            row.appendChild(
                createCell(registration.phone_number)
            );

            row.appendChild(
                createCell(registration.course_name)
            );

            const formatCell =
                document.createElement("td");

            const formatBadge =
                document.createElement("span");

            formatBadge.className = "format-badge";
            formatBadge.textContent =
                registration.study_format;

            formatCell.appendChild(formatBadge);
            row.appendChild(formatCell);

            const statusCell =
                document.createElement("td");

            statusCell.appendChild(
                createStatusSelect(registration)
            );

            row.appendChild(statusCell);

            const registrationDate =
                new Date(registration.created_at);

            row.appendChild(
                createCell(
                    registrationDate.toLocaleString(
                        "ky-KG"
                    )
                )
            );

            tableBody.appendChild(row);
        });
    }


    async function loadRegistrations() {
        refreshButton.disabled = true;
        loadingText.textContent =
            "Маалымат жүктөлүүдө...";

        emptyMessage.style.display = "none";

        try {
            const response = await fetch(
                "/api/registrations"
            );

            if (!response.ok) {
                throw new Error(
                    "Маалымат алынган жок."
                );
            }

            const data = await response.json();
            const registrations = data.items;

            totalCount.textContent =
                registrations.length;

            onlineCount.textContent =
                registrations.filter(
                    registration =>
                        registration.study_format ===
                        "Онлайн"
                ).length;

            offlineCount.textContent =
                registrations.filter(
                    registration =>
                        registration.study_format ===
                        "Офлайн"
                ).length;

            renderRegistrations(registrations);

            if (registrations.length === 0) {
                emptyMessage.style.display = "block";
                loadingText.textContent = "0 өтүнүч";
                return;
            }

            applyFilters();

        } catch (error) {
            loadingText.textContent =
                "Маалыматты жүктөөдө ката чыкты.";

            console.error(error);
        } finally {
            refreshButton.disabled = false;
        }
    }


    refreshButton.addEventListener(
        "click",
        loadRegistrations
    );

    searchInput.addEventListener(
        "input",
        applyFilters
    );

    statusFilter.addEventListener(
        "change",
        applyFilters
    );

    loadRegistrations();

    const tabs = document.querySelectorAll(".admin-tab");
    const panels = document.querySelectorAll(".tab-panel");
    const coursesTable = document.getElementById("coursesTable");
    const coursesLoadingText = document.getElementById("coursesLoadingText");
    const coursesEmptyMessage = document.getElementById("coursesEmptyMessage");
    const courseModal = document.getElementById("courseModal");
    const courseForm = document.getElementById("courseForm");
    const courseFormMessage = document.getElementById("courseFormMessage");
    let courses = [];

    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            tabs.forEach(item => item.classList.toggle("active", item === tab));
            panels.forEach(panel => panel.classList.toggle("active", panel.id === tab.dataset.tab));
            if (tab.dataset.tab === "coursesPanel") loadCourses();
        });
    });

    function closeCourseModal() {
        courseModal.hidden = true;
        document.body.classList.remove("modal-open");
    }

    function openCourseModal(course) {
        courseForm.reset();
        courseFormMessage.textContent = "";
        document.getElementById("courseModalTitle").textContent = course ? "Курсту өзгөртүү" : "Жаңы курс";
        document.getElementById("courseId").value = course ? course.id : "";
        document.getElementById("courseTitle").value = course ? course.title : "";
        document.getElementById("courseSlug").value = course ? course.slug : "";
        document.getElementById("courseLevel").value = course ? course.level : "";
        document.getElementById("courseIcon").value = course ? course.icon : "ق";
        document.getElementById("courseDuration").value = course ? course.duration : "";
        document.getElementById("coursePrice").value = course ? course.price : "";
        document.getElementById("courseImageUrl").value = course ? course.image_url : "";
        document.getElementById("coursePosition").value = course ? course.position : 0;
        document.getElementById("courseShortDescription").value = course ? course.short_description : "";
        document.getElementById("courseFullDescription").value = course ? course.full_description : "";
        document.getElementById("coursePublished").checked = course ? course.is_published : true;
        courseModal.hidden = false;
        document.body.classList.add("modal-open");
        document.getElementById("courseTitle").focus();
    }

    document.getElementById("newCourseButton").addEventListener("click", () => openCourseModal(null));
    document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", closeCourseModal));

    function actionButton(label, className, handler) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `table-action ${className || ""}`;
        button.textContent = label;
        button.addEventListener("click", handler);
        return button;
    }

    function renderCourses() {
        coursesTable.textContent = "";
        coursesEmptyMessage.style.display = courses.length ? "none" : "block";
        courses.forEach(function (course) {
            const row = document.createElement("tr");
            row.appendChild(createCell(course.position));
            const titleCell = document.createElement("td");
            titleCell.className = "course-title-cell";
            const title = document.createElement("strong");
            const slug = document.createElement("small");
            title.textContent = course.title;
            slug.textContent = course.slug;
            titleCell.append(title, slug);
            row.appendChild(titleCell);
            row.appendChild(createCell(course.level));
            row.appendChild(createCell([course.duration, course.price].filter(Boolean).join(" / ") || "—"));
            const stateCell = document.createElement("td");
            const state = document.createElement("span");
            state.className = `publish-badge ${course.is_published ? "published" : ""}`;
            state.textContent = course.is_published ? "Жарыяланган" : "Жашырылган";
            stateCell.appendChild(state);
            row.appendChild(stateCell);
            const actions = document.createElement("td");
            const actionWrap = document.createElement("div");
            actionWrap.className = "row-actions";
            actionWrap.append(
                actionButton("Өзгөртүү", "", () => openCourseModal(course)),
                actionButton(course.is_published ? "Жашыруу" : "Жарыялоо", "", () => togglePublish(course)),
                actionButton("Өчүрүү", "danger", () => deleteCourse(course))
            );
            actions.appendChild(actionWrap);
            row.appendChild(actions);
            coursesTable.appendChild(row);
        });
        coursesLoadingText.textContent = `${courses.length} курс көрсөтүлдү`;
    }

    async function apiRequest(url, options) {
        const response = await fetch(url, options);
        if (!response.ok) {
            let message = "Сурам аткарылган жок.";
            try { message = (await response.json()).detail || message; } catch (_) {}
            throw new Error(message);
        }
        return response.status === 204 ? null : response.json();
    }

    async function loadCourses() {
        coursesLoadingText.textContent = "Курстар жүктөлүүдө...";
        try {
            courses = await apiRequest("/api/admin/courses");
            renderCourses();
        } catch (error) {
            coursesLoadingText.textContent = "Курстарды жүктөөдө ката чыкты.";
            console.error(error);
        }
    }

    async function togglePublish(course) {
        try {
            await apiRequest(`/api/admin/courses/${course.id}/publish`, {
                method: "PATCH", headers: {"Content-Type": "application/json"},
                body: JSON.stringify({is_published: !course.is_published})
            });
            await loadCourses();
        } catch (error) { alert(error.message); }
    }

    async function deleteCourse(course) {
        if (!confirm(`“${course.title}” курсун өчүрөсүзбү?`)) return;
        try {
            await apiRequest(`/api/admin/courses/${course.id}`, {method: "DELETE"});
            await loadCourses();
        } catch (error) { alert(error.message); }
    }

    courseForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const id = document.getElementById("courseId").value;
        const payload = {
            title: document.getElementById("courseTitle").value.trim(),
            slug: document.getElementById("courseSlug").value.trim(),
            level: document.getElementById("courseLevel").value.trim(),
            icon: document.getElementById("courseIcon").value.trim(),
            duration: document.getElementById("courseDuration").value.trim(),
            price: document.getElementById("coursePrice").value.trim(),
            image_url: document.getElementById("courseImageUrl").value.trim(),
            position: Number(document.getElementById("coursePosition").value),
            short_description: document.getElementById("courseShortDescription").value.trim(),
            full_description: document.getElementById("courseFullDescription").value.trim(),
            is_published: document.getElementById("coursePublished").checked
        };
        const saveButton = document.getElementById("saveCourseButton");
        saveButton.disabled = true;
        courseFormMessage.textContent = "";
        try {
            await apiRequest(id ? `/api/admin/courses/${id}` : "/api/admin/courses", {
                method: id ? "PUT" : "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)
            });
            closeCourseModal();
            await loadCourses();
        } catch (error) { courseFormMessage.textContent = error.message; }
        finally { saveButton.disabled = false; }
    });
});
