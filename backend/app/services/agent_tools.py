"""Tool definitions and dispatch for the AI coach's agent loop.

Each tool wraps an existing, already-tested service — split_generator
(step 8) and macro_target_service (step 7) — so the LLM never invents a
split or estimates macro numbers itself; it only decides *when* to call
these and narrates the result. This is what makes the coach's answers
grounded in real logged data instead of hallucinated.
"""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ExperienceLevel, MacroGoal, TrainingGoal
from app.models.user import User
from app.services import macro_target_service, split_service

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "generate_workout_split",
            "description": (
                "Generate a structured, rule-based workout split (which days train "
                "which muscle groups, with specific exercises, sets, and reps) pulled "
                "from the real exercise database. Use this whenever the user asks for "
                "a training split, program, or routine. Never invent one freehand."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "days_per_week": {"type": "integer", "minimum": 1, "maximum": 6},
                    "experience_level": {
                        "type": "string",
                        "enum": ["beginner", "intermediate", "advanced"],
                    },
                    "goal": {
                        "type": "string",
                        "enum": ["strength", "hypertrophy", "general_fitness"],
                    },
                },
                "required": ["days_per_week", "experience_level", "goal"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_macros",
            "description": (
                "Calculate the user's BMR, TDEE, and a calorie/macro target for a "
                "given goal, using Mifflin-St Jeor and their most recently logged "
                "weight. Saves the result as their new active target. Use this "
                "whenever the user asks about calories, macros, cutting, or bulking. "
                "Never estimate these numbers yourself."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "goal": {"type": "string", "enum": ["cut", "maintain", "bulk"]},
                },
                "required": ["goal"],
            },
        },
    },
]


async def execute_tool(
    db: AsyncSession, user: User, tool_name: str, arguments: dict[str, Any]
) -> dict[str, Any]:
    if tool_name == "generate_workout_split":
        return await _generate_workout_split(db, user, arguments)
    if tool_name == "calculate_macros":
        return await _calculate_macros(db, user, arguments)
    return {"error": f"Unknown tool: {tool_name}"}


async def _generate_workout_split(db: AsyncSession, user: User, arguments: dict[str, Any]) -> dict[str, Any]:
    # Goes through split_service (not split_generator directly) so a split
    # the coach generates becomes the user's active split too, exactly like
    # generating one from the Splits page — "the active split" means the
    # same thing regardless of which path created it, which is what the
    # streak/adherence tracking and the Splits page's completion checkboxes
    # depend on.
    split = await split_service.generate_and_save_split(
        db,
        user,
        days_per_week=arguments["days_per_week"],
        experience_level=ExperienceLevel(arguments["experience_level"]),
        goal=TrainingGoal(arguments["goal"]),
    )
    return split.plan


async def _calculate_macros(db: AsyncSession, user: User, arguments: dict[str, Any]) -> dict[str, Any]:
    goal = MacroGoal(arguments["goal"])
    try:
        target = await macro_target_service.calculate_and_save_target(db, user, goal)
    except macro_target_service.NoWeightOnFileError:
        return {"error": "No weight on file. Ask the user to log their current weight first."}

    return {
        "bmr": float(target.bmr),
        "tdee": float(target.tdee),
        "target_calories": float(target.target_calories),
        "target_protein_g": float(target.target_protein_g),
        "target_carbs_g": float(target.target_carbs_g),
        "target_fat_g": float(target.target_fat_g),
    }
