from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from collections import Counter
import io

def generate_pdf_report(session, records, user):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    # Title
    story.append(Paragraph(f"Engagement Report: {session.title}", styles["Title"]))
    story.append(Spacer(1, 0.5*cm))

    # Student info
    story.append(Paragraph(f"Student: {user.full_name}", styles["Normal"]))
    story.append(Paragraph(f"Email: {user.email}", styles["Normal"]))
    story.append(Paragraph(f"Session started: {session.started_at.strftime('%Y-%m-%d %H:%M')}", styles["Normal"]))
    story.append(Spacer(1, 0.5*cm))

    # Summary stats
    avg_score = round(sum(r.engagement_score for r in records) / len(records), 1) if records else 0
    emotions = Counter(r.emotion for r in records)
    top_emotion = emotions.most_common(1)[0][0] if emotions else "N/A"
    yawns = sum(1 for r in records if r.yawning)
    hand_raises = sum(1 for r in records if r.hand_raised)

    summary_data = [
        ["Metric", "Value"],
        ["Total frames analyzed", str(len(records))],
        ["Average engagement score", f"{avg_score}/100"],
        ["Most frequent emotion", top_emotion.capitalize()],
        ["Yawn detections", str(yawns)],
        ["Hand raises", str(hand_raises)],
        ["Duration (sec)", str(session.duration_seconds)],
    ]
    table = Table(summary_data, colWidths=[8*cm, 8*cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#3B82F6")),
        ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
        ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#F1F5F9")]),
        ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ("PADDING", (0,0), (-1,-1), 8),
    ]))
    story.append(table)
    story.append(Spacer(1, 1*cm))

    # Emotion breakdown
    story.append(Paragraph("Emotion distribution", styles["Heading2"]))
    for emotion, count in emotions.most_common():
        pct = round(count / len(records) * 100, 1)
        story.append(Paragraph(f"  {emotion.capitalize()}: {pct}%", styles["Normal"]))

    doc.build(story)
    return buffer.getvalue()