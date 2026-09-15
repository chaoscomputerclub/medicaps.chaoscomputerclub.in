"""
Chaos Computer Club — Campus Pass & QR Validation Pydantic Schemas
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CampusPassResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pass_code: str
    contest_id: str
    seat_number: str
    qr_data: str
    check_in_status: str
    issued_at: datetime
