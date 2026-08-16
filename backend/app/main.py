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
        "QURAN_JWT_SECRET .env Ñ„Ð°Ð¹Ð»Ñ‹Ð½Ð´Ð° ÐºÓ©Ñ€ÑÓ©Ñ‚Ò¯Ð»Ð³Ó©Ð½ ÑÐ¼ÐµÑ."
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
    description="Quran Center Ð¾ÐºÑƒÑƒ Ð±Ð¾Ñ€Ð±Ð¾Ñ€ÑƒÐ½ÑƒÐ½ Ð²ÐµÐ±-ÑÐ°Ð¹Ñ‚Ñ‹",
)


app.mount(
    "/assets",
    StaticFiles(directory=FRONTEND_DIR / "assets"),
    name="assets",
)


class RegistrationCreate(BaseModel):
    student_name: str = Field(
        min_length=2,
        max_length=100,
    )

    phone_number: str = Field(
        min_length=9,
        max_length=30,
    )

    course_name: str = Field(
        min_length=2,
        max_length=100,
    )

    study_format: str = Field(
        min_length=2,
        max_length=30,
    )

class RegistrationStatusUpdate(BaseModel):
    status: str = Field(
        min_length=2,
        max_length=50,
    )

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


class CourseBase(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    slug: str = Field(min_length=2, max_length=150, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    short_description: str = Field(min_length=2, max_length=500)
    full_description: str = Field(min_length=2, max_length=5000)
    level: str = Field(min_length=2, max_length=100)
    duration: str = Field(default="", max_length=100)
    price: str = Field(default="", max_length=100)
    image_url: str = Field(default="", max_length=1000)
    icon: str = Field(default="ق", max_length=20)
    position: int = Field(default=0, ge=0)
    is_published: bool = True


class CourseCreate(CourseBase):
    pass


class CourseUpdate(CourseBase):
    pass


class CoursePublishUpdate(BaseModel):
    is_published: bool


class Course(CourseBase):
    id: int
    created_at: datetime
    updated_at: datetime


INITIAL_COURSES = [
    ("Куран алиппеси", "kuran-alippesi", "Араб тамгаларын, үндөрдү жана Куран окуунун алгачкы эрежелерин үйрөнөсүз.", "Араб тамгаларын таанып, туура айтуудан баштап Куран окууга даярдоочу толук башталгыч программа.", "БАШТАЛГЫЧ", "", "", "", "ا", 1, True),
    ("Куран окуу", "kuran-okuu", "Аяттарды өз алдынча, ишенимдүү жана туура окууга кадам сайын үйрөнөсүз.", "Куранды эркин жана туура окуу көндүмүн системалуу өнүктүрүүчү негизги курс.", "НЕГИЗГИ КУРС", "", "", "", "ق", 2, True),
    ("Тажвид", "tajvid", "Куран окуунун махраждарын жана тажвид эрежелерин системалуу өздөштүрөсүз.", "Туура айтылышты, махраждарды жана негизги тажвид эрежелерин практика менен үйрөтүүчү курс.", "ОРТО ДЕҢГЭЭЛ", "", "", "", "ت", 3, True),
    ("Хифз", "hifz", "Куран аяттарын туура жаттоо жана кайталоо боюнча жеке программа аласыз.", "Жаттоо, бекемдөө жана үзгүлтүксүз кайталоо ыкмаларын камтыган жеке программа.", "ЖАТТОО", "", "", "", "ح", 4, True),
    ("Балдар курсу", "baldar-kursu", "Балдарга ылайыкташтырылган кызыктуу жана түшүнүктүү Куран сабактары.", "Балдардын жаш өзгөчөлүгүнө ылайык оюн элементтери менен түзүлгөн Куран сабактары.", "БАЛДАР ҮЧҮН", "", "", "", "ب", 5, True),
    ("Чоңдор курсу", "chondor-kursu", "Жаш курагына карабай Куран окууну баштоону каалагандар үчүн ыңгайлуу курс.", "Чоңдор үчүн ыңгайлуу темпте нөлдөн баштап Куран окууну үйрөтүүчү программа.", "ЧОҢДОР ҮЧҮН", "", "", "", "ك", 6, True),
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
                status TEXT NOT NULL DEFAULT 'Ð–Ð°Ò£Ñ‹',
                created_at TEXT NOT NULL
            )
            """
        )
        columns = {column[1] for column in connection.execute("PRAGMA table_info(registrations)")}
        if "status" not in columns:
            connection.execute("ALTER TABLE registrations ADD COLUMN status TEXT NOT NULL DEFAULT 'Жаңы'")
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
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                short_description TEXT NOT NULL,
                full_description TEXT NOT NULL,
                level TEXT NOT NULL,
                duration TEXT NOT NULL DEFAULT '',
                price TEXT NOT NULL DEFAULT '',
                image_url TEXT NOT NULL DEFAULT '',
                icon TEXT NOT NULL DEFAULT 'ق',
                position INTEGER NOT NULL DEFAULT 0,
                is_published INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        if connection.execute("SELECT COUNT(*) FROM courses").fetchone()[0] == 0:
            now = datetime.now(timezone.utc).isoformat()
            connection.executemany(
                """
                INSERT INTO courses (
                    title, slug, short_description, full_description, level,
                    duration, price, image_url, icon, position, is_published,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [course + (now, now) for course in INITIAL_COURSES],
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
            detail="Ð›Ð¾Ð³Ð¸Ð½ Ð¶Ðµ ÑÑ‹Ñ€ÑÓ©Ð· Ñ‚ÑƒÑƒÑ€Ð° ÑÐ¼ÐµÑ.",
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

def set_auth_cookie(
    response: Response,
    access_token: str,
) -> None:
    response.set_cookie(
        key="quran_access_token",
        value=access_token,
        max_age=JWT_EXPIRE_MINUTES * 60,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
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
        detail="ÐšÐ¸Ñ€Ò¯Ò¯ Ð¼Ó©Ó©Ð½Ó©Ñ‚Ò¯ Ð±Ò¯Ñ‚Ñ‚Ò¯ Ð¶Ðµ Ñ‚Ð¾ÐºÐµÐ½ Ñ‚ÑƒÑƒÑ€Ð° ÑÐ¼ÐµÑ.",
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

@app.get("/login", include_in_schema=False)
def login_page() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "login.html")


@app.get("/register", include_in_schema=False)
def register_page() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "register.html")


@app.get("/dashboard", include_in_schema=False)
def dashboard_page() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "dashboard.html")

@app.get("/health")
def health() -> dict[str, str]:
    try:
        with sqlite3.connect(DATABASE_PATH) as connection:
            connection.execute("SELECT 1").fetchone()
    except sqlite3.Error as error:
        raise HTTPException(
            status_code=503,
            detail="ÐœÐ°Ð°Ð»Ñ‹Ð¼Ð°Ñ‚ Ð±Ð°Ð·Ð°ÑÑ‹ Ð¶ÐµÑ‚ÐºÐ¸Ð»Ð¸ÐºÑÐ¸Ð·.",
        ) from error

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
    response: Response,
    user_data: UserAccountCreate,
) -> TokenResponse:
    normalized_phone = normalize_phone_number(
        user_data.phone_number
    )

    if len(normalized_phone) < 9:
        raise HTTPException(
            status_code=422,
            detail="Ð¢ÐµÐ»ÐµÑ„Ð¾Ð½ Ð½Ð¾Ð¼ÐµÑ€Ð¸ Ñ‚ÑƒÑƒÑ€Ð° ÑÐ¼ÐµÑ.",
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
            detail="Ð‘ÑƒÐ» Ñ‚ÐµÐ»ÐµÑ„Ð¾Ð½ Ð½Ð¾Ð¼ÐµÑ€Ð¸ Ð¼ÐµÐ½ÐµÐ½ Ð°ÐºÐºÐ°ÑƒÐ½Ñ‚ Ð±Ð°Ñ€.",
        ) from error

    access_token = create_access_token(
        user_id=user_id
    )

    set_auth_cookie(
        response=response,
        access_token=access_token,
    )

    return TokenResponse(
        access_token=access_token
    )


@app.post(
    "/api/auth/login",
    response_model=TokenResponse,
)
def login_user(
    response: Response,
    login_data: UserLogin,
) -> TokenResponse:
    user = authenticate_user(
        phone_number=login_data.phone_number,
        password=login_data.password,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ð¢ÐµÐ»ÐµÑ„Ð¾Ð½ Ð½Ð¾Ð¼ÐµÑ€Ð¸ Ð¶Ðµ ÑÑ‹Ñ€ÑÓ©Ð· Ñ‚ÑƒÑƒÑ€Ð° ÑÐ¼ÐµÑ.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        user_id=user["id"]
    )

    set_auth_cookie(
        response=response,
        access_token=access_token,
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
        "message": "ÐÐºÐºÐ°ÑƒÐ½Ñ‚Ñ‚Ð°Ð½ Ð¸Ð¹Ð³Ð¸Ð»Ð¸ÐºÑ‚Ò¯Ò¯ Ñ‡Ñ‹ÐºÑ‚Ñ‹Ò£Ñ‹Ð·."
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
            detail="ÐœÐ°Ð°Ð»Ñ‹Ð¼Ð°Ñ‚Ñ‚Ñ‹ ÑÐ°ÐºÑ‚Ð¾Ð¾Ð´Ð¾ ÐºÐ°Ñ‚Ð° Ñ‡Ñ‹ÐºÑ‚Ñ‹.",
        ) from error

    return {
        "id": registration_id,
        "message": "ÐšÐ°Ñ‚Ñ‚Ð°Ð»ÑƒÑƒ Ó©Ñ‚Ò¯Ð½Ò¯Ñ‡Ò¯ ÑÐ°ÐºÑ‚Ð°Ð»Ð´Ñ‹.",
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
            detail="ÐšÐ°Ñ‚Ñ‚Ð°Ð»ÑƒÑƒÐ»Ð°Ñ€Ð´Ñ‹ Ð°Ð»ÑƒÑƒÐ´Ð° ÐºÐ°Ñ‚Ð° Ñ‡Ñ‹ÐºÑ‚Ñ‹.",
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
            detail="Ð­ÐºÑÐ¿Ð¾Ñ€Ñ‚Ñ‚Ð¾Ð¾Ð´Ð¾ ÐºÐ°Ñ‚Ð° Ñ‡Ñ‹ÐºÑ‚Ñ‹.",
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
            "â„–",
            "ÐÑ‚Ñ‹-Ð¶Ó©Ð½Ò¯",
            "Ð¢ÐµÐ»ÐµÑ„Ð¾Ð½",
            "ÐšÑƒÑ€Ñ",
            "Ð¤Ð¾Ñ€Ð¼Ð°Ñ‚",
            "Ð¡Ñ‚Ð°Ñ‚ÑƒÑ",
            "ÐšÐ°Ñ‚Ñ‚Ð°Ð»Ð³Ð°Ð½ ÑƒÐ±Ð°ÐºÑ‹Ñ‚",
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
            updated_rows = cursor.rowcount

    except sqlite3.Error as error:
        raise HTTPException(
            status_code=500,
            detail="Ð¡Ñ‚Ð°Ñ‚ÑƒÑÑ‚Ñƒ Ó©Ð·Ð³Ó©Ñ€Ñ‚Ò¯Ò¯Ð´Ó© ÐºÐ°Ñ‚Ð° Ñ‡Ñ‹ÐºÑ‚Ñ‹.",
        ) from error

    if updated_rows == 0:
        raise HTTPException(
            status_code=404,
            detail="ÐšÐ°Ñ‚Ñ‚Ð°Ð»ÑƒÑƒ Ñ‚Ð°Ð±Ñ‹Ð»Ð³Ð°Ð½ Ð¶Ð¾Ðº.",
        )

    return {
        "id": registration_id,
        "status": status_update.status,
        "message": "Ð¡Ñ‚Ð°Ñ‚ÑƒÑ Ð¶Ð°Ò£Ñ‹Ñ€Ñ‚Ñ‹Ð»Ð´Ñ‹.",
    }


COURSE_COLUMNS = """
    id, title, slug, short_description, full_description, level,
    duration, price, image_url, icon, position, is_published,
    created_at, updated_at
"""


def course_from_row(row: sqlite3.Row) -> dict:
    course = dict(row)
    course["is_published"] = bool(course["is_published"])
    return course


def get_course_or_404(course_id: int, published_only: bool = False) -> dict:
    condition = " AND is_published = 1" if published_only else ""
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute(
            f"SELECT {COURSE_COLUMNS} FROM courses WHERE id = ?{condition}",
            (course_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Курс табылган жок.")
    return course_from_row(row)


@app.get("/api/courses", response_model=list[Course])
def get_published_courses() -> list[dict]:
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            f"SELECT {COURSE_COLUMNS} FROM courses WHERE is_published = 1 ORDER BY position, id"
        ).fetchall()
    return [course_from_row(row) for row in rows]


@app.get("/api/courses/{course_id}", response_model=Course)
def get_published_course(course_id: int) -> dict:
    return get_course_or_404(course_id, published_only=True)


@app.get("/api/admin/courses", response_model=list[Course])
def get_admin_courses(admin_username: str = Depends(require_admin)) -> list[dict]:
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            f"SELECT {COURSE_COLUMNS} FROM courses ORDER BY position, id"
        ).fetchall()
    return [course_from_row(row) for row in rows]


@app.post("/api/admin/courses", response_model=Course, status_code=status.HTTP_201_CREATED)
def create_course(course: CourseCreate, admin_username: str = Depends(require_admin)) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    values = course.model_dump()
    try:
        with sqlite3.connect(DATABASE_PATH) as connection:
            cursor = connection.execute(
                """
                INSERT INTO courses (
                    title, slug, short_description, full_description, level,
                    duration, price, image_url, icon, position, is_published,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (*values.values(), now, now),
            )
            connection.commit()
            course_id = cursor.lastrowid
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail="Бул slug менен курс мурунтан бар.") from error
    return get_course_or_404(course_id)


@app.put("/api/admin/courses/{course_id}", response_model=Course)
def update_course(course_id: int, course: CourseUpdate, admin_username: str = Depends(require_admin)) -> dict:
    values = course.model_dump()
    now = datetime.now(timezone.utc).isoformat()
    try:
        with sqlite3.connect(DATABASE_PATH) as connection:
            cursor = connection.execute(
                """
                UPDATE courses SET
                    title = ?, slug = ?, short_description = ?, full_description = ?,
                    level = ?, duration = ?, price = ?, image_url = ?, icon = ?,
                    position = ?, is_published = ?, updated_at = ?
                WHERE id = ?
                """,
                (*values.values(), now, course_id),
            )
            connection.commit()
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail="Бул slug менен курс мурунтан бар.") from error
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Курс табылган жок.")
    return get_course_or_404(course_id)


@app.patch("/api/admin/courses/{course_id}/publish", response_model=Course)
def publish_course(course_id: int, update: CoursePublishUpdate, admin_username: str = Depends(require_admin)) -> dict:
    with sqlite3.connect(DATABASE_PATH) as connection:
        cursor = connection.execute(
            "UPDATE courses SET is_published = ?, updated_at = ? WHERE id = ?",
            (update.is_published, datetime.now(timezone.utc).isoformat(), course_id),
        )
        connection.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Курс табылган жок.")
    return get_course_or_404(course_id)


@app.delete("/api/admin/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, admin_username: str = Depends(require_admin)) -> Response:
    with sqlite3.connect(DATABASE_PATH) as connection:
        cursor = connection.execute("DELETE FROM courses WHERE id = ?", (course_id,))
        connection.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Курс табылган жок.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/admin", include_in_schema=False)
def admin_page(
    admin_username: str = Depends(require_admin),
) -> FileResponse:
    return FileResponse(FRONTEND_DIR / "admin.html")
