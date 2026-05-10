# app/services/tag_inference.py

import re

from sqlalchemy.orm import Session

from app.utils.tag_rules import TAG_RULES
from app.models.tag import Tag
from app.models.track import Track
from app.models.track_tag import TrackTag


def normalize_text(value: str) -> str:
    """
    Normalize text before keyword matching.

    We do this so rules work consistently across file names, folder names,
    and metadata. For example:
        "Late-Night_Vibes.mp3" -> "late night vibes mp3"

    This makes tag inference more reliable without needing complex NLP.
    """
    value = value.lower()
    value = re.sub(r"[_\-]+", " ", value)
    value = re.sub(r"[^\w\s&]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()

    return value


def build_track_search_text(track: Track) -> str:
    """
    Build one searchable text block from all useful track fields.

    Tag inference should not rely only on title, because many files have
    weak or missing metadata. Folder paths and file names often contain
    useful signals like:
        /Music/Workout/
        lofi_study_beats.mp3
        sad-night-drive.flac

    We include both display and scanned fields because display fields may be
    user-edited, while scanned fields preserve the original file metadata.
    """
    parts = [
        track.display_title,
        track.display_artist,
        track.display_album,
        track.title,
        track.artist,
        track.album,
        track.scanned_title,
        track.scanned_artist,
        track.scanned_album,
        track.file_name,
        track.folder_path,
    ]

    text = " ".join(part for part in parts if part)

    return normalize_text(text)


def keyword_matches(text: str, keyword: str) -> bool:
    """
    Check whether a rule keyword appears in the normalized track text.

    Multi-word keywords use simple substring matching because phrases like
    "late night" and "deep work" should match exactly inside the search text.

    Single-word keywords use word boundaries so short terms do not match
    inside unrelated words. For example:
        "rap" should not match "scrap"
        "pop" should not match "popular" unless "popular" is its own keyword
    """
    normalized_keyword = normalize_text(keyword)

    if not normalized_keyword:
        return False

    if " " in normalized_keyword:
        return normalized_keyword in text

    pattern = rf"\b{re.escape(normalized_keyword)}\b"

    return re.search(pattern, text) is not None


def infer_keyword_tags(track: Track) -> list[tuple[str, float]]:
    """
    Infer tags from configured keyword rules.

    This is the rule-engine part of the system:
        track text -> keyword matches -> inferred tag names

    The confidence comes from TAG_RULES because not all signals are equally
    strong. For example:
        "explicit" in a file name is a strong signal.
        "love" in a title is only a weak romantic signal.
    """
    text = build_track_search_text(track)
    inferred = []

    for tag_name, rule in TAG_RULES.items():
        keywords = rule.get("keywords", [])
        confidence = float(rule.get("confidence", 0.5))

        has_match = any(
            keyword_matches(text, keyword)
            for keyword in keywords
        )

        if has_match:
            inferred.append((tag_name, confidence))

    return inferred


def infer_duration_tags(track: Track) -> list[tuple[str, float]]:
    """
    Infer simple length-based tags from track duration.

    This is intentionally conservative. Duration can tell us whether a track
    is short or long, but it should not be used to guess mood or tempo.

    For example:
        A 70-second track is probably an intro, skit, or interlude.
        A 9-minute track is probably extended, live, ambient, or progressive.
    """
    inferred = []

    if track.duration is None:
        return inferred

    if track.duration < 90:
        inferred.append(("short", 0.75))

    if track.duration > 420:
        inferred.append(("long", 0.75))

    return inferred

def infer_bpm_tags(track: Track) -> list[tuple[str, float]]:
    inferred = []

    bpm = getattr(track, "bpm", None)
    confidence = getattr(track, "bpm_confidence", None) or 0.0

    if bpm is None or confidence < 0.45:
        return inferred

    if bpm >= 155:
        inferred.append(("fast", 0.8))
    elif bpm <= 85:
        inferred.append(("slow", 0.75))

    return inferred


def infer_energy_tags(track: Track) -> list[tuple[str, float]]:
    inferred = []

    energy_label = getattr(track, "energy_label", None)
    confidence = getattr(track, "energy_confidence", None) or 0.0

    if not energy_label or confidence < 0.45:
        return inferred

    # Low energy is safer to infer from energy alone.
    if energy_label == "low":
        inferred.append(("low_energy", 0.75))

    # Many slow/chill songs are mastered loud, especially YouTube downloads.
    return inferred

def track_has_slow_text_signal(track: Track) -> bool:
    text = build_track_search_text(track)

    slow_keywords = [
        "slow",
        "slowed",
        "slowed reverb",
        "slowed down",
        "slow version",
    ]

    return any(keyword_matches(text, keyword) for keyword in slow_keywords)

def infer_bpm_energy_combo_tags(track: Track) -> list[tuple[str, float]]:
    inferred = []

    bpm = getattr(track, "bpm", None)
    bpm_confidence = getattr(track, "bpm_confidence", None) or 0.0

    energy_label = getattr(track, "energy_label", None)
    energy_confidence = getattr(track, "energy_confidence", None) or 0.0

    if bpm is None:
        return inferred

    if bpm_confidence < 0.45 or energy_confidence < 0.45:
        return inferred

    has_slow_text = track_has_slow_text_signal(track)

    # If filename/title clearly says slowed, do not add high_energy
    # just because the audio is mastered loud.
    if has_slow_text:
        inferred.append(("slow", 0.85))
        inferred.append(("low_energy", 0.65))
        inferred.append(("chill", 0.60))
        return inferred

    if bpm >= 140 and energy_label == "high":
        inferred.append(("high_energy", 0.85))
        inferred.append(("workout", 0.72))
        inferred.append(("party", 0.65))

    elif bpm >= 125 and energy_label == "high":
        inferred.append(("high_energy", 0.70))
        inferred.append(("party", 0.60))

    if bpm <= 90 and energy_label in {"low", "medium"}:
        inferred.append(("low_energy", 0.75))
        inferred.append(("chill", 0.65))

    return inferred

def infer_track_tags(track: Track) -> list[tuple[str, float]]:
    """
    Run all available tag inference strategies for one track.

    This function is the public entry point for inference. Keep individual
    inference strategies separated so we can add more later without changing
    the rest of the app.

    Future examples:
        infer_genre_metadata_tags(track)
        infer_bpm_tags(track)
        infer_musicbrainz_tags(track)
        infer_audio_analysis_tags(track)
    """
    inferred = []

    inferred.extend(infer_keyword_tags(track))
    inferred.extend(infer_duration_tags(track))
    inferred.extend(infer_bpm_tags(track))
    inferred.extend(infer_energy_tags(track))
    inferred.extend(infer_bpm_energy_combo_tags(track))

    # A track may match the same tag from multiple strategies.
    # Keep the strongest confidence instead of creating duplicates.
    merged = {}

    for tag_name, confidence in inferred:
        current_confidence = merged.get(tag_name, 0)
        merged[tag_name] = max(current_confidence, confidence)

    return list(merged.items())


def ensure_tag_exists(db: Session, tag_name: str) -> Tag | None:
    """
    Make sure the inferred tag exists in the database.

    TAG_RULES is treated as the source of truth for built-in auto-tags.
    If the inferred tag is not in TAG_RULES, we skip it instead of creating
    random database tags from bad input.

    This prevents bugs where typos or bad parser output create messy tags like:
        "chll"
        "hig_energy"
        ""
    """
    rule = TAG_RULES.get(tag_name)

    if not rule:
        return None

    category = rule["category"]

    tag = db.query(Tag).filter(Tag.name == tag_name).first()

    if tag:
        return tag

    tag = Tag(
        name=tag_name,
        category=category,
    )

    # flush() writes the row enough for tag.id to exist in this transaction,
    # but does not commit yet. The caller should control the final commit.
    db.add(tag)
    db.flush()

    return tag


def apply_inferred_tags(db: Session, track: Track) -> list[TrackTag]:
    """
    Infer and save rule-based tags for a track.

    This function does not commit. The scanner or route that calls this
    function should commit after all track updates are complete.

    Important rule:
        Never overwrite manual user tags.

    Manual tags are treated as stronger than inferred tags because the user is
    correcting the system. Auto-tagging should assist the user, not fight them.
    """
    inferred_tags = infer_track_tags(track)
    applied_track_tags = []

    for tag_name, confidence in inferred_tags:
        tag = ensure_tag_exists(db, tag_name)

        if not tag:
            continue

        existing_track_tag = (
            db.query(TrackTag)
            .filter(
                TrackTag.track_id == track.id,
                TrackTag.tag_id == tag.id,
            )
            .first()
        )

        if existing_track_tag:
            # User-created tags should always win over automatic inference.
            if existing_track_tag.source == "manual":
                continue

            # If the same automatic tag already exists, keep the strongest
            # confidence score we have seen so far.
            existing_track_tag.confidence = max(
                existing_track_tag.confidence,
                confidence,
            )
            existing_track_tag.source = "rule"

            applied_track_tags.append(existing_track_tag)
            continue

        track_tag = TrackTag(
            track_id=track.id,
            tag_id=tag.id,
            source="rule",
            confidence=confidence,
        )

        db.add(track_tag)
        applied_track_tags.append(track_tag)

    return applied_track_tags

def refresh_inferred_tags(db: Session, track: Track) -> list[TrackTag]:
    """
    Rebuild rule-based tags for a track.

    Manual tags are preserved. Existing rule-based tags are removed because
    they may no longer match after metadata edits or rescans.
    """
    (
        db.query(TrackTag)
        .filter(
            TrackTag.track_id == track.id,
            TrackTag.source == "rule",
        )
        .delete(synchronize_session=False)
    )

    return apply_inferred_tags(db, track)

def parsed_rules_to_tags(parsed_rules: dict) -> tuple[list[str], list[str]]:
    include_tags = []
    exclude_tags = []

    # These should map directly to your tag names.
    include_tags.extend(parsed_rules.get("use_cases", []))
    include_tags.extend(parsed_rules.get("moods", []))
    include_tags.extend(parsed_rules.get("genres", []))

    energy = parsed_rules.get("energy")
    if energy == "low":
        include_tags.append("low_energy")
    elif energy == "high":
        include_tags.append("high_energy")

    exclude_tags.extend(parsed_rules.get("exclude_moods", []))
    exclude_tags.extend(parsed_rules.get("exclude_keywords", []))

    # Remove duplicates while preserving order
    include_tags = list(dict.fromkeys(include_tags))
    exclude_tags = list(dict.fromkeys(exclude_tags))

    return include_tags, exclude_tags
