"""Import every model so Base.metadata is fully populated for Alembic
autogenerate and for create_all() in tests — SQLAlchemy only registers a
mapped class once its module has been imported somewhere.
"""

from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.chat_summary import ChatSummary
from app.models.custom_exercise import CustomExercise
from app.models.exercise import Exercise
from app.models.exercise_progression import ExerciseProgression
from app.models.favorite_exercise import FavoriteExercise
from app.models.generated_split import GeneratedSplit
from app.models.macro_target import MacroTarget
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.split_day_completion import SplitDayCompletion
from app.models.user import User
from app.models.weight_log import WeightLog
from app.models.workout import Workout
from app.models.workout_set import WorkoutSet

__all__ = [
    "ChatMessage",
    "ChatSession",
    "ChatSummary",
    "CustomExercise",
    "Exercise",
    "ExerciseProgression",
    "FavoriteExercise",
    "GeneratedSplit",
    "MacroTarget",
    "PasswordResetToken",
    "RefreshToken",
    "SplitDayCompletion",
    "User",
    "WeightLog",
    "Workout",
    "WorkoutSet",
]
