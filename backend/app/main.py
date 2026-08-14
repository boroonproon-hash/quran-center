import os
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

FRONTEND_DIR = BASE_DIR / "frontend"
DATABASE_PATH = BASE_DIR / "backend" / "quran_center.db"

ADMIN_USERNAME = os.getenv(
    "QURAN_ADMIN_USERNAME",
    "admin",
)

ADMIN_PASSWORD = os.getenv(
    "QURAN_ADMIN_PASSWORD",
    "change-me-now",
)

admin_security = HTTPBasic()


app = FastAPI(
    title="Quran Center",
    version="0.2.0",
    description="Quran Center окуу борборунун веб-сайты",
)


app.mount(
    "/assets",
    StaticFiles(directory=FRONTEND_DIR / "assets"),
    name="assets",
)


class RegistrationCreate(BaseModel):
    student_name: str = Field(min_length=3, max_length=100)
    phone_number: str = Field(min_length=9, max_length=30)

    course_name: Literal[
        "Куран алиппеси",
        "Куран окуу",
        "Тажвид",
        "Хифз",
        "Балдар курсу",
        "Чоңдор курсу",
    ]

    study_format: Literal["Онлайн", "Офлайн"]

class RegistrationStatusUpdate(BaseModel):
    status: Literal[
        "Жаңы",
        "Байланыштык",
        "Окууга кабыл алынды",
    ]


def create_database() -> None:
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_name TEXT NOT NULL,
                phone_number TEXT NOT NULL,
                course_name TEXT NOT NULL,
                study_format TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Жаңы',
                created_at TEXT NOT NULL
            )
            """
        )

        existing_columns = {
            column[1]
            for column in connection.execute(
                "PRAGMA table_info(registrations)"
            ).fetchall()
        }

        if "status" not in existing_columns:
            connection.execute(
                """
                ALTER TABLE registrations
                ADD COLUMN status TEXT NOT NULL DEFAULT 'Жаңы'
                """
            )

        connection.commit()


create_database()


def require_admin(
    credentials: HTTPBasicCredentials = Depends(admin_security),
) -> str:
    username_is_correct = secrets.compare_digest(
        credentials.username,
        ADMIN_USERNAME,
    )

    password_is_correct = secrets.compare_digest(
        credentials.password,
        ADMIN_PASSWORD,
    )

    if not username_is_correct or not password_is_correct:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Логин же сырсөз туура эмес.",
            headers={"WWW-Authenticate": "Basic"},
        )

    return credentials.username


@app.get("/")
def home() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "database": "connected",
    }


@app.post(
    "/api/registrations",
    status_code=status.HTTP_201_CREATED,
)
def create_registration(
    registration: RegistrationCreate,
) -> dict[str, str | int]:
    created_at = datetime.now(timezone.utc).isoformat()

    try:
        with sqlite3.connect(DATABASE_PATH) as connection:
            cursor = connection.execute(
                """
                INSERT INTO registrations (
                    student_name,
                    phone_number,
                    course_name,
                    study_format,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    registration.student_name,
                    registration.phone_number,
                    registration.course_name,
                    registration.study_format,
                    created_at,
                ),
            )

            connection.commit()
            registration_id = cursor.lastrowid

    except sqlite3.Error as error:
        raise HTTPException(
            status_code=500,
            detail="Маалыматты сактоодо ката чыкты.",
        ) from error

    return {
        "id": registration_id,
        "message": "Катталуу өтүнүчү сакталды.",
    }

@app.get("/api/registrations")
def get_registrations(
    admin_username: str = Depends(require_admin),
) -> dict:
    try:
        with sqlite3.connect(DATABASE_PATH) as connection:
            connection.row_factory = sqlite3.Row

            rows = connection.execute(
                """
                SELECT
                    id,
                    student_name,
                    phone_number,
                    course_name,
                    study_format,
                    status,
                    created_at
                FROM registrations
                ORDER BY id DESC
                """
            ).fetchall()

    except sqlite3.Error as error:
        raise HTTPException(
            status_code=500,
            detail="Катталууларды алууда ката чыкты.",
        ) from error

    registrations = [
        {
            "id": row["id"],
            "student_name": row["student_name"],
            "phone_number": row["phone_number"],
            "course_name": row["course_name"],
            "study_format": row["study_format"],
            "status": row["status"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]

    return {
        "total": len(registrations),
        "items": registrations,
    }


@app.patch("/api/registrations/{registration_id}")
def update_registration_status(
    registration_id: int,
    status_update: RegistrationStatusUpdate,
    admin_username: str = Depends(require_admin),
) -> dict[str, str | int]:
    try:
        with sqlite3.connect(DATABASE_PATH) as connection:
            cursor = connection.execute(
                """
                UPDATE registrations
                SET status = ?
                WHERE id = ?
                """,
                (
                    status_update.status,
                    registration_id,
                ),
            )

            connection.commit()

    except sqlite3.Error as error:
        raise HTTPException(
            status_code=500,
            detail="Статусту өзгөртүүдө ката чыкты.",
        ) from error

    if cursor.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Катталуу табылган жок.",
        )

    return {
        "id": registration_id,
        "status": status_update.status,
        "message": "Статус жаңыртылды.",
    }


@app.get("/admin", include_in_schema=False)
def admin_page(
    admin_username: str = Depends(require_admin),
) -> FileResponse:
    return FileResponse(FRONTEND_DIR / "admin.html")