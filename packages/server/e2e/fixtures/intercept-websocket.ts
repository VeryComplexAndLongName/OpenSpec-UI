import type { Page, WebSocketRoute } from "@playwright/test";

export interface WebSocketHandle {
  current?: WebSocketRoute;
}

/** Sets up passthrough interception of the standalone app's WebSocket
 * connection so a test can later sever it from the client side
 * (`handle.current?.close()`), deterministically simulating a dropped
 * connection. Must be called before `page.goto()`.
 *
 * Node's `server.closeAllConnections()` is documented to NOT affect
 * sockets already upgraded to WebSocket -- calling it on the test's
 * `OpenSpecUiServer.httpServer` before `server.close()` does not
 * actually sever a still-open browser WebSocket (confirmed directly:
 * a test relying on it alone hung for the full test timeout). Closing
 * the client side of the connection through Playwright's own route,
 * as this fixture does, is the mechanism that's actually been proven to
 * work end-to-end. */
export async function interceptWebSocket(page: Page): Promise<WebSocketHandle> {
  const handle: WebSocketHandle = {};
  await page.routeWebSocket(/\/api\/ws/, (ws) => {
    ws.connectToServer();
    handle.current = ws;
  });
  return handle;
}
