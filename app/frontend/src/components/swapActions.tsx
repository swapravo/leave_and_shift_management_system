import { api } from "../api";
import { useAction } from "../hooks";
import type { Swap } from "../types";
import { ErrorBox } from "./ui";

/** Accept / decline / cancel a swap, with one busy flag and error shared by whatever renders the buttons. */
export function useSwapActions(onDone: (message: string) => void) {
  const act = useAction();
  const respond = async (s: Swap, accept: boolean) => {
    if (await act.run(() => api.respondSwap(s.id, accept))) onDone(accept ? "Swap accepted. It now needs approval." : "Swap declined.");
  };
  const cancel = async (s: Swap) => {
    if (await act.run(() => api.cancelSwap(s.id))) onDone("Swap cancelled.");
  };
  const buttons = (s: Swap) => (s.can_respond || s.can_cancel) && (
    <div className="row-actions">
      {s.can_respond && (
        <>
          <button type="button" className="primary" disabled={act.busy} onClick={() => respond(s, true)}>Accept</button>
          <button type="button" disabled={act.busy} onClick={() => respond(s, false)}>Decline</button>
        </>
      )}
      {s.can_cancel && <button type="button" disabled={act.busy} onClick={() => cancel(s)}>Cancel swap</button>}
    </div>
  );
  return { buttons, error: <ErrorBox error={act.error} /> };
}
