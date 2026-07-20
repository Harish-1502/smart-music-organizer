from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[2]
WILDCARD_BACKEND_HOSTS = {"0.0.0.0", "::", "[::]"}


class Settings(BaseSettings):
    """
    Central backend configuration.

    These defaults intentionally preserve the app's current local-development
    behavior. Later hardening steps can start enforcing these values without
    changing where configuration is declared.
    """

    # Configures Pydantic to load settings from a .env file in the backend root, and to ignore any extra fields that aren't defined in this model. It also makes the environment variable names case-insensitive 
    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # This is used to set the application environment used for enabling dev-only features and logging. The modes are development and test.
    app_env: str = Field(
        default="development",
        validation_alias=AliasChoices("APP_ENV", "API_ENV"),
    ) 
    api_mode: str = Field(default="local", validation_alias="API_MODE")
    demo_mode: bool = Field(default=False, validation_alias="DEMO_MODE")
    app_lan_mode: bool = Field(default=False, validation_alias="APP_LAN_MODE")
    backend_host: str = Field(default="127.0.0.1", validation_alias="BACKEND_HOST")
    backend_port: int = Field(default=8000, validation_alias="BACKEND_PORT")
    api_auth_token: str | None = Field(default=None, validation_alias="API_AUTH_TOKEN")

    # The variables can be set using the corresponding environment variables or by defining them in the .env file. For example, to set the database_url, you can add the following line to your .env file:
        # DATABASE_URL=sqlite:///./data/app.db
    # This is also used to configure specific settings like CORS origins, file upload limits, and feature flags for AI playlists and deep scanning.
    database_url: str = Field(
        default="sqlite:///./data/app.db",
        validation_alias="DATABASE_URL",
    )

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://localhost",
            "https://localhost",
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

    @field_validator("backend_host", mode="before")
    @classmethod
    def strip_backend_host(cls, value):
        if isinstance(value, str):
            return value.strip()

        return value

    @field_validator("api_auth_token", mode="before")
    @classmethod
    def strip_api_auth_token(cls, value):
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None

        return value

    @model_validator(mode="after")
    def validate_lan_security_settings(self):
        if self.backend_host in WILDCARD_BACKEND_HOSTS and not self.app_lan_mode:
            raise ValueError(
                "BACKEND_HOST=0.0.0.0 (or another wildcard host) requires "
                "APP_LAN_MODE=true because it exposes the API on the local network."
            )

        if self.app_lan_mode and not self.api_auth_token:
            raise ValueError(
                "API_AUTH_TOKEN is required when APP_LAN_MODE=true."
            )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
