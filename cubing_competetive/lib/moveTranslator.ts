import * as THREE from "three";
import { FaceMove } from "@/lib/cubeTypes";

export type Face = "U" | "D" | "R" | "L" | "F" | "B";

export const FACE_VECTORS: Record<Face, THREE.Vector3> = {
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
};

export function getOppositeFace(face: Face): Face {
  switch (face) {
    case "U": return "D";
    case "D": return "U";
    case "L": return "R";
    case "R": return "L";
    case "F": return "B";
    case "B": return "F";
  }
}

export function vectorToFace(v: THREE.Vector3): Face {
  const rx = Math.round(v.x);
  const ry = Math.round(v.y);
  const rz = Math.round(v.z);

  if (rx === 1) return "R";
  if (rx === -1) return "L";
  if (ry === 1) return "U";
  if (ry === -1) return "D";
  if (rz === 1) return "F";
  if (rz === -1) return "B";
  throw new Error(`Invalid vector: (${v.x}, ${v.y}, ${v.z})`);
}

/**
 * Given the current camera, determines which physical faces are currently facing
 * Front (the user) and Top (up on the screen).
 */
export function getFacingDirections(camera: THREE.Camera): {
  facingFront: Face;
  facingTop: Face;
} {
  // viewDir is the direction pointing from target (origin) to camera.
  // In Three.js, camera.quaternion * (0, 0, 1) is the direction pointing backwards from the camera.
  const viewDir = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion).normalize();

  // upDir is the direction pointing up on the screen.
  const upDir = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

  const faces: { name: Face; vector: THREE.Vector3 }[] = [
    { name: "U", vector: FACE_VECTORS.U },
    { name: "D", vector: FACE_VECTORS.D },
    { name: "R", vector: FACE_VECTORS.R },
    { name: "L", vector: FACE_VECTORS.L },
    { name: "F", vector: FACE_VECTORS.F },
    { name: "B", vector: FACE_VECTORS.B },
  ];

  // Find the face closest to viewDir (Front)
  let bestFrontDot = -Infinity;
  let facingFront: Face = "F";

  for (const face of faces) {
    const dot = face.vector.dot(viewDir);
    if (dot > bestFrontDot) {
      bestFrontDot = dot;
      facingFront = face.name;
    }
  }

  // Find the face closest to upDir (Top), excluding front and back
  let bestTopDot = -Infinity;
  let facingTop: Face = "U";

  for (const face of faces) {
    if (face.name === facingFront || face.name === getOppositeFace(facingFront)) {
      continue;
    }
    const dot = face.vector.dot(upDir);
    if (dot > bestTopDot) {
      bestTopDot = dot;
      facingTop = face.name;
    }
  }

  return { facingFront, facingTop };
}

/**
 * Translates a relative move (e.g. U, D, R, L, F, B from the viewer's current perspective)
 * to a physical move on the cube (which is always physically oriented green front, white top, red right).
 */
export function translateMove(
  relativeMove: FaceMove,
  facingFront: Face,
  facingTop: Face
): FaceMove {
  const frontVec = FACE_VECTORS[facingFront];
  const topVec = FACE_VECTORS[facingTop];

  // Right = Top x Front
  const rightVec = new THREE.Vector3().crossVectors(topVec, frontVec);
  const facingRight = vectorToFace(rightVec);
  const facingLeft = getOppositeFace(facingRight);
  const facingBottom = getOppositeFace(facingTop);
  const facingBack = getOppositeFace(facingFront);

  const relativeToPhysicalMap: Record<FaceMove, FaceMove> = {
    F: facingFront,
    U: facingTop,
    D: facingBottom,
    B: facingBack,
    R: facingRight,
    L: facingLeft,
  };

  return relativeToPhysicalMap[relativeMove];
}
