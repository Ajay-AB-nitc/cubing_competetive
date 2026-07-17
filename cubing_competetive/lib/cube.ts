import { MOVES } from "@/lib/moves";
import {
    Corner,
    Edge,
    FaceMove,
    MoveDefinition,
    EdgeOrientation,
    CornerOrientation
} from "@/lib/cubeTypes";

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
            newCorners[i] = this.corners[oldPos];
            newCornerOri[i] =
                ((this.cornerOrientation[oldPos] + move.cornerOri[i]) % 3) as CornerOrientation;
        }

        for (let i = 0; i < 12; i++) {
            const oldPos = move.edges[i];
            newEdges[i] = this.edges[oldPos];
            newEdgeOri[i] =
                ((this.edgeOrientation[oldPos] + move.edgeOri[i]) % 2) as EdgeOrientation;
        }

        this.corners = newCorners;
        this.cornerOrientation = newCornerOri;
        this.edges = newEdges;
        this.edgeOrientation = newEdgeOri;
    }


    applyMove(move: FaceMove) {
        this.multiply(MOVES[move]);
    }

}