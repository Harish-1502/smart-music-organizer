from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.track import Track
from app.services.bpm_analyzer import analyze_bpm
from app.services.energy_analyzer import analyze_energy


def analyze_track_audio(db: Session, track: Track) -> Track:
    """
    Run local audio analysis for one track and save the result.

    This does not create tags directly.
    Tag inference should read the saved bpm/energy fields later.
    """

    try:
        bpm_result = analyze_bpm(track.file_path)
        energy_result = analyze_energy(track.file_path)

        track.bpm = bpm_result.bpm
        track.bpm_confidence = bpm_result.confidence

        track.energy_score = energy_result.energy_score
        track.energy_label = energy_result.energy_label
        track.energy_confidence = energy_result.confidence
        track.loudness_db = energy_result.loudness_db
        track.loudness_label = energy_result.loudness_label

        track.audio_analyzed_at = datetime.now(timezone.utc)

        errors = []
        if bpm_result.error:
            errors.append(f"BPM: {bpm_result.error}")
        if energy_result.error:
            errors.append(f"Energy: {energy_result.error}")

        track.audio_analysis_error = "; ".join(errors) if errors else None

        db.flush()
        return track

    except Exception as error:
        track.audio_analysis_error = str(error)
        track.audio_analyzed_at = datetime.now(timezone.utc)
        db.flush()
        return track
