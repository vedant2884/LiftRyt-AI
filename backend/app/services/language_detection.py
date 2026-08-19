"""Cheap, deterministic language + script detection for the AI coach's
Hindi/Marathi handling, run *before* the LLM call rather than trusted to
the model's own judgment (which was observed misreading Roman-script
Marathi as Hindi — see agent.py's language policy).

Word-list heuristics, not a real classifier. Good enough for the actual
failure mode this exists to fix (short, single-clause fitness questions),
and cheap enough (a couple of set intersections) to run on every turn
without hurting the time-to-first-token goal that's the point of this
whole change — a real NLP model or an extra LLM call would cost far more
latency than the problem is worth.
"""

import re

DEVANAGARI_RE = re.compile(r"[ऀ-ॿ]")

# Pronouns/verb-forms/particles/interrogatives that differ between Hindi
# and Marathi when romanized — not fitness vocabulary, which tends to be
# shared English loanwords in both and so carries no signal either way.
# A handful of words (nahi, ho, ka, karu) legitimately show up in both
# lists; that's fine, they contribute equally to both counts and simply
# don't tip the balance, which is the correct behavior for genuinely
# ambiguous shared words.
ROMAN_MARATHI_MARKERS = {
    "mi", "mala", "majha", "majhi", "majhe", "maza", "tu", "tula", "tuza",
    "tuzi", "tuze", "tumhi", "apan", "aahe", "aahet", "ahe", "hota", "hoti",
    "hote", "aahat", "kaay", "kay", "kasa", "kashi", "kase", "kuthe",
    "kevha", "ka", "nahi", "ho", "aani", "karane", "karto", "karte",
    "karu", "kartoy", "kartey", "karaycha", "karaychi", "nako", "pahije",
    "shakto", "shakte", "changla", "changli", "khup", "bara", "chhan",
    "jevan", "vyayam", "sang", "zala", "zali", "peksha", "madat", "mhanje",
    "kiti", "apla",
}
ROMAN_HINDI_MARKERS = {
    "main", "mujhe", "mera", "meri", "mere", "tum", "tumhein", "tumhara",
    "tumhari", "aap", "aapka", "aapki", "aapko", "hai", "hain", "tha",
    "thi", "the", "hoon", "hun", "kya", "kaise", "kaisa", "kaisi", "kahan",
    "kab", "kyun", "kyu", "ka", "nahi", "ho", "aur", "karna", "karta",
    "karti", "karu", "chahiye", "sakta", "sakti", "accha", "acha", "bahut",
    "raha", "rahi", "batao", "samajh", "samjha", "kitna",
}

DEVANAGARI_MARATHI_MARKERS = {
    "मी", "मला", "माझा", "माझी", "माझे", "तू", "तुला", "तुझा", "तुझी",
    "तुझे", "तुम्ही", "आपण", "आहे", "आहेत", "आहात", "होता", "होती",
    "होते", "काय", "कसा", "कशी", "कसे", "कुठे", "केव्हा", "का", "नाही",
    "आणि", "करणे", "करतो", "करते", "करू", "पाहिजे", "शकतो", "शकते",
    "चांगला", "चांगली", "खूप", "म्हणजे", "किती",
}
DEVANAGARI_HINDI_MARKERS = {
    "मैं", "मुझे", "मेरा", "मेरी", "मेरे", "तुम", "तुम्हारा", "तुम्हारी",
    "आप", "आपका", "आपकी", "आपको", "है", "हैं", "था", "थी", "थे", "हूं",
    "क्या", "कैसे", "कैसा", "कैसी", "कहाँ", "कब", "क्यों", "नहीं", "और",
    "करना", "करता", "करती", "करूं", "चाहिए", "सकता", "सकती", "अच्छा",
    "अच्छी", "बहुत", "रहा", "रही", "बताओ", "कितना",
}


def detect_language(text: str, fallback_language: str = "hindi") -> tuple[str, str]:
    """Returns (language, script). language is one of "english", "hindi",
    "marathi"; script is "devanagari" or "roman" (script is irrelevant for
    english — always answered in plain English regardless).

    fallback_language is what to use when Devanagari text carries no
    matched marker word at all (rare) or the two languages tie — pass the
    conversation's most recent detected language so an ambiguous follow-up
    doesn't randomly flip languages; defaults to Hindi with no other signal.
    """
    has_devanagari = bool(DEVANAGARI_RE.search(text))
    script = "devanagari" if has_devanagari else "roman"

    if has_devanagari:
        tokens = set(re.findall(r"[ऀ-ॿ]+", text))
        marathi_hits = len(tokens & DEVANAGARI_MARATHI_MARKERS)
        hindi_hits = len(tokens & DEVANAGARI_HINDI_MARKERS)
    else:
        tokens = set(re.findall(r"[a-zA-Z]+", text.lower()))
        marathi_hits = len(tokens & ROMAN_MARATHI_MARKERS)
        hindi_hits = len(tokens & ROMAN_HINDI_MARKERS)

    if marathi_hits == 0 and hindi_hits == 0:
        if has_devanagari:
            language = fallback_language if fallback_language in ("hindi", "marathi") else "hindi"
        else:
            language = "english"
    elif marathi_hits > hindi_hits:
        language = "marathi"
    elif hindi_hits > marathi_hits:
        language = "hindi"
    else:
        language = fallback_language if fallback_language in ("hindi", "marathi") else "hindi"

    return language, script


def language_instruction(language: str, script: str) -> str:
    """The explicit per-turn instruction injected into the system prompt —
    a strong default, not an unconditional command, since an explicit
    in-message request ("reply in English") still needs to win."""
    if language == "english":
        return "\n\nDetected language: English. Respond in English."
    script_label = "Devanagari" if script == "devanagari" else "Roman/Latin"
    return (
        f"\n\nDetected language: {language.capitalize()}. Detected script: {script_label}.\n"
        f"Respond in {language.capitalize()}, written in {script_label} script, unless the user's "
        f"current message explicitly asks for a different language or script — an explicit request "
        f"always overrides this detected default. Do not switch to the other of Hindi/Marathi, and "
        f"do not silently translate the user's script."
    )
