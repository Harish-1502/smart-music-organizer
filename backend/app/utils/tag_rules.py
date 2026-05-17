TAG_RULES = {
    # -------------------------
    # Mood / vibe tags
    # -------------------------
    "chill": {
        "category": "mood",
        "keywords": [
            "chill", "chilled", "chilling", "relax", "relaxed", "relaxing",
            "calm", "mellow", "laid back", "laid-back", "smooth", "easy",
            "soft", "cozy", "vibey", "vibe", "lofi", "lo-fi",
        ],
        "confidence": 0.80,
    },
    "happy": {
        "category": "mood",
        "keywords": [
            "happy", "happier", "joy", "joyful", "fun", "feel good",
            "feel-good", "good mood", "uplifting", "upbeat", "positive",
            "sunny", "bright",
        ],
        "confidence": 0.75,
    },
    "calm": {
        "category": "mood",
        "keywords": ["calm", "peaceful", "gentle", "relaxing"],
        "confidence": 0.75,
    },
    "sad": {
        "category": "mood",
        "keywords": [
            "sad", "sadness", "cry", "crying", "tears", "heartbreak",
            "heartbroken", "lonely", "alone", "melancholy", "melancholic",
            "depressing", "blue", "emotional",
        ],
        "confidence": 0.78,
    },
    "dark": {
        "category": "mood",
        "keywords": [
            "dark", "moody", "ominous", "eerie", "haunting", "haunted",
            "creepy", "goth", "gothic", "shadow", "villain",
        ],
        "confidence": 0.72,
    },
    "romantic": {
        "category": "mood",
        "keywords": [
            "romantic", "romance", "love", "lover", "lovers", "valentine",
            "date night", "crush", "kiss", "slow dance",
        ],
        "confidence": 0.70,
    },
    "angry": {
        "category": "mood",
        "keywords": [
            "angry", "anger", "rage", "mad", "aggressive", "fight",
            "war", "battle", "revenge", "riot",
        ],
        "confidence": 0.70,
    },
    "confident": {
        "category": "mood",
        "keywords": [
            "confident", "confidence", "boss", "main character",
            "main-character", "power", "powerful", "swagger", "flex",
        ],
        "confidence": 0.68,
    },

    # -------------------------
    # Activity tags
    # -------------------------
    "workout": {
        "category": "activity",
        "keywords": [
            "workout", "work out", "gym", "training", "train", "lifting",
            "lift", "pump", "fitness", "exercise", "cardio", "running",
            "run", "jogging", "beast mode", "beastmode",
        ],
        "confidence": 0.85,
    },
    "focus": {
        "category": "activity",
        "keywords": [
            "focus", "focused", "concentration", "concentrate", "deep work",
            "deepwork", "coding", "programming", "work", "productivity",
            "flow state", "flow",
        ],
        "confidence": 0.76,
    },
    "study": {
        "category": "activity",
        "keywords": [
            "study", "studying", "homework", "school", "exam", "exams",
            "finals", "midterm", "library", "reading", "notes",
        ],
        "confidence": 0.78,
    },
    "sleep": {
        "category": "activity",
        "keywords": [
            "sleep", "sleeping", "bedtime", "nap", "dream", "dreams",
            "dreamy", "night sleep", "fall asleep", "ambient sleep",
        ],
        "confidence": 0.80,
    },
    "driving": {
        "category": "activity",
        "keywords": [
            "drive", "driving", "car", "road", "roadtrip", "road trip",
            "highway", "cruise", "cruising", "night drive", "late night drive",
        ],
        "confidence": 0.78,
    },
    "party": {
        "category": "activity",
        "keywords": [
            "party", "club", "clubbing", "dance", "dancing", "dancefloor",
            "rave", "festival", "turn up", "turnup", "banger", "bangers",
        ],
        "confidence": 0.82,
    },

    # -------------------------
    # Context tags
    # -------------------------
    "night": {
        "category": "context",
        "keywords": [
            "night", "midnight", "late night", "latenight", "after dark",
            "dark night", "night drive", "night vibes",
        ],
        "confidence": 0.75,
    },
    "morning": {
        "category": "context",
        "keywords": [
            "morning", "sunrise", "wake up", "wakeup", "breakfast",
            "early morning", "am",
        ],
        "confidence": 0.68,
    },
    "summer": {
        "category": "context",
        "keywords": [
            "summer", "beach", "sun", "sunshine", "vacation", "island",
            "tropical", "pool", "poolside",
        ],
        "confidence": 0.72,
    },
    "winter": {
        "category": "context",
        "keywords": [
            "winter", "snow", "cold", "december", "christmas", "holiday",
            "cozy winter",
        ],
        "confidence": 0.72,
    },
    "background": {
        "category": "context",
        "keywords": [
            "background", "background music", "ambient", "soft background",
            "cafe", "coffee shop", "lounge",
        ],
        "confidence": 0.70,
    },

    # -------------------------
    # Tempo / energy tags
    # These are weak unless from BPM later.
    # -------------------------
    "fast": {
        "category": "tempo",
        "keywords": [
            "fast", "speed", "speedy", "rapid", "rush", "running",
            "high bpm", "uptempo", "up tempo", "energetic", "energy",
        ],
        "confidence": 0.58,
    },
    "slow": {
        "category": "tempo",
        "keywords": [
            "slow", "slowed", "slowly", "slow jam", "slow jams",
            "ballad", "soft", "mellow", "low bpm",
        ],
        "confidence": 0.58,
    },
    "high_energy": {
        "category": "energy",
        "keywords": [
            "high energy", "high-energy", "hype", "hyped", "intense",
            "banger", "bangers", "pump", "hard", "explosive", "energetic",
        ],
        "confidence": 0.65,
    },
    "low_energy": {
        "category": "energy",
        "keywords": [
            "low energy", "low-energy", "calm", "soft", "quiet",
            "peaceful", "gentle", "mellow", "sleepy",
        ],
        "confidence": 0.60,
    },

    # -------------------------
    # Genre tags
    # -------------------------
    "rap": {
        "category": "genre",
        "keywords": [
            "rap", "rapper", "hip hop", "hip-hop", "hiphop", "trap",
            "drill", "freestyle", "bars", "mixtape",
        ],
        "confidence": 0.82,
    },
    "rnb": {
        "category": "genre",
        "keywords": [
            "rnb", "r&b", "rhythm and blues", "soul", "slow jam",
            "slow jams", "neo soul", "neosoul",
        ],
        "confidence": 0.82,
    },
    "pop": {
        "category": "genre",
        "keywords": [
            "pop", "pop music", "radio hit", "radio hits", "top 40",
            "mainstream", "dance pop", "synth pop", "synthpop",
        ],
        "confidence": 0.72,
    },
    "rock": {
        "category": "genre",
        "keywords": [
            "rock", "alt rock", "alternative rock", "indie rock",
            "punk", "metal", "guitar rock", "hard rock",
        ],
        "confidence": 0.82,
    },
    "electronic": {
        "category": "genre",
        "keywords": [
            "electronic", "edm", "house", "techno", "dubstep", "trance",
            "electro", "dance", "rave", "synth", "synthwave",
        ],
        "confidence": 0.82,
    },
    "lofi": {
        "category": "genre",
        "keywords": [
            "lofi", "lo-fi", "lo fi", "chillhop", "study beats",
            "sleepy beats", "beats to study", "jazzhop",
        ],
        "confidence": 0.85,
    },
    "acoustic": {
        "category": "genre",
        "keywords": [
            "acoustic", "unplugged", "guitar", "piano", "stripped",
            "stripped down", "live acoustic",
        ],
        "confidence": 0.75,
    },
    "jazz": {
        "category": "genre",
        "keywords": [
            "jazz", "smooth jazz", "bebop", "swing", "sax", "saxophone",
            "jazzhop",
        ],
        "confidence": 0.80,
    },
    "classical": {
        "category": "genre",
        "keywords": [
            "classical", "orchestra", "orchestral", "symphony", "concerto",
            "piano sonata", "violin", "mozart", "beethoven", "bach",
        ],
        "confidence": 0.85,
    },
    "country": {
        "category": "genre",
        "keywords": [
            "country", "folk", "western", "americana", "banjo",
            "nashville",
        ],
        "confidence": 0.78,
    },
    "reggae": {
        "category": "genre",
        "keywords": [
            "reggae", "dancehall", "dub", "jamaica", "afrobeats",
            "afrobeat", "afro pop", "afropop",
        ],
        "confidence": 0.78,
    },
    "latin": {
        "category": "genre",
        "keywords": [
            "latin", "reggaeton", "bachata", "salsa", "merengue",
            "latin pop", "spanish",
        ],
        "confidence": 0.78,
    },

    # -------------------------
    # Vocal / structure tags
    # -------------------------
    "instrumental": {
        "category": "vocal",
        "keywords": [
            "instrumental", "instrumentals", "beat", "beats", "no vocals",
            "no vocal", "karaoke", "piano version", "guitar version",
        ],
        "confidence": 0.78,
    },
    "live": {
        "category": "version",
        "keywords": [
            "live", "live version", "live at", "concert", "session",
            "acoustic session", "performance",
        ],
        "confidence": 0.80,
    },
    "remix": {
        "category": "version",
        "keywords": [
            "remix", "refix", "edit", "club mix", "radio edit",
            "extended mix", "vip mix",
        ],
        "confidence": 0.85,
    },
    "cover": {
        "category": "version",
        "keywords": [
            "cover", "covered by", "tribute", "version of",
        ],
        "confidence": 0.75,
    },
    "edm": {
        "category": "genre",
        "keywords": [
            "edm",
            "electronic dance music",
            "festival mix",
            "rave",
        ],
        "confidence": 0.85,
    },

    # -------------------------
    # Clean / explicit signals
    # -------------------------
    "explicit": {
        "category": "content",
        "keywords": [
            "explicit", "dirty version", "uncensored",
        ],
        "confidence": 0.90,
    },
    "clean": {
        "category": "content",
        "keywords": [
            "clean", "clean version", "radio edit", "censored",
        ],
        "confidence": 0.85,
    },

    # -------------------------
    # Length tags
    # These should mostly be added by duration logic, not keyword logic.
    # -------------------------
    "short": {
        "category": "length",
        "keywords": [
            "short", "interlude", "intro", "skit",
        ],
        "confidence": 0.60,
    },
    "long": {
        "category": "length",
        "keywords": [
            "long", "extended", "extended version", "extended mix",
        ],
        "confidence": 0.60,
    },
    # YouTube / edited music tags
    "nightcore": {
        "category": "version",
        "keywords": [
            "nightcore",
            "night core",
        ],
        "confidence": 0.95,
    },

    "sped_up": {
        "category": "version",
        "keywords": [
            "sped up",
            "sped-up",
            "speed up",
            "speed-up",
            "fast version",
            "speed version",
            "speed audio",
        ],
        "confidence": 0.90,
    },

    "slowed": {
        "category": "version",
        "keywords": [
            "slowed",
            "slowed reverb",
            "slowed + reverb",
            "slow version",
            "slowed down",
        ],
        "confidence": 0.90,
    },

    "anime": {
        "category": "context",
        "keywords": [
            "anime",
            "opening",
            "ending",
            "ost",
            "amv",
            "mad",
        ],
        "confidence": 0.78,
    },

    "amv": {
        "category": "context",
        "keywords": [
            "amv",
            "anime music video",
        ],
        "confidence": 0.90,
    },

    "jpop": {
        "category": "genre",
        "keywords": [
            "jpop",
            "j-pop",
            "j pop",
            "japanese pop",
        ],
        "confidence": 0.85,
    },

    "kpop": {
        "category": "genre",
        "keywords": [
            "kpop",
            "k-pop",
            "k pop",
            "korean pop",
        ],
        "confidence": 0.85,
    },

    "phonk": {
        "category": "genre",
        "keywords": [
            "phonk",
            "drift phonk",
            "cowbell",
        ],
        "confidence": 0.90,
    },

    "bass_boosted": {
        "category": "version",
        "keywords": [
            "bass boosted",
            "bassboosted",
            "bass boost",
            "boosted bass",
        ],
        "confidence": 0.90,
    },

    "tiktok": {
        "category": "context",
        "keywords": [
            "tiktok",
            "tik tok",
            "viral",
            "edit audio",
            "audio edit",
        ],
        "confidence": 0.75,
    },
}