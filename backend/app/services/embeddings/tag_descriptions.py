EMBEDDING_ENABLED_TAGS: frozenset[str] = frozenset(
    {
        "remix",
        "sped_up",
        "slowed",
        "cover",
        "anime",
        "phonk",
        "rap",
        "edm",
    }
)


TAG_EMBEDDING_DESCRIPTIONS: dict[str, str] = {
    "anime": (
        "Anime music, anime openings, anime endings, AMV edits, Japanese animation "
        "soundtracks, songs associated with anime series, anime OP and ED themes."
    ),
    # "nightcore": (
    #     "Nightcore version, sped up high-pitched remix, fast energetic edit, "
    #     "anime-style sped up remix, pitched-up electronic or pop song."
    # ),
    "sped_up": (
        "Sped up version, faster remix, increased tempo edit, fast edit, speed-up version, "
        "TikTok-style sped up audio."
    ),
    "slowed": (
        "Slowed version, slowed and reverb edit, slower remix, reduced tempo version, "
        "dreamy slow edit, relaxed slowed audio."
    ),
    "remix": (
        "Remix version, alternate mix, producer edit, dance remix, VIP mix, bootleg remix, "
        "reworked version of an original song."
    ),
    "cover": (
        "Cover song, performed by another artist, alternate vocal performance, "
        "reinterpretation of an existing song."
    ),
    "edm": (
        "Electronic dance music, EDM, electronic beats, dance drops, festival music, "
        "NCS style music, copyright-free electronic music, house, trap, future bass, "
        "dubstep, melodic electronic music."
    ),
    "phonk": (
        "Phonk music, drift phonk, aggressive bass, cowbell melody, dark trap-inspired music, "
        "LXNGVX style, Brazilian phonk, car drift music."
    ),
    "high_energy": (
        "High energy music, intense, fast, loud, exciting, energetic songs, hype music, "
        "powerful drops, strong beat, action music, gym energy, party energy."
    ),
    "low_energy": (
        "Low energy music, calm, soft, relaxed, slow, quiet songs, background listening, "
        "gentle mood, peaceful listening, not intense."
    ),
    "chill": (
        "Chill music, relaxed music, calm vibe, laid-back listening, soft mood, "
        "background music, relaxing electronic music, mellow songs."
    ),
    "study": (
        "Study music, focus music, concentration music, calm background music, "
        "low distraction listening, music for coding, reading, working, or homework."
    ),
    "workout": (
        "Workout music, gym music, intense training music, motivational high energy songs, "
        "running music, exercise playlist, hype songs for lifting, cardio, or sports."
    ),
    "party": (
        "Party music, upbeat fun music, danceable songs, energetic social music, "
        "club-like tracks, exciting music for a party playlist."
    ),
    "bass_boosted": (
        "Bass boosted music, heavy bass edit, strong low-end, boosted bass remix, "
        "loud bass-heavy version."
    ),
    "rap": (
        "Rap music, hip hop vocals, trap rap, rhythmic spoken vocals, bars, verses, "
        "rapper performance."
    ),
}
