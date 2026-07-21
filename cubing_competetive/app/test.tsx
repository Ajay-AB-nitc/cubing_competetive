"use client"

import { Cube } from "@/lib/shared"
import { useState, useEffect } from "react"
import { useCubeKeyboardControls } from "@/lib/useCubeKeyboardControls"
import { Html } from "@react-three/drei"
import { Cube3D } from "@/components/Cube3D"

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

interface TimerProps {
    isRunning: boolean
    startTime: number
    elapsedWhenStopped: number
}

function Timer({ isRunning, startTime, elapsedWhenStopped }: TimerProps) {
    const [timeElapsed, setTimeElapsed] = useState(0)

    useEffect(() => {
        if (!isRunning) {
            setTimeElapsed(elapsedWhenStopped)
            return
        }

        const intervalId = setInterval(() => {
            setTimeElapsed(Date.now() - startTime)
        }, 10) // 10ms updates for centiseconds

        return () => clearInterval(intervalId)
    }, [isRunning, startTime, elapsedWhenStopped])

    return (
        <div className="text-7xl md:text-8xl font-black tabular-nums tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            {formatTime(timeElapsed)}
        </div>
    )
}

export default function RubiksCube() {
    const [cube, setCube] = useState(() => new Cube())

    // Timer states
    const [timerRunning, setTimerRunning] = useState(false)
    const [startTime, setStartTime] = useState(0)
    const [elapsedWhenStopped, setElapsedWhenStopped] = useState(0)
    const [isSolved, setIsSolved] = useState(false)
    const [bestTime, setBestTime] = useState<number | null>(null)

    // Fetch initial scramble on load
    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/random`)
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

    // Solve detection
    useEffect(() => {
        const solved = cube.isSolved()
        setIsSolved(solved)
        if (timerRunning && solved) {
            setTimerRunning(false)
            const solveTime = Date.now() - startTime
            setElapsedWhenStopped(solveTime)
            setBestTime(prev => {
                if (prev === null || solveTime < prev) {
                    return solveTime
                }
                return prev
            })
        }
    }, [cube, timerRunning, startTime])

    const startSolving = () => {
        setIsSolved(false)
        setElapsedWhenStopped(0)
        
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/random`)
            .then(res => res.json())
            .then(data => {
                if (data && Array.isArray(data.corners) && Array.isArray(data.edges)) {
                    setCube(new Cube(
                        data.corners,
                        data.cornerOrientation,
                        data.edges,
                        data.edgeOrientation
                    ))
                    setStartTime(Date.now())
                    setTimerRunning(true)
                }
            })
            .catch(err => {
                console.error("Error fetching scramble:", err)
                setCube(Cube.random())
                setStartTime(Date.now())
                setTimerRunning(true)
            })
    }

    useCubeKeyboardControls(setCube, timerRunning)

    return (
        <>
            <Cube3D cube={cube} />

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
                            <Timer
                                isRunning={timerRunning}
                                startTime={startTime}
                                elapsedWhenStopped={elapsedWhenStopped}
                            />
                            
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
                                            setElapsedWhenStopped(0)
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
