from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.models.track import Track
from app.services.scanner import scan_library, scan_state
import pytest

TEST_DB_URL = "sqlite:///./test_scanner.db"

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def setup_module():
    Base.metadata.create_all(bind=engine)


def teardown_module():
    Base.metadata.drop_all(bind=engine)


def test_scan_library_inserts_supported_files(tmp_path):
    # Create fake folder structure
    music_dir = tmp_path / "Music"
    music_dir.mkdir()

    (music_dir / "song1.mp3").write_text("fake mp3")
    (music_dir / "song2.flac").write_text("fake flac")
    (music_dir / "notes.txt").write_text("not music")

    db = TestingSessionLocal()

    try:
        scan_library(str(music_dir), db)

        tracks = db.query(Track).all()
        assert len(tracks) == 2
        assert scan_state["supported_found"] == 2
        assert scan_state["inserted"] == 2
        assert scan_state["failed"] == 0
    finally:
        db.close()

def test_scan_library_skips_duplicates(tmp_path):
    music_dir = tmp_path / "Music"
    music_dir.mkdir()

    (music_dir / "song1.mp3").write_text("fake mp3")

    db = TestingSessionLocal()

    try:
        scan_library(str(music_dir), db)
        scan_library(str(music_dir), db)

        tracks = db.query(Track).all()
        assert len(tracks) == 1
        assert scan_state["duplicates"] >= 1
    finally:
        db.close()

def test_scan_library_invalid_folder():
    db = TestingSessionLocal()

    try:
        with pytest.raises(ValueError, match="Folder does not exist."):
            scan_library("Z:/this/path/does/not/exist", db)
    finally:
        db.close()