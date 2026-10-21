"""Training-only augmentation: Romanized-Hindi spelling variants as the Hinglish ASR writes them.

Romanized Hindi has no standard spelling and the recogniser spells freely ("thoda" -> "toda",
"shuru" -> "shuroo", "awaaz" -> "aavaaz", "dheemi" -> "dhimi"), while the seed templates use one
spelling per word. Adding a respelled copy of training rows teaches the intent model that these are
the same words. Labels are unchanged (spelling never changes meaning). Only the train split is
augmented; validation and test sets stay as written.
"""
from __future__ import annotations

import random
import re

_ROMAN_HINDI = {"hinglish", "romanized_hindi"}
_WORD = re.compile(r"[a-z]{3,}")
# (pattern, replacement) pairs observed in Hinglish ASR output; one is applied per chosen word.
_RESPELL = [
    (r"th", "t"), (r"dh", "d"), (r"kh", "k"), (r"gh", "g"),   # dropped aspiration
    (r"w", "v"), (r"v", "w"),                                  # w/v
    (r"aa", "a"), (r"ee", "i"), (r"oo", "u"),                  # shortened vowels
    (r"(?<![aeiou])a(?![aeiou])", "aa"), (r"(?<![aeiou])u(?![aeiou])", "oo"),  # lengthened lone vowels
    (r"(?<![aeiou])i(?![aeiou])", "ee"),
]


def _respell(word: str, rng: random.Random) -> str:
    options = [(p, r) for p, r in _RESPELL if re.search(p, word)]
    if not options:
        return word
    p, r = rng.choice(options)
    hits = list(re.finditer(p, word))
    m = rng.choice(hits)
    return word[:m.start()] + r + word[m.end():]


def asr_spelling_variants(rows: list[dict], seed: int = 29, row_p: float = 0.5, word_p: float = 0.3) -> list[dict]:
    """`rows` plus, for about `row_p` of the Romanized-Hindi rows, one respelled copy."""
    rng = random.Random(seed)
    out = list(rows)
    for r in rows:
        if r.get("language_pattern") not in _ROMAN_HINDI or rng.random() >= row_p:
            continue
        text = _WORD.sub(lambda m: _respell(m.group(), rng) if rng.random() < word_p else m.group(), r["text"])
        if text != r["text"]:
            out.append(dict(r, id=f"{r['id']}:asr", text=text, provenance="asr_spelling_augmentation"))
    return out
