"""
Tests for BPM analyzer.

These tests generate synthetic click tracks instead of relying on real music
files. That keeps the tests fast, legal, and repeatable.
"""

from pathlib import Path

import numpy as np
import soundfile as sf

from app.services.bpm_analyzer import analyze_bpm


def _write_click_track(
    path: Path,
    *,
    bpm: int,
    duration_seconds: int = 30,
    sample_rate: int = 22050,
) -> None:
    """
    Create a simple synthetic click track at a target BPM.

    This is not real music, but it is good enough to test whether the analyzer
    can detect a clear tempo.
    """

    total_samples = duration_seconds * sample_rate
    audio = np.zeros(total_samples, dtype=np.float32)

    seconds_per_beat = 60.0 / bpm
    beat_samples = int(seconds_per_beat * sample_rate)

    click_length = int(0.02 * sample_rate)

    for start in range(0, total_samples, beat_samples):
        end = min(start + click_length, total_samples)

        # Short impulse/click.
        audio[start:end] = 0.9

    sf.write(path, audio, sample_rate)


def test_analyze_bpm_returns_file_not_found_for_missing_file(tmp_path):
    missing_file = tmp_path / "missing.wav"

    result = analyze_bpm(missing_file)

    assert result.bpm is None
    assert result.confidence == 0.0
    assert result.error is not None


def test_analyze_bpm_detects_120_bpm_click_track(tmp_path):
    audio_file = tmp_path / "click_120.wav"
    _write_click_track(audio_file, bpm=120, duration_seconds=45)

    result = analyze_bpm(
        audio_file,
        offset_seconds=0,
        analysis_seconds=45,
    )

    assert result.bpm is not None
    assert abs(result.bpm - 120) <= 5
    assert result.confidence > 0.4


def test_analyze_bpm_detects_150_bpm_click_track(tmp_path):
    audio_file = tmp_path / "click_150.wav"
    _write_click_track(audio_file, bpm=150, duration_seconds=45)

    result = analyze_bpm(
        audio_file,
        offset_seconds=0,
        analysis_seconds=45,
    )

    assert result.bpm is not None
    assert abs(result.bpm - 150) <= 8
    assert result.confidence > 0.4


def test_analyze_bpm_handles_silent_audio(tmp_path):
    audio_file = tmp_path / "silent.wav"
    sample_rate = 22050
    silent_audio = np.zeros(sample_rate * 10, dtype=np.float32)

    sf.write(audio_file, silent_audio, sample_rate)

    result = analyze_bpm(
        audio_file,
        offset_seconds=0,
        analysis_seconds=10,
    )

    assert result.bpm is None
    assert result.confidence == 0.0
    assert result.error is not None