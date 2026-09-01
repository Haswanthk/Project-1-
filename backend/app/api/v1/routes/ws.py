from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.realtime.ws_manager import ws_manager

router = APIRouter()


@router.websocket("/notifications")
async def notifications_socket(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            payload = await websocket.receive_text()
            await ws_manager.broadcast(payload)
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)

