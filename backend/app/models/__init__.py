"""Import every model so Base.metadata is fully populated for Alembic
autogenerate and for create_all() in tests — SQLAlchemy only registers a
mapped class once its module has been imported somewhere.
"""

from app.models.chat_message import ChatMessage
from app.models.exercise import Exercise
from app.models.macro_target import MacroTarget
from app.models.user import User
from app.models.weight_log import WeightLog
from app.models.workout import Workout
from app.models.workout_set import WorkoutSet

__all__ = [
    "ChatMessage",
    "Exercise",
    "MacroTarget",
    "User",
    "WeightLog",
    "Workout",
    "WorkoutSet",
]
