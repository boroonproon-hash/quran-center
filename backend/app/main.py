import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

import jwt
from fastapi import (
    Cookie,
    Depends,
    FastAPI,
    HTTPException,
    Response,
    status,
)
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBasic,
    HTTPBasicCredentials,
    HTTPBearer,
)
from fastapi.staticfiles import StaticFiles
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import csv
import io


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
user_security = HTTPBearer(auto_error=False)
JWT_SECRET = os.getenv("QURAN_JWT_SECRET")

if not JWT_SECRET:
    raise RuntimeError(
        "QURAN_JWT_SECRET .env файлында көрсөтүлгөн эмес."
    )

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24 * 7

password_hash = PasswordHash.recommended()

DUMMY_PASSWORD_HASH = password_hash.hash(
    "quran-center-dummy-password"
)


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

class UserAccountCreate(BaseModel):
    full_name: str = Field(
        min_length=3,
        max_length=100,
    )

    phone_number: str = Field(
        min_length=9,
        max_length=30,
    )

    password: str = Field(
        min_length=8,
        max_length=128,
    )


class UserLogin(BaseModel):
    phone_number: str = Field(
        min_length=9,
        max_length=30,
    )

    password: str = Field(
        min_length=8,
        max_length=128,
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

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

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                phone_number TEXT NOT NULL UNIQUE,
                hashed_password TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
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

def normalize_phone_number(
    phone_number: str,
) -> str:
    return "".join(
        character
        for character in phone_number.strip()
        if character.isdigit() or character == "+"
    )


def create_access_token(
    user_id: int,
) -> str:
    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(minutes=JWT_EXPIRE_MINUTES)
    )

    token_data = {
        "sub": str(user_id),
        "exp": expires_at,
    }

    return jwt.encode(
        token_data,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def authenticate_user(
    phone_number: str,
    password: str,
) -> dict | None:
    normalized_phone = normalize_phone_number(
        phone_number
    )

    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row

        user = connection.execute(
            """
            SELECT
                id,
                full_name,
                phone_number,
                hashed_password,
                created_at
            FROM users
            WHERE phone_number = ?
            """,
            (normalized_phone,),
        ).fetchone()

    if user is None:
        password_hash.verify(
            password,
            DUMMY_PASSWORD_HASH,
        )

        return None

    if not password_hash.verify(
        password,
        user["hashed_password"],
    ):
        return None

    return {
        "id": user["id"],
        "full_name": user["full_name"],
        "phone_number": user["phone_number"],
        "created_at": user["created_at"],
    }
def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        user_security
    ),
    cookie_token: str | None = Cookie(
        default=None,
        alias="quran_access_token",
    ),
) -> dict:
    unauthorized_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Кирүү мөөнөтү бүттү же токен туура эмес.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    access_token = (
        credentials.credentials
        if credentials is not None
        else cookie_token
    )

    if access_token is None:
        raise unauthorized_error
    try:
        payload = jwt.decode(
            access_token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )

        user_id = int(payload.get("sub"))

    except (
        InvalidTokenError,
        TypeError,
        ValueError,
    ) as error:
        raise unauthorized_error from error

    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row

        user = connection.execute(
            """
            SELECT
                id,
                full_name,
                phone_number,
                created_at
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()

    if user is None:
        raise unauthorized_error

    return {
        "id": user["id"],
        "full_name": user["full_name"],
        "phone_number": user["phone_number"],
        "created_at": user["created_at"],
    }

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
    "/api/auth/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    user_data: UserAccountCreate,
) -> TokenResponse:
    normalized_phone = normalize_phone_number(
        user_data.phone_number
    )

    if len(normalized_phone) < 9:
        raise HTTPException(
            status_code=422,
            detail="Телефон номери туура эмес.",
        )

    hashed_password = password_hash.hash(
        user_data.password
    )

    created_at = datetime.now(
        timezone.utc
    ).isoformat()

    try:
        with sqlite3.connect(DATABASE_PATH) as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (
                    full_name,
                    phone_number,
                    hashed_password,
                    created_at
                )
                VALUES (?, ?, ?, ?)
                """,
                (
                    user_data.full_name.strip(),
                    normalized_phone,
                    hashed_password,
                    created_at,
                ),
            )

            connection.commit()
            user_id = cursor.lastrowid

    except sqlite3.IntegrityError as error:
        raise HTTPException(
            status_code=409,
            detail="Бул телефон номери менен аккаунт бар.",
        ) from error

    access_token = create_access_token(
        user_id=user_id
    )

    return TokenResponse(
        access_token=access_token
    )


@app.post(
    "/api/auth/login",
    response_model=TokenResponse,
)
def login_user(
    login_data: UserLogin,
) -> TokenResponse:
    user = authenticate_user(
        phone_number=login_data.phone_number,
        password=login_data.password,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Телефон номери же сырсөз туура эмес.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        user_id=user["id"]
    )

    return TokenResponse(
        access_token=access_token
    )

@app.post("/api/auth/logout")
def logout_user(response: Response) -> dict[str, str]:
    response.delete_cookie(
        key="quran_access_token",
        path="/",
    )

    return {
        "message": "Аккаунттан ийгиликтүү чыктыңыз."
    }

@app.get("/api/auth/me")
def get_my_profile(
    current_user: dict = Depends(get_current_user),
) -> dict:
    return current_user

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

@app.get("/api/registrations/export")
def export_registrations(
    admin_username: str = Depends(require_admin),
) -> StreamingResponse:
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
            detail="Экспорттоодо ката чыкты.",
        ) from error

    csv_file = io.StringIO()

    csv_file.write("\ufeff")

    writer = csv.writer(
        csv_file,
        delimiter=";",
        lineterminator="\n",
)

    writer.writerow(
        [
            "№",
            "Аты-жөнү",
            "Телефон",
            "Курс",
            "Формат",
            "Статус",
            "Катталган убакыт",
        ]
    )

    for row in rows:
        writer.writerow(
            [
                row["id"],
                row["student_name"],
                row["phone_number"],
                row["course_name"],
                row["study_format"],
                row["status"],
                row["created_at"],
            ]
        )

    response = StreamingResponse(
        iter([csv_file.getvalue()]),
        media_type="text/csv; charset=utf-8",
    )

    response.headers["Content-Disposition"] = (
        'attachment; filename="quran-center-registrations.csv"'
    )

    return response
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