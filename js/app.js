// ============================================================
// APP — router de vistas, guardia de sesión, sidebar
// ============================================================

import { onAuthReady, logout, isAdmin, currentProfile } from "./auth.js";

const views = {
  dashboard: { title: "Dashboard", sub: "Resumen del día de operación", mod: () => import("./views/dashboard.js") },
  jornada:   { title: "Jornada del día", sub: "Flujo completo: carga → ruta → ventas → cierre", mod: () => import("./views/jornada.js") },
  rutas:     { title: "Rutas", sub: "Las 6 rutas comerciales y su asignación por día", mod: () => import("./views/rutas.js") },
  productos: { title: "Productos", sub: "Catálogo de productos y precios", mod: () => import("./views/productos.js") },
  inventario:{ title: "Inventario", sub: "Cargado, vendido, devuelto y diferencias por jornada", mod: () => import("./views/inventario.js") },
  ventas:    { title: "Ventas", sub: "Registro de ventas por jornada, ruta y producto", mod: () => import("./views/ventas.js") },
  gastos:    { title: "Gastos", sub: "Gastos diarios por categoría", mod: () => import("./views/gastos.js") },
  vehiculo:  { title: "Vehículo", sub: "Kilometraje, combustible y mantenimiento", mod: () => import("./views/vehiculo.js") },
  depositos: { title: "Depósitos bancarios", sub: "Control de depósitos vs. ventas del día", mod: () => import("./views/depositos.js") },
  reportes:  { title: "Reportes", sub: "Ventas, inventario, gastos, vehículo y banco", mod: () => import("./views/reportes.js") },
  usuarios:  { title: "Usuarios", sub: "Administrador y socio (solo lectura)", mod: () => import("./views/usuarios.js") },
};

let current = "dashboard";

function setActiveNav(view) {
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === view);
  });
}

async function loadView(view) {
  const root = document.getElementById("view-root");
  const cfg = views[view];
  if (!cfg) return;

  current = view;
  setActiveNav(view);
  document.getElementById("view-title").textContent = cfg.title;
  document.getElementById("view-sub").textContent = cfg.sub;
  root.innerHTML = `<div class="empty-state"><p>Cargando…</p></div>`;

  // Banner de solo lectura para el socio
  const bannerSlot = document.getElementById("readonly-banner-slot");
  bannerSlot.innerHTML = isAdmin()
    ? ""
    : `<div class="readonly-banner">👁 Estás en modo <strong>&nbsp;solo lectura&nbsp;</strong> — puedes consultar la información pero no modificarla.</div>`;

  try {
    const mod = await cfg.mod();
    await mod.render(root, { isAdmin: isAdmin(), profile: currentProfile });
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="empty-state"><p>No se pudo cargar esta sección. ${err.message || ""}</p></div>`;
  }

  // cerrar sidebar en móvil tras navegar
  document.getElementById("sidebar").classList.remove("open");
}

function initNav() {
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.addEventListener("click", () => loadView(el.dataset.view));
  });
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await logout();
    window.location.href = "index.html";
  });
  document.getElementById("menu-toggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });
}

function paintUserChip(profile, email) {
  const name = profile?.nombre || email || "Usuario";
  document.getElementById("user-avatar").textContent = name.slice(0, 1).toUpperCase();
  document.getElementById("user-name").textContent = name;
  document.getElementById("user-role").textContent = profile?.rol === "administrador" ? "Administrador" : "Socio · solo lectura";

  // Solo el administrador ve el módulo de Usuarios
  document.getElementById("nav-usuarios").style.display = profile?.rol === "administrador" ? "flex" : "none";
}

onAuthReady((user, profile) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  paintUserChip(profile, user.email);
  initNav();
  loadView(current);
});
