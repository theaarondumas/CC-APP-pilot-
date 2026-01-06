/* ===========================
   Verifi Pilot — Feature Complete (NO LOCK)
   + Separate Nursing Screen (paper-style monthly log)
   =========================== */

const $ = (id) => document.getElementById(id);

const LOCAL_KEY_TECH = "verifi_pilot_round_v1";
const LOCAL_KEY_NURSE = "verifi_pilot_nurse_log_v1";

/* ---------------------------
   NAV (Tech / Nursing screens)
--------------------------- */
const techView = $("techView");
const nursingView = $("nursingView");
const navTech = $("navTech");
const navNursing = $("navNursing");

function showScreen(screen) {
  if (screen === "nursing") {
    techView.classList.add("hidden");
    nursingView.classList.remove("hidden");
    navTech.classList.remove("active");
    navNursing.classList.add("active");
  } else {
    nursingView.classList.add("hidden");
    techView.classList.remove("hidden");
    navNursing.classList.remove("active");
    navTech.classList.add("active");
  }
}

navTech.addEventListener("click", () => showScreen("tech"));
navNursing.addEventListener("click", () => showScreen("nursing"));

/* ===========================
   TECH MODULE (stickers)
=========================== */
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

let showAll = false;

let round = {
  cartType: "Adult – Towers",
  department: "",
  carts: []
};

// Department lists (from your paper sheets)
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
    supplyExp: "",
    checkDate: "",
    checkedBy: "",

    // Shift toggle
    shift: "",

    // Issue
    issue: false,
    issueNote: "",

    // Drug sticker
    drugExp: "",
    drugName: ""
  };
}

function renderDepartmentOptions() {
  const opts = DEPARTMENTS[round.cartType] || [];
  departmentSelect.innerHTML = opts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");

  if (!opts.includes(round.department)) {
    round.department = opts[0] || "";
  }
  departmentSelect.value = round.department;
}

function renderRoundMeta() {
  const c = round.carts.length;
  roundMeta.textContent =
    c === 0 ? "No carts added" : `${round.cartType} • ${round.department} • ${c} cart${c > 1 ? "s" : ""}`;
}

function addCart(cartNo) {
  const cleaned = String(cartNo).trim();
  if (!cleaned) return;

  const dup = round.carts.some(c =>
    c.cartNo === cleaned &&
    c.department === round.department &&
    c.cartType === round.cartType
  );
  if (dup) {
    cartNumberInput.value = "";
    cartNumberInput.placeholder = "Already added";
    return;
  }

  round.carts.push(newCart(cleaned));
  cartNumberInput.value = "";
  cartNumberInput.placeholder = "Enter Cart # (manual)";

  saveTechToLocal();
  renderTechAll();
}

function removeCart(index) {
  round.carts.splice(index, 1);
  saveTechToLocal();
  renderTechAll();
}

function wireShiftButtons(cart, cardEl) {
  const buttons = cardEl.querySelectorAll(".shiftBtn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const selected = btn.getAttribute("data-shift");
      cart.shift = selected;
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      saveTechToLocal();
      renderTechNursingLog();
    });
  });

  if (cart.shift) {
    buttons.forEach(b => {
      if (b.getAttribute("data-shift") === cart.shift) b.classList.add("active");
    });
  }
}

function syncIssueUI(cart, cardEl) {
  const issueCheckbox = cardEl.querySelector(".issueCheckbox");
  const noteRow = cardEl.querySelector(".issueNoteRow");
  const noteInput = cardEl.querySelector(".issueNoteInput");

  const apply = () => {
    cart.issue = issueCheckbox.checked;

    if (cart.issue) {
      noteRow.classList.remove("hidden");
      cardEl.style.outline = "4px solid rgba(244,162,27,.55)";
    } else {
      noteRow.classList.add("hidden");
      cart.issueNote = "";
      noteInput.value = "";
      cardEl.style.outline = "none";
    }

    saveTechToLocal();
    renderTechNursingLog();
  };

  issueCheckbox.addEventListener("change", apply);
  noteInput.addEventListener("input", () => {
    cart.issueNote = noteInput.value;
    saveTechToLocal();
    renderTechNursingLog();
  });

  issueCheckbox.checked = !!cart.issue;
  noteInput.value = cart.issueNote || "";
  apply();
}

function cartCardHTML(cart, index) {
  return `
    <div class="cartCard" data-index="${index}">
      <div class="cartHeader">
        <div>
          <div class="cartTitle">Cart # ${escapeHtml(cart.cartNo)}</div>
          <div class="cartSub">${escapeHtml(cart.cartType)} • ${escapeHtml(cart.department)}</div>
        </div>
        <div class="cartActions noPrint">
          <button class="iconBtn removeBtn" type="button" title="Remove">✕</button>
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
          <input class="underline drugName" placeholder="—" type="text"
            autocomplete="off" autocapitalize="words" spellcheck="false"
            value="${escapeHtml(cart.drugName)}" />
        </div>
      </section>
    </div>
  `;
}

function renderCartCards() {
  cartList.innerHTML = round.carts.map((c, i) => cartCardHTML(c, i)).join("");

  cartList.querySelectorAll(".cartCard").forEach((cardEl) => {
    const idx = Number(cardEl.getAttribute("data-index"));
    const cart = round.carts[idx];

    cardEl.querySelector(".removeBtn")?.addEventListener("click", () => removeCart(idx));

    const supplyName = cardEl.querySelector(".supplyName");
    const supplyExp = cardEl.querySelector(".supplyExp");
    const checkDate = cardEl.querySelector(".checkDate");
    const checkedBy = cardEl.querySelector(".checkedBy");
    const drugExp = cardEl.querySelector(".drugExp");
    const drugName = cardEl.querySelector(".drugName");

    supplyName.addEventListener("input", () => { cart.supplyName = supplyName.value; saveTechToLocal(); renderTechNursingLog(); });
    supplyExp.addEventListener("change", () => { cart.supplyExp = supplyExp.value; saveTechToLocal(); renderTechNursingLog(); });
    checkDate.addEventListener("change", () => { cart.checkDate = checkDate.value; saveTechToLocal(); renderTechNursingLog(); });
    checkedBy.addEventListener("input", () => { cart.checkedBy = checkedBy.value; saveTechToLocal(); renderTechNursingLog(); });

    drugExp.addEventListener("change", () => { cart.drugExp = drugExp.value; saveTechToLocal(); renderTechNursingLog(); });
    drugName.addEventListener("input", () => { cart.drugName = drugName.value; saveTechToLocal(); renderTechNursingLog(); });

    wireShiftButtons(cart, cardEl);
    syncIssueUI(cart, cardEl);
  });
}

/* ---- Tech due soon logic ---- */
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

// Blank expiration => Due Soon
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
        <tbody>${tableRows}</tbody>
      </table>
    `;
  }).join("");
}

function renderTechNursingLog() {
  const filtered = round.carts.filter(c => c.cartType === round.cartType);
  const rows = showAll ? filtered : filtered.filter(needsAttention);
  nursingMeta.textContent = showAll ? "Showing all carts" : "Needs attention only";
  renderNursingTable(nursingLogContainer, rows);
}

function renderTechNursingLogForPrint() {
  $("printCartType").textContent = round.cartType;
  $("printGeneratedAt").textContent = new Date().toLocaleString();
  const filtered = round.carts.filter(c => c.cartType === round.cartType);
  const rows = showAll ? filtered : filtered.filter(needsAttention);
  renderNursingTable(nursingLogPrintContainer, rows);
}

/* ---- Tech local save/load ---- */
function saveTechToLocal() {
  try { localStorage.setItem(LOCAL_KEY_TECH, JSON.stringify(round)); } catch {}
}
function loadTechFromLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_TECH);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.cartType || !Array.isArray(parsed.carts)) return false;
    round = parsed;
    return true;
  } catch { return false; }
}
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

/* ---- Tech render ---- */
function renderTechAll() {
  renderDepartmentOptions();
  renderRoundMeta();
  renderCartCards();
  renderTechNursingLog();
}

/* ---- Tech event wiring ---- */
cartTypeTabs.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-type]");
  if (!btn) return;

  round.cartType = btn.getAttribute("data-type");

  document.querySelectorAll("#cartTypeTabs .tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");

  renderDepartmentOptions();
  saveTechToLocal();
  renderTechAll();
});

departmentSelect.addEventListener("change", () => {
  round.department = departmentSelect.value;
  saveTechToLocal();
  renderTechAll();
});

addCartBtn.addEventListener("click", () => addCart(cartNumberInput.value));
cartNumberInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addCart(cartNumberInput.value);
});

clearRoundBtn.addEventListener("click", () => {
  if (!confirm("Clear this round (remove all carts from screen)?")) return;
  round.carts = [];
  saveTechToLocal();
  renderTechAll();
});

saveRoundBtn.addEventListener("click", () => {
  saveTechToLocal();
  alert("Tech round saved on this device.");
});

exportJsonBtn.addEventListener("click", () => {
  downloadJSON(round, `verifi_${round.cartType.replaceAll(" ", "_")}_export.json`);
});

showAllToggle.addEventListener("change", () => {
  showAll = showAllToggle.checked;
  renderTechNursingLog();
});

printPdfBtn.addEventListener("click", () => {
  renderTechNursingLogForPrint();
  window.print();
});

/* ===========================
   NURSING MODULE (paper-style)
=========================== */
const nurseUnitName = $("nurseUnitName");
const nurseMonth = $("nurseMonth");
const nurseAddRowBtn = $("nurseAddRowBtn");
const nurseSaveBtn = $("nurseSaveBtn");
const nursePrintBtn = $("nursePrintBtn");
const nurseClearBtn = $("nurseClearBtn");
const nurseTableWrap = $("nurseTableWrap");
const nursePrintTableWrap = $("nursePrintTableWrap");
const nursePaperMeta = $("nursePaperMeta");

let nurseLog = {
  unitName: "",
  month: "", // YYYY-MM
  rows: []   // array of day rows
};

// Mirrors your paper columns (digitized)
const NURSE_COLS = [
  { key:"day", label:"Day" },
  { key:"lockNo", label:"Cart Lock #" },
  { key:"sealed", label:"Cart Sealed" },
  { key:"plugged", label:"Cart Plugged" },
  { key:"defib", label:"Defib Test" },
  { key:"supplyExpPresent", label:"Supplies Exp Date Present" },
  { key:"medExpPresent", label:"Med Drawer Exp Date Present" },
  { key:"contents", label:"Contents Listed" },
  { key:"suction", label:"Suction OK" },
  { key:"o2", label:"O₂ Green Zone" },
  { key:"signature", label:"Signature" }
];

function todayDayOfMonth() {
  return String(new Date().getDate());
}

function newNurseRow(day) {
  return {
    day: day || todayDayOfMonth(),
    lockNo: "",
    sealed: false,
    plugged: false,
    defib: false,
    supplyExpPresent: false,
    medExpPresent: false,
    contents: false,
    suction: false,
    o2: false,
    signature: ""
  };
}

function saveNurseToLocal() {
  nurseLog.unitName = nurseUnitName.value || "";
  nurseLog.month = nurseMonth.value || "";
  try { localStorage.setItem(LOCAL_KEY_NURSE, JSON.stringify(nurseLog)); } catch {}
  nursePaperMeta.textContent = `Saved • ${nurseLog.rows.length} row(s)`;
}

function loadNurseFromLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_NURSE);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.rows)) return false;
    nurseLog = parsed;
    return true;
  } catch { return false; }
}

function renderNurseTable(targetEl, rows, isPrint=false) {
  const th = NURSE_COLS.map(c => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows.map((r, idx) => {
    const tds = NURSE_COLS.map(col => {
      if (col.key === "day") {
        return isPrint
          ? `<td>${escapeHtml(r.day)}</td>`
          : `<td><input class="paperInput" data-i="${idx}" data-k="day" value="${escapeHtml(r.day)}" /></td>`;
      }
      if (col.key === "lockNo" || col.key === "signature") {
        return isPrint
          ? `<td>${escapeHtml(r[col.key] || "")}</td>`
          : `<td><input class="paperInput" data-i="${idx}" data-k="${col.key}" value="${escapeHtml(r[col.key] || "")}" /></td>`;
      }

      // checkboxes
      return isPrint
        ? `<td>${r[col.key] ? "Y" : ""}</td>`
        : `<td><input class="paperChk" type="checkbox" data-i="${idx}" data-k="${col.key}" ${r[col.key] ? "checked" : ""} /></td>`;
    }).join("");

    return `<tr>${tds}</tr>`;
  }).join("");

  const table = `
    <table class="paperTable">
      <thead><tr>${th}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;

  targetEl.innerHTML = table;

  if (isPrint) return;

  // wire inputs
  targetEl.querySelectorAll("input.paperInput").forEach(inp => {
    inp.addEventListener("input", () => {
      const i = Number(inp.getAttribute("data-i"));
      const k = inp.getAttribute("data-k");
      nurseLog.rows[i][k] = inp.value;
      saveNurseToLocal();
    });
  });

  targetEl.querySelectorAll("input.paperChk").forEach(chk => {
    chk.addEventListener("change", () => {
      const i = Number(chk.getAttribute("data-i"));
      const k = chk.getAttribute("data-k");
      nurseLog.rows[i][k] = chk.checked;
      saveNurseToLocal();
    });
  });
}

function renderNurseAll() {
  nurseUnitName.value = nurseLog.unitName || "";
  nurseMonth.value = nurseLog.month || "";

  renderNurseTable(nurseTableWrap, nurseLog.rows, false);
}

nurseAddRowBtn.addEventListener("click", () => {
  nurseLog.rows.unshift(newNurseRow(todayDayOfMonth())); // newest on top
  saveNurseToLocal();
  renderNurseAll();
});

nurseSaveBtn.addEventListener("click", () => {
  saveNurseToLocal();
  alert("Nursing log saved on this device.");
});

nurseClearBtn.addEventListener("click", () => {
  if (!confirm("Clear nursing log for this month?")) return;
  nurseLog.rows = [];
  saveNurseToLocal();
  renderNurseAll();
});

nursePrintBtn.addEventListener("click", () => {
  $("nursePrintUnit").textContent = nurseUnitName.value || "—";
  $("nursePrintMonth").textContent = nurseMonth.value || "—";
  renderNurseTable(nursePrintTableWrap, nurseLog.rows, true);

  // show print block (CSS print handles it)
  window.print();
});

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
   Init
--------------------------- */
(function init() {
  // tech
  loadTechFromLocal();
  renderDepartmentOptions();
  if (!round.department) round.department = (DEPARTMENTS[round.cartType] || [])[0] || "";
  document.querySelectorAll("#cartTypeTabs .tab").forEach(t => t.classList.remove("active"));
  document.querySelector(`#cartTypeTabs .tab[data-type="${CSS.escape(round.cartType)}"]`)?.classList.add("active");
  departmentSelect.value = round.department;
  renderTechAll();

  // nursing
  loadNurseFromLocal();

  // default month to current if empty
  if (!nurseLog.month) {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    nurseLog.month = `${now.getFullYear()}-${mm}`;
  }
  renderNurseAll();

  // start on tech
  showScreen("tech");
})();
