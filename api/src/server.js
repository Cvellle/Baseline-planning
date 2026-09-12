import express from "express";

const app = express();
app.use(express.json());

// Health check -- used by docker compose to gate the frontends on the API.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Empty placeholder route. Real endpoints get added here later.
app.get("/api/", (_req, res) => {
  res.json({ service: "baseline-api", routes: ["/api/health"] });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`api listening on ${port}`);
});
