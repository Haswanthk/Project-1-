from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self.connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.connections.append(websocket)

    async def disconnect(self, websocket: WebSocket):
        if websocket in self.connections:
            self.connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in list(self.connections):
            await connection.send_text(message)

    async def close_all(self):
        for connection in list(self.connections):
            await connection.close()
        self.connections.clear()


ws_manager = WebSocketManager()

