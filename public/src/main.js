const TYPE_LABELS = {
  IIT: "IITs",
  NIT: "NITs",
  IIIT: "IIITs",
};

const RANK_TYPE_ALLOWED = {
  advanced: new Set(["IIT"]),
  main: new Set(["NIT", "IIIT"]),
};

const TABLES = {
  possible: {
    title: "Most possible option",
    bodyId: "possibleBody",
    countId: "possibleCount",
    chartId: "possibleChart",
    collegeSet: "possibleInstitutes",
    branchSet: "possibleBranches",
    degreeSet: "possibleDegrees",
    collegeTouched: "possibleInstitutesTouched",
    branchTouched: "possibleBranchesTouched",
    degreeTouched: "possibleDegreesTouched",
    sortKey: "possibleSort",
  },
  chance: {
    title: "Chance",
    bodyId: "chanceBody",
    countId: "chanceCount",
    chartId: "chanceChart",
    collegeSet: "chanceInstitutes",
    branchSet: "chanceBranches",
    degreeSet: "chanceDegrees",
    collegeTouched: "chanceInstitutesTouched",
    branchTouched: "chanceBranchesTouched",
    degreeTouched: "chanceDegreesTouched",
    sortKey: "chanceSort",
  },
};

const COLOR_OPTIONS = [
  { value: "", label: "None" },
  { value: "green", label: "Green" },
  { value: "yellow", label: "Yellow" },
  { value: "red", label: "Red" },
  { value: "blue", label: "Blue" },
];

const state = {
  rows: [],
  selectedInstitutes: new Set(),
  selectedBranches: new Set(),
  possibleInstitutes: new Set(),
  possibleBranches: new Set(),
  possibleDegrees: new Set(),
  possibleInstitutesTouched: false,
  possibleBranchesTouched: false,
  possibleDegreesTouched: false,
  chanceInstitutes: new Set(),
  chanceBranches: new Set(),
  chanceDegrees: new Set(),
  chanceInstitutesTouched: false,
  chanceBranchesTouched: false,
  chanceDegreesTouched: false,
  possibleSort: { column: "openingRank", direction: "desc" },
  chanceSort: { column: "openingRank", direction: "desc" },
  rowColors: {},
};

const elements = {
  controlsGrid: document.querySelector("#controlsGrid"),
  rankTypeInput: document.querySelector("#rankTypeInput"),
  rankInput: document.querySelector("#rankInput"),
  rankRangeInput: document.querySelector("#rankRangeInput"),
  resetFilters: document.querySelector("#resetFilters"),
  exportCsv: document.querySelector("#exportCsv"),
};

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function rowKey(row) {
  return `${row.type}|${row.institute}|${row.branch}|${row.openingRank}|${row.closingRank}|${row.quota}|${row.seatType}|${row.gender}`;
}

function getDegreeType(programName) {
  const value = programName.toLowerCase();
  if (value.includes("dual degree")) return "Dual Degree";
  if (value.includes("bachelor of science")) return "Bachelor of Science";
  if (value.includes("bachelor of technology") || value.includes("b.tech")) return "Bachelor of Technology";
  return "Other";
}

function allowedTypes() {
  return RANK_TYPE_ALLOWED[elements.rankTypeInput.value] ?? RANK_TYPE_ALLOWED.advanced;
}

function isAllowedType(type) {
  return allowedTypes().has(type);
}

function allowedRows() {
  return state.rows.filter((row) => isAllowedType(row.type));
}

function closeTableMenus(exceptHost = null) {
  document.querySelectorAll(".table-filter").forEach((host) => {
    if (host !== exceptHost) {
      const menu = host.querySelector(".filter-menu");
      if (menu) menu.hidden = true;
    }
  });
}

function resetTableFilters() {
  ["possible", "chance"].forEach((tableName) => {
    const config = TABLES[tableName];
    state[config.collegeSet] = new Set();
    state[config.branchSet] = new Set();
    state[config.degreeSet] = new Set();
    state[config.collegeTouched] = false;
    state[config.branchTouched] = false;
    state[config.degreeTouched] = false;
  });
}

function syncRankTypeRestrictions() {
  const allowed = allowedTypes();
  const institutes = new Set(allowedRows().map((row) => row.institute));
  const branches = new Set(allowedRows().map((row) => row.branch));

  state.selectedInstitutes = new Set(
    [...state.selectedInstitutes].filter((institute) => institutes.has(institute)),
  );
  institutes.forEach((institute) => state.selectedInstitutes.add(institute));

  state.selectedBranches = new Set(
    [...state.selectedBranches].filter((branch) => branches.has(branch)),
  );
  branches.forEach((branch) => state.selectedBranches.add(branch));

  state.rows
    .filter((row) => !allowed.has(row.type))
    .forEach((row) => state.selectedInstitutes.delete(row.institute));
}

function makeCheckboxGroup(title, options, selectedSet, onChange, disabled = false) {
  const block = document.createElement("section");
  block.className = `filter-block${disabled ? " disabled-block" : ""}`;
  block.innerHTML = `
    <div class="filter-heading">
      <h2>${escapeHtml(title)}</h2>
      <span class="selected-count">${disabled ? "Blocked" : `${selectedSet.size}/${options.length}`}</span>
    </div>
    <div class="quick-actions">
      <button type="button" data-action="all" ${disabled ? "disabled" : ""}>Select all</button>
      <button type="button" data-action="none" ${disabled ? "disabled" : ""}>None</button>
    </div>
    <label class="mini-search">
      <span>Search</span>
      <input placeholder="Search ${escapeHtml(title)}" ${disabled ? "disabled" : ""} />
    </label>
    <div class="checkbox-list"></div>
  `;

  const list = block.querySelector(".checkbox-list");
  const count = block.querySelector(".selected-count");
  const search = block.querySelector("input");

  const renderOptions = () => {
    const query = search.value.trim().toLowerCase();
    const visible = options.filter((option) => option.toLowerCase().includes(query));
    list.innerHTML = visible
      .map(
        (option) => `
          <label class="check-row">
            <input type="checkbox" value="${escapeHtml(option)}" ${selectedSet.has(option) ? "checked" : ""} ${disabled ? "disabled" : ""} />
            <span>${escapeHtml(option)}</span>
          </label>
        `,
      )
      .join("");
    count.textContent = disabled ? "Blocked" : `${selectedSet.size}/${options.length}`;
  };

  block.querySelector('[data-action="all"]').addEventListener("click", () => {
    if (disabled) return;
    options.forEach((option) => selectedSet.add(option));
    resetTableFilters();
    onChange();
    renderOptions();
  });

  block.querySelector('[data-action="none"]').addEventListener("click", () => {
    if (disabled) return;
    options.forEach((option) => selectedSet.delete(option));
    resetTableFilters();
    onChange();
    renderOptions();
  });

  search.addEventListener("input", renderOptions);
  list.addEventListener("change", (event) => {
    if (disabled) return;
    if (event.target.checked) selectedSet.add(event.target.value);
    else selectedSet.delete(event.target.value);
    resetTableFilters();
    onChange();
    renderOptions();
  });

  renderOptions();
  return block;
}

function getCandidateRows(tableName) {
  const rankEntered = elements.rankInput.value !== "";
  const rank = rankEntered ? toNumber(elements.rankInput.value, 0) : 0;
  const range = Math.max(0, toNumber(elements.rankRangeInput.value, 0));
  const lowerChanceRank = rank - range;

  return state.rows
    .filter((row) => isAllowedType(row.type))
    .filter((row) => state.selectedInstitutes.has(row.institute))
    .filter((row) => state.selectedBranches.has(row.branch))
    .filter((row) => {
      if (!rankEntered) return tableName === "possible";
      if (tableName === "possible") return row.closingRank >= rank;
      return row.closingRank > lowerChanceRank && row.closingRank < rank;
    })
    .map((row) => ({ ...row, degreeType: getDegreeType(row.branch), gap: row.closingRank - rank }));
}

function sortRows(rows, tableName) {
  const sort = state[TABLES[tableName].sortKey];
  const direction = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const diff = a[sort.column] - b[sort.column];
    return diff === 0 ? b.closingRank - a.closingRank : diff * direction;
  });
}

function getFilteredRows(tableName) {
  const config = TABLES[tableName];
  const rows = getCandidateRows(tableName);
  const collegeFilterActive = state[config.collegeTouched] || state[config.collegeSet].size > 0;
  const branchFilterActive = state[config.branchTouched] || state[config.branchSet].size > 0;
  const degreeFilterActive = state[config.degreeTouched] || state[config.degreeSet].size > 0;
  return sortRows(
    rows
      .filter((row) => !collegeFilterActive || state[config.collegeSet].has(row.institute))
      .filter((row) => !branchFilterActive || state[config.branchSet].has(row.branch))
      .filter((row) => !degreeFilterActive || state[config.degreeSet].has(row.degreeType)),
    tableName,
  );
}

function renderControls() {
  elements.controlsGrid.innerHTML = "";
  Object.entries(TYPE_LABELS).forEach(([type, title]) => {
    const typeRows = state.rows.filter((row) => row.type === type);
    const options = uniqueSorted(typeRows.map((row) => row.institute));
    const disabled = !isAllowedType(type);
    if (disabled) options.forEach((option) => state.selectedInstitutes.delete(option));
    elements.controlsGrid.append(
      makeCheckboxGroup(title, options, state.selectedInstitutes, renderAllResults, disabled),
    );
  });

  elements.controlsGrid.append(
    makeCheckboxGroup(
      "Branches",
      uniqueSorted(allowedRows().map((row) => row.branch)),
      state.selectedBranches,
      renderAllResults,
    ),
  );
}

function renderTableFilter(tableName, kind, options, selectedSet, keepOpen = false) {
  const config = TABLES[tableName];
  const host = document.querySelector(`.table-filter[data-table="${tableName}"][data-filter="${kind}"]`);
  const label = kind === "college" ? "college" : kind;
  const touchedKey =
    kind === "college" ? config.collegeTouched : kind === "branch" ? config.branchTouched : config.degreeTouched;
  host.innerHTML = `
    <button type="button" aria-label="Filter ${label}">Filter v</button>
    <div class="filter-menu" ${keepOpen ? "" : "hidden"}>
      <label class="mini-search menu-search">
        <span>Search</span>
        <input placeholder="Filter ${label}" />
      </label>
      <div class="quick-actions">
        <button type="button" data-action="all">All</button>
        <button type="button" data-action="none">None</button>
      </div>
      <div class="menu-options"></div>
    </div>
  `;

  const button = host.querySelector(":scope > button");
  const menu = host.querySelector(".filter-menu");
  const search = host.querySelector("input");
  const optionList = host.querySelector(".menu-options");

  const renderOptions = () => {
    const query = search.value.trim().toLowerCase();
    const visible = options.filter((option) => option.toLowerCase().includes(query));
    optionList.innerHTML = visible
      .map(
        (option) => `
          <label class="check-row">
            <input type="checkbox" value="${escapeHtml(option)}" ${selectedSet.has(option) ? "checked" : ""} />
            <span>${escapeHtml(option)}</span>
          </label>
        `,
      )
      .join("");
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const shouldOpen = menu.hidden;
    closeTableMenus(host);
    menu.hidden = !shouldOpen;
  });

  menu.addEventListener("click", (event) => event.stopPropagation());
  search.addEventListener("input", renderOptions);

  host.querySelector('[data-action="all"]').addEventListener("click", () => {
    selectedSet.clear();
    options.forEach((option) => selectedSet.add(option));
    state[touchedKey] = true;
    renderAllResults({ closeMenus: false, keepOpen: { tableName, kind } });
  });

  host.querySelector('[data-action="none"]').addEventListener("click", () => {
    selectedSet.clear();
    state[touchedKey] = true;
    renderAllResults({ closeMenus: false, keepOpen: { tableName, kind } });
  });

  optionList.addEventListener("change", (event) => {
    if (event.target.checked) selectedSet.add(event.target.value);
    else selectedSet.delete(event.target.value);
    state[touchedKey] = true;
    renderAllResults({ closeMenus: false, keepOpen: { tableName, kind } });
  });

  renderOptions();
}

function colorSelect(row, index) {
  const key = rowKey(row);
  const value = state.rowColors[key] ?? "";
  const options = COLOR_OPTIONS.map(
    (option) => `<option value="${option.value}" ${value === option.value ? "selected" : ""}>${option.label}</option>`,
  ).join("");
  return `
    <div class="serial-cell">
      <span>${index + 1}</span>
      <select class="row-color-select" data-row-key="${escapeHtml(key)}" aria-label="Row color">${options}</select>
    </div>
  `;
}

function renderRows(tableName, rows) {
  const config = TABLES[tableName];
  const body = document.querySelector(`#${config.bodyId}`);
  document.querySelector(`#${config.countId}`).textContent = `${rows.length} matching programs`;

  if (!rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">No rows match the selected rank, colleges, branches, and degree filters.</td>
      </tr>
    `;
    return;
  }

  body.innerHTML = rows
    .map((row, index) => {
      const color = state.rowColors[rowKey(row)] || "";
      return `
        <tr class="${color ? `row-color-${color}` : ""}">
          <td>${colorSelect(row, index)}</td>
          <td>${escapeHtml(row.institute)}</td>
          <td>
            <strong>${escapeHtml(row.branch)}</strong>
            <span class="subline">${escapeHtml(row.degreeType)} / ${escapeHtml(row.quota)} / ${escapeHtml(row.seatType)} / ${escapeHtml(row.gender)}</span>
          </td>
          <td>${escapeHtml(row.degreeType)}</td>
          <td>${row.openingRank.toLocaleString("en-IN")}</td>
          <td>${row.closingRank.toLocaleString("en-IN")}</td>
          <td class="${row.gap < 0 ? "negative" : ""}">${row.gap.toLocaleString("en-IN")}</td>
        </tr>
      `;
    })
    .join("");
}

function updateSortButtons(tableName) {
  const sort = state[TABLES[tableName].sortKey];
  document.querySelectorAll(`.sort-button[data-table="${tableName}"]`).forEach((button) => {
    const column = button.dataset.sort;
    const label =
      column === "openingRank" ? "Opening rank" : column === "closingRank" ? "Closing rank" : "Gap";
    const direction = sort.column === column ? sort.direction : "desc";
    button.textContent = `${label} ${direction === "desc" ? "high to low" : "low to high"}`;
  });
}

function renderTable(tableName, keepOpen) {
  const config = TABLES[tableName];
  const candidates = getCandidateRows(tableName);
  const availableInstitutes = uniqueSorted(candidates.map((row) => row.institute));
  const availableBranches = uniqueSorted(candidates.map((row) => row.branch));
  const availableDegrees = uniqueSorted(candidates.map((row) => row.degreeType));

  if (!state[config.collegeTouched] && state[config.collegeSet].size === 0 && availableInstitutes.length) {
    state[config.collegeSet] = new Set(availableInstitutes);
  }
  if (!state[config.branchTouched] && state[config.branchSet].size === 0 && availableBranches.length) {
    state[config.branchSet] = new Set(availableBranches);
  }
  if (!state[config.degreeTouched] && state[config.degreeSet].size === 0 && availableDegrees.length) {
    state[config.degreeSet] = new Set(availableDegrees);
  }

  renderTableFilter(
    tableName,
    "college",
    availableInstitutes,
    state[config.collegeSet],
    keepOpen?.tableName === tableName && keepOpen?.kind === "college",
  );
  renderTableFilter(
    tableName,
    "branch",
    availableBranches,
    state[config.branchSet],
    keepOpen?.tableName === tableName && keepOpen?.kind === "branch",
  );
  renderTableFilter(
    tableName,
    "degree",
    availableDegrees,
    state[config.degreeSet],
    keepOpen?.tableName === tableName && keepOpen?.kind === "degree",
  );
  renderRows(tableName, getFilteredRows(tableName));
  updateSortButtons(tableName);
}

function countCollegesByBranch(rows, limit = 15) {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.branch)) map.set(row.branch, new Set());
    map.get(row.branch).add(row.institute);
  });
  const data = [...map.entries()]
    .map(([branch, colleges]) => ({ branch, count: colleges.size }))
    .sort((a, b) => b.count - a.count || a.branch.localeCompare(b.branch));
  return limit ? data.slice(0, limit) : data;
}

function renderChart(chartId, rows) {
  const host = document.querySelector(`#${chartId}`);
  const data = countCollegesByBranch(rows);
  renderChartData(host, data);
}

function renderChartData(host, data) {
  if (!data.length) {
    host.innerHTML = `<p class="empty-chart">No chart data for the selected filters.</p>`;
    return;
  }
  const max = Math.max(...data.map((item) => item.count));
  host.innerHTML = data
    .map(
      (item) => `
        <div class="bar-row">
          <span class="bar-label" title="${escapeHtml(item.branch)}">${escapeHtml(item.branch)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${(item.count / max) * 100}%"></div>
          </div>
          <strong>${item.count}</strong>
        </div>
      `,
    )
    .join("");
}

function renderCharts() {
  const possibleRows = getFilteredRows("possible");
  const chanceRows = getFilteredRows("chance");
  const possibleCounts = countCollegesByBranch(possibleRows, 0);
  const chanceCounts = countCollegesByBranch(chanceRows, 0);
  const combinedCounts = new Map();
  [...possibleCounts, ...chanceCounts].forEach((item) => {
    combinedCounts.set(item.branch, (combinedCounts.get(item.branch) || 0) + item.count);
  });
  const combinedData = [...combinedCounts.entries()]
    .map(([branch, count]) => ({ branch, count }))
    .sort((a, b) => b.count - a.count || a.branch.localeCompare(b.branch))
    .slice(0, 15);

  renderChart(TABLES.possible.chartId, possibleRows);
  renderChart(TABLES.chance.chartId, chanceRows);
  renderChartData(document.querySelector("#combinedChart"), combinedData);
}

function renderAllResults(options = {}) {
  if (options.closeMenus !== false) closeTableMenus();
  renderTable("possible", options.keepOpen);
  renderTable("chance", options.keepOpen);
  renderCharts();
}

function exportCsv() {
  const rows = [
    ...getFilteredRows("possible").map((row) => ({ ...row, table: "Most possible option" })),
    ...getFilteredRows("chance").map((row) => ({ ...row, table: "Chance" })),
  ];
  const header = ["Table", "S.No", "College", "Branch / Department", "Degree", "Opening Rank", "Closing Rank", "Gap", "Color"];
  const body = rows.map((row, index) => [
    row.table,
    index + 1,
    row.institute,
    row.branch,
    row.degreeType,
    row.openingRank,
    row.closingRank,
    row.gap,
    state.rowColors[rowKey(row)] || "",
  ]);
  const csv = [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "jossa-filtered-results.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function resetFilters() {
  elements.rankInput.value = "";
  elements.rankRangeInput.value = "500";
  syncRankTypeRestrictions();
  state.possibleSort = { column: "openingRank", direction: "desc" };
  state.chanceSort = { column: "openingRank", direction: "desc" };
  resetTableFilters();
  renderControls();
  renderAllResults();
}

function handleRankTypeChange() {
  syncRankTypeRestrictions();
  resetTableFilters();
  renderControls();
  renderAllResults();
}

["input", "change"].forEach((eventName) => {
  elements.rankInput.addEventListener(eventName, () => {
    resetTableFilters();
    renderAllResults();
  });
  elements.rankRangeInput.addEventListener(eventName, () => {
    resetTableFilters();
    renderAllResults();
  });
});

elements.rankTypeInput.addEventListener("change", handleRankTypeChange);

document.querySelectorAll(".sort-button").forEach((button) => {
  button.addEventListener("click", () => {
    const config = TABLES[button.dataset.table];
    const sort = state[config.sortKey];
    const column = button.dataset.sort;
    state[config.sortKey] = {
      column,
      direction: sort.column === column && sort.direction === "desc" ? "asc" : "desc",
    };
    renderAllResults();
  });
});

document.addEventListener("change", (event) => {
  if (!event.target.classList.contains("row-color-select")) return;
  const key = event.target.dataset.rowKey;
  state.rowColors[key] = event.target.value;
  renderAllResults();
});

document.addEventListener("click", () => closeTableMenus());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeTableMenus();
});
elements.resetFilters.addEventListener("click", resetFilters);
elements.exportCsv.addEventListener("click", exportCsv);

fetch("/data.json")
  .then((response) => response.json())
  .then((payload) => {
    state.rows = payload.rows;
    state.rows.forEach((row) => {
      row.degreeType = getDegreeType(row.branch);
    });
    resetFilters();
  })
  .catch(() => {
    Object.values(TABLES).forEach((config) => {
      document.querySelector(`#${config.bodyId}`).innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">Unable to load data.json.</td>
        </tr>
      `;
    });
  });
