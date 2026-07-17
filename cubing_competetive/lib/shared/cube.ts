import { MOVES } from "./moves";
import {
    Corner,
    Edge,
    type FaceMove,
    type MoveDefinition,
    type EdgeOrientation,
    type CornerOrientation
} from "./cubeTypes";

// export type CornerOrientation = 0 | 1 | 2;
// export type EdgeOrientation = 0 | 1;

export class Cube {
    corners: Corner[];

    cornerOrientation: CornerOrientation[];

    edges: Edge[];

    edgeOrientation: EdgeOrientation[];

    constructor(
        corners?: Corner[],
        cornerOrientation?: CornerOrientation[],
        edges?: Edge[],
        edgeOrientation?: EdgeOrientation[]
    ) {
        this.corners = corners ?? [
            Corner.URF, Corner.UFL, Corner.ULB, Corner.UBR,
            Corner.DFR, Corner.DLF, Corner.DBL, Corner.DRB
        ];

        this.cornerOrientation = cornerOrientation ?? [0, 0, 0, 0, 0, 0, 0, 0];

        this.edges = edges ?? [
            Edge.UR, Edge.UF, Edge.UL, Edge.UB,
            Edge.DR, Edge.DF, Edge.DL, Edge.DB,
            Edge.FR, Edge.FL, Edge.BL, Edge.BR
        ];

        this.edgeOrientation = edgeOrientation ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }

    static solved(): Cube {
        return new Cube();
    }

    clone(): Cube {
        const cube = new Cube();
        cube.corners = [...this.corners];
        cube.cornerOrientation = [...this.cornerOrientation];
        cube.edges = [...this.edges];
        cube.edgeOrientation = [...this.edgeOrientation];
        return cube;
    }

    isSolved(): boolean {
        return (
            this.corners.every((c, i) => c === i) &&
            this.cornerOrientation.every(o => o === 0) &&
            this.edges.every((e, i) => e === i) &&
            this.edgeOrientation.every(o => o === 0)
        );
    }


    multiply(move: MoveDefinition) {
        const newCorners: Corner[] = new Array(8);
        const newCornerOri: CornerOrientation[] = new Array(8);
        const newEdges: Edge[] = new Array(12);
        const newEdgeOri: EdgeOrientation[] = new Array(12);

        for (let i = 0; i < 8; i++) {
            const oldPos = move.corners[i];
            if (oldPos === undefined) continue;
            newCorners[i] = this.corners[oldPos]!;
            newCornerOri[i] =
                ((this.cornerOrientation[oldPos]! + move.cornerOri[i]!) % 3) as CornerOrientation;
        }

        for (let i = 0; i < 12; i++) {
            const oldPos = move.edges[i];
            if (oldPos === undefined) continue;
            newEdges[i] = this.edges[oldPos]!;
            newEdgeOri[i] =
                ((this.edgeOrientation[oldPos]! + move.edgeOri[i]!) % 2) as EdgeOrientation;
        }

        this.corners = newCorners;
        this.cornerOrientation = newCornerOri;
        this.edges = newEdges;
        this.edgeOrientation = newEdgeOri;
    }


    applyMove(move: FaceMove) {
        this.multiply(MOVES[move]);
    }

    isValid(): boolean {
        if (this.corners.length !== 8 || this.cornerOrientation.length !== 8) return false;
        if (this.edges.length !== 12 || this.edgeOrientation.length !== 12) return false;

        // Check corner values are a permutation of 0..7
        const cornerSet = new Set(this.corners);
        if (cornerSet.size !== 8) return false;
        for (let i = 0; i < 8; i++) {
            if (!cornerSet.has(i as Corner)) return false;
        }

        // Check edge values are a permutation of 0..11
        const edgeSet = new Set(this.edges);
        if (edgeSet.size !== 12) return false;
        for (let i = 0; i < 12; i++) {
            if (!edgeSet.has(i as Edge)) return false;
        }

        // Verify orientations are valid
        if (!this.cornerOrientation.every(o => o === 0 || o === 1 || o === 2)) return false;
        if (!this.edgeOrientation.every(o => o === 0 || o === 1)) return false;

        // 1. Verify corner orientation sum % 3 == 0
        const cornerOriSum = this.cornerOrientation.reduce<number>((sum, o) => sum + o, 0);
        if (cornerOriSum % 3 !== 0) return false;

        // 2. Verify edge orientation sum % 2 == 0
        const edgeOriSum = this.edgeOrientation.reduce<number>((sum, o) => sum + o, 0);
        if (edgeOriSum % 2 !== 0) return false;

        // 3. Calculate permutation parity for corners and edges
        const cornerParity = getParity(this.corners);
        const edgeParity = getParity(this.edges);

        // 4. Verify corner parity == edge parity
        return cornerParity === edgeParity;
    }

    static random(): Cube {
        // 1. Generate random corner permutation
        const corners = shuffle([
            Corner.URF, Corner.UFL, Corner.ULB, Corner.UBR,
            Corner.DFR, Corner.DLF, Corner.DBL, Corner.DRB
        ]);

        // 2. Generate random edge permutation
        const edges = shuffle([
            Edge.UR, Edge.UF, Edge.UL, Edge.UB,
            Edge.DR, Edge.DF, Edge.DL, Edge.DB,
            Edge.FR, Edge.FL, Edge.BL, Edge.BR
        ]);

        // 3. Generate random corner orientations for 7 corners and calculate the 8th
        const cornerOrientation: CornerOrientation[] = [];
        let cornerOriSum = 0;
        for (let i = 0; i < 7; i++) {
            const o = Math.floor(Math.random() * 3) as CornerOrientation;
            cornerOrientation.push(o);
            cornerOriSum += o;
        }
        cornerOrientation.push(((3 - (cornerOriSum % 3)) % 3) as CornerOrientation);

        // 4. Generate random edge orientations for 11 edges and calculate the 12th
        const edgeOrientation: EdgeOrientation[] = [];
        let edgeOriSum = 0;
        for (let i = 0; i < 11; i++) {
            const o = Math.floor(Math.random() * 2) as EdgeOrientation;
            edgeOrientation.push(o);
            edgeOriSum += o;
        }
        edgeOrientation.push((edgeOriSum % 2) as EdgeOrientation);

        // 5. Fix parity mismatch by swapping two edges
        const cornerParity = getParity(corners);
        const edgeParity = getParity(edges);

        if (cornerParity !== edgeParity) {
            const e0 = edges[0];
            const e1 = edges[1];
            if (e0 !== undefined && e1 !== undefined) {
                edges[0] = e1;
                edges[1] = e0;
            }
        }

        return new Cube(corners, cornerOrientation, edges, edgeOrientation);
    }
}

function getParity<T>(arr: T[]): number {
    const n = arr.length;
    const visited = new Array(n).fill(false);
    let swaps = 0;
    for (let i = 0; i < n; i++) {
        if (visited[i]) continue;
        let cycleSize = 0;
        let curr = i;
        while (!visited[curr]) {
            visited[curr] = true;
            const next = arr[curr];
            if (next === undefined || typeof next !== "number" || next < 0 || next >= n) {
                throw new Error("Invalid permutation value");
            }
            curr = next;
            cycleSize++;
        }
        if (cycleSize > 1) {
            swaps += (cycleSize - 1);
        }
    }
    return swaps % 2;
}

function shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = result[i];
        const randVal = result[j];
        if (temp !== undefined && randVal !== undefined) {
            result[i] = randVal;
            result[j] = temp;
        }
    }
    return result;
}