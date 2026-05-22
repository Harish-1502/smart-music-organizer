import re


CONTROL_CHARACTER_PATTERN = re.compile(r"[\x00-\x1f\x7f]")


def strip_string(value):
    if isinstance(value, str):
        return value.strip()
    return value


def reject_control_characters(value):
    if isinstance(value, str) and CONTROL_CHARACTER_PATTERN.search(value):
        raise ValueError("Control characters are not allowed")
    return value
