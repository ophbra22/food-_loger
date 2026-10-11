import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/** False only when the phone itself reports no connection. A reachable network may still fail. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        // Only the link state: a home network without internet can still reach a local server.
        setOnline(state.isConnected !== false);
      }),
    [],
  );
  return online;
}
