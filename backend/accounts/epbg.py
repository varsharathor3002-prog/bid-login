"""EPBG (%) is a number, or "NA" when the bid has no EPBG (Not Applicable)."""

NOT_APPLICABLE = "NA"
_NA_SPELLINGS = {"na", "n/a", "n.a", "n.a.", "not applicable"}


def normalize_epbg(value, current="0"):
    """Clean an EPBG value from a form.

    "NA"/"N/A"/"Not Applicable" (any case) -> "NA", blank -> "0", a number
    -> that number as text ("5", "2.5"). Anything else keeps ``current``,
    the same way the old float parsing ignored junk input.
    """
    if value is None:
        return current
    text = str(value).strip().rstrip("%").strip()
    if text.lower() in _NA_SPELLINGS:
        return NOT_APPLICABLE
    if not text:
        return "0"
    try:
        number = float(text)
    except ValueError:
        return current
    return f"{number:g}"
