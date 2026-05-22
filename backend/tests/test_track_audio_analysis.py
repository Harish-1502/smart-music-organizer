from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.track import Track
from app.services.audio_analysis_models import BpmAnalysisResult, EnergyAnalysisResult
from app.services.track_audio_analysis import analyze_track_audio


def make_test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )

    Base.metadata.create_all(bind=engine)

    return TestingSessionLocal


def test_analyze_track_audio_persists_loudness_fields(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = Track(
            file_path="S:/Music/song.mp3",
            file_name="song.mp3",
            extension=".mp3",
            folder_path="S:/Music",
        )
        db.add(track)
        db.flush()

        monkeypatch.setattr(
            "app.services.track_audio_analysis.analyze_bpm",
            lambda _path: BpmAnalysisResult(
                bpm=120.0,
                confidence=0.9,
                source="test",
                reason="test bpm",
            ),
        )
        monkeypatch.setattr(
            "app.services.track_audio_analysis.analyze_energy",
            lambda _path: EnergyAnalysisResult(
                rms_energy=0.1,
                peak_amplitude=0.5,
                dynamic_range=0.2,
                loudness_db=-12.5,
                energy_score=0.8,
                energy_label="high",
                confidence=0.85,
                source="test",
                reason="test energy",
                loudness_label="loud",
            ),
        )

        analyze_track_audio(db, track)

        assert track.bpm == 120.0
        assert track.energy_score == 0.8
        assert track.loudness_db == -12.5
        assert track.loudness_label == "loud"
        assert track.audio_analysis_error is None
    finally:
        db.close()
