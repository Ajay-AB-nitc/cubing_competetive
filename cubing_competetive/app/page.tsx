import Scene from "./Scene";
import SocketStatus from "@/components/SocketStatus";

export default function Home() {
  return (
    <div className="w-screen h-screen flex items-center justify-center relative">
      <div className="absolute top-4 right-4 z-50">
        <SocketStatus />
      </div>
      <Scene></Scene>
    </div>
  );
}

