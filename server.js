// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");
const cors = require("cors");

const app = express();
app.use(cors()); // pozwala na połączenia z dowolnej domeny (np. GitHub Pages)

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // tutaj możesz zamiast "*" wpisać domenę frontendu np. "https://twojlogin.github.io"
});

let games = {}; 
// struktura: { gameId: { location, players: {socketId: {name, role}} } }

// endpoint do tworzenia nowej gry
app.get("/create", (req, res) => {
  const gameId = nanoid(6);
  games[gameId] = { location: null, players: {} };
  res.json({ gameId });
});

// obsługa socket.io
io.on("connection", (socket) => {
  console.log("Nowy gracz:", socket.id);

  // dołączenie do gry
  socket.on("joinGame", ({ gameId, name }) => {
    if (!games[gameId]) {
      socket.emit("errorMsg", "Gra nie istnieje.");
      return;
    }
    games[gameId].players[socket.id] = { name, role: null };
    socket.join(gameId);
    io.to(gameId).emit("playersUpdate", games[gameId].players);
  });

  // rozpoczęcie gry przez mistrza
  socket.on("startGame", ({ gameId, location }) => {
    if (!games[gameId]) return;

    games[gameId].location = location;
    let playerIds = Object.keys(games[gameId].players);

    // losowanie jednego szpiega
    const spyIndex = Math.floor(Math.random() * playerIds.length);
    playerIds.forEach((id, index) => {
      if (index === spyIndex) {
        games[gameId].players[id].role = "spy";
        io.to(id).emit("role", { role: "spy" });
      } else {
        games[gameId].players[id].role = "player";
        io.to(id).emit("role", { role: "player", location });
      }
    });
  });

  // rozłączenie gracza
  socket.on("disconnect", () => {
    for (let gameId in games) {
      if (games[gameId].players[socket.id]) {
        delete games[gameId].players[socket.id];
        io.to(gameId).emit("playersUpdate", games[gameId].players);
      }
    }
  });
});

// Render wymaga nasłuchiwania na PORT z env
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log("Serwer działa na porcie " + PORT);
});
