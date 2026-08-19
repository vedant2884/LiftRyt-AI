from pydantic import BaseModel


class NotificationOut(BaseModel):
    type: str
    message: str
