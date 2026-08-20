"""Team 4: Real-time Notifications & WebSocket API endpoints."""

import json
from datetime import datetime
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from backend.api.dependencies import get_current_user, get_db, AuthenticatedUser
from backend.models.product import Product, ReviewItem, Notification
from backend.schemas.product import NotificationRead, NotificationCreate

router = APIRouter()

# WebSocket connection manager
class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id] = [
                ws for ws in self.active_connections[user_id] if ws != websocket
            ]
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    async def broadcast(self, message: dict):
        for user_id, connections in self.active_connections.items():
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass


manager = ConnectionManager()


# ─── WebSocket Endpoint ──────────────────────────────────────────────────

@router.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    """WebSocket endpoint for real-time notifications."""
    user_id = websocket.query_params.get("user_id", "anonymous")

    await manager.connect(websocket, user_id)
    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "data": {"user_id": user_id, "message": "Connected to notification stream"},
        })

        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong", "data": {}})
            elif message.get("type") == "mark_read":
                # Handle read acknowledgment
                await websocket.send_json({
                    "type": "ack",
                    "data": {"notification_id": message.get("notification_id")},
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception:
        manager.disconnect(websocket, user_id)


# ─── Notification CRUD ───────────────────────────────────────────────────

@router.get("/notifications")
def list_notifications(
    user_id: str | None = None,
    type_filter: str | None = None,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """List user notifications with optional filters."""
    uid = user_id or current_user.uid
    query = db.query(Notification).filter(Notification.user_id == uid)

    if type_filter:
        query = query.filter(Notification.type == type_filter)
    if unread_only:
        query = query.filter(Notification.is_read == False)

    notifications = query.order_by(Notification.created_at.desc()).limit(50).all()

    return [
        {
            "id": n.id,
            "user_id": n.user_id,
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "product_id": n.product_id,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifications
    ]


@router.get("/notifications/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, int]:
    """Get the count of unread notifications."""
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.uid, Notification.is_read == False)
        .count()
    )
    return {"unread_count": count}


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Mark a notification as read."""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.user_id != current_user.uid:
        raise HTTPException(status_code=403, detail="Not authorized")

    notification.is_read = True
    db.commit()

    return {"message": "Notification marked as read", "id": notification_id}


@router.post("/notifications/mark-all-read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Mark all notifications as read for the current user."""
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.uid, Notification.is_read == False)
        .update({"is_read": True})
    )
    db.commit()

    return {"message": f"Marked {count} notifications as read"}


@router.post("/notifications")
def create_notification(
    notification_data: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Create a new notification."""
    notification = Notification(
        user_id=notification_data.user_id,
        type=notification_data.type,
        title=notification_data.title,
        message=notification_data.message,
        product_id=notification_data.product_id,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    return {
        "id": notification.id,
        "message": "Notification created",
    }


# ─── Activity Feed ───────────────────────────────────────────────────────

@router.get("/activity-feed")
def get_activity_feed(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Get recent activity feed showing team actions."""
    activities = []

    # Recent notifications
    recent_notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.uid)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )

    for n in recent_notifications:
        activities.append({
            "type": "notification",
            "subtype": n.type,
            "title": n.title,
            "message": n.message,
            "product_id": n.product_id,
            "timestamp": n.created_at.isoformat() if n.created_at else None,
        })

    # Recent review actions
    recent_reviews = (
        db.query(ReviewItem)
        .filter(ReviewItem.status != "PENDING", ReviewItem.status != "pending")
        .order_by(ReviewItem.reviewed_at.desc())
        .limit(10)
        .all()
    )

    for r in recent_reviews:
        activities.append({
            "type": "review",
            "subtype": r.status.lower() if r.status else "updated",
            "title": r.title,
            "message": f"Review item {r.status.lower() if r.status else 'updated'} by {r.reviewer or 'system'}",
            "product_id": r.product_id,
            "timestamp": r.reviewed_at.isoformat() if r.reviewed_at else None,
        })

    # Sort by timestamp
    activities.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    return activities[:limit]


# ─── Event Triggers ──────────────────────────────────────────────────────

async def trigger_notification(
    user_id: str,
    notif_type: str,
    title: str,
    message: str,
    product_id: int | None = None,
    db: Session = None,
):
    """Create a notification and push it via WebSocket.

    This function is called from other endpoints when events occur.
    """
    if db:
        notification = Notification(
            user_id=user_id,
            type=notif_type,
            title=title,
            message=message,
            product_id=product_id,
        )
        db.add(notification)
        db.commit()

    # Push via WebSocket
    await manager.send_to_user(user_id, {
        "type": "notification",
        "data": {
            "type": notif_type,
            "title": title,
            "message": message,
            "product_id": product_id,
            "timestamp": datetime.utcnow().isoformat(),
        },
    })
