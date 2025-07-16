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

  useEffect(() => {
    const sock = io("http://localhost:3001", {
      transports: ["websocket", "polling"]
    });
    setSocket(sock);

    sock.on("connect", () =>
      console.log("🔗 Connected, socket.id =", sock.id)
    );
    sock.onAny((event, ...args) =>
      console.log(`📥 client onAny: ${event}`, args)
    );

    sock.on("you_are", ({ isAdmin, isSpectator }) => {
      setIsAdmin(isAdmin);
      setIsSpectator(isSpectator);
    });
    sock.on("players_update", list => setPlayers(list));
    sock.on("min_players_update", newMin => {
      setMinPlayers(newMin);
      setMinInput(String(newMin));
    });
    sock.on("auto_start_update", flag => setAutoStart(flag));
    sock.on("auto_next_update", flag => setAutoNext(flag));
    sock.on("not_enough_players", ({ current, required }) =>
      alert(`Min ${required} oyuncu gerek. Şu: ${current}`)
    );
    sock.on("level_data", data => {
      setGameStarted(true);
      setLevelData(data);
      setSelected(null);
      setAllSelections(null);
    });
    sock.on("all_selections", ({ selections }) =>
      setAllSelections(selections)
    );
    sock.on("time_up", () => {
      alert("⏱️ Süre doldu, diğer soruya geçiliyor.");
    });
    sock.on("game_over", () => {
      alert("🎉 Oyun bitti!");
      reset();
    });
    sock.on("game_cancelled", msg => {
      alert(msg);
      reset();
    });

    return () => {
      sock.disconnect();
      console.log("🛑 Socket disconnected");
    };
  }, []);

  const handleJoin = () => {
    if (!socket || !name.trim()) return;
    socket.emit("send_name", name.trim());
    setJoined(true);
  };

  const handleSetMin = () => {
    if (!socket) return;
    socket.emit("set_min_players", minInput);
  };

  const handleToggleAutoStart = () => {
    if (!socket) return;
    socket.emit("toggle_auto_start", !autoStart);
  };

  const handleToggleAutoNext = () => {
    if (!socket) return;
    socket.emit("toggle_auto_next", !autoNext);
  };

  const handleStart = () => {
    if (!socket) return;
    socket.emit("start_game");
  };

  const handleNext = () => {
    if (!socket) return;
    socket.emit("next_level");
  };

  const handleSelect = opt => {
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
  };

  if (!joined) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Enter Your Name</h1>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="text-black p-2 rounded"
            placeholder="Your name"
          />
          <button
            onClick={handleJoin}
            className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
          >
            Join Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      {!gameStarted ? (
        <div className="mb-6 w-full max-w-md">
          <h3 className="text-xl mb-2">
            Lobby ({players.length}/{minPlayers})
            {isSpectator && " – You’re spectating"}
          </h3>
          <ul className="space-y-1 mb-4">
            {players.map((p, i) => (
              <li key={i}>
                {p.name} {p.isAdmin && "(Admin)"} {p.isSpectator && "👀"}
              </li>
            ))}
          </ul>

          {isAdmin && (
            <div className="space-y-4">
              <div className="flex items-center">
                <label className="mr-2">Min Players:</label>
                <input
                  type="number"
                  value={minInput}
                  onChange={e => setMinInput(e.target.value)}
                  className="text-black w-16 p-1 rounded"
                />
                <button
                  onClick={handleSetMin}
                  className="ml-2 bg-yellow-500 px-3 py-1 rounded hover:bg-yellow-600"
                >
                  Set
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={autoStart}
                  onChange={handleToggleAutoStart}
                  id="autoStart"
                  className="h-4 w-4"
                />
                <label htmlFor="autoStart">Auto-start</label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={autoNext}
                  onChange={handleToggleAutoNext}
                  id="autoNext"
                  className="h-4 w-4"
                />
                <label htmlFor="autoNext">Auto-next (10s)</label>
              </div>
              <button
                onClick={handleStart}
                className="w-full bg-green-600 px-4 py-2 rounded hover:bg-green-700"
              >
                Start Game
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center space-y-4 w-full max-w-md">
          {isSpectator && (
            <p className="text-yellow-300">Game in progress, you’re spectating.</p>
          )}
          {!levelData ? (
            <p>Waiting for next level…</p>
          ) : (
            <>
              <h2 className="text-xl font-bold">Level {levelData.level}</h2>
              {!selected && !isSpectator ? (
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => handleSelect(levelData.optionA)}
                    className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700"
                  >
                    {levelData.optionA}
                  </button>
                  <button
                    onClick={() => handleSelect(levelData.optionB)}
                    className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700"
                  >
                    {levelData.optionB}
                  </button>
                </div>
              ) : selected ? (
                <p className="text-green-400">You selected: {selected}</p>
              ) : null}

              {isAdmin && (
                <button
                  onClick={handleNext}
                  className="mt-2 bg-yellow-500 px-4 py-2 rounded hover:bg-yellow-600"
                >
                  Next Question
                </button>
              )}

              {allSelections && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">
                    Everyone’s Choices:
                  </h3>
                  <ul className="space-y-1">
                    {allSelections.map((s, i) => (
                      <li key={i}>
                        {s.name} → {s.choice}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
