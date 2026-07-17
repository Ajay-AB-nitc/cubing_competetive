import { Cube, Corner, Edge } from "@/lib/shared"
import { useState, useEffect } from "react"
import { useCubeKeyboardControls } from "@/lib/useCubeKeyboardControls"
import { useFrame, useThree } from "@react-three/fiber"
import { getFacingDirections, Face } from "@/lib/moveTranslator"
import { Html } from "@react-three/drei"


type RenderCubie = {
    id: string
    position: [number, number, number]
    stickers: {
        U?: string
        D?: string
        L?: string
        R?: string
        F?: string
        B?: string
    }
}


const CORNER_PIECE_STICKERS: Record<Corner, { ud: string; s1: string; s2: string }> = {
    [Corner.URF]: { ud: "white", s1: "red", s2: "green" },
    [Corner.UFL]: { ud: "white", s1: "green", s2: "orange" },
    [Corner.ULB]: { ud: "white", s1: "orange", s2: "blue" },
    [Corner.UBR]: { ud: "white", s1: "blue", s2: "red" },
    [Corner.DFR]: { ud: "yellow", s1: "green", s2: "red" },
    [Corner.DLF]: { ud: "yellow", s1: "orange", s2: "green" },
    [Corner.DBL]: { ud: "yellow", s1: "blue", s2: "orange" },
    [Corner.DRB]: { ud: "yellow", s1: "red", s2: "blue" },
};

const CORNER_POSITION_FACES: Record<number, { ud: string; s1: string; s2: string }> = {
    0: { ud: "U", s1: "R", s2: "F" },
    1: { ud: "U", s1: "F", s2: "L" },
    2: { ud: "U", s1: "L", s2: "B" },
    3: { ud: "U", s1: "B", s2: "R" },
    4: { ud: "D", s1: "F", s2: "R" },
    5: { ud: "D", s1: "L", s2: "F" },
    6: { ud: "D", s1: "B", s2: "L" },
    7: { ud: "D", s1: "R", s2: "B" },
};

const CORNER_POSITIONS: [number, number, number][] = [
    [1, 1, 1],      // URF
    [-1, 1, 1],     // UFL
    [-1, 1, -1],    // ULB
    [1, 1, -1],     // UBR
    [1, -1, 1],     // DFR
    [-1, -1, 1],    // DLF
    [-1, -1, -1],   // DBL
    [1, -1, -1],    // DRB
];

const EDGE_PIECE_STICKERS: Record<Edge, { prim: string; sec: string }> = {
    [Edge.UR]: { prim: "white", sec: "red" },
    [Edge.UF]: { prim: "white", sec: "green" },
    [Edge.UL]: { prim: "white", sec: "orange" },
    [Edge.UB]: { prim: "white", sec: "blue" },
    [Edge.DR]: { prim: "yellow", sec: "red" },
    [Edge.DF]: { prim: "yellow", sec: "green" },
    [Edge.DL]: { prim: "yellow", sec: "orange" },
    [Edge.DB]: { prim: "yellow", sec: "blue" },
    [Edge.FR]: { prim: "green", sec: "red" },
    [Edge.FL]: { prim: "green", sec: "orange" },
    [Edge.BL]: { prim: "blue", sec: "orange" },
    [Edge.BR]: { prim: "blue", sec: "red" },
};

const EDGE_POSITION_FACES: Record<number, { prim: string; sec: string }> = {
    0: { prim: "U", sec: "R" },
    1: { prim: "U", sec: "F" },
    2: { prim: "U", sec: "L" },
    3: { prim: "U", sec: "B" },
    4: { prim: "D", sec: "R" },
    5: { prim: "D", sec: "F" },
    6: { prim: "D", sec: "L" },
    7: { prim: "D", sec: "B" },
    8: { prim: "F", sec: "R" },
    9: { prim: "F", sec: "L" },
    10: { prim: "B", sec: "L" },
    11: { prim: "B", sec: "R" },
};

const EDGE_POSITIONS: [number, number, number][] = [
    [1, 1, 0],     // UR
    [0, 1, 1],     // UF
    [-1, 1, 0],    // UL
    [0, 1, -1],    // UB
    [1, -1, 0],    // DR
    [0, -1, 1],    // DF
    [-1, -1, 0],   // DL
    [0, -1, -1],   // DB
    [1, 0, 1],     // FR
    [-1, 0, 1],    // FL
    [-1, 0, -1],   // BL
    [1, 0, -1],    // BR
];

const CENTERS: RenderCubie[] = [
    { id: "center-U", position: [0, 1, 0], stickers: { U: "white" } },
    { id: "center-D", position: [0, -1, 0], stickers: { D: "yellow" } },
    { id: "center-L", position: [-1, 0, 0], stickers: { L: "orange" } },
    { id: "center-R", position: [1, 0, 0], stickers: { R: "red" } },
    { id: "center-F", position: [0, 0, 1], stickers: { F: "green" } },
    { id: "center-B", position: [0, 0, -1], stickers: { B: "blue" } },
];

function cubeToRenderCubies(cube: Cube): RenderCubie[] {
    const renderCubies: RenderCubie[] = [];

    // Corners
    for (let position = 0; position < 8; position++) {
        const cubie = cube.corners[position];
        const ori = cube.cornerOrientation[position];

        const pieceStickers = CORNER_PIECE_STICKERS[cubie];
        const posFaces = CORNER_POSITION_FACES[position];
        const stickers: { [key: string]: string } = {};

        if (ori === 0) {
            stickers[posFaces.ud] = pieceStickers.ud;
            stickers[posFaces.s1] = pieceStickers.s1;
            stickers[posFaces.s2] = pieceStickers.s2;
        } else if (ori === 1) {
            stickers[posFaces.s1] = pieceStickers.ud;
            stickers[posFaces.s2] = pieceStickers.s1;
            stickers[posFaces.ud] = pieceStickers.s2;
        } else {
            stickers[posFaces.s2] = pieceStickers.ud;
            stickers[posFaces.ud] = pieceStickers.s1;
            stickers[posFaces.s1] = pieceStickers.s2;
        }

        renderCubies.push({
            id: `corner-${position}`,
            position: CORNER_POSITIONS[position],
            stickers: stickers as RenderCubie["stickers"]
        });
    }

    // Edges
    for (let position = 0; position < 12; position++) {
        const cubie = cube.edges[position];
        const ori = cube.edgeOrientation[position];

        const pieceStickers = EDGE_PIECE_STICKERS[cubie];
        const posFaces = EDGE_POSITION_FACES[position];
        const stickers: { [key: string]: string } = {};

        if (ori === 0) {
            stickers[posFaces.prim] = pieceStickers.prim;
            stickers[posFaces.sec] = pieceStickers.sec;
        } else {
            stickers[posFaces.sec] = pieceStickers.prim;
            stickers[posFaces.prim] = pieceStickers.sec;
        }

        renderCubies.push({
            id: `edge-${position}`,
            position: EDGE_POSITIONS[position],
            stickers: stickers as RenderCubie["stickers"]
        });
    }

    // Centers
    renderCubies.push(...CENTERS);

    return renderCubies;
}


function Cubie({ cubie, isHighlighted }: { cubie: RenderCubie; isHighlighted?: boolean }) {
    const s = cubie.stickers

    const materials = [
        s.R ?? "black", // +X
        s.L ?? "black", // -X
        s.U ?? "black", // +Y
        s.D ?? "black", // -Y
        s.F ?? "black", // +Z
        s.B ?? "black", // -Z
    ]

    const scale: [number, number, number] = isHighlighted ? [1.12, 1.12, 1.12] : [1, 1, 1]

    return (
        <mesh position={cubie.position} scale={scale}>
            <boxGeometry args={[0.95, 0.95, 0.95]} />
            {materials.map((color, i) => (
                <meshStandardMaterial
                    key={i}
                    attach={`material-${i}`}
                    color={color}
                    emissive={isHighlighted && color !== "black" ? color : "black"}
                    emissiveIntensity={isHighlighted ? 0.6 : 0}
                />
            ))}
        </mesh>
    )
}

function formatTime(ms: number): string {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const centiseconds = Math.floor((ms % 1000) / 10);
    
    const csStr = centiseconds.toString().padStart(2, "0");
    const sStr = seconds.toString().padStart(2, "0");
    if (minutes > 0) {
        return `${minutes}:${sStr}.${csStr}`;
    }
    return `${seconds}.${csStr}`;
}

export default function RubiksCube() {
    const [cube, setCube] = useState(() => new Cube())
    const [facingFront, setFacingFront] = useState<Face>("F")
    const { camera } = useThree()

    // Timer states
    const [timerRunning, setTimerRunning] = useState(false)
    const [timeElapsed, setTimeElapsed] = useState(0)
    const [isSolved, setIsSolved] = useState(false)
    const [bestTime, setBestTime] = useState<number | null>(null)

    // Fetch initial scramble on load
    useEffect(() => {
        fetch("http://localhost:3001/random")
            .then(res => res.json())
            .then(data => {
                if (data && Array.isArray(data.corners) && Array.isArray(data.edges)) {
                    setCube(new Cube(
                        data.corners,
                        data.cornerOrientation,
                        data.edges,
                        data.edgeOrientation
                    ))
                }
            })
            .catch(err => {
                console.error("Error fetching random cube state:", err)
                setCube(Cube.random()) // local fallback
            })
    }, [])

    // Timer interval
    useEffect(() => {
        let intervalId: any
        if (timerRunning) {
            const start = Date.now() - timeElapsed
            intervalId = setInterval(() => {
                setTimeElapsed(Date.now() - start)
            }, 10)
        }
        return () => clearInterval(intervalId)
    }, [timerRunning])

    // Solve detection
    useEffect(() => {
        const solved = cube.isSolved()
        setIsSolved(solved)
        if (timerRunning && solved) {
            setTimerRunning(false)
            setBestTime(prev => {
                if (prev === null || timeElapsed < prev) {
                    return timeElapsed
                }
                return prev
            })
        }
    }, [cube, timerRunning, timeElapsed])

    useFrame(() => {
        const { facingFront: currentFront } = getFacingDirections(camera)
        if (currentFront !== facingFront) {
            setFacingFront(currentFront)
        }
    })

    const startSolving = () => {
        setTimeElapsed(0)
        setIsSolved(false)
        
        fetch("http://localhost:3001/random")
            .then(res => res.json())
            .then(data => {
                if (data && Array.isArray(data.corners) && Array.isArray(data.edges)) {
                    setCube(new Cube(
                        data.corners,
                        data.cornerOrientation,
                        data.edges,
                        data.edgeOrientation
                    ))
                    setTimerRunning(true)
                }
            })
            .catch(err => {
                console.error("Error fetching scramble:", err)
                setCube(Cube.random())
                setTimerRunning(true)
            })
    }

    const renderCubies = cubeToRenderCubies(cube)

    useCubeKeyboardControls(setCube, timerRunning)

    return (
        <>
            {renderCubies.map((cubie) => (
                <Cubie
                    key={cubie.id}
                    cubie={cubie}
                    isHighlighted={cubie.id === `center-${facingFront}`}
                />
            ))}

            <Html fullscreen style={{ pointerEvents: "none" }}>
                <div className="absolute inset-0 flex flex-col justify-between p-8 text-white font-sans">
                    {/* Top Stats */}
                    <div className="flex justify-between items-start pointer-events-auto">
                        <div className="bg-black/40 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 shadow-2xl">
                            <h1 className="text-xs uppercase tracking-widest text-gray-400 font-bold">Session PB</h1>
                            <p className="text-2xl font-extrabold text-amber-400 mt-1">
                                {bestTime !== null ? formatTime(bestTime) : "--.--"}
                            </p>
                        </div>

                        <div className="bg-black/40 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 shadow-2xl text-right">
                            <h2 className="text-xs uppercase tracking-widest text-gray-400 font-bold">Status</h2>
                            <p className={`text-sm font-semibold mt-1 ${
                                timerRunning 
                                    ? "text-emerald-400 animate-pulse" 
                                    : isSolved 
                                        ? "text-blue-400" 
                                        : "text-amber-400"
                            }`}>
                                {timerRunning ? "SOLVING" : isSolved ? "SOLVED!" : "READY"}
                            </p>
                        </div>
                    </div>

                    {/* Center Timer */}
                    <div className="flex flex-col items-center justify-center flex-grow pointer-events-auto">
                        <div className="text-center">
                            <div className="text-7xl md:text-8xl font-black tabular-nums tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                                {formatTime(timeElapsed)}
                            </div>
                            
                            <div className="mt-8 flex gap-4 justify-center">
                                {!timerRunning ? (
                                    <button
                                        onClick={startSolving}
                                        className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-lg rounded-2xl border border-emerald-400/20 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer"
                                    >
                                        {isSolved ? "Solve Again" : "Start Timer"}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setTimerRunning(false)
                                            setTimeElapsed(0)
                                        }}
                                        className="px-8 py-4 bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-lg rounded-2xl border border-rose-400/20 shadow-[0_0_20px_rgba(244,63,94,0.3)] transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer"
                                    >
                                        Reset / Stop
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Instructions / Keyboard Hints */}
                    <div className="flex justify-center pointer-events-auto">
                        <div className="bg-black/60 backdrop-blur-lg px-8 py-4 rounded-3xl border border-white/10 shadow-2xl max-w-xl text-center">
                            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Controls</p>
                            <div className="grid grid-cols-6 gap-2 text-xs md:text-sm font-semibold text-gray-300">
                                <div><kbd className="px-2 py-1 bg-white/10 rounded">U</kbd> Top</div>
                                <div><kbd className="px-2 py-1 bg-white/10 rounded">D</kbd> Bottom</div>
                                <div><kbd className="px-2 py-1 bg-white/10 rounded">L</kbd> Left</div>
                                <div><kbd className="px-2 py-1 bg-white/10 rounded">R</kbd> Right</div>
                                <div><kbd className="px-2 py-1 bg-white/10 rounded">F</kbd> Front</div>
                                <div><kbd className="px-2 py-1 bg-white/10 rounded">B</kbd> Back</div>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-3 italic">
                                * Moves are relative to the center piece highlighted in <span className="text-emerald-400 font-bold">green</span>. Hold Shift for counter-clockwise.
                            </p>
                        </div>
                    </div>
                </div>
            </Html>
        </>
    )
}



