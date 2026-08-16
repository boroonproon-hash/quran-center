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


    function getAdminBasicAuthHeader() {
        try {
            const currentUrl = new URL(window.location.href);
            const username = currentUrl.username;
            const password = currentUrl.password;
            if (!username || !password) {
                return {};
            }
            const token = btoa(`${username}:${password}`);
            return {
                Authorization: `Basic ${token}`,
            };
        } catch (error) {
            console.error("Admin auth header creation failed.", error);
            return {};
        }
    }

    function buildApiUrl(path) {
        return new URL(path, window.location.origin).toString();
    }

    async function loadRegistrations() {
        refreshButton.disabled = true;
        loadingText.textContent =
            "Маалымат жүктөлүүдө...";

        emptyMessage.style.display = "none";

        try {
            const response = await fetch(
                buildApiUrl("/api/registrations")
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
    const lessonsTable = document.getElementById("lessonsTable");
    const lessonsLoadingText = document.getElementById("lessonsLoadingText");
    const lessonsEmptyMessage = document.getElementById("lessonsEmptyMessage");
    const lessonsManager = document.getElementById("lessonsManager");
    const lessonsHeading = document.getElementById("lessonsHeading");
    const lessonModal = document.getElementById("lessonModal");
    const lessonForm = document.getElementById("lessonForm");
    const lessonFormMessage = document.getElementById("lessonFormMessage");
    let courses = [];
    let lessons = [];
    let currentCourse = null;

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
    document.getElementById("newLessonButton").addEventListener("click", () => {
        if (!currentCourse) return;
        openLessonModal(null);
    });
    document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", closeCourseModal));
    document.querySelectorAll("[data-close-lesson-modal]").forEach(button => button.addEventListener("click", closeLessonModal));

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
                actionButton("Сабактар", "", () => openLessons(course)),
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

    function closeLessonModal() {
        lessonModal.hidden = true;
        document.body.classList.remove("modal-open");
    }

    function openLessonModal(lesson) {
        lessonForm.reset();
        lessonFormMessage.textContent = "";
        document.getElementById("lessonModalTitle").textContent = lesson ? "Сабакты өзгөртүү" : "Жаңы сабак";
        document.getElementById("lessonId").value = lesson ? lesson.id : "";
        document.getElementById("lessonTitle").value = lesson ? lesson.title : "";
        document.getElementById("lessonDescription").value = lesson ? lesson.description : "";
        document.getElementById("lessonVideoUrl").value = lesson ? lesson.video_url : "";
        document.getElementById("lessonMaterialUrl").value = lesson ? lesson.material_url : "";
        document.getElementById("lessonPosition").value = lesson ? lesson.position : 0;
        document.getElementById("lessonFreePreview").checked = lesson ? lesson.is_free_preview : false;
        document.getElementById("lessonPublished").checked = lesson ? lesson.is_published : true;
        lessonModal.hidden = false;
        document.body.classList.add("modal-open");
        document.getElementById("lessonTitle").focus();
    }

    async function loadLessons(course) {
        if (!course) return;

        currentCourse = course;
        lessonsLoadingText.textContent = "Сабактар жүктөлүүдө...";
        lessonsEmptyMessage.style.display = "none";
        lessonsManager.hidden = false;
        lessonsHeading.textContent = `${course.title} — сабактар`;

        try {
            lessons = await apiRequest(`/api/admin/courses/${course.id}/lessons`);
            renderLessons();
        } catch (error) {
            lessonsLoadingText.textContent = "Сабактарды жүктөөдө ката чыкты.";
            console.error(error);
        }
    }

    function renderLessons() {
        lessonsTable.textContent = "";
        lessonsEmptyMessage.style.display = lessons.length ? "none" : "block";

        lessons.forEach(function (lesson) {
            const row = document.createElement("tr");
            row.appendChild(createCell(lesson.position));

            const titleCell = document.createElement("td");
            titleCell.textContent = lesson.title;
            row.appendChild(titleCell);

            const videoCell = document.createElement("td");
            videoCell.textContent = lesson.video_url ? "Жок" : "—";
            if (lesson.video_url) {
                const link = document.createElement("a");
                link.href = lesson.video_url;
                link.target = "_blank";
                link.rel = "noreferrer";
                link.textContent = "Видео";
                videoCell.textContent = "";
                videoCell.appendChild(link);
            }
            row.appendChild(videoCell);

            const previewCell = document.createElement("td");
            previewCell.textContent = lesson.is_free_preview ? "Ооба" : "Жок";
            row.appendChild(previewCell);

            const stateCell = document.createElement("td");
            const state = document.createElement("span");
            state.className = `publish-badge ${lesson.is_published ? "published" : ""}`;
            state.textContent = lesson.is_published ? "Жарыяланган" : "Жашырылган";
            stateCell.appendChild(state);
            row.appendChild(stateCell);

            const actions = document.createElement("td");
            const actionWrap = document.createElement("div");
            actionWrap.className = "row-actions";
            actionWrap.append(
                actionButton("Өзгөртүү", "", () => openLessonModal(lesson)),
                actionButton(lesson.is_published ? "Жашыруу" : "Жарыялоо", "", () => toggleLessonPublish(lesson)),
                actionButton("Өчүрүү", "danger", () => deleteLesson(lesson))
            );
            actions.appendChild(actionWrap);
            row.appendChild(actions);
            lessonsTable.appendChild(row);
        });

        lessonsLoadingText.textContent = `${lessons.length} сабақ көрсөтүлдү`;
    }

    function openLessons(course) {
        loadLessons(course);
    }

    async function toggleLessonPublish(lesson) {
        try {
            await apiRequest(`/api/admin/lessons/${lesson.id}/publish`, {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({is_published: !lesson.is_published})
            });
            await loadLessons(currentCourse);
        } catch (error) {
            alert(error.message);
        }
    }

    async function deleteLesson(lesson) {
        if (!confirm(`“${lesson.title}” сабағын өчүрөсүзбү?`)) return;
        try {
            await apiRequest(`/api/admin/lessons/${lesson.id}`, {method: "DELETE"});
            await loadLessons(currentCourse);
        } catch (error) {
            alert(error.message);
        }
    }

    async function apiRequest(url, options = {}) {
        const requestUrl = buildApiUrl(url);
        const headers = {
            ...(options.headers || {}),
            ...(url.startsWith("/api/admin/") ? getAdminBasicAuthHeader() : {}),
        };

        const response = await fetch(requestUrl, {
            ...options,
            headers,
        });

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

    lessonForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!currentCourse) return;

        const id = document.getElementById("lessonId").value;
        const payload = {
            title: document.getElementById("lessonTitle").value.trim(),
            description: document.getElementById("lessonDescription").value.trim(),
            video_url: document.getElementById("lessonVideoUrl").value.trim(),
            material_url: document.getElementById("lessonMaterialUrl").value.trim(),
            position: Number(document.getElementById("lessonPosition").value),
            is_free_preview: document.getElementById("lessonFreePreview").checked,
            is_published: document.getElementById("lessonPublished").checked
        };

        const saveButton = document.getElementById("saveLessonButton");
        saveButton.disabled = true;
        lessonFormMessage.textContent = "";

        try {
            if (id) {
                await apiRequest(`/api/admin/lessons/${id}`, {
                    method: "PUT",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify(payload)
                });
            } else {
                await apiRequest(`/api/admin/courses/${currentCourse.id}/lessons`, {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify(payload)
                });
            }

            closeLessonModal();
            await loadLessons(currentCourse);
        } catch (error) {
            lessonFormMessage.textContent = error.message;
        } finally {
            saveButton.disabled = false;
        }
    });
});
