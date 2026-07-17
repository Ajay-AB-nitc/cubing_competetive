// types/cubeTypes.ts

/*
Corner positions / cubies

        U
    2-------3
   /|      /|
  1-------0 |
  | |     | |
  | 6-----|-7
  |/      |/
  5-------4
*/

export enum Corner {
  URF = 0,
  UFL = 1,
  ULB = 2,
  UBR = 3,
  DFR = 4,
  DLF = 5,
  DBL = 6,
  DRB = 7,
}

/*
Edge positions / cubies
Top:    UR UF UL UB
Bottom: DR DF DL DB
Middle: FR FL BL BR
*/

export enum Edge {
  UR = 0,
  UF = 1,
  UL = 2,
  UB = 3,

  DR = 4,
  DF = 5,
  DL = 6,
  DB = 7,

  FR = 8,
  FL = 9,
  BL = 10,
  BR = 11,
}

export type CornerOrientation = 0 | 1 | 2;
export type EdgeOrientation = 0 | 1;

export type FaceMove = "U" | "D" | "R" | "L" | "F" | "B";


export type MoveDefinition = {
  corners: Corner[];
  cornerOri: CornerOrientation[];
  edges: Edge[];
  edgeOri: EdgeOrientation[];
};

export const SOLVED_CORNERS: Corner[] = [
  Corner.URF,
  Corner.UFL,
  Corner.ULB,
  Corner.UBR,
  Corner.DFR,
  Corner.DLF,
  Corner.DBL,
  Corner.DRB,
];

export const SOLVED_EDGES: Edge[] = [
  Edge.UR,
  Edge.UF,
  Edge.UL,
  Edge.UB,
  Edge.DR,
  Edge.DF,
  Edge.DL,
  Edge.DB,
  Edge.FR,
  Edge.FL,
  Edge.BL,
  Edge.BR,
];

export const SOLVED_CORNER_ORIENTATION: CornerOrientation[] =
  [0, 0, 0, 0, 0, 0, 0, 0];

export const SOLVED_EDGE_ORIENTATION: EdgeOrientation[] =
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];