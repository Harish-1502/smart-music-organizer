from dataclasses import dataclass


@dataclass(frozen=True)
class BpmAnalysisResult:
    """
    Result of BPM/tempo analysis for one audio file.

    Attributes:
        bpm:
            Estimated tempo in beats per minute.

        confidence:
            A rough confidence score from 0.0 to 1.0.
            This is not a perfect scientific confidence value.
            It is a practical score for deciding whether the BPM is usable.

        source:
            The analysis method used.

        reason:
            Human-readable explanation for debugging or UI display.

        duration_seconds:
            Duration of the analyzed audio.

        analyzed_seconds:
            How much audio was actually analyzed.

        error:
            Error message if analysis failed.
    """

    bpm: float | None
    confidence: float
    source: str
    reason: str
    duration_seconds: float | None = None
    analyzed_seconds: float | None = None
    error: str | None = None

@dataclass(frozen=True)
class EnergyAnalysisResult:
    """
    Result of local energy/loudness analysis for one audio file.

    This is not meant to be a perfect broadcast loudness measurement.
    It is a practical music-library feature for deciding whether a track feels:
    - low-energy
    - medium-energy
    - high-energy

    Attributes:
        rms_energy:
            Average root-mean-square energy of the analyzed audio.
            Higher values usually mean louder/more intense audio.

        peak_amplitude:
            Highest absolute sample value in the analyzed audio.

        dynamic_range:
            Difference between louder and quieter parts.
            A rough measure of how compressed or varied the audio is.

        loudness_db:
            Approximate loudness in decibels relative to full scale.
            This is useful for comparison, not professional mastering.

        loudness_label:
            Simple label derived from loudness_db.

        energy_score:
            Practical 0.0 to 1.0 score for playlist/tagging decisions.

        energy_label:
            One of: "low", "medium", "high".

        confidence:
            Practical confidence score from 0.0 to 1.0.

        source:
            Analysis method used.

        reason:
            Human-readable explanation for logs/UI later.

        duration_seconds:
            Total file duration if readable.

        analyzed_seconds:
            Amount of audio actually analyzed.

        error:
            Error message if analysis failed.
    """

    rms_energy: float | None
    peak_amplitude: float | None
    dynamic_range: float | None
    loudness_db: float | None
    energy_score: float
    energy_label: str | None
    confidence: float
    source: str
    reason: str
    loudness_label: str | None = None
    duration_seconds: float | None = None
    analyzed_seconds: float | None = None
    error: str | None = None
