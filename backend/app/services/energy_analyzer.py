"""
Energy/loudness analyzer for local music files.

This module only analyzes audio and returns an EnergyAnalysisResult.
It does not:
- write to the database
- create tags
- update tracks
- apply playlist logic

The goal is to produce a useful local signal for future tags like:
- high-energy
- low-energy
- workout
- chill
- background
"""

from __future__ import annotations

import logging
from pathlib import Path

import librosa
import numpy as np

from app.services.audio_analysis_models import EnergyAnalysisResult

logger = logging.getLogger(__name__)


DEFAULT_ANALYSIS_SECONDS = 90
DEFAULT_OFFSET_SECONDS = 10
DEFAULT_SAMPLE_RATE = 22050
DEFAULT_MONO = True

# Small value to avoid log(0).
EPSILON = 1e-10


def analyze_energy(
    file_path: str | Path,
    *,
    analysis_seconds: int = DEFAULT_ANALYSIS_SECONDS,
    offset_seconds: int = DEFAULT_OFFSET_SECONDS,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
) -> EnergyAnalysisResult:
    """
    Analyze rough energy and loudness for an audio file.

    Args:
        file_path:
            Path to local audio file.

        analysis_seconds:
            Number of seconds to analyze.

        offset_seconds:
            Number of seconds to skip before analysis.
            Skipping intros helps avoid misleading quiet openings.

        sample_rate:
            Target sample rate used by librosa.

    Returns:
        EnergyAnalysisResult with energy/loudness features.
    """

    path = Path(file_path)

    if not path.exists():
        return EnergyAnalysisResult(
            rms_energy=None,
            peak_amplitude=None,
            dynamic_range=None,
            loudness_db=None,
            energy_score=0.0,
            energy_label=None,
            confidence=0.0,
            source="librosa_energy",
            reason="Audio file does not exist",
            error=f"File not found: {path}",
        )

    try:
        logger.info("Analyzing energy/loudness for file: %s", path)

        duration_seconds = _safe_get_duration(path)

        y, sr = librosa.load(
            path,
            sr=sample_rate,
            mono=DEFAULT_MONO,
            offset=offset_seconds,
            duration=analysis_seconds,
        )

        if y.size == 0:
            return EnergyAnalysisResult(
                rms_energy=None,
                peak_amplitude=None,
                dynamic_range=None,
                loudness_db=None,
                energy_score=0.0,
                energy_label=None,
                confidence=0.0,
                source="librosa_energy",
                reason="No audio data could be loaded",
                duration_seconds=duration_seconds,
                analyzed_seconds=0,
                error="Loaded audio array is empty",
            )

        analyzed_seconds = len(y) / sr

        if _is_silent(y):
            return EnergyAnalysisResult(
                rms_energy=0.0,
                peak_amplitude=0.0,
                dynamic_range=0.0,
                loudness_db=None,
                energy_score=0.0,
                energy_label="low",
                confidence=0.0,
                source="librosa_energy",
                reason="Audio appears silent or near-silent",
                duration_seconds=duration_seconds,
                analyzed_seconds=round(float(analyzed_seconds), 2),
                error="Silent or near-silent audio",
            )

        rms_energy = _calculate_average_rms(y)
        peak_amplitude = _calculate_peak_amplitude(y)
        dynamic_range = _calculate_dynamic_range(y)
        loudness_db = _calculate_loudness_db(rms_energy)

        energy_score = _calculate_energy_score(
            rms_energy=rms_energy,
            peak_amplitude=peak_amplitude,
            dynamic_range=dynamic_range,
        )

        energy_label = _label_energy(energy_score)

        confidence = _estimate_energy_confidence(
            analyzed_seconds=analyzed_seconds,
            rms_energy=rms_energy,
            peak_amplitude=peak_amplitude,
        )

        return EnergyAnalysisResult(
            rms_energy=round(float(rms_energy), 6),
            peak_amplitude=round(float(peak_amplitude), 6),
            dynamic_range=round(float(dynamic_range), 6),
            loudness_db=round(float(loudness_db), 2),
            energy_score=round(float(energy_score), 3),
            energy_label=energy_label,
            confidence=round(float(confidence), 3),
            source="librosa_energy",
            reason=_build_reason(energy_label, energy_score, loudness_db, confidence),
            duration_seconds=duration_seconds,
            analyzed_seconds=round(float(analyzed_seconds), 2),
        )

    except Exception as exc:
        logger.exception("Energy/loudness analysis failed for file: %s", path)

        return EnergyAnalysisResult(
            rms_energy=None,
            peak_amplitude=None,
            dynamic_range=None,
            loudness_db=None,
            energy_score=0.0,
            energy_label=None,
            confidence=0.0,
            source="librosa_energy",
            reason="Energy/loudness analysis failed",
            error=str(exc),
        )


def _safe_get_duration(path: Path) -> float | None:
    """
    Read total duration safely.
    """

    try:
        return round(float(librosa.get_duration(path=str(path))), 2)
    except Exception:
        logger.exception("Could not read duration for file: %s", path)
        return None


def _is_silent(y: np.ndarray) -> bool:
    """
    Detect silent or almost silent audio.
    """

    peak = float(np.max(np.abs(y))) if y.size else 0.0
    return peak < 1e-5


def _calculate_average_rms(y: np.ndarray) -> float:
    """
    Calculate average RMS energy.

    RMS is one of the simplest useful loudness/energy features.
    """

    rms_frames = librosa.feature.rms(y=y)[0]

    if rms_frames.size == 0:
        return 0.0

    return float(np.mean(rms_frames))


def _calculate_peak_amplitude(y: np.ndarray) -> float:
    """
    Calculate highest absolute sample amplitude.
    """

    return float(np.max(np.abs(y))) if y.size else 0.0


def _calculate_dynamic_range(y: np.ndarray) -> float:
    """
    Estimate rough dynamic range using RMS frame percentiles.

    This is not professional dynamic range measurement.
    It is good enough to compare tracks for playlist/tagging purposes.
    """

    rms_frames = librosa.feature.rms(y=y)[0]

    if rms_frames.size == 0:
        return 0.0

    quiet = float(np.percentile(rms_frames, 10))
    loud = float(np.percentile(rms_frames, 90))

    return max(loud - quiet, 0.0)


def _calculate_loudness_db(rms_energy: float) -> float:
    """
    Convert RMS energy to approximate dBFS.

    dBFS means decibels relative to full scale.
    0 dBFS is maximum digital level.
    Most music will be negative, like -20 dBFS, -12 dBFS, etc.
    """

    return float(20.0 * np.log10(max(rms_energy, EPSILON)))


def _calculate_energy_score(
    *,
    rms_energy: float,
    peak_amplitude: float,
    dynamic_range: float,
) -> float:
    """
    Convert raw audio features into a practical 0.0 to 1.0 energy score.

    This is intentionally simple for V1.

    The score uses:
    - average RMS energy as the main signal
    - peak amplitude as a supporting signal
    - dynamic range as a small supporting signal
    """

    # These ranges are practical for normalized audio loaded by librosa.
    # They may need tuning after you test on your own library.
    rms_score = _normalize_value(rms_energy, min_value=0.01, max_value=0.18)
    peak_score = _normalize_value(peak_amplitude, min_value=0.10, max_value=0.95)
    dynamic_score = _normalize_value(dynamic_range, min_value=0.005, max_value=0.12)

    score = (
        0.65 * rms_score
        + 0.25 * peak_score
        + 0.10 * dynamic_score
    )

    return min(max(score, 0.0), 1.0)


def _normalize_value(value: float, *, min_value: float, max_value: float) -> float:
    """
    Normalize a number into a 0.0 to 1.0 range.
    """

    if max_value <= min_value:
        return 0.0

    normalized = (value - min_value) / (max_value - min_value)
    return min(max(float(normalized), 0.0), 1.0)


def _label_energy(energy_score: float) -> str:
    """
    Convert energy score to a simple label.
    """

    if energy_score >= 0.7:
        return "high"

    if energy_score >= 0.35:
        return "medium"

    return "low"


def _estimate_energy_confidence(
    *,
    analyzed_seconds: float,
    rms_energy: float,
    peak_amplitude: float,
) -> float:
    """
    Estimate practical confidence for the energy analysis.

    Confidence increases when:
    - enough audio was analyzed
    - the track has non-trivial signal level
    """

    confidence = 0.0

    if analyzed_seconds >= 60:
        confidence += 0.45
    elif analyzed_seconds >= 30:
        confidence += 0.35
    elif analyzed_seconds >= 15:
        confidence += 0.25
    elif analyzed_seconds >= 5:
        confidence += 0.15

    if rms_energy >= 0.03:
        confidence += 0.3
    elif rms_energy >= 0.01:
        confidence += 0.2

    if peak_amplitude >= 0.2:
        confidence += 0.25
    elif peak_amplitude >= 0.05:
        confidence += 0.15

    return min(confidence, 1.0)


def _build_reason(
    energy_label: str,
    energy_score: float,
    loudness_db: float,
    confidence: float,
) -> str:
    """
    Build a short explanation for logs/UI.
    """

    if confidence >= 0.8:
        confidence_label = "high confidence"
    elif confidence >= 0.6:
        confidence_label = "medium confidence"
    else:
        confidence_label = "low confidence"

    return (
        f"Detected {energy_label} energy "
        f"(score {energy_score:.2f}, approx {loudness_db:.1f} dBFS) "
        f"with {confidence_label}"
    )