"""
Maps external tags/genres into the app's internal tag vocabulary.

Why this exists:
External providers can return messy tags like:
    "hip-hop", "hip hop", "southern hip hop", "seen live", "canada"

We do not want to blindly create all of those as app tags.

Instead, we map useful external tags to the smaller set of tags that the
playlist generator understands.
"""

MUSICBRAINZ_TAG_MAP = {
    # Rap / hip-hop
    "hip hop": "rap",
    "hip-hop": "rap",
    "rap": "rap",
    "trap": "rap",
    "drill": "rap",

    # R&B
    "r&b": "rnb",
    "rnb": "rnb",
    "rhythm and blues": "rnb",
    "soul": "rnb",
    "neo soul": "rnb",

    # Pop
    "pop": "pop",
    "dance pop": "pop",
    "dance-pop": "pop",
    "synth pop": "pop",
    "synth-pop": "pop",
    "synthpop": "pop",

    # Rock
    "rock": "rock",
    "alternative rock": "rock",
    "indie rock": "rock",
    "punk rock": "rock",
    "hard rock": "rock",
    "metal": "rock",

    # Electronic
    "electronic": "electronic",
    "electronica": "electronic",
    "edm": "electronic",
    "house": "electronic",
    "techno": "electronic",
    "dubstep": "electronic",
    "trance": "electronic",
    "synthwave": "electronic",

    # Lofi
    "lofi": "lofi",
    "lo-fi": "lofi",
    "lo fi": "lofi",
    "chillhop": "lofi",

    # Other genres
    "jazz": "jazz",
    "classical": "classical",
    "country": "country",
    "reggae": "reggae",
    "dancehall": "reggae",
    "latin": "latin",
    "reggaeton": "latin",

    # Mood / vibe
    "chill": "chill",
    "calm": "chill",
    "mellow": "chill",
    "relaxing": "chill",
    "sad": "sad",
    "melancholic": "sad",
    "melancholy": "sad",
    "happy": "happy",
    "upbeat": "happy",
    "dark": "dark",
    "moody": "dark",

    # Activity/context
    "dance": "party",
    "club": "party",
    "party": "party",
    "study": "study",
    "focus": "focus",
    "ambient": "background",
    "instrumental": "instrumental",
}