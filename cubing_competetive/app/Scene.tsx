"use client"

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import RubiksCube from "./test";

export default function Scene() {
    return (
        <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 5, 5]} />

            <RubiksCube />

            <OrbitControls />
        </Canvas>
    );
}