import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Cube, FaceMove } from "@/lib/shared";
import { getFacingDirections, translateMove } from "@/lib/moveTranslator";

const MOVE_KEYS: Record<string, FaceMove> = {
    u: "U",
    d: "D",
    r: "R",
    l: "L",
    f: "F",
    b: "B",
};

export function useCubeKeyboardControls(
    setCube: React.Dispatch<React.SetStateAction<Cube>>,
    enabled: boolean = true
) {
    const { camera } = useThree();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!enabled) return;

            // Ignore key presses if typing in input fields
            if (
                document.activeElement?.tagName === "INPUT" ||
                document.activeElement?.tagName === "TEXTAREA" ||
                (document.activeElement as HTMLElement)?.isContentEditable
            ) {
                return;
            }

            const key = e.key.toLowerCase();
            if (key in MOVE_KEYS) {
                const relativeMove = MOVE_KEYS[key];
                const isReverse = e.shiftKey;

                // Determine physical move based on camera orientation
                const { facingFront, facingTop } = getFacingDirections(camera);
                const physicalMove = translateMove(relativeMove, facingFront, facingTop);

                setCube((prev) => {
                    const next = prev.clone();
                    if (isReverse) {
                        next.applyMove(physicalMove);
                        next.applyMove(physicalMove);
                        next.applyMove(physicalMove);
                    } else {
                        next.applyMove(physicalMove);
                    }
                    return next;
                });
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [setCube, camera, enabled]);
}

