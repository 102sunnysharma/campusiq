"""
NLP Service — Phase 5 (Section 11)

Runs a lightweight, local NLP pipeline on submitted feedback:
  1. Sentiment Analysis     — TextBlob polarity → positive / neutral / negative
  2. Keyword Extraction     — TextBlob noun phrases (top 10)
  3. Topic Modeling         — keyword-to-topic rule mapping
  4. Severity Detection     — combined polarity + domain-specific signal words
  5. Language Detection     — langdetect (EN/HI heuristic fallback)

All libraries are free and open-source (TextBlob, NLTK, langdetect).
No paid external APIs are ever called (Section 11.2).

Failure handling (Section 11.4):
  - If ANY step raises an exception, the feedback row stays saved with
    status="analysis_failed" and feedback_analysis.analysis_status="FAILED".
  - The student's original submission is NEVER rolled back.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Model metadata ───────────────────────────────────────────────────────────
MODEL_NAME = "textblob-nltk-local"
MODEL_VERSION = "1.0.0"

# ─── Topic keywords map ───────────────────────────────────────────────────────
# Maps detected noun-phrase keywords to high-level topic labels.
TOPIC_KEYWORD_MAP = {
    "academics":    ["exam", "assignment", "syllabus", "lecture", "grade", "marks",
                     "professor", "teacher", "class", "course", "study", "curriculum",
                     "result", "semester", "attendance"],
    "hostel":       ["hostel", "room", "bathroom", "toilet", "warden", "dormitory",
                     "bed", "mess", "night", "curfew", "roommate"],
    "transport":    ["bus", "route", "driver", "transport", "vehicle", "schedule",
                     "pickup", "drop", "stop", "commute", "timing"],
    "food":         ["food", "canteen", "cafeteria", "meal", "lunch", "dinner",
                     "breakfast", "menu", "quality", "taste", "hygiene", "kitchen"],
    "facilities":   ["lab", "library", "internet", "wifi", "computer", "equipment",
                     "facility", "building", "classroom", "projector", "ac", "water",
                     "electricity", "sports"],
    "staff":        ["staff", "faculty", "admin", "office", "principal", "dean",
                     "registrar", "clerk", "behavior", "response", "rude", "helpful"],
    "fees":         ["fee", "fees", "payment", "scholarship", "challan", "fine",
                     "charges", "refund", "billing"],
    "events":       ["event", "fest", "cultural", "sports", "competition", "club",
                     "activity", "workshop", "seminar", "placement"],
}

# Words that escalate severity regardless of overall sentiment score
HIGH_SEVERITY_SIGNALS = {
    "harassment", "ragging", "violence", "abuse", "threat", "assault",
    "discrimination", "unsafe", "dangerous", "emergency", "urgent",
    "broken", "no water", "no electricity", "fire", "accident", "fraud",
    "cheating", "corruption", "bribe",
}

MEDIUM_SEVERITY_SIGNALS = {
    "poor", "terrible", "pathetic", "worst", "horrible", "unacceptable",
    "disgusting", "filthy", "dirty", "broken", "damaged", "failed",
    "ignored", "rude", "arrogant", "unfair", "biased",
}


def _detect_language(text: str) -> str:
    """Detect language — returns ISO 639-1 code ('en', 'hi', etc.).
    Falls back to 'en' on any failure."""
    try:
        from langdetect import detect
        return detect(text)
    except Exception:
        # Simple Devanagari heuristic as fallback
        devanagari_chars = sum(1 for c in text if "\u0900" <= c <= "\u097F")
        return "hi" if devanagari_chars / max(len(text), 1) > 0.15 else "en"


def _get_sentiment(text: str):
    """Return (label, score) using TextBlob polarity.
    score is scaled to 0–100 and represents confidence magnitude."""
    try:
        from textblob import TextBlob
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity  # -1.0 to 1.0

        # Map polarity to label
        if polarity >= 0.1:
            label = "positive"
        elif polarity <= -0.1:
            label = "negative"
        else:
            label = "neutral"

        # Score: distance from threshold (0–100), higher = more confident
        score = round(min(abs(polarity) * 100, 100.0), 2)
        return label, score
    except Exception as exc:
        raise RuntimeError(f"Sentiment analysis failed: {exc}") from exc


def _extract_keywords(text: str) -> list:
    """Extract up to 10 meaningful noun phrases using TextBlob."""
    try:
        from textblob import TextBlob
        blob = TextBlob(text.lower())
        phrases = list(blob.noun_phrases)
        # Deduplicate while preserving order
        seen = set()
        unique = []
        for p in phrases:
            p_clean = p.strip()
            if p_clean and p_clean not in seen and len(p_clean) > 1:
                seen.add(p_clean)
                unique.append(p_clean)
        return unique[:10]
    except Exception as exc:
        raise RuntimeError(f"Keyword extraction failed: {exc}") from exc


def _detect_topics(keywords: list, text: str) -> list:
    """Map keywords and raw text to topic labels from TOPIC_KEYWORD_MAP."""
    text_lower = text.lower()
    detected = set()
    combined = " ".join(keywords) + " " + text_lower

    for topic, signals in TOPIC_KEYWORD_MAP.items():
        if any(sig in combined for sig in signals):
            detected.add(topic)

    return sorted(detected) if detected else ["general"]


def _detect_severity(sentiment_label: str, sentiment_score: float, text: str) -> str:
    """
    Determine severity based on sentiment + domain-specific signal words.
    Returns: critical / high / medium / low
    """
    text_lower = text.lower()

    # Check for critical signals first
    if any(sig in text_lower for sig in HIGH_SEVERITY_SIGNALS):
        return "critical"

    if sentiment_label == "negative":
        if sentiment_score >= 70:
            # Very strong negative — check for medium signals
            if any(sig in text_lower for sig in MEDIUM_SEVERITY_SIGNALS):
                return "high"
            return "high"
        elif sentiment_score >= 40:
            return "medium"
        else:
            return "low"

    if sentiment_label == "neutral":
        return "low"

    # Positive
    return "low"


def _predict_category(topics: list) -> Optional[str]:
    """Simple topic → category prediction (display label)."""
    mapping = {
        "academics":  "Academic Issues",
        "hostel":     "Hostel & Accommodation",
        "transport":  "Transport Services",
        "food":       "Canteen & Food Services",
        "facilities": "Campus Facilities",
        "staff":      "Staff Conduct",
        "fees":       "Fees & Finance",
        "events":     "Events & Activities",
        "general":    "General Feedback",
    }
    if topics:
        return mapping.get(topics[0], "General Feedback")
    return "General Feedback"


def run_nlp_analysis(text: str) -> dict:
    """
    Execute the full NLP pipeline on the given feedback text.
    Returns a dict with all analysis fields.
    Raises RuntimeError on any failure (caller handles the FAILED path).
    """
    language = _detect_language(text)
    sentiment_label, sentiment_score = _get_sentiment(text)
    keywords = _extract_keywords(text)
    topics = _detect_topics(keywords, text)
    severity = _detect_severity(sentiment_label, sentiment_score, text)
    category_prediction = _predict_category(topics)

    return {
        "sentiment":           sentiment_label,
        "sentiment_score":     sentiment_score,
        "category_prediction": category_prediction,
        "severity":            severity,
        "confidence_score":    sentiment_score,  # reuse polarity magnitude
        "language":            language,
        "keywords":            keywords,
        "topics":              topics,
        "model_name":          MODEL_NAME,
        "model_version":       MODEL_VERSION,
        "analysis_status":     "COMPLETED",
        "error_message":       None,
        "processed_at":        datetime.now(timezone.utc),
    }


# ─── Background Task Entry Point ─────────────────────────────────────────────

def analyze_feedback_background(feedback_id: str, text: str, db_url: str):
    """
    Top-level function invoked by FastAPI BackgroundTasks.
    Opens its own DB session (background tasks run after response is sent,
    so we cannot reuse the request-scoped session).

    On any failure:
      - Sets feedback_analysis.analysis_status = FAILED
      - Sets feedback.status = "analysis_failed"
      - Logs the error
      - Does NOT raise (failure must be silent to the student — Section 11.4)
    """
    # Import here to avoid circular imports at module level
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.models import Feedback, FeedbackAnalysis

    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # Ensure NLTK corpora are available (download if missing)
        _ensure_nltk_data()

        result = run_nlp_analysis(text)

        # Persist the completed analysis
        analysis = db.query(FeedbackAnalysis).filter(
            FeedbackAnalysis.feedback_id == uuid.UUID(feedback_id)
        ).first()

        if analysis:
            for field, value in result.items():
                setattr(analysis, field, value)
        else:
            # Shouldn't happen, but handle gracefully
            analysis = FeedbackAnalysis(
                id=uuid.uuid4(),
                feedback_id=uuid.UUID(feedback_id),
                **result,
            )
            db.add(analysis)

        # Update parent feedback status
        feedback = db.query(Feedback).filter(
            Feedback.id == uuid.UUID(feedback_id)
        ).first()
        if feedback:
            feedback.status = "analyzed"

        db.commit()
        logger.info(f"NLP analysis COMPLETED for feedback {feedback_id} — "
                    f"sentiment={result['sentiment']}, severity={result['severity']}")

    except Exception as exc:
        db.rollback()
        logger.error(f"NLP analysis FAILED for feedback {feedback_id}: {exc}", exc_info=True)

        # Mark as failed — Section 11.4
        try:
            analysis = db.query(FeedbackAnalysis).filter(
                FeedbackAnalysis.feedback_id == uuid.UUID(feedback_id)
            ).first()
            if analysis:
                analysis.analysis_status = "FAILED"
                analysis.error_message = str(exc)
                analysis.processed_at = datetime.now(timezone.utc)

            feedback = db.query(Feedback).filter(
                Feedback.id == uuid.UUID(feedback_id)
            ).first()
            if feedback:
                feedback.status = "analysis_failed"

            db.commit()
        except Exception as inner_exc:
            logger.error(f"Failed to write failure state for feedback {feedback_id}: {inner_exc}")
            db.rollback()
    finally:
        db.close()


def _ensure_nltk_data():
    """Download required NLTK corpora if not already present."""
    import nltk
    packages = [
        ("tokenizers/punkt",       "punkt"),
        ("tokenizers/punkt_tab",   "punkt_tab"),
        ("corpora/stopwords",      "stopwords"),
        ("taggers/averaged_perceptron_tagger", "averaged_perceptron_tagger"),
        ("taggers/averaged_perceptron_tagger_eng", "averaged_perceptron_tagger_eng"),
    ]
    for path, pkg in packages:
        try:
            nltk.data.find(path)
        except LookupError:
            nltk.download(pkg, quiet=True)
