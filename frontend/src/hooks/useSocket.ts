import { useEffect, useState } from "react";
import { WS_URL } from "../ws_url";

export const useSocket = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      setSocket(ws);
    }

    ws.onclose = () => {
      setSocket(null);
    }

    return () => {
      console.log('useSocket unmount');
      ws.close();
    }

  }, [] )

  return socket;
}