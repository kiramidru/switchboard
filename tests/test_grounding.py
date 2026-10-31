from datetime import date

import pytest

from backend.examples import get_demo
from backend.grounding import explicit_dates, find_evidence, ground_extraction
from backend.models import Extraction, ExtractionAction


def test_quote_matching_allows_only_whitespace_changes():
    source = "📬 Return the signed\n form by June 10, 2027."
    evidence = find_evidence(source, "signed form")
    assert evidence is not None
    assert source[evidence.start:evidence.end] == "signed\n form"
    assert find_evidence(source, "unsigned form") is None
    assert find_evidence(source, "") is None


@pytest.mark.parametrize("text,expected", [
    ("June 10, 2027", {date(2027, 6, 10)}),
    ("10 June 2027", {date(2027, 6, 10)}),
    ("Jun. 10th, 2027", {date(2027, 6, 10)}),
    ("2027-06-10", {date(2027, 6, 10)}),
    ("June 10", set()),
    ("06/10/2027", set()),
    ("tomorrow", set()),
    ("February 31, 2027", set()),
    ("2027-99-99", set()),
])
def test_explicit_dates(text, expected):
    assert explicit_dates(text) == expected


@pytest.mark.parametrize("due,quote", [
    ("2027-06-11", "June 10, 2027"),
    ("2027-06-10", "June 10"),
    ("not-a-date", "June 10, 2027"),
    ("2027-06-10", None),
])
def test_ungrounded_dates_cannot_be_exported(due, quote):
    source = "Return the form by June 10, 2027."
    extraction = Extraction(
        title="Notice", summary="Return the form", source_text=source,
        actions=[ExtractionAction(title="Return form", detail="Return it", quote=source,
                                  due_date=due, deadline_quote=quote)],
        documents=[], uncertainties=[],
    )
    result = ground_extraction(extraction, source=source, mode="live", mode_reason="AI", source_type="text")
    assert result.actions[0].due_date is None
    assert result.actions[0].deadline_evidence is None
    assert result.warnings


def test_missing_evidence_omits_action_and_document():
    result = ground_extraction(get_demo("school-trip"), source="Unrelated notice.",
                               mode="live", mode_reason="AI", source_type="text")
    assert result.actions == []
    assert result.documents == []
    assert any("omitted" in warning for warning in result.warnings)
