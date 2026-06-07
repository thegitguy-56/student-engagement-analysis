from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import io

from app.database.connection import get_db
from app.models.user import User
from app.models.session import Session
from app.models.engagement import EngagementRecord
from app.services.auth_dependency import get_current_user
from app.services.report_service import generate_pdf_report

router = APIRouter()

@router.get("/{session_id}/pdf")
async def download_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session_result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    records_result = await db.execute(
        select(EngagementRecord)
        .where(EngagementRecord.session_id == session_id)
        .order_by(EngagementRecord.timestamp)
    )
    records = records_result.scalars().all()

    pdf_bytes = generate_pdf_report(session, records, current_user)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=session-{session_id[:8]}-report.pdf"}
    )