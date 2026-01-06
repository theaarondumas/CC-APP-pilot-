/* ===========================
   Verifi Pilot — Feature Complete (Local Save)
   - Cart Types + filtered departments
   - Manual Cart # batch round
   - Sticker entry per cart
   - All dates = calendar picker
   - Drug name free text
   - Issue stays included + optional Issue Note
   - Shift 3-button toggle
   - Nursing Log: Needs attention default (A) + Show All
   - Due Soon logic (30d) + blanks => Due Soon
   - Print / Save PDF
   - LocalStorage persistence + JSON export
   =========================== */

const $ = (id) => document.getElementById(id);

const LOCAL_KEY = "verifi_pilot_round_v1";
const DEMO_PIN = "1234"; // pilot lock/unlock

// UI
const lockBtn = $("lockBtn");
const pinModal = $("pinModal");
const pinInput = $("pinInput");
const pinCancel = $("pinCancel");
const pinUnlock = $("pinUnlock");

const cartTypeTabs = $("cartTypeTabs");
const departmentSelect = $("departmentSelect");
const cartNumberInput = $("cartNumberInput");
const addCartBtn = $("addCartBtn");
const clearRoundBtn = $("clearRoundBtn");
const saveRoundBtn = $("saveRoundBtn");
const exportJsonBtn = $("exportJsonBtn");

const roundMeta = $("roundMeta");
const cartList = $("cartList");

const nursingMeta = $("nursingMeta");
const nursingLogContainer = $("nursingLogContainer");
const nursingLogPrintContainer = $("nursingLogPrintContainer");
const showAllToggle = $("showAllToggle");
const printPdfBtn = $("printPdfBtn");

// State
let isLocked = false;
let showAll = false;

let round = {
  cartType: "Adult – Towers",
  department: "",
  carts: [] // array of cart objects
};

// Department lists based on your paper sheets (pilot-safe)
const DEPARTMENTS = {
  "Adult – Towers": [
    "4 South","4 East","3 South","3 East","2 South","2 East",
    "2A","2B","2C","2D","3A","3B","3C","3D",
    "ICU Pavilion — Pav A","ICU Pavilion — Pav B","ICU Pavilion — Pav C",
    "Tower Extra Cart"
  ],
  "Adult – ER / Procedural": [
    "ER Area","Cardiology","EDX1","EDX2","ER Triage","ER Room 2",
    "X-Ray Dept","CT1","CT2 / MRI","Specials Room 5","Specials Room 6",
    "Cath Lab","CT Trailer",
    "Mother/Baby — L&D Triage","Mother/Baby — L&D Nurse Station","Mother/Baby — Maternity",
    "Surgery — OR","Surgery — Recovery",
    "North Building","Physical Therapy","Basement","GI Lab",
    "Central Backup Carts","X-Ray Trailer","Urology"
  ],
  "Neonatal": [
    "Labor & Delivery — OR Hallway","Labor & Delivery — L&D Hallway",
    "Mother/Baby — NICU","Mother/Baby — Nursery","Pav C NICU",
    "Central Backup Carts"
  ],
  "Broselow": [
    "2C","ER","EDX1","EDX2","ER MAIN",
    "Surgery — Recovery",
    "Central Backup Carts"
  ]
};

function newCart(cartNo) {
  return {
    cartType: round.cartType,
    department: round.department,
    cartNo: String(cartNo).trim(),

    // Supply sticker
    supplyName: "",
    supplyExp: "",   // YYYY-MM-DD
    checkDate: "",   // YYYY-MM-DD
    checkedBy: "",

    // Shift toggle (Day/Evening/Night)
    shift: "",

    // Issue
    issue: false,
    issueNote: "",

    // Drug sticker
    drugExp: "",     // YYYY-MM-DD
    drugName: ""
  };
}

/* ---------------------------
   Lock / Unlock
--------------------------- */
function setLocked(state) {
  isLocked = state;

  document.querySelectorAll("input, select, button").forEach((el) => {
    // keep unlock controls clickable
    const id = el.id || "";
    if (id === "lockBtn" || id === "pinUnlock" || id === "pinCancel" || id === "pinInput") return;

    // printing button should still work even if locked (optional)
    if (id === "printPdfBtn") return;

    // allow lock button always
    if (el.closest("#pinModal")) return;

    el.disabled = state;
  });

  lockBtn.textContent = state ? "🔒 Locked" : "🔒 Lock";
}

lockBtn.addEventListener("click", () => {
  if (!isLocked) return setLocked(true);

  pinModal.classList.remove("hidden");
  pinInput.value = "";
  pinInput.placeholder = "••••";
  pinInput.focus();
});

pinCancel.addEventListener("click", () => pinModal.classList.add("hidden"));

pinUnlock.addEventListener("click", () => {
  if (pinInput.value.trim() === DEMO_PIN) {
    setLocked(false);
    pinModal.classList.add("hidden");
  } else {
    pinInput.value = "";
    pinInput.placeholder = "Wrong PIN";
    pinInput.focus();
  }
});

/* ---------------------------
   Department options
--------------------------- */
function renderDepartmentOptions() {
  const opts = DEPARTMENTS[round.cartType] || [];
  departmentSelect.innerHTML = opts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");

  // preserve if still valid, else pick first
  if (!opts.includes(round.department)) {
    round.department = opts[0] || "";
  }
  departmentSelect.value = round.department;
}

/* ---------------------------
   Round meta
--------------------------- */
function renderRoundMeta() {
  const c = round.carts.length;
  roundMeta.textContent =
    c === 0
      ? "No carts added"
      : `${round.cartType} • ${round.department} • ${c} cart${c > 1 ? "s" : ""}`;
}

/* ---------------------------
   Add/Remove carts
--------------------------- */
function addCart(cartNo) {
  const cleaned = String(cartNo).trim();
  if (!cleaned) return;

  // duplicates within same round
  if (round.carts.some(c => c.cartNo === cleaned && c.department === round.department && c.cartType === round.cartType)) {
    cartNumberInput.value = "";
    cartNumberInput.placeholder = "Already added";
    return;
  }

  const cart = newCart(cleaned);
  round.carts.push(cart);

  cartNumberInput.value = "";
  cartNumberInput.placeholder = "Enter Cart # (manual)";

  renderAll();
}

function removeCart(index) {
  round.carts.splice(index, 1);
  renderAll();
}

/* ---------------------------
   Shift Toggle wiring
--------------------------- */
function wireShiftButtons(cart, cardEl) {
  const buttons = cardEl.querySelectorAll(".shiftBtn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const selected = btn.getAttribute("data-shift");
      cart.shift = selected;

      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      saveToLocal(); // small autosave
      renderNursingLog();
    });
  });

  if (cart.shift) {
    buttons.forEach(b => {
      if (b.getAttribute("data-shift") === cart.shift) b.classList.add("active");
    });
  }
}

/* ---------------------------
   Issue Note show/hide
--------------------------- */
function syncIssueUI(cart, cardEl) {
  const issueCheckbox = cardEl.querySelector(".issueCheckbox");
  const noteRow = cardEl.querySelector(".issueNoteRow");
  const noteInput = cardEl.querySelector(".issueNoteInput");

  const apply = () => {
    cart.issue = issueCheckbox.checked;
    if (cart.issue) {
      noteRow.classList.remove("hidden");
    } else {
      noteRow.classList.add("hidden");
      cart.issueNote = "";
      noteInput.value = "";
    }
    // highlight card outline
    cardEl.style.outline = cart.issue ? "4px solid rgba(244,162,27,.55)" : "none";

    saveToLocal();
    renderNursingLog();
  };

  issueCheckbox.addEventListener("change", apply);
  noteInput.addEventListener("input", () => {
    cart.issueNote = noteInput.value;
    saveToLocal();
    renderNursingLog();
  });

  // initial state
  issueCheckbox.checked = !!cart.issue;
  noteInput.value = cart.issueNote || "";
  apply();
}

/* ---------------------------
   Render cart cards
--------------------------- */
function cartCardHTML(cart, index) {
  return `
    <div class="cartCard" data-index="${index}">
      <div class="cartHeader">
        <div>
          <div class="cartTitle">Cart # ${escapeHtml(cart.cartNo)}</div>
          <div class="cartSub">${escapeHtml(cart.cartType)} • ${escapeHtml(cart.department)}</div>
        </div>
        <div class="cartActions noPrint">
          <button class="iconBtn removeBtn" title="Remove">✕</button>
        </div>
      </div>

      <section class="sticker sticker--lime">
        <div class="sticker__title">CRASH CART CHECK</div>
        <div class="sticker__rule"></div>

        <div class="formRow">
          <div class="label">First supply to expire:</div>
          <input class="underline supplyName" placeholder="—" value="${escapeHtml(cart.supplyName)}" />
        </div>

        <div class="formRow">
          <div class="label">Date:</div>
          <input class="underline supplyExp" type="date" value="${escapeHtml(cart.supplyExp)}" />
        </div>

        <div class="formRow">
          <div class="label">Check Date done:</div>
          <input class="underline checkDate" type="date" value="${escapeHtml(cart.checkDate)}" />
        </div>

        <div class="formRow">
          <div class="label">Checked by:</div>
          <input class="underline checkedBy" placeholder="Initials / Name" value="${escapeHtml(cart.checkedBy)}" />
        </div>

        <div class="shiftRow">
          <span class="shiftLabel">Shift:</span>
          <div class="shiftPills">
            <button type="button" class="shiftBtn" data-shift="Day">Day</button>
            <button type="button" class="shiftBtn" data-shift="Evening">Eve</button>
            <button type="button" class="shiftBtn" data-shift="Night">Night</button>
          </div>
        </div>

        <div class="issueRow">
          <label class="issueToggle">
            <input type="checkbox" class="issueCheckbox" ${cart.issue ? "checked" : ""} />
            <span>⚠️ Issue present</span>
          </label>
          <span class="issueHint">Stays included</span>
        </div>

        <div class="issueNoteRow ${cart.issue ? "" : "hidden"}">
          <input class="issueNoteInput" maxlength="60"
            placeholder="Optional note (e.g. seal broken, O2 low)"
            value="${escapeHtml(cart.issueNote || "")}"
          />
        </div>
      </section>

      <section class="sticker sticker--orange">
        <div class="sticker__titleSmall">Crash Cart Check</div>
        <div class="sticker__rule"></div>

        <div class="formRow">
          <div class="label">First Drug to Exp:</div>
          <input class="underline drugExp" type="date" value="${escapeHtml(cart.drugExp)}" />
        </div>

        <div class="formRow">
          <div class="label">Name of Drug:</div>
          <input class="underline drugName"
                 placeholder="—"
                 type="text"
                 autocomplete="off"
                 autocapitalize="words"
                 spellcheck="false"
                 value="${escapeHtml(cart.drugName)}" />
        </div>
      </section>
    </div>
  `;
}

function renderCartCards() {
  cartList.innerHTML = round.carts.map((c, i) => cartCardHTML(c, i)).join("");

  // Wire card events
  const cards = cartList.querySelectorAll(".cartCard");
  cards.forEach((cardEl) => {
    const idx = Number(cardEl.getAttribute("data-index"));
    const cart = round.carts[idx];

    // remove
    cardEl.querySelector(".removeBtn")?.addEventListener("click", () => {
      removeCart(idx);
    });

    // inputs
    const supplyName = cardEl.querySelector(".supplyName");
    const supplyExp = cardEl.querySelector(".supplyExp");
    const checkDate = cardEl.querySelector(".checkDate");
    const checkedBy = cardEl.querySelector(".checkedBy");
    const drugExp = cardEl.querySelector(".drugExp");
    const drugName = cardEl.querySelector(".drugName");

    supplyName.addEventListener("input", () => { cart.supplyName = supplyName.value; saveToLocal(); renderNursingLog(); });
    supplyExp.addEventListener("change", () => { cart.supplyExp = supplyExp.value; saveToLocal(); renderNursingLog(); });
    checkDate.addEventListener("change", () => { cart.checkDate = checkDate.value; saveToLocal(); renderNursingLog(); });
    checkedBy.addEventListener("input", () => { cart.checkedBy = checkedBy.value; saveToLocal(); renderNursingLog(); });

    drugExp.addEventListener("change", () => { cart.drugExp = drugExp.value; saveToLocal(); renderNursingLog(); });
    drugName.addEventListener("input", () => { cart.drugName = drugName.value; saveToLocal(); renderNursingLog(); });

    // shift
    wireShiftButtons(cart, cardEl);

    // issue + note
    syncIssueUI(cart, cardEl);
  });

  setLocked(isLocked);
}

/* ---------------------------
   Due Soon / Overdue logic
--------------------------- */
const DUE_SOON_DAYS = 30;

function parseISODate(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / ms);
}
function earliestDate(d1, d2) {
  if (!d1) return d2;
  if (!d2) return d1;
  return d1 <= d2 ? d1 : d2;
}

// Blank expiration => Due Soon (LOCKED)
function computeExpiryStatus(cart) {
  const today = startOfToday();
  const s = parseISODate(cart.supplyExp);
  const d = parseISODate(cart.drugExp);
  const next = earliestDate(s, d);

  if (!next) return { level: "dueSoon", pill: "⏰ Due Soon" };

  const daysLeft = daysBetween(today, next);
  if (daysLeft < 0) return { level: "overdue", pill: "❌ Overdue" };
  if (daysLeft <= DUE_SOON_DAYS) return { level: "dueSoon", pill: "⏰ Due Soon" };
  return { level: "ok", pill: "✅ OK" };
}

function computeNursingPill(cart) {
  const expiry = computeExpiryStatus(cart);
  if (cart.issue) return { level: "issue", pill: "⚠️ Issue" };
  return expiry;
}

function needsAttention(cart) {
  return computeNursingPill(cart).level !== "ok";
}

/* ---------------------------
   Nursing Log render
--------------------------- */
function groupByDepartment(rows) {
  const map = new Map();
  rows.forEach(r => {
    const dept = r.department || "Unassigned";
    if (!map.has(dept)) map.set(dept, []);
    map.get(dept).push(r);
  });
  return Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0]));
}

function renderNursingTable(targetEl, rows) {
  if (!targetEl) return;

  if (rows.length === 0) {
    targetEl.innerHTML = `<div style="color:rgba(234,242,247,.65); padding:10px;">No carts to display.</div>`;
    return;
  }

  const groups = groupByDepartment(rows);

  targetEl.innerHTML = groups.map(([dept, items]) => {
    const tableRows = items.map(cart => {
      const status = computeNursingPill(cart);
      const supplyExp = cart.supplyExp || "—";
      const drugExp = cart.drugExp || "—";
      const checkedBy = cart.checkedBy || "—";
      const checkDate = cart.checkDate || "—";
      const shift = cart.shift ? ` • ${cart.shift}` : "";
      const noteIcon = cart.issue && cart.issueNote ? " 📝" : "";

      return `
        <tr>
          <td>${escapeHtml(cart.cartNo || "—")}</td>
          <td>${escapeHtml(supplyExp)}</td>
          <td>${escapeHtml(drugExp)}</td>
          <td>${escapeHtml(checkedBy)} • ${escapeHtml(checkDate)}${escapeHtml(shift)}${noteIcon}</td>
          <td><span class="statusPill ${status.level}">${status.pill}</span></td>
        </tr>
      `;
    }).join("");

    // Only show group header if group has rows (it does)
    return `
      <div class="groupHeader">${escapeHtml(dept)}</div>
      <table class="nurseTable">
        <thead>
          <tr>
            <th>Cart #</th>
            <th>Central Exp</th>
            <th>Med Box Exp</th>
            <th>Checked By</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;
  }).join("");
}

function renderNursingLog() {
  if (!nursingLogContainer) return;

  // only show carts for selected cart type (round.cartType)
  const filtered = round.carts.filter(c => c.cartType === round.cartType);

  const rows = showAll ? filtered : filtered.filter(needsAttention);
  nursingMeta.textContent = showAll ? "Showing all carts" : "Needs attention only";

  renderNursingTable(nursingLogContainer, rows);
}

function renderNursingLogForPrint() {
  $("printCartType").textContent = round.cartType;
  $("printGeneratedAt").textContent = new Date().toLocaleString();

  const filtered = round.carts.filter(c => c.cartType === round.cartType);
  const rows = showAll ? filtered : filtered.filter(needsAttention);
  renderNursingTable(nursingLogPrintContainer, rows);
}

/* ---------------------------
   Local save / load
--------------------------- */
function saveToLocal() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(round));
  } catch {}
}

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);

    // basic shape validation
    if (!parsed || !parsed.cartType || !Array.isArray(parsed.carts)) return false;

    round = parsed;
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------
   Export JSON (pilot review)
--------------------------- */
function downloadJSON(data, filename = "verifi_pilot_export.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------
   Utilities
--------------------------- */
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------------------------
   Render everything
--------------------------- */
function renderAll() {
  renderDepartmentOptions();
  renderRoundMeta();
  renderCartCards();
  renderNursingLog();
}

/* ---------------------------
   Event wiring
--------------------------- */
cartTypeTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-type]");
  if (!btn) return;

  const newType = btn.getAttribute("data-type");
  round.cartType = newType;

  document.querySelectorAll("#cartTypeTabs .tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");

  // update department list and keep carts' type stable (existing carts retain their cartType)
  renderDepartmentOptions();
  saveToLocal();
  renderAll();
});

departmentSelect.addEventListener("change", () => {
  round.department = departmentSelect.value;

  // NOTE: carts already added keep the department they were created with (like paper)
  saveToLocal();
  renderAll();
});

addCartBtn.addEventListener("click", () => addCart(cartNumberInput.value));
cartNumberInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addCart(cartNumberInput.value);
});

clearRoundBtn.addEventListener("click", () => {
  if (!confirm("Clear this round (remove all carts from screen)?")) return;
  round.carts = [];
  saveToLocal();
  renderAll();
});

saveRoundBtn.addEventListener("click", () => {
  saveToLocal();
  alert("Round saved on this device.");
});

exportJsonBtn.addEventListener("click", () => {
  downloadJSON(round, `verifi_${round.cartType.replaceAll(" ", "_")}_export.json`);
});

showAllToggle.addEventListener("change", () => {
  showAll = showAllToggle.checked;
  renderNursingLog();
});

printPdfBtn.addEventListener("click", () => {
  renderNursingLogForPrint();
  window.print();
});

/* ---------------------------
   Init
--------------------------- */
(function init() {
  // load saved state if present
  loadFromLocal();

  // ensure department exists
  renderDepartmentOptions();
  if (!round.department) round.department = (DEPARTMENTS[round.cartType] || [])[0] || "";

  // set active tab
  document.querySelectorAll("#cartTypeTabs .tab").forEach(t => t.classList.remove("active"));
  document.querySelector(`#cartTypeTabs .tab[data-type="${CSS.escape(round.cartType)}"]`)?.classList.add("active");

  departmentSelect.value = round.department;

  renderAll();
  setLocked(false);
})();
