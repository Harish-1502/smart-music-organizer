from pathlib import Path

from app.core.config import Settings


def test_default_settings_preserve_current_local_behavior():
    settings = Settings(_env_file=None)

    assert settings.app_env == "development"
    assert settings.api_mode == "local"
    assert settings.database_url == "sqlite:///./data/app.db"
    assert settings.cors_origins == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    assert settings.managed_static_dirs == [Path("data")]
    assert settings.managed_artwork_dir == Path("data/track_art")
    assert settings.allowed_scan_roots == []
    assert settings.upload_max_bytes is None
    assert settings.enable_ai_playlists is True
    assert settings.enable_deep_scan is True
    assert settings.enable_legacy_art_path_route is True
    assert settings.expose_local_paths is True


def test_settings_support_environment_overrides(monkeypatch):
    monkeypatch.setenv("API_ENV", "test")
    monkeypatch.setenv("API_MODE", "ci")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./override.db")
    monkeypatch.setenv("CORS_ORIGINS", '["http://example.test"]')
    monkeypatch.setenv("MANAGED_STATIC_DIRS", '["data", "public"]')
    monkeypatch.setenv("MANAGED_ARTWORK_DIR", "custom/art")
    monkeypatch.setenv("ALLOWED_SCAN_ROOTS", '["C:/Music", "D:/Audio"]')
    monkeypatch.setenv("UPLOAD_MAX_BYTES", "12345")
    monkeypatch.setenv("ENABLE_AI_PLAYLISTS", "false")
    monkeypatch.setenv("ENABLE_DEEP_SCAN", "false")
    monkeypatch.setenv("ENABLE_LEGACY_ART_PATH_ROUTE", "false")
    monkeypatch.setenv("DEBUG_EXPOSE_LOCAL_PATHS", "false")

    settings = Settings(_env_file=None)

    assert settings.app_env == "test"
    assert settings.api_mode == "ci"
    assert settings.database_url == "sqlite:///./override.db"
    assert settings.cors_origins == ["http://example.test"]
    assert settings.managed_static_dirs == [Path("data"), Path("public")]
    assert settings.managed_artwork_dir == Path("custom/art")
    assert settings.allowed_scan_roots == [Path("C:/Music"), Path("D:/Audio")]
    assert settings.upload_max_bytes == 12345
    assert settings.enable_ai_playlists is False
    assert settings.enable_deep_scan is False
    assert settings.enable_legacy_art_path_route is False
    assert settings.expose_local_paths is False
