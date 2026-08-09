from pydantic import BaseModel


class WeeklyAdherenceOut(BaseModel):
    completed: int
    planned: int


class StreaksOut(BaseModel):
    logging_streak_days: int
    # None when the user has never generated a split — there's nothing to
    # be adherent (or not) to yet.
    weekly_adherence: WeeklyAdherenceOut | None
