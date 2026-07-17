"use client"

import { Cube, Corner, Edge } from "@/lib/shared"
import { useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { getFacingDirections, Face } from "@/lib/moveTranslator"

export type RenderCubie = {
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

export interface Cube3DProps {
    cube: Cube
    highlightFrontCenter?: boolean
}

export function Cube3D({ cube, highlightFrontCenter = true }: Cube3DProps) {
    const [facingFront, setFacingFront] = useState<Face>("F")
    const { camera } = useThree()

    useFrame(() => {
        if (!highlightFrontCenter) return

        const { facingFront: currentFront } = getFacingDirections(camera)
        if (currentFront !== facingFront) {
            setFacingFront(currentFront)
        }
    })

    const renderCubies = cubeToRenderCubies(cube)

    return (
        <>
            {renderCubies.map((cubie) => {
                const isHighlighted = highlightFrontCenter && cubie.id === `center-${facingFront}`
                return (
                    <Cubie
                        key={cubie.id}
                        cubie={cubie}
                        isHighlighted={isHighlighted}
                    />
                )
            })}
        </>
    )
}
