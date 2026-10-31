"""Fictional, deterministic samples. Never used as fallback for custom notices."""

from .models import Example, Extraction

EXAMPLES = [
    Example(
        id="school-trip",
        label="The school trip letter",
        category="School",
        description="A permission form, a payment, and a few details to check.",
        text=(
            "Maplewood Community School\n"
            "Year 8 · Science museum visit\n\n"
            "Dear parents and carers,\n\n"
            "Our Year 8 science museum visit will take place on June 18, 2027. "
            "Students will travel together by coach.\n\n"
            "Please return the signed consent form and completed emergency contact sheet "
            "to the school office by June 10, 2027.\n\n"
            "The transport contribution is $12 per student. Please pay through the "
            "school portal by June 10, 2027. Contact the office if you need help with the cost.\n\n"
            "On June 18, 2027, students must bring a packed lunch and a refillable water bottle. "
            "School uniform is required.\n\n"
            "Departure and return times will be confirmed in a separate message. "
            "Please do not make collection arrangements until those times are confirmed.\n\n"
            "Questions? Contact the school office.\n\n"
            "Ms. Rivera\nYear 8 coordinator\n\n"
            "Fictional notice for demonstration only."
        ),
    ),
    Example(
        id="housing-visit",
        label="The maintenance notice",
        category="Housing",
        description="An access window and an alternative-arrangement deadline.",
        text=(
            "Northside Housing Cooperative\nRoutine water-meter inspection\n\n"
            "A contractor will inspect the water meter in your home on May 20, 2027, "
            "between 9:00 a.m. and 1:00 p.m. The inspection should take about 20 minutes.\n\n"
            "Please make sure an adult can provide access on May 20, 2027. "
            "If this window does not work for you, contact the housing office "
            "by May 17, 2027 to arrange an alternative.\n\n"
            "Before the visit on May 20, 2027, clear the area around the water meter "
            "and keep pets in another room.\n\n"
            "The contractor will carry photo identification. Do not make any payment "
            "to the contractor; this routine inspection is included in your housing services.\n\n"
            "The notice does not specify whether water service will be interrupted. "
            "Ask the housing office if you need to plan around an interruption.\n\n"
            "Fictional notice for demonstration only."
        ),
    ),
    Example(
        id="library-appointment",
        label="The appointment confirmation",
        category="Appointment",
        description="What to bring, when to arrive, and what “recent” means.",
        text=(
            "Riverside Library\nMembership appointment confirmation\n\n"
            "Your membership appointment is on June 4, 2027 at 10:30 a.m. "
            "Please attend the welcome desk at the Riverside branch.\n\n"
            "Bring photo identification and recent proof of address to your appointment "
            "on June 4, 2027. A utility bill or bank statement is accepted as proof of address.\n\n"
            "If you cannot attend, please contact the library by June 2, 2027 "
            "to reschedule.\n\n"
            "This notice does not define how recent your proof of address must be. "
            "Contact the library before your visit if you are unsure whether your document qualifies.\n\n"
            "No payment is required at this appointment.\n\n"
            "Fictional notice for demonstration only."
        ),
    ),
]


def _action(title, detail, quote, due_date=None, deadline_quote=None):
    return dict(title=title, detail=detail, quote=quote, due_date=due_date,
                deadline_quote=deadline_quote)


def _document(name, quote):
    return dict(name=name, quote=quote)


SAMPLE_DATA = {
    "school-trip": dict(
        title="Get ready for the museum visit",
        summary="Return two forms, pay the transport contribution, and pack for June 18. "
        "The school will confirm travel times separately.",
        actions=[
            _action(
                "Return the two completed forms",
                "Sign the consent form and complete the emergency contact sheet. "
                "Return both to the school office.",
                "Please return the signed consent form and completed emergency contact sheet "
                "to the school office by June 10, 2027.",
                "2027-06-10",
                "by June 10, 2027",
            ),
            _action(
                "Pay the $12 transport contribution",
                "Pay through the school portal. If the cost is a concern, contact the office.",
                "The transport contribution is $12 per student. Please pay through the "
                "school portal by June 10, 2027.",
                "2027-06-10",
                "by June 10, 2027",
            ),
            _action(
                "Pack lunch and a water bottle",
                "Bring both on the day of the visit and wear school uniform.",
                "On June 18, 2027, students must bring a packed lunch and a refillable water bottle. "
                "School uniform is required.",
                "2027-06-18",
                "On June 18, 2027",
            ),
        ],
        documents=[
            _document("Signed consent form", "signed consent form"),
            _document("Completed emergency contact sheet", "completed emergency contact sheet"),
        ],
        uncertainties=["Departure and return times are not confirmed. Wait for the school's "
                       "separate message before making collection arrangements."],
    ),
    "housing-visit": dict(
        title="Prepare for the water-meter inspection",
        summary="Arrange access for May 20, or contact the office by May 17 if you need a different window.",
        actions=[
            _action(
                "Arrange adult access for the inspection",
                "An adult needs to provide access between 9 a.m. and 1 p.m.; the visit takes about 20 minutes.",
                "Please make sure an adult can provide access on May 20, 2027.",
                "2027-05-20", "on May 20, 2027",
            ),
            _action(
                "If needed, request a different window",
                "Only if the proposed window does not work: contact the housing office.",
                "If this window does not work for you, contact the housing office "
                "by May 17, 2027 to arrange an alternative.",
                "2027-05-17", "by May 17, 2027",
            ),
            _action(
                "Clear the meter area and secure pets",
                "Keep pets in another room before the contractor arrives.",
                "Before the visit on May 20, 2027, clear the area around the water meter "
                "and keep pets in another room.",
                "2027-05-20", "on May 20, 2027",
            ),
        ],
        documents=[],
        uncertainties=["The notice does not say whether water service will be interrupted. "
                       "Ask the housing office if this affects your plans."],
    ),
    "library-appointment": dict(
        title="Prepare for your library appointment",
        summary="Visit the Riverside welcome desk on June 4 at 10:30 a.m. "
        "Bring ID and proof of address.",
        actions=[
            _action(
                "Attend your membership appointment",
                "Go to the Riverside branch welcome desk at 10:30 a.m. "
                "Calendar exports are all-day events, so check this time separately.",
                "Your membership appointment is on June 4, 2027 at 10:30 a.m. "
                "Please attend the welcome desk at the Riverside branch.",
                "2027-06-04", "on June 4, 2027",
            ),
            _action(
                "Bring ID and proof of address",
                "A utility bill or bank statement is accepted as proof of address.",
                "Bring photo identification and recent proof of address to your appointment "
                "on June 4, 2027. A utility bill or bank statement is accepted as proof of address.",
                "2027-06-04", "on June 4, 2027",
            ),
            _action(
                "If needed, reschedule before the deadline",
                "Only if you cannot attend: contact the library to reschedule.",
                "If you cannot attend, please contact the library by June 2, 2027 "
                "to reschedule.",
                "2027-06-02", "by June 2, 2027",
            ),
        ],
        documents=[
            _document("Photo identification", "photo identification"),
            _document("Recent proof of address", "recent proof of address"),
        ],
        uncertainties=["The notice does not define how recent proof of address must be. "
                       "Check with the library if you are unsure.",
                       "The appointment is at 10:30 a.m. Calendar downloads use all-day events, "
                       "not time-specific reminders."],
    ),
}


def get_example(example_id: str) -> Example | None:
    return next((example for example in EXAMPLES if example.id == example_id), None)


def get_demo(example_id: str) -> Extraction:
    example = get_example(example_id)
    if example is None:
        raise KeyError(example_id)
    return Extraction(source_text=example.text, **SAMPLE_DATA[example_id])
