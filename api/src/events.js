/**
 * Minimal SSE hub. Both People and Delivery open an EventSource against
 * GET /api/events on load. Every mutation (rate added/edited/removed,
 * allocation edited, breakdown item changed) broadcasts a small JSON
 * message here; the other app's EventSource fires and it re-fetches the
 * affected slice. This is what satisfies "a rate edited in People reaches
 * any open Delivery cost view with no reload."
 */

const clients = new Set();

export function sseHandler(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("retry: 2000\n\n");

  clients.add(res);
  req.on("close", () => clients.delete(res));
}

export function broadcast(type, payload) {
  const message = `data: ${JSON.stringify({ type, payload, at: Date.now() })}\n\n`;
  for (const res of clients) {
    res.write(message);
  }
}
