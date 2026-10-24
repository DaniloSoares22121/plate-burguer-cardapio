import { StrictMode, Suspense, lazy } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { BASE } from "./lib/api"
import MenuApp from "./menu/MenuApp.tsx"

const AdminApp = lazy(() => import("./admin/AdminApp.tsx"))

const rel = "/" + window.location.pathname.slice(BASE.length).replace(/^\/+/, "")
const isAdmin = rel === "/admin" || rel.startsWith("/admin/")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense fallback={<div className="grid min-h-screen place-items-center text-muted">Carregando…</div>}>
        <AdminApp />
      </Suspense>
    ) : (
      <MenuApp />
    )}
  </StrictMode>,
)
