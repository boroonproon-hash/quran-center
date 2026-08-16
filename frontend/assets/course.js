document.addEventListener("DOMContentLoaded", async () => {
    const courseDetail = document.getElementById("courseDetail");
    const lessonsList = document.getElementById("lessonsList");
    const lessonDetail = document.getElementById("lessonDetail");

    const courseId = Number(window.location.pathname.split("/").filter(Boolean).pop());

    if (!courseId || Number.isNaN(courseId)) {
        courseDetail.innerHTML = '<p>Курс табылган жок.</p>';
        return;
    }

    function renderCourse(course) {
        const icon = course.icon || "ق";
        courseDetail.innerHTML = `
            <div class="course-icon-large">${icon}</div>
            <span class="course-level-badge">${course.level}</span>
            <h1>${course.title}</h1>
            <p>${course.short_description || course.full_description || ""}</p>
            <div class="course-meta">
                <span class="meta-pill">${course.is_published ? "Жарыяланган" : "Жашырылган"}</span>
                ${course.duration ? `<span class="meta-pill">${course.duration}</span>` : ""}
                ${course.price ? `<span class="meta-pill">${course.price}</span>` : ""}
            </div>
            <div class="course-actions">
                <a class="button button-primary" href="#register">Курсқа катталуу</a>
                <a class="button button-secondary" href="/">Башкы бет</a>
            </div>
        `;
    }

    function renderLessonDetail(lesson) {
        if (!lesson) {
            lessonDetail.innerHTML = '<p class="empty">Сабак тандалган жок.</p>';
            return;
        }

        const embedUrl = lesson.video_url && /youtube|youtu\.be/.test(lesson.video_url)
            ? lesson.video_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")
            : "";

        const hasVideo = Boolean(embedUrl);

        lessonDetail.innerHTML = `
            <h2>${lesson.title}</h2>
            <p>${lesson.description || "Сабактын сүрөттөмөсү жок."}</p>
            ${hasVideo ? `
                <div class="lesson-video">
                    <iframe src="${embedUrl}" allowfullscreen title="${lesson.title}"></iframe>
                </div>
            ` : ""}
            ${lesson.material_url ? `<p><a href="${lesson.material_url}" target="_blank" rel="noreferrer">Материалды жүктөө</a></p>` : ""}
        `;
    }

    function renderLessons(lessons) {
        lessonsList.innerHTML = "";
        if (!lessons.length) {
            lessonsList.innerHTML = '<p class="empty">Азырынча сабак жок.</p>';
            renderLessonDetail(null);
            return;
        }

        lessons.forEach((lesson) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "lesson-item";
            button.innerHTML = `
                <strong>${lesson.title}</strong>
                <small>${lesson.is_published ? "Жарыяланган" : "Жашырылган"}</small>
            `;
            button.addEventListener("click", () => {
                document.querySelectorAll(".lesson-item").forEach((item) => item.classList.remove("active"));
                button.classList.add("active");
                renderLessonDetail(lesson);
            });
            lessonsList.appendChild(button);
        });

        const firstLesson = lessons[0];
        renderLessonDetail(firstLesson);
    }

    try {
        const courseResponse = await fetch(`/api/courses/${courseId}`);
        if (!courseResponse.ok) {
            throw new Error("Course not found");
        }
        const course = await courseResponse.json();
        renderCourse(course);

        const lessonsResponse = await fetch(`/api/courses/${courseId}/lessons`);
        if (!lessonsResponse.ok) {
            throw new Error("Lessons request failed");
        }
        const lessons = await lessonsResponse.json();
        renderLessons(lessons);
    } catch (error) {
        console.error(error);
        courseDetail.innerHTML = '<p>Курс маалыматтары жүктөлгөн жок.</p>';
        lessonsList.innerHTML = '<p class="empty">Сабактарды жүктөө мүмкүн болгон жок.</p>';
        lessonDetail.innerHTML = '<p class="empty">Сабактын мазмуну жүктөлгөн жок.</p>';
    }
});
