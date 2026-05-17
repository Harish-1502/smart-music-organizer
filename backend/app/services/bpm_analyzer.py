"""
BPM analyzer for local music files.

This module only analyzes audio and returns a BPM result.
It does not:
- write to the database
- create tags
- update tracks
- apply playlist logic

That separation makes it easier to test first and integrate later.
"""

from __future__ import annotations

import logging
from pathlib import Path

import librosa
import numpy as np
from app.services.audio_analysis_models import BpmAnalysisResult

logger = logging.getLogger(__name__)


# Analyze a limited amount of audio for speed.
# YouTube downloads can be long, so analyzing the whole file is unnecessary.
DEFAULT_ANALYSIS_SECONDS = 90

# Skip the first few seconds because intros can be quiet, speechy, or misleading.
DEFAULT_OFFSET_SECONDS = 10

# Use mono audio for faster and simpler tempo analysis.
DEFAULT_MONO = True

# Librosa's default sample rate is 22050, which is fine for analysis.
DEFAULT_SAMPLE_RATE = 22050


def analyze_bpm(
    file_path: str | Path,
    *,
    analysis_seconds: int = DEFAULT_ANALYSIS_SECONDS,
    offset_seconds: int = DEFAULT_OFFSET_SECONDS,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
) -> BpmAnalysisResult:
    """
    Estimate the BPM of an audio file.

    Args:
        file_path:
            Path to the local audio file.

        analysis_seconds:
            Number of seconds to analyze.
            Keeping this limited makes scanning faster.

        offset_seconds:
            Number of seconds to skip before analysis.
            This avoids misleading intros.

        sample_rate:
            Target sample rate used by librosa.

    Returns:
        BpmAnalysisResult with BPM, confidence, and reason.
    """

    path = Path(file_path)

    if not path.exists():
        return BpmAnalysisResult(
            bpm=None,
            confidence=0.0,
            source="librosa_bpm",
            reason="Audio file does not exist",
            error=f"File not found: {path}",
        )

    try:
        logger.info("Analyzing BPM for file: %s", path)

        duration_seconds = _safe_get_duration(path)

        y, sr = librosa.load(
            path,
            sr=sample_rate,
            mono=DEFAULT_MONO,
            offset=offset_seconds,
            duration=analysis_seconds,
        )

        if y.size == 0:
            return BpmAnalysisResult(
                bpm=None,
                confidence=0.0,
                source="librosa_bpm",
                reason="No audio data could be loaded",
                duration_seconds=duration_seconds,
                analyzed_seconds=0,
                error="Loaded audio array is empty",
            )

        analyzed_seconds = len(y) / sr

        # Harmonic/percussive separation helps tempo detection focus on rhythm.
        # If this fails for any weird file, fall back to the raw signal.
        try:
            _, y_percussive = librosa.effects.hpss(y)
        except Exception:
            logger.exception("HPSS failed; falling back to raw audio")
            y_percussive = y

        onset_envelope = librosa.onset.onset_strength(
            y=y_percussive,
            sr=sr,
        )

        if onset_envelope.size == 0 or float(np.max(onset_envelope)) <= 0:
            return BpmAnalysisResult(
                bpm=None,
                confidence=0.0,
                source="librosa_bpm",
                reason="No rhythmic onset information found",
                duration_seconds=duration_seconds,
                analyzed_seconds=analyzed_seconds,
                error="Empty or silent onset envelope",
            )

        tempo_values = librosa.feature.tempo(
            onset_envelope=onset_envelope,
            sr=sr,
            aggregate=None,
        )

        if tempo_values is None or len(tempo_values) == 0:
            return BpmAnalysisResult(
                bpm=None,
                confidence=0.0,
                source="librosa_bpm",
                reason="Tempo estimation returned no values",
                duration_seconds=duration_seconds,
                analyzed_seconds=analyzed_seconds,
                error="No tempo values returned",
            )

        bpm = _pick_stable_bpm(tempo_values)
        bpm = _normalize_common_double_or_half_tempo(bpm)

        confidence = _estimate_bpm_confidence(
            tempo_values=tempo_values,
            onset_envelope=onset_envelope,
            analyzed_seconds=analyzed_seconds,
        )

        return BpmAnalysisResult(
            bpm=round(float(bpm), 2),
            confidence=round(float(confidence), 3),
            source="librosa_bpm",
            reason=_build_reason(bpm, confidence),
            duration_seconds=duration_seconds,
            analyzed_seconds=round(float(analyzed_seconds), 2),
        )

    except Exception as exc:
        logger.exception("BPM analysis failed for file: %s", path)

        return BpmAnalysisResult(
            bpm=None,
            confidence=0.0,
            source="librosa_bpm",
            reason="BPM analysis failed",
            error=str(exc),
        )


def _safe_get_duration(path: Path) -> float | None:
    """
    Get audio duration safely.

    Duration is useful later for deciding if the file is a short edit,
    normal track, or long mix.
    """

    try:
        return round(float(librosa.get_duration(path=str(path))), 2)
    except Exception:
        logger.exception("Could not read duration for file: %s", path)
        return None


def _pick_stable_bpm(tempo_values: np.ndarray) -> float:
    """
    Pick a stable BPM estimate from frame-level tempo values.

    Librosa can return many tempo values across the analyzed segment.
    The median is more stable than blindly taking the first value.
    """

    cleaned = np.asarray(tempo_values, dtype=float)
    cleaned = cleaned[np.isfinite(cleaned)]
    cleaned = cleaned[cleaned > 0]

    if cleaned.size == 0:
        return 0.0

    return float(np.median(cleaned))


def _normalize_common_double_or_half_tempo(bpm: float) -> float:
    """
    Normalize extremely low/high BPM into a more useful playlist range.

    Tempo detection often has half-time/double-time ambiguity.
    Example:
        75 BPM could be perceived as 150 BPM.
        190 BPM could be perceived as 95 BPM.

    For playlists, a practical range is often more useful than the literal
    detected tempo.
    """

    if bpm <= 0:
        return bpm

    # Very low detected BPM is often half-time.
    if bpm < 70:
        bpm *= 2

    # Very high detected BPM is often double-time.
    elif bpm > 190:
        bpm /= 2

    return bpm


def _estimate_bpm_confidence(
    *,
    tempo_values: np.ndarray,
    onset_envelope: np.ndarray,
    analyzed_seconds: float,
) -> float:
    """
    Estimate a practical confidence score for BPM.

    This is not a formal probability. It combines:
    - enough analyzed audio
    - enough onset strength
    - tempo stability across frames
    """

    confidence = 0.0

    # More analyzed audio usually gives better BPM estimates.
    if analyzed_seconds >= 60:
        confidence += 0.35
    elif analyzed_seconds >= 30:
        confidence += 0.25
    elif analyzed_seconds >= 15:
        confidence += 0.15

    onset_max = float(np.max(onset_envelope)) if onset_envelope.size else 0.0
    onset_mean = float(np.mean(onset_envelope)) if onset_envelope.size else 0.0

    # Strong rhythmic onsets are a good sign.
    if onset_max > 0 and onset_mean > 0:
        confidence += 0.25

    cleaned = np.asarray(tempo_values, dtype=float)
    cleaned = cleaned[np.isfinite(cleaned)]
    cleaned = cleaned[cleaned > 0]

    if cleaned.size >= 3:
        tempo_std = float(np.std(cleaned))

        # Stable tempo means lower standard deviation.
        if tempo_std <= 5:
            confidence += 0.3
        elif tempo_std <= 12:
            confidence += 0.2
        elif tempo_std <= 25:
            confidence += 0.1
    elif cleaned.size > 0:
        confidence += 0.1

    return min(confidence, 1.0)


def _build_reason(bpm: float, confidence: float) -> str:
    """
    Build a simple explanation that can later be shown in logs or UI.
    """

    if confidence >= 0.8:
        quality = "high confidence"
    elif confidence >= 0.6:
        quality = "medium confidence"
    else:
        quality = "low confidence"

    if bpm >= 155:
        tempo_label = "very fast"
    elif bpm >= 125:
        tempo_label = "fast"
    elif bpm >= 95:
        tempo_label = "moderate"
    else:
        tempo_label = "slow"

    return f"Detected {tempo_label} tempo around {bpm:.0f} BPM with {quality}"