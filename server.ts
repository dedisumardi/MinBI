import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const PORT = 3000;

  // Game state storage (in-memory for this demo, could use sqlite)
  const rooms = new Map();

  // WebSocket Server
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
    
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection established');
    let currentRoomId: string | null = null;
    let playerSymbol: 'X' | 'O' | null = null;

    ws.on('message', (message: string) => {
      const data = JSON.parse(message.toString());
      console.log('Received message:', data.type, data.roomId || '');

      switch (data.type) {
        case 'JOIN_ROOM': {
          const { roomId } = data;
          let room = rooms.get(roomId);

          if (!room) {
            console.log('Creating new room:', roomId);
            room = {
              id: roomId,
              players: [],
              board: Array(9).fill(null),
              xIsNext: true,
            };
            rooms.set(roomId, room);
          }

          if (room.players.length < 2) {
            playerSymbol = room.players.length === 0 ? 'X' : 'O';
            room.players.push({ ws, symbol: playerSymbol });
            currentRoomId = roomId;

            ws.send(JSON.stringify({
              type: 'ROOM_JOINED',
              symbol: playerSymbol,
              board: room.board,
              xIsNext: room.xIsNext,
              playerCount: room.players.length
            }));

            // Notify other player
            room.players.forEach((p: any) => {
              if (p.ws !== ws) {
                p.ws.send(JSON.stringify({
                  type: 'PLAYER_JOINED',
                  playerCount: room.players.length
                }));
              }
            });
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Room is full' }));
          }
          break;
        }

        case 'MOVE': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const { index } = data;
          if (room.board[index] === null && 
              ((room.xIsNext && playerSymbol === 'X') || (!room.xIsNext && playerSymbol === 'O'))) {
            
            room.board[index] = playerSymbol;
            room.xIsNext = !room.xIsNext;

            const update = {
              type: 'GAME_UPDATE',
              board: room.board,
              xIsNext: room.xIsNext
            };

            room.players.forEach((p: any) => p.ws.send(JSON.stringify(update)));
          }
          break;
        }

        case 'RESET': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          room.board = Array(9).fill(null);
          room.xIsNext = true;

          const update = {
            type: 'GAME_UPDATE',
            board: room.board,
            xIsNext: room.xIsNext
          };

          room.players.forEach((p: any) => p.ws.send(JSON.stringify(update)));
          break;
        }
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          room.players = room.players.filter((p: any) => p.ws !== ws);
          if (room.players.length === 0) {
            rooms.delete(currentRoomId);
          } else {
            room.players.forEach((p: any) => {
              p.ws.send(JSON.stringify({
                type: 'PLAYER_LEFT',
                playerCount: room.players.length
              }));
            });
          }
        }
      }
    });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
