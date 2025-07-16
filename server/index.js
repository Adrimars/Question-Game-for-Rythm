const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const players = [];      // {id, name, isAdmin, isSpectator, selection}
let currentLevel = 0;
let gameStarted = false;
let minPlayers = 8;
let autoStart = false;
let autoNext = false;
let questionTimer = null;

function getRandomOptionsForLevel(level) {
  const levelPath = path.join(__dirname, "levels", `level${level}.json`);
  if (!fs.existsSync(levelPath)) return null;
  const allPairs = JSON.parse(fs.readFileSync(levelPath, "utf-8"));
  return allPairs[Math.floor(Math.random() * allPairs.length)];
}

function startNextLevel() {
  clearTimeout(questionTimer);
  if (currentLevel >= 8) {
    io.emit("game_over");
    console.log("🛑 Oyun bitti.");
    return;
  }
  currentLevel++;
  const opts = getRandomOptionsForLevel(currentLevel);
  if (!opts) {
    console.error(`⚠️ level${currentLevel}.json yok.`);
    return;
  }
  players.forEach(p => (p.selection = null));
  io.emit("level_data", {
    level: currentLevel,
    optionA: opts.optionA,
    optionB: opts.optionB
  });
  console.log(`➡️ Level ${currentLevel}: ${opts.optionA} vs ${opts.optionB}`);

  // 30s timer to force next
  questionTimer = setTimeout(() => {
    io.emit("time_up");
    startNextLevel();
  }, 30 * 1000);
}

io.on("connection", socket => {
  console.log("🔌 Bağlandı:", socket.id);

  socket.onAny((event, ...args) => {
    console.log(`📥 onAny event: ${event}`, args);
  });

  socket.on("set_min_players", newMin => {
    const p = players.find(x => x.id === socket.id);
    if (!p?.isAdmin) return;
    minPlayers = Math.max(1, parseInt(newMin, 10) || 1);
    io.emit("min_players_update", minPlayers);
    console.log(`🔧 Min players updated → ${minPlayers}`);
  });

  socket.on("toggle_auto_start", flag => {
    const p = players.find(x => x.id === socket.id);
    if (!p?.isAdmin) return;
    autoStart = flag;
    io.emit("auto_start_update", autoStart);
    console.log(`🔄 Auto-start set → ${autoStart}`);
    if (
      autoStart &&
      !gameStarted &&
      players.filter(p => !p.isSpectator).length >= minPlayers
    ) {
      gameStarted = true;
      currentLevel = 0;
      console.log("🎬 Auto-start triggered.");
      startNextLevel();
    }
  });

  socket.on("toggle_auto_next", flag => {
    const p = players.find(x => x.id === socket.id);
    if (!p?.isAdmin) return;
    autoNext = flag;
    io.emit("auto_next_update", autoNext);
    console.log(`⏭️ Auto-next set → ${autoNext}`);
  });

  socket.on("send_name", name => {
    if (players.find(p => p.id === socket.id)) return;
    const isSpectator = gameStarted;
    const isAdmin = players.length === 0 && !isSpectator;
    players.push({
      id: socket.id,
      name,
      isAdmin,
      isSpectator,
      selection: null
    });

    io.emit("players_update", players.map(p => ({
      name: p.name,
      isAdmin: p.isAdmin,
      isSpectator: p.isSpectator
    })));
    socket.emit("you_are", { isAdmin, isSpectator });
    socket.emit("min_players_update", minPlayers);
    socket.emit("auto_start_update", autoStart);
    socket.emit("auto_next_update", autoNext);
    console.log(
      `👤 ${name} katıldı. ${
        isAdmin ? "[ADMIN]" : isSpectator ? "[SPECTATOR]" : ""
      }`
    );

    if (
      autoStart &&
      !gameStarted &&
      players.filter(p => !p.isSpectator).length >= minPlayers
    ) {
      gameStarted = true;
      currentLevel = 0;
      console.log("🎬 Auto-start (post-join) triggered.");
      startNextLevel();
    }
  });

  socket.on("start_game", () => {
    const p = players.find(x => x.id === socket.id);
    if (!p?.isAdmin) return;
    if (players.filter(p => !p.isSpectator).length < minPlayers) {
      socket.emit("not_enough_players", {
        current: players.filter(p => !p.isSpectator).length,
        required: minPlayers
      });
      return;
    }
    if (!gameStarted) {
      gameStarted = true;
      currentLevel = 0;
      console.log("🎬 Oyun başlatıldı.");
      startNextLevel();
    }
  });

  socket.on("submit_selection", choice => {
    const p = players.find(x => x.id === socket.id);
    if (!p || p.selection !== null || p.isSpectator) return;
    p.selection = choice;
    console.log(`✅ ${p.name} seçimi: ${choice}`);

    if (
      players
        .filter(p => !p.isSpectator)
        .every(x => x.selection !== null)
    ) {
      clearTimeout(questionTimer);
      const sels = players
        .filter(p => !p.isSpectator)
        .map(x => ({ name: x.name, choice: x.selection }));
      io.emit("all_selections", { selections: sels });
      if (autoNext) {
        questionTimer = setTimeout(startNextLevel, 10 * 1000);
      }
    }
  });

  socket.on("next_level", () => {
    const p = players.find(x => x.id === socket.id);
    if (p?.isAdmin && gameStarted) {
      console.log("🔜 Admin manuel geçiş talebi");
      startNextLevel();
    }
  });

  socket.on("disconnect", () => {
    const idx = players.findIndex(x => x.id === socket.id);
    if (idx !== -1) {
      const left = players.splice(idx, 1)[0];
      console.log(`❌ ${left.name} ayrıldı.`);
    }
    if (
      gameStarted &&
      players.filter(p => !p.isSpectator).length < minPlayers
    ) {
      clearTimeout(questionTimer);
      io.emit("game_cancelled", "Yeterli oyuncu kalmadı, oyun iptal edildi.");
      gameStarted = false;
      currentLevel = 0;
    }
    io.emit("players_update", players.map(p => ({
      name: p.name,
      isAdmin: p.isAdmin,
      isSpectator: p.isSpectator
    })));
  });
});

server.listen(3001, () => {
  console.log("✅ Socket.io sunucusu 3001 portunda çalışıyor.");
});
