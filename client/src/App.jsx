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

  // --- Initialize socket once ---
  useEffect(() => {
    const sock = io("http://localhost:3001", {
      transports: ["websocket", "polling"],
    });
    setSocket(sock);

    sock.on("you_are", ({ isAdmin, isSpectator }) => {
      setIsAdmin(isAdmin);
      setIsSpectator(isSpectator);
    });
    sock.on("players_update", list => setPlayers(list));
    sock.on("min_players_update", v => {
      setMinPlayers(v);
      setMinInput(String(v));
    });
    sock.on("auto_start_update", flag => setAutoStart(flag));
    sock.on("auto_next_update", flag => setAutoNext(flag));

    sock.on("level_data", data => {
      setGameStarted(true);
      setLevelData(data);
      setSelected(null);
      setAllSelections(null);
      setCountdown(30);         // 30s to answer
    });
    sock.on("all_selections", ({ selections }) => {
      setAllSelections(selections);
      if (autoNext) setCountdown(10);  // 10s discussion
      else setCountdown(0);            // freeze until admin
    });

    sock.on("time_up", () => {
      // answer time over → evaluation screen stays
    });
    sock.on("game_over", () => reset());
    sock.on("game_cancelled", () => reset());

    return () => sock.disconnect();
  }, []);  // <-- run only once

  // --- Countdown effect ---
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // --- Event Handlers ---
  const handleJoin     = () => { socket?.emit("send_name", name.trim()); setJoined(true); };
  const handleSetMin   = () => socket?.emit("set_min_players", minInput);
  const handleToggleAS = () => socket?.emit("toggle_auto_start", !autoStart);
  const handleToggleAN = () => socket?.emit("toggle_auto_next",  !autoNext);
  const handleStart    = () => socket?.emit("start_game");
  const handleNext     = () => socket?.emit("next_level");
  const handleSelect   = opt => {
    if (!socket || selected || isSpectator) return;
    setSelected(opt);
    socket.emit("submit_selection", opt);
  };
  const reset = () => {
    setGameStarted(false);
    setLevelData(null);
    setAllSelections(null);
    setSelected(null);
    setIsSpectator(false);
    setCountdown(0);
  };

  // --- Derived State ---
  const nonSpecCount    = players.filter(p => !p.isSpectator).length;
  const canStartManually = isAdmin && !gameStarted && nonSpecCount >= minPlayers;

  // --- Render ---
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
            disabled={!name.trim()}
            className="w-full bg-blue-600 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition"
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

        {/* --- Lobby --- */}
        {!gameStarted ? (
          <div className="bg-gray-800 p-4 rounded-lg shadow-md mb-6">
            <h3 className="text-xl mb-2">
              Lobby ({nonSpecCount}/{minPlayers})
              {isSpectator && " – Spectator"}
            </h3>
            <ul className="space-y-1 mb-4">
              {players.map((p,i) => (
                <li key={i} className="flex items-center">
                  <span className="flex-1">{p.name}</span>
                  {p.isAdmin     && <span className="text-yellow-400 ml-2">(Admin)</span>}
                  {p.isSpectator && <span className="text-gray-400 ml-2">👀</span>}
                </li>
              ))}
            </ul>
            {isAdmin && (
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={minInput}
                    onChange={e => setMinInput(e.target.value)}
                    className="text-gray-900 w-16 p-1 rounded"
                  />
                  <button
                    onClick={handleSetMin}
                    className="bg-yellow-500 px-3 py-1 rounded hover:bg-yellow-600 transition"
                  >
                    Set Min
                  </button>
                </div>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-1">
                    <input type="checkbox" checked={autoStart} onChange={handleToggleAS} className="h-4 w-4"/>
                    <span>Auto-start</span>
                  </label>
                  <label className="flex items-center space-x-1">
                    <input type="checkbox" checked={autoNext} onChange={handleToggleAN} className="h-4 w-4"/>
                    <span>Auto-next</span>
                  </label>
                </div>
                <button
                  onClick={handleStart}
                  disabled={!canStartManually}
                  className={`w-full py-2 rounded transition ${
                    canStartManually
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-gray-600 cursor-not-allowed"
                  }`}
                >
                  Start Game
                </button>
              </div>
            )}
          </div>
        ) : (
        /* --- Game Screen --- */
          <div className="bg-gray-800 p-4 rounded-lg shadow-md w-full">
            {levelData ? (
              <>
                <h2 className="text-2xl font-bold mb-2">Level {levelData.level}</h2>

                {/* Countdown Bar */}
                {countdown > 0 && (
                  <>
                    <div className="h-2 bg-gray-700 rounded overflow-hidden mb-2">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${(countdown / (allSelections ? 10 : 30)) * 100}%` }}
                      />
                    </div>
                    <p className="text-right text-sm mb-4">
                      {allSelections ? `Next in ${countdown}s` : `Time left: ${countdown}s`}
                    </p>
                  </>
                )}

                {/* Options */}
                {!selected && !isSpectator && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {[levelData.optionA, levelData.optionB].map((opt,i) => (
                      <button
                        key={i}
                        onClick={() => handleSelect(opt)}
                        className="w-full bg-purple-600 py-3 rounded hover:bg-purple-700 transition"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {selected && (
                  <p className="text-green-400 text-center mb-4">
                    You selected: {selected}
                  </p>
                )}

                {/* Evaluation */}
                {allSelections && (
                  <div className="bg-gray-700 p-3 rounded mb-4">
                    <h3 className="text-lg font-semibold mb-2">Everyone’s Choices:</h3>
                    <ul className="space-y-1">
                      {allSelections.map((s,i) => (
                        <li key={i} className="flex justify-between">
                          <span>{s.name}</span>
                          <span className="font-medium">{s.choice}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Admin Next */}
                {isAdmin && (
                  <button
                    onClick={handleNext}
                    className="w-full bg-yellow-500 py-2 rounded hover:bg-yellow-600 transition"
                  >
                    Next Question
                  </button>
                )}
              </>
            ) : (
              <p className="text-center">Waiting for level data…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
