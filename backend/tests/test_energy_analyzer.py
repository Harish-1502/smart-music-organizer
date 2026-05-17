"""
Tests for energy/loudness analyzer.

These tests generate synthetic WAV files instead of using real songs.
That keeps tests fast, legal, and repeatable.
"""

from pathlib import Path

import numpy as np
import soundfile as sf

from app.services.energy_analyzer import analyze_energy


def _write_sine_wave(
    path: Path,
    *,
    amplitude: float,
    frequency: float = 440.0,
    duration_seconds: int = 10,
    sample_rate: int = 22050,
) -> None:
    """
    Write a simple sine wave at a chosen amplitude.

    Higher amplitude should result in higher RMS and energy score.
    """

    t = np.linspace(
        0,
        duration_seconds,
        int(sample_rate * duration_seconds),
        endpoint=False,
    )

    audio = amplitude * np.sin(2 * np.pi * frequency * t)

    sf.write(path, audio.astype(np.float32), sample_rate)


def test_analyze_energy_returns_file_not_found_for_missing_file(tmp_path):
    missing_file = tmp_path / "missing.wav"

    result = analyze_energy(missing_file)

    assert result.rms_energy is None
    assert result.energy_score == 0.0
    assert result.energy_label is None
    assert result.confidence == 0.0
    assert result.error is not None


def test_analyze_energy_handles_silent_audio(tmp_path):
    audio_file = tmp_path / "silent.wav"
    sample_rate = 22050
    silent_audio = np.zeros(sample_rate * 10, dtype=np.float32)

    sf.write(audio_file, silent_audio, sample_rate)

    result = analyze_energy(
        audio_file,
        offset_seconds=0,
        analysis_seconds=10,
    )

    assert result.rms_energy == 0.0
    assert result.peak_amplitude == 0.0
    assert result.energy_score == 0.0
    assert result.energy_label == "low"
    assert result.error is not None


def test_high_amplitude_audio_has_higher_energy_than_low_amplitude_audio(tmp_path):
    low_file = tmp_path / "low.wav"
    high_file = tmp_path / "high.wav"

    _write_sine_wave(low_file, amplitude=0.05, duration_seconds=10)
    _write_sine_wave(high_file, amplitude=0.8, duration_seconds=10)

    low_result = analyze_energy(
        low_file,
        offset_seconds=0,
        analysis_seconds=10,
    )

    high_result = analyze_energy(
        high_file,
        offset_seconds=0,
        analysis_seconds=10,
    )

    assert low_result.rms_energy is not None
    assert high_result.rms_energy is not None

    assert high_result.rms_energy > low_result.rms_energy
    assert high_result.peak_amplitude > low_result.peak_amplitude
    assert high_result.energy_score > low_result.energy_score


def test_energy_label_for_quiet_audio_is_low(tmp_path):
    audio_file = tmp_path / "quiet.wav"

    _write_sine_wave(audio_file, amplitude=0.03, duration_seconds=10)

    result = analyze_energy(
        audio_file,
        offset_seconds=0,
        analysis_seconds=10,
    )

    assert result.energy_label == "low"
    assert result.energy_score < 0.35


def test_energy_label_for_loud_audio_is_high_or_medium(tmp_path):
    audio_file = tmp_path / "loud.wav"

    _write_sine_wave(audio_file, amplitude=0.9, duration_seconds=10)

    result = analyze_energy(
        audio_file,
        offset_seconds=0,
        analysis_seconds=10,
    )

    assert result.energy_label in {"medium", "high"}
    assert result.energy_score >= 0.35
    assert result.confidence > 0.0