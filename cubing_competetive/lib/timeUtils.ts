// Formats millisecond time into MM:SS.CC or SS.CC format
export function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((ms % 1000) / 10);
  
  const csStr = centiseconds.toString().padStart(2, "0");
  const sStr = seconds.toString().padStart(2, "0");
  if (minutes > 0) {
    return `${minutes}:${sStr}.${csStr}`;
  }
  return `${seconds}.${csStr}`;
}
