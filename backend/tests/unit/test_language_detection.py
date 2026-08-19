from app.services.language_detection import detect_language

CASES = [
    ("How was my workout today?", "english", "roman"),
    ("What is my current weight?", "english", "roman"),
    ("मेरा आज का workout कैसा था?", "hindi", "devanagari"),
    ("mera aaj ka workout kaisa tha?", "hindi", "roman"),
    ("mera weight kitna hai?", "hindi", "roman"),
    ("माझा आजचा workout कसा होता?", "marathi", "devanagari"),
    ("माझं वजन किती आहे?", "marathi", "devanagari"),
    ("majha aajcha workout kasa hota?", "marathi", "roman"),
    ("majha weight kiti aahe?", "marathi", "roman"),
    # The exact bug report from production.
    ("mala sang tuza naav", "marathi", "roman"),
    ("majha bench press kasa improve karu?", "marathi", "roman"),
    ("mera bench press kaise improve karu?", "hindi", "roman"),
    ("माझा bench press कसा improve करू?", "marathi", "devanagari"),
    ("मेरा bench press कैसे improve करूं?", "hindi", "devanagari"),
]


def test_detect_language_matrix():
    failures = []
    for text, expected_language, expected_script in CASES:
        language, script = detect_language(text)
        if (language, script) != (expected_language, expected_script):
            failures.append(f"{text!r}: got ({language}, {script}), expected ({expected_language}, {expected_script})")
    assert not failures, "\n".join(failures)


def test_ambiguous_devanagari_falls_back_to_conversation_language():
    # No matched marker words at all (contrived) — falls back rather than
    # guessing, and previous-language wins over the hard default.
    language, _ = detect_language("अ", fallback_language="marathi")
    assert language == "marathi"
    language, _ = detect_language("अ", fallback_language="hindi")
    assert language == "hindi"
    language, _ = detect_language("अ")  # no fallback given
    assert language == "hindi"


def test_english_has_no_roman_markers_by_default():
    language, script = detect_language("Can you check my last 3 workouts?")
    assert (language, script) == ("english", "roman")
