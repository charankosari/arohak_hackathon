"""Small, explicit language normalization; never rewrites unknown policy terms."""
import re


def normalize(text: str) -> str:
    text = text.strip().lower()
    substitutions = {
        r'\b(?:tommorow|tomorow|tommorrow)\b': 'tomorrow',
        r'\b(?:checkin|check in)\b': 'check-in',
        r'\b(?:checkout|check out)\b': 'check-out',
        r'\bwi fi\b': 'wifi',
        r'\b(?:plz|pls)\b': 'please',
        r'\b(?:costing|pricing)\b': 'price',
    }
    for pattern, replacement in substitutions.items():
        text = re.sub(pattern, replacement, text)
    return text
