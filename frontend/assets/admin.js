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
});