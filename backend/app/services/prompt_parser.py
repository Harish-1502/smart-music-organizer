import re
from dataclasses import dataclass, field

DEFAULT_DURATION_MINUTES = 45
MIN_DURATION_MINUTES = 5
MAX_DURATION_MINUTES = 240

VALID_ENERGIES = {"low", "medium", "high"}

WORD_RULES = {
    # Mood / vibe words
    "chill": {
        "moods": {"chill", "calm"},
        "energy": "low",
    },
    "calm": {
        "moods": {"calm"},
        "energy": "low",
    },
    "relaxing": {
        "moods": {"relaxing", "calm"},
        "energy": "low",
    },
    "relax": {
        "moods": {"relaxing", "calm"},
        "energy": "low",
    },
    "sad": {
        "moods": {"sad"},
        "energy": "low",
    },
    "happy": {
        "moods": {"happy"},
        "energy": "medium",
    },
    "hype": {
        "moods": {"hype"},
        "energy": "high",
    },
    "energetic": {
        "moods": {"hype"},
        "energy": "high",
    },

    # Use cases
    "study": {
        "use_cases": {"study"},
        "moods": {"focus", "calm"},
        "energy": "low",
    },
    "focus": {
        "use_cases": {"focus"},
        "moods": {"focus", "calm"},
        "energy": "low",
    },
    "work": {
        "use_cases": {"work"},
        "moods": {"focus"},
        "energy": "medium",
    },
    "workout": {
        "use_cases": {"workout"},
        "moods": {"hype"},
        "energy": "high",
    },
    "gym": {
        "use_cases": {"gym"},
        "moods": {"hype"},
        "energy": "high",
    },
    "gaming": {
        "use_cases": {"gaming"},
        "moods": {"focus", "hype"},
        "energy": "high",
    },
    "driving": {
        "use_cases": {"driving"},
        "moods": {"chill"},
        "energy": "medium",
    },
    "night": {
        "moods": {"chill"},
        "energy": "low",
    },

    # Genres
    "rock": {
        "genres": {"rock"},
        "energy": "high",
    },
    "rap": {
        "genres": {"rap"},
        "energy": "high",
    },
    "pop": {
        "genres": {"pop"},
        "energy": "medium",
    },
    "electronic": {
        "genres": {"electronic"},
        "energy": "high",
    },
    "lofi": {
        "genres": {"lofi"},
        "moods": {"chill", "focus"},
        "energy": "low",
    },
    "jazz": {
        "genres": {"jazz"},
        "moods": {"calm"},
        "energy": "low",
    },
    "metal": {
        "genres": {"metal"},
        "moods": {"aggressive", "hype"},
        "energy": "high",
    },
    "rnb": {
        "genres": {"r&b"},
        "moods": {"chill"},
        "energy": "medium",
    },
}

PHRASE_RULES = {
    # Use-case phrases
    "night drive": {
        "use_cases": {"driving"},
        "moods": {"chill", "night"},
        "energy": "medium",
    },
    "night driving": {
        "use_cases": {"driving"},
        "moods": {"chill", "night"},
        "energy": "medium",
    },
    "road trip": {
        "use_cases": {"driving"},
        "moods": {"happy"},
        "energy": "medium",
    },
    "deep focus": {
        "use_cases": {"focus"},
        "moods": {"focus", "calm"},
        "energy": "low",
    },
    "background music": {
        "use_cases": {"background"},
        "moods": {"calm"},
        "energy": "low",
    },

    # Genre phrases
    "hip hop": {
        "genres": {"hip hop"},
        "energy": "high",
    },
    "r b": {
        "genres": {"r&b"},
        "moods": {"chill"},
        "energy": "medium",
    },
    "r and b": {
        "genres": {"r&b"},
        "moods": {"chill"},
        "energy": "medium",
    },

    # Common playlist phrases
    "pump up": {
        "moods": {"hype"},
        "energy": "high",
    },
    "feel good": {
        "moods": {"happy"},
        "energy": "medium",
    },
}

EXCLUSION_RULES = {
    "no sad": {
        "exclude_moods": {"sad"},
        "exclude_keywords": {"sad"},
    },
    "no sad songs": {
        "exclude_moods": {"sad"},
        "exclude_keywords": {"sad"},
    },
    "avoid sad": {
        "exclude_moods": {"sad"},
        "exclude_keywords": {"sad"},
    },
    "without sad": {
        "exclude_moods": {"sad"},
        "exclude_keywords": {"sad"},
    },

    "avoid slow": {
        "exclude_moods": {"slow"},
        "exclude_keywords": {"slow"},
    },
    "no slow songs": {
        "exclude_moods": {"slow"},
        "exclude_keywords": {"slow"},
    },
    "without slow": {
        "exclude_moods": {"slow"},
        "exclude_keywords": {"slow"},
    },

    "avoid aggressive": {
        "exclude_moods": {"aggressive"},
        "exclude_keywords": {"aggressive"},
    },
    "without aggressive": {
        "exclude_moods": {"aggressive"},
        "exclude_keywords": {"aggressive"},
    },
    "no aggressive songs": {
        "exclude_moods": {"aggressive"},
        "exclude_keywords": {"aggressive"},
    },

    "no long songs": {
        "exclude_keywords": {"long"},
    },
    "avoid long songs": {
        "exclude_keywords": {"long"},
    },
    "without long songs": {
        "exclude_keywords": {"long"},
    },
}

@dataclass
class PromptRuleAccumulator:
    use_cases: set[str] = field(default_factory=set)
    moods: set[str] = field(default_factory=set)
    genres: set[str] = field(default_factory=set)

    exclude_moods: set[str] = field(default_factory=set)
    exclude_keywords: set[str] = field(default_factory=set)

    energy_votes: dict[str, int] = field(
        default_factory=lambda: {
            "low": 0,
            "medium": 0,
            "high": 0,
        }
    )

    duration_max_minutes: int | None = None
    warnings: list[str] = field(default_factory=list)

    def apply_rule(self, rule: dict) -> None:
        self.use_cases.update(rule.get("use_cases", ()))
        self.moods.update(rule.get("moods", ()))
        self.genres.update(rule.get("genres", ()))

        energy = rule.get("energy")
        if energy in self.energy_votes:
            self.energy_votes[energy] += 1

    def apply_exclusion_rule(self, rule: dict) -> None:
        self.exclude_moods.update(rule.get("exclude_moods", ()))
        self.exclude_keywords.update(rule.get("exclude_keywords", ()))

    def choose_energy(self) -> str:
        highest_vote = max(self.energy_votes.values())

        if highest_vote == 0:
            return "medium"

        winners = [
            energy
            for energy, vote_count in self.energy_votes.items()
            if vote_count == highest_vote
        ]

        if len(winners) > 1:
            return "medium"

        return winners[0]
    
    def add_vague_prompt_warning_if_needed(self) -> None:
        if not self.use_cases and not self.moods and not self.genres:
            self.warnings.append(
                "Prompt was vague, so generation will use general metadata matching."
            )

    def to_dict(self) -> dict:
        return {
            "use_cases": sorted(self.use_cases),
            "moods": sorted(self.moods),
            "energy": self.choose_energy(),
            "duration_max_minutes": self.duration_max_minutes,
            "genres": sorted(self.genres),
            "exclude_moods": sorted(self.exclude_moods),
            "exclude_keywords": sorted(self.exclude_keywords),
            "warnings": self.warnings,
        }

def apply_word_rules(tokens: set[str], acc: PromptRuleAccumulator) -> None:
    for token in tokens:
        rule = WORD_RULES.get(token)

        if rule:
            acc.apply_rule(rule)


def apply_phrase_rules(normalized_prompt: str, acc: PromptRuleAccumulator) -> None:
    for phrase, rule in PHRASE_RULES.items():
        if phrase in normalized_prompt:
            acc.apply_rule(rule)


def apply_exclusion_rules(normalized_prompt: str, acc: PromptRuleAccumulator) -> None:
    for phrase, rule in EXCLUSION_RULES.items():
        if phrase in normalized_prompt:
            acc.apply_exclusion_rule(rule)

def normalize_prompt(prompt: str) -> tuple[str, set[str]]:
    """
    Normalize a user playlist prompt so the parser can detect words consistently.

    Example:
    "  Make me a Chill, Study playlist under 45 minutes!  "

    becomes:
    normalized_prompt = "make me a chill study playlist under 45 minutes"
    tokens = {"make", "me", "a", "chill", "study", "playlist", "under", "45", "minutes"}
    """

    if prompt is None:
        raise ValueError("Prompt cannot be empty.")

    # 1. Lowercase the prompt
    normalized = prompt.lower()

    # 2. Replace punctuation/symbols with spaces
    # Keeps letters, numbers, and whitespace.
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)

    # 3. Collapse multiple spaces/tabs/newlines into one space
    normalized = re.sub(r"\s+", " ", normalized)

    # 4. Remove spaces from the start and end
    normalized = normalized.strip()

    # 5. Reject empty prompt after cleaning
    if not normalized:
        raise ValueError("Prompt cannot be empty.")

    # 6. Split into unique words
    tokens = set(normalized.split())

    return normalized, tokens

def clamp_duration(minutes: int) -> int:
    return max(MIN_DURATION_MINUTES, min(minutes, MAX_DURATION_MINUTES))

def detect_duration(normalized_prompt: str) -> int:
    """
    Detect max playlist duration from a normalized prompt.

    Examples:
    - "under 30 minutes" -> 30
    - "less than 45 mins" -> 45
    - "below 1 hour" -> 60
    - "30 min playlist" -> 30
    - "1 hour playlist" -> 60
    - no duration -> DEFAULT_DURATION_MINUTES
    """

    minute_patterns = [
        r"(?:under|less than|below|within|max|maximum)\s+(\d+)\s*(?:minutes|minute|mins|min)",
        r"(\d+)\s*(?:minutes|minute|mins|min)",
    ]

    hour_patterns = [
        r"(?:under|less than|below|within|max|maximum)\s+(\d+)\s*(?:hours|hour|hrs|hr)",
        r"(\d+)\s*(?:hours|hour|hrs|hr)",
    ]

    for pattern in minute_patterns:
        match = re.search(pattern, normalized_prompt)
        if match:
            return clamp_duration(int(match.group(1)))

    for pattern in hour_patterns:
        match = re.search(pattern, normalized_prompt)
        if match:
            return clamp_duration(int(match.group(1)) * 60)

    return DEFAULT_DURATION_MINUTES

def parse_prompt(prompt: str):
    normalized_prompt, tokens = normalize_prompt(prompt)

    criteria_acc = PromptRuleAccumulator()

    apply_word_rules(tokens, criteria_acc)

    apply_phrase_rules(normalized_prompt, criteria_acc)

    apply_exclusion_rules(normalized_prompt, criteria_acc)

    criteria_acc.duration_max_minutes = detect_duration(normalized_prompt)

    criteria_acc.add_vague_prompt_warning_if_needed()

    return criteria_acc.to_dict()