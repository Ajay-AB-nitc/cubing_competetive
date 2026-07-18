import { Cube } from "./shared/cube";

export interface PlayerStats {
  moveCount: number;
  startTime?: number | undefined;
  endTime?: number | undefined;
}

export class GameState {
  cube: Cube;
  expectedSeq: number = 0;
  stats: PlayerStats;

  constructor(scramble: Cube) {
    this.cube = new Cube(
      [...scramble.corners],
      [...scramble.cornerOrientation],
      [...scramble.edges],
      [...scramble.edgeOrientation]
    );
    this.stats = { moveCount: 0 };
  }

  reset(scramble: Cube, startTime?: number) {
    this.cube = new Cube(
      [...scramble.corners],
      [...scramble.cornerOrientation],
      [...scramble.edges],
      [...scramble.edgeOrientation]
    );
    this.expectedSeq = 0;
    this.stats = { moveCount: 0, startTime };
  }
}
