"use client";

import { Canvas } from "@react-three/fiber";
import { Cube } from "@/lib/shared";
import { Cube3D } from "./Cube3D";

interface MiniCubeProps {
  cube: Cube;
}

export function MiniCube({ cube }: MiniCubeProps) {
  return (
    <div className="w-40 h-40 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 overflow-hidden shadow-2xl relative pointer-events-none">
      <div className="absolute top-2 left-2 z-10 bg-slate-900/80 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-rose-400 border border-rose-500/20">
        Opponent
      </div>
      <Canvas camera={{ position: [4, 3.5, 4], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} />
        <Cube3D cube={cube} highlightFrontCenter={false} />
      </Canvas>
    </div>
  );
}
