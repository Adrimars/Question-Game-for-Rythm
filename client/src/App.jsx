import { useEffect, useState } from "react";
import { io } from "socket.io-client";

function App() {
  const [socket, setSocket] = useState(null);
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [players, setPlayers] = useState([]);
  const [minPlayers, setMinPlayers] = useState(8);
  const [minInput, setMinInput] = useState("8");
  const [autoStart, setAutoStart] = useState(false);
  const [autoNext, setAutoNext] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [levelData, setLevelData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [allSelections, setAllSelections] = useState(null);
  const [countdown, setCountdown] = useState(0);

  // Setup socket.io
  useEffect(() => {
    const sock = io("http://localhost:3001", {
      transports: ["websocket", "polling"]
    });
    setSocket(sock);

    sock.on("you_are", ({ isAdmin, isSpectator }) => {
      setIsAdmin(isAdmin);
      setIsSpectator(isSpectator);
    });
    sock.on("players_update", list => setPlayers(list));
    sock.on("min_players_update", v => { setMinPlayers(v); setMinInput(String(v)); });
    sock.on("auto_start_update", flag => setAutoStart(flag));
    sock.on("auto_next_update", flag => setAutoNext(flag));
    sock.on("level_data", data => {
      setGameStarted(true);
      setLevelData(data);
      setSelected(null);
      setAllSelections(null);
      setCountdown(30);
    });
    sock.on("all_selections", ({ selections }) => {
      setAllSelections(selections);
      if (autoNext) setCountdown(10);
    });
    sock.on("time_up", () => alert("⏱️ Süre doldu, diğer soruya geçiliyor."));
    sock.on("game_over", () => { alert("🎉 Oyun bitti!"); reset(); });
    sock.on("game_cancelled", msg => { alert(msg); reset(); });

    return () => sock.disconnect();
  }, [autoNext]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // Handlers
  const handleJoin         = () => { if (socket && name.trim()) { socket.emit("send_name", name.trim()); setJoined(true); } };
  const handleSetMin       = () => socket?.emit("set_min_players", minInput);
  const handleToggleAS     = () => socket?.emit("toggle_auto_start",  !autoStart);
  const handleToggleAN     = () => socket?.emit("toggle_auto_next",   !autoNext);
  const handleStart        = () => socket?.emit("start_game");
  const handleNext         = () => socket?.emit("next_level");
  const handleSelect       = opt => { if (socket && !selected && !isSpectator) { setSelected(opt); socket.emit("submit_selection", opt); } };
  const reset              = () => { setGameStarted(false); setLevelData(null); setAllSelections(null); setSelected(null); setIsSpectator(false); setCountdown(0); };

  // Derived
  const realPlayersCount = players.filter(p => !p.isSpectator).length;
  const canStartManually = isAdmin && !gameStarted && realPlayersCount >= minPlayers;

  if (!joined) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-xs space-y-4">
          <h1 className="text-2xl font-bold text-center">Enter Your Name</h1>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full text-gray-900 p-2 rounded"
            placeholder="Your name"
          />
          <button
            onClick={handleJoin}
            className="w-full bg-blue-600 py-2 rounded hover:bg-blue-700 transition"
          >
            Join Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      <div className="w-full max-w-md sm:max-w-lg lg:max-w-xl">
        {!gameStarted ? (
          <div className="mb-6 bg-gray-800 p-4 rounded-lg shadow-md">
            <h3 className="text-lg sm:text-xl mb-2">
              Lobby ({realPlayersCount}/{minPlayers})
              {isSpectator && " – Spectator"}
            </h3>
            <ul className="space-y-1 mb-4 text-sm sm:text-base">
              {players.map((p, i) => (
                <li key={i} className="flex items-center">
                  <span className="flex-1">{p.name}</span>
                  {p.isAdmin && <span className="text-yellow-400 ml-2">(Admin)</span>}
                  {p.isSpectator && <span className="text-gray-400 ml-2">👀</span>}
                </li>
              ))}
            </ul>

            {isAdmin && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                  <label className="sm:mr-2">Min Players:</label>
                  <input
                    type="number"
                    value={minInput}
                    onChange={e => setMinInput(e.target.value)}
                    className="text-gray-900 w-20 p-1 rounded"
                  />
                  <button
                    onClick={handleSetMin}
                    className="mt-2 sm:mt-0 bg-yellow-500 px-3 py-1 rounded hover:bg-yellow-600 transition"
                  >
                    Set
                  </button>
                </div>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-1">
                    <input type="checkbox" checked={autoStart} onChange={handleToggleAS} className="h-4 w-4" />
                    <span>Auto-start</span>
                  </label>
                  <label className="flex items-center space-x-1">
                    <input type="checkbox" checked={autoNext} onChange={handleToggleAN} className="h-4 w-4" />
                    <span>Auto-next (10s)</span>
                  </label>
                </div>
                <button
                  onClick={handleStart}
                  disabled={!canStartManually}
                  className={`w-full py-2 rounded transition ${canStartManually ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 cursor-not-allowed"}`}
                >
                  Start Game
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 p-4 rounded-lg shadow-md w-full">
            {isSpectator && (
              <p className="text-yellow-300 text-sm mb-2 text-center">
                You’re spectating this game.
              </p>
            )}
            {levelData ? (
              <>
                <div className="mb-2">
                  <h2 className="text-xl sm:text-2xl font-bold">Level {levelData.level}</h2>
                  <div className="h-2 bg-gray-700 rounded overflow-hidden mt-2">
                    <div
                      className={`h-full bg-blue-500 transition-all`}
                      style={{ width: `${(countdown / (allSelections ? 10 : 30)) * 100}%` }}
                    />
                  </div>
                  <p className="text-right text-sm mt-1">
                    {allSelections
                      ? `Next in ${countdown}s`
                      : `Time left: ${countdown}s`}
                  </p>
                </div>

                {!selected && !isSpectator && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[levelData.optionA, levelData.optionB].map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelect(opt)}
                        className="w-full bg-purple-600 py-3 rounded hover:bg-purple-700 transition text-sm sm:text-base"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {selected && (
                  <p className="text-green-400 text-center">You selected: {selected}</p>
                )}

                {allSelections && (
                  <div className="mt-4 bg-gray-700 p-3 rounded">
                    <h3 className="text-lg font-semibold mb-2">Everyone’s Choices:</h3>
                    <ul className="space-y-1 text-sm sm:text-base">
                      {allSelections.map((s, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{s.name}</span>
                          <span className="font-medium">{s.choice}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isAdmin && (
                  <button
                    onClick={handleNext}
                    className="mt-4 w-full bg-yellow-500 py-2 rounded hover:bg-yellow-600 transition"
                  >
                    Next Question
                  </button>
                )}
              </>
            ) : (
              <p className="text-center">Waiting for next level…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
