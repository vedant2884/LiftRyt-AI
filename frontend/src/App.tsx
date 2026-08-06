import { useEffect, useState } from "react";
import { api } from "./lib/api";

type HealthStatus = "checking" | "ok" | "error";

function App() {
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    api
      .get("/health")
      .then((res) => {
        setStatus("ok");
        setDetail(JSON.stringify(res.data));
      })
      .catch((err) => {
        setStatus("error");
        setDetail(err.message);
      });
  }, []);

  const statusColor =
    status === "ok"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-amber-400";

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-neutral-100">
      <h1 className="text-4xl font-semibold tracking-tight">
        Lift<span className="text-violet-400">Ryt</span> AI
      </h1>
      <p className="text-neutral-400">Monorepo skeleton is booted.</p>

      <div className="mt-4 flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
        <span>
          backend health check:{" "}
          <span className="font-mono text-neutral-300">
            {status === "checking" ? "checking..." : detail}
          </span>
        </span>
      </div>
    </main>
  );
}

export default App;
