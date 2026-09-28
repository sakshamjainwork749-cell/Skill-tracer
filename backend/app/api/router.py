from fastapi import APIRouter

from app.api.routes import analytics, auth, employers, followups, messaging, notifications, trainees, webhooks

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(trainees.router)
api_router.include_router(employers.router)
api_router.include_router(analytics.router)
api_router.include_router(followups.router)
api_router.include_router(notifications.router)
api_router.include_router(webhooks.router)
api_router.include_router(messaging.router)
