// server/index.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app    = express();
app.use(cors());
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: "*" } });

let players      = []; // { id, name, avatar, isAdmin, isSpectator, selection }
let currentLevel = 0;
let gameStarted  = false;
let minPlayers   = 8;
let autoStart    = false;
let autoNext     = false;
let timerHandle  = null;

function getRandomOptionsForLevel(lvl) {
  const file = path.join(__dirname, "levels", `level${lvl}.json`);
  if (!fs.existsSync(file)) return null;
  const arr = JSON.parse(fs.readFileSync(file, "utf-8"));
  return arr[Math.floor(Math.random() * arr.length)];
}

function startNextLevel() {
  clearTimeout(timerHandle);
  if (currentLevel >= 8) {
    io.emit("game_over");
    gameStarted = false;
    return;
  }
  currentLevel++;
  const opts = getRandomOptionsForLevel(currentLevel);
  if (!opts) return;

  players.forEach(p => {
    p.selection   = null;
    p.isSpectator = false;
  });

  io.emit("level_data", {
    level:   currentLevel,
    optionA: opts.optionA,
    optionB: opts.optionB
  });

  // 30s answer window
  timerHandle = setTimeout(() => io.emit("time_up"), 30 * 1000);
}

io.on("connection", socket => {
  console.log("🔌 Connected:", socket.id);
  socket.onAny((e, args) => console.log(e, args));

  socket.on("send_name", ({ name, avatar }) => {
    if (players.find(p => p.id === socket.id)) return;
    const isSpectator = gameStarted;
    const isAdmin     = !gameStarted && players.length === 0;
    players.push({ id: socket.id, name, avatar, isAdmin, isSpectator, selection: null });

    io.emit("players_update", players.map(p => ({
      name:       p.name,
      avatar:     p.avatar,
      isAdmin:    p.isAdmin,
      isSpectator:p.isSpectator
    })));
    socket.emit("you_are", { isAdmin, isSpectator });
    socket.emit("min_players_update", minPlayers);
    socket.emit("auto_start_update", autoStart);
    socket.emit("auto_next_update", autoNext);

    if (!gameStarted &&
        autoStart &&
        players.filter(p => !p.isSpectator).length >= minPlayers) {
      gameStarted  = true;
      currentLevel = 0;
      startNextLevel();
    }
  });

  socket.on("set_min_players", v => {
    const p = players.find(x => x.id === socket.id);
    if (!p?.isAdmin) return;
    minPlayers = Math.max(1, parseInt(v,10) || 1);
    io.emit("min_players_update", minPlayers);
    if (!gameStarted &&
        autoStart &&
        players.filter(p => !p.isSpectator).length >= minPlayers) {
      gameStarted  = true;
      currentLevel = 0;
      startNextLevel();
    }
  });

  socket.on("toggle_auto_start", flag => {
    const p = players.find(x => x.id === socket.id);
    if (!p?.isAdmin) return;
    autoStart = flag;
    io.emit("auto_start_update", autoStart);
    if (!gameStarted &&
        autoStart &&
        players.filter(p => !p.isSpectator).length >= minPlayers) {
      gameStarted  = true;
      currentLevel = 0;
      startNextLevel();
    }
  });

  socket.on("toggle_auto_next", flag => {
    const p = players.find(x => x.id === socket.id);
    if (!p?.isAdmin) return;
    autoNext = flag;
    io.emit("auto_next_update", autoNext);
  });

  socket.on("start_game", () => {
    const p = players.find(x => x.id === socket.id);
    if (!p?.isAdmin || gameStarted) return;
    if (players.filter(p => !p.isSpectator).length < minPlayers) {
      socket.emit("not_enough_players", {
        current:  players.filter(p => !p.isSpectator).length,
        required: minPlayers
      });
      return;
    }
    gameStarted  = true;
    currentLevel = 0;
    startNextLevel();
  });

  socket.on("submit_selection", choice => {
    const p = players.find(x => x.id === socket.id);
    if (!p || p.selection != null || p.isSpectator) return;
    p.selection = choice;

    if (players.filter(p => !p.isSpectator).every(x => x.selection != null)) {
      clearTimeout(timerHandle);
      io.emit("all_selections", {
        selections: players
          .filter(p => !p.isSpectator)
          .map(x => ({ name: x.name, choice: x.selection }))
      });
      if (autoNext) {
        timerHandle = setTimeout(() => startNextLevel(), 10 * 1000);
      }
    }
  });

  socket.on("next_level", () => {
    const p = players.find(x => x.id === socket.id);
    if (!p?.isAdmin || !gameStarted) return;
    startNextLevel();
  });

  socket.on("disconnect", () => {
    players = players.filter(p => p.id !== socket.id);
    io.emit("players_update", players.map(p => ({
      name:       p.name,
      avatar:     p.avatar,
      isAdmin:    p.isAdmin,
      isSpectator:p.isSpectator
    })));
    if (gameStarted &&
        players.filter(p => !p.isSpectator).length < minPlayers) {
      clearTimeout(timerHandle);
      io.emit("game_cancelled", "Not enough players, game cancelled.");
      gameStarted  = false;
      currentLevel = 0;
    }
  });
});

server.listen(3001, () => console.log("✅ Socket.io server running on port 3001"));
