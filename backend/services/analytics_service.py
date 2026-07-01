from database import get_db

async def get_dashboard_analytics(user_id: str | None = None):
    db = get_db()
    match_filter = {"user_id": user_id} if user_id else {}
    pipeline = [{"$match": match_filter}, {"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    
    cursor = db.applications.aggregate(pipeline)
    results = await cursor.to_list(length=10)
    
    metrics = {
        "saved": 0,
        "applied": 0,
        "interview": 0,
        "offer": 0,
        "rejected": 0
    }
    
    for r in results:
        status = r["_id"].lower()
        if status in metrics:
            metrics[status] = r["count"]
            
    total_applications = sum(metrics.values())
    offer_rate = (metrics["offer"] / total_applications * 100) if total_applications > 0 else 0
    interview_rate = ((metrics["interview"] + metrics["offer"] + metrics["rejected"]) / total_applications * 100) if total_applications > 0 else 0 # Simplified
    
    return {
        "metrics": metrics,
        "total_applications": total_applications,
        "offer_rate": round(offer_rate, 2),
        "interview_rate": round(interview_rate, 2),
        "high_priority_actions": metrics["interview"] + metrics["saved"] # Example
    }
