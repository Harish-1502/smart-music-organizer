from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """
    Central backend configuration.

    These defaults intentionally preserve the app's current local-development
    behavior. Later hardening steps can start enforcing these values without
    changing where configuration is declared.
    """

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = Field(
        default="development",
        validation_alias=AliasChoices("APP_ENV", "API_ENV"),
    )
    api_mode: str = Field(default="local", validation_alias="API_MODE")

    database_url: str = Field(
        default="sqlite:///./data/app.db",
        validation_alias="DATABASE_URL",
    )

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        validation_alias="CORS_ORIGINS",
    )

    managed_static_dirs: list[Path] = Field(
        default_factory=lambda: [Path("data")],
        validation_alias="MANAGED_STATIC_DIRS",
    )
    managed_artwork_dir: Path = Field(
        default=Path("data/track_art"),
        validation_alias="MANAGED_ARTWORK_DIR",
    )

    allowed_scan_roots: list[Path] = Field(
        default_factory=list,
        validation_alias="ALLOWED_SCAN_ROOTS",
    )
    upload_max_bytes: int | None = Field(
        default=5 * 1024 * 1024,
        validation_alias="UPLOAD_MAX_BYTES",
    )

    enable_ai_playlists: bool = Field(
        default=True,
        validation_alias="ENABLE_AI_PLAYLISTS",
    )
    enable_deep_scan: bool = Field(
        default=True,
        validation_alias="ENABLE_DEEP_SCAN",
    )
    enable_legacy_art_path_route: bool = Field(
        default=False,
        validation_alias="ENABLE_LEGACY_ART_PATH_ROUTE",
    )
    expose_local_paths: bool = Field(
        default=True,
        validation_alias=AliasChoices(
            "EXPOSE_LOCAL_PATHS",
            "DEBUG_EXPOSE_LOCAL_PATHS",
        ),
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
