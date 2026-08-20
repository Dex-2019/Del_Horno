// ============================================================
// UTILS — formato de moneda/fecha, toasts, modal genérico
// ============================================================

export function fmtL(num) {
  const n = Number(num) || 0;
  return "L " + n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(d) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return date.toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function diaSemana(fechaISO) {
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const d = new Date(fechaISO + "T00:00:00");
  return dias[d.getDay()];
}

export function toast(msg) {
  const box = document.getElementById("toast");
  if (!box) return alert(msg);
  const el = document.createElement("div");
  el.className = "toast-msg";
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- Modal genérico ----
// openModal({ title, bodyHtml, onSubmit, submitLabel }) -> muestra un modal
// con el HTML de formulario dado. onSubmit recibe FormData del <form>.
export function openModal({ title, bodyHtml, onSubmit, submitLabel = "Guardar" }) {
  const overlay = document.getElementById("modal-overlay");
  overlay.innerHTML = `
    <div class="modal">
      <h3>${escapeHtml(title)}</h3>
      <form id="modal-form">
        ${bodyHtml}
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" id="modal-cancel">Cancelar</button>
          <button type="submit" class="btn">${escapeHtml(submitLabel)}</button>
        </div>
      </form>
    </div>`;
  overlay.classList.add("open");

  overlay.querySelector("#modal-cancel").onclick = () => closeModal();
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

  const form = overlay.querySelector("#modal-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await onSubmit(fd, form);
      closeModal();
    } catch (err) {
      console.error(err);
      toast("Error: " + (err.message || "no se pudo guardar"));
      submitBtn.disabled = false;
    }
  };
}

export function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  overlay.classList.remove("open");
  overlay.innerHTML = "";
}

export function confirmDialog(msg) {
  return window.confirm(msg);
}
