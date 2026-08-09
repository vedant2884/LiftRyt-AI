"""Outbound email.

No SMTP/transactional-email provider is wired up (would need real
credentials from something like Resend or SES, the same way Groq/Firebase
needed keys). In dev, "sending" an email means printing the link to the
backend console and, since there's nowhere else for the user to find it,
also returning it in the API response, clearly marked as such. Swap
`_deliver` for a real provider call to go to production; every caller
already goes through this one function.
"""

from app.core.config import settings


def _deliver(to_email: str, subject: str, body: str) -> None:
    if settings.environment == "production":
        raise RuntimeError(
            "No email provider configured. Wire one up in app/services/email.py before "
            "deploying password reset to production."
        )
    print(f"[dev-email] To: {to_email}\nSubject: {subject}\n\n{body}\n")


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    _deliver(
        to_email,
        "Reset your LiftRyt AI password",
        f"Click the link below to reset your password. It expires in an hour.\n\n{reset_link}",
    )
