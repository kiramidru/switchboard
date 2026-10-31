"""Validate quotations and explicit dates; this is not a semantic fact checker."""

import re
from datetime import date, datetime, timezone
from uuid import uuid4

from .models import Action, Analysis, Evidence, Extraction, RequiredDocument

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
MONTH_PATTERN = (
    r"(?:January|February|March|April|May|June|July|August|September|October|November|"
    r"December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?"
)


def find_evidence(source: str, quote: str | None) -> Evidence | None:
    if not quote or not quote.strip() or len(quote) > 3000:
        return None
    quote = quote.strip()
    start = source.find(quote)
    if start >= 0:
        return Evidence(quote=quote, start=start, end=start + len(quote))
    # Permit line-wrap differences, not changed words or punctuation.
    pattern = r"\s+".join(re.escape(part) for part in quote.split())
    match = re.search(pattern, source)
    if match:
        return Evidence(quote=match.group(), start=match.start(), end=match.end())
    return None


def explicit_dates(text: str) -> set[date]:
    dates = set()
    for value in re.findall(r"\b\d{4}-\d{2}-\d{2}\b", text):
        try:
            dates.add(date.fromisoformat(value))
        except ValueError:
            pass
    patterns = [
        rf"\b(?P<month>{MONTH_PATTERN})\s+(?P<day>\d{{1,2}})(?:st|nd|rd|th)?[,]?\s+(?P<year>\d{{4}})\b",
        rf"\b(?P<day>\d{{1,2}})(?:st|nd|rd|th)?\s+(?P<month>{MONTH_PATTERN})[,]?\s+(?P<year>\d{{4}})\b",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            try:
                dates.add(date(int(match["year"]), MONTHS[match["month"][:3].lower()],
                               int(match["day"])))
            except ValueError:
                pass
    return dates


def ground_extraction(
    extraction: Extraction,
    *,
    source: str,
    mode: str,
    mode_reason: str,
    source_type: str,
) -> Analysis:
    warnings = [warning[:800] for warning in extraction.uncertainties[:12] if warning.strip()]
    actions = []
    for index, item in enumerate(extraction.actions[:30]):
        evidence = find_evidence(source, item.quote)
        if not evidence or not item.title.strip():
            warnings.append("An action was omitted because its supporting text could not be found in the notice.")
            continue
        due_date = None
        deadline_evidence = find_evidence(source, item.deadline_quote)
        if item.due_date:
            try:
                proposed = date.fromisoformat(item.due_date)
            except ValueError:
                proposed = None
            if proposed and deadline_evidence and proposed in explicit_dates(deadline_evidence.quote):
                due_date = proposed
            else:
                deadline_evidence = None
                warnings.append(f'A date for “{item.title[:120]}” could not be verified. Check the original notice.')
        else:
            deadline_evidence = None
        actions.append(Action(
            id=f"action-{index + 1}", title=item.title.strip()[:200], detail=item.detail[:1000],
            evidence=evidence, due_date=due_date, deadline_evidence=deadline_evidence,
        ))
    documents = []
    for item in extraction.documents[:20]:
        evidence = find_evidence(source, item.quote)
        if evidence and item.name.strip():
            documents.append(RequiredDocument(name=item.name[:200], evidence=evidence))
        else:
            warnings.append("A document requirement was omitted because its supporting text could not be found.")
    if len(extraction.actions) > 30 or len(extraction.documents) > 20:
        warnings.append("This notice has many requirements. Only the first 30 actions and 20 documents are shown.")
    if source_type == "image":
        warnings.insert(0, "This text was transcribed from your photo by AI. Compare it with the original image; "
                        "matched quotes do not verify transcription accuracy.")
    if not actions:
        warnings.append("No source-backed actions were found. Review the notice yourself before deciding nothing is required.")
    return Analysis(
        id=str(uuid4()), title=extraction.title[:200] or "Your notice",
        summary=extraction.summary[:1500], source_text=source, actions=actions,
        documents=documents, warnings=list(dict.fromkeys(warnings)), mode=mode,
        mode_reason=mode_reason, source_type=source_type, created_at=datetime.now(timezone.utc),
    )
