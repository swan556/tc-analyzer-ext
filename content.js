let analysisWindow;
let analysisContent;
let footerBar;
let lastPromptString = "";

(function injectButton() {
  console.log("CONTENT SCRIPT LOADED");
  if (document.getElementById("lc-llm-analyze-btn")) return;

  const btn = document.createElement("button");
  makeDraggable(btn, btn);

  btn.id = "lc-llm-analyze-btn";
  btn.textContent = "⚡︎ Analyze";
  Object.assign(btn.style, {
    position: "fixed",
    top: "12px",
    right: "12px",
    padding: "8px 16px",
    borderRadius: "8px",
    background: "linear-gradient(90deg, #6f16ff, #4823d0)", // LeetCode Orange
    color: "#ffffff", // Dark text for contrast
    border: "none",
    zIndex: "999999",
    cursor: "pointer",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontWeight: "bold",
    // boxShadow: "0 4px 14px rgba(255, 161, 22, 0.3)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  });

  // --- Helper to extract LeetCode Data ---
  function extractLeetCodeData() {
    let code = "";
    let problemText = "Problem text not found.";
    let constraintText = "Constraints not found.";

    // 1. Extract Code
    const monacoView = document.querySelector(".view-lines");
    if (monacoView) {
      code = Array.from(monacoView.querySelectorAll(".view-line"))
        .map((l) => l.innerText)
        .join("\n");
    }

    // 2. Extract Problem Statement and Constraints
    // LeetCode usually stores the main description inside a div with this data attribute
    const descContainer = document.querySelector(
      '[data-track-load="description_content"]',
    );
    if (descContainer) {
      const fullText = descContainer.innerText;

      // Split the text at the "Constraints:" header if it exists
      const parts = fullText.split("Constraints:");
      problemText = parts[0].trim();

      if (parts.length > 1) {
        constraintText = parts[1].trim();
      }
    }

    return { code, problemText, constraintText };
  }

  btn.onclick = async () => {
    console.log("Extracting data from LeetCode...");

    const { code, problemText, constraintText } = extractLeetCodeData();

    if (!code || code.trim().length < 3) {
      console.log("Could not read code. Ensure the editor is visible.");
      return;
    }

    // Creating the EXACT JSON structure you requested
    const llmInputPayload = {
      problemText: problemText,
      constraintText: constraintText,
      code: code,
    };

    // We stringify it because the LLM expects a single string prompt in the 'content' field
    const promptString = JSON.stringify(llmInputPayload, null, 2);

    console.log("Sending to Mistral Agent...");
    lastPromptString = promptString;
    chrome.runtime.sendMessage(
      { action: "analyze", prompt: promptString },
      (resp) => {
        if (chrome.runtime.lastError) {
          console.log("Extension Error: " + chrome.runtime.lastError.message);
          return;
        }
        if (!resp) {
          console.log("No response from background script.");
          return;
        }
        if (resp.error) {
          console.log("API Error: " + resp.error);
          return;
        }

        try {
          const cleanJson = resp.result
            .replace(/^```json\s*/i, "")
            .replace(/```$/i, "")
            .trim();

          const analysis = JSON.parse(cleanJson);

          console.log("Parsed analysis:", analysis);

          renderAnalysis(analysis);
        } catch (err) {
          console.error("JSON Parse Error:", err);
        }
      },
    );
  };
  createAnalysisWindow();
  document.body.appendChild(btn);
})();

function createAnalysisWindow() {
  analysisWindow = document.createElement("div");

  Object.assign(analysisWindow.style, {
    display: "none",
    flexDirection: "column",
    position: "fixed",
    top: "80px",
    right: "20px",
    width: "520px",
    maxHeight: "80vh",
    background: "#282828", // LeetCode editor dark background
    color: "#eff1f6", // LeetCode standard text color
    border: "1px solid #3e3e3e",
    resize: "both",
    borderRadius: "12px",
    zIndex: "999999",
    boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  });

  const header = document.createElement("div");

  Object.assign(header.style, {
    padding: "16px",
    background: "#1e1e1e", // Slightly darker for header
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "move",
    borderTopLeftRadius: "12px",
    borderTopRightRadius: "12px",
    borderBottom: "1px solid #3e3e3e",
  });

  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <strong style="font-size: 15px; font-weight: 600; color: #eff1f6;">Code Breakdown</strong>
    </div>
    <button id="lc-close-btn" style="background:transparent; border:none; color:#8a8a8a; cursor:pointer; font-size:16px; padding:4px; transition:color 0.2s;">✕</button>
  `;

  analysisContent = document.createElement("div");

  Object.assign(analysisContent.style, {
    padding: "20px",
    overflowY: "auto",
    flex: "1",
  });

  footerBar = document.createElement("div");

  Object.assign(footerBar.style, {
    padding: "12px 20px",
    background: "#1e1e1e",
    borderBottomLeftRadius: "12px",
    borderBottomRightRadius: "12px",
    borderTop: "1px solid #3e3e3e",
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
  });

  analysisWindow.appendChild(header);
  analysisWindow.appendChild(analysisContent);
  analysisWindow.appendChild(footerBar);

  document.body.appendChild(analysisWindow);

  document.getElementById("lc-close-btn").onclick = () => {
    analysisWindow.style.display = "none";
  };

  makeDraggable(analysisWindow, header);

  // Add a small style block to handle details/summary styling elegantly
  const styleBlock = document.createElement("style");
  styleBlock.textContent = `
    .lc-details-box { margin-bottom: 12px; background: #333333; border-radius: 8px; border: 1px solid #444; overflow: hidden; }
    .lc-details-box summary { padding: 12px 16px; font-weight: 600; cursor: pointer; user-select: none; color: #eff1f6; font-size: 14px; outline: none; transition: background 0.2s; }
    .lc-details-box summary:hover { background: #3e3e3e; }
    .lc-details-content { padding: 16px; border-top: 1px solid #444; font-size: 13px; color: #acacac; line-height: 1.6; }
    .lc-action-btn { background: #333; border: 1px solid #444; color: #eff1f6; padding: 8px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; transition: all 0.2s; }
    .lc-action-btn:hover { background: #444; border-color: #555; }
    .lc-action-btn svg { width: 16px; height: 16px; }
  `;
  document.head.appendChild(styleBlock);
}

function makeDraggable(element, handle) {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener("mousedown", (e) => {
    // Only drag if left click
    if (e.button !== 0) return;

    // Ignore drag if clicking on the close button
    if (e.target.id === "lc-close-btn") return;

    isDragging = true;

    const rect = element.getBoundingClientRect();

    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    element.style.left = rect.left + "px";
    element.style.top = rect.top + "px";
    element.style.right = "auto";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    element.style.left = e.clientX - offsetX + "px";
    element.style.top = e.clientY - offsetY + "px";
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}

function getVerdictColor(isOptimal) {
  return isOptimal ? "#2cbb5d" : "#ef4743"; // LeetCode Green & Red
}

function getTleColor(tle) {
  const value = tle.toLowerCase();

  if (value.includes("no")) return "#2cbb5d";
  if (value.includes("high")) return "#ffa116"; // LeetCode Orange

  return "#ef4743";
}

function createCostAuditTable(audit) {
  return `
    <table style="
      width:100%;
      border-collapse:collapse;
      font-size:13px;
      color:#acacac;
    ">
      <thead>
        <tr>
          <th style="text-align:left;padding:10px;border-bottom:1px solid #444;color:#eff1f6;font-weight:600;">Code Snippet</th>
          <th style="text-align:left;padding:10px;border-bottom:1px solid #444;color:#eff1f6;font-weight:600;">Time</th>
          <th style="text-align:left;padding:10px;border-bottom:1px solid #444;color:#eff1f6;font-weight:600;">Space</th>
        </tr>
      </thead>
      <tbody>
        ${audit
          .map(
            (item) => `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #3e3e3e;font-family:monospace;color:#ffa116;">
              ${item.code_segment}
            </td>
            <td style="padding:10px;border-bottom:1px solid #3e3e3e;">
              ${item.exact_time_cost_contribution}
            </td>
            <td style="padding:10px;border-bottom:1px solid #3e3e3e;">
              ${item.exact_space_cost_contribution}
            </td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderAnalysis(a) {
  analysisWindow.style.display = "flex";

  const verdictText = a.approach_evaluation.is_optimal
    ? "Optimal"
    : "Not Optimal";

  const verdictColor = getVerdictColor(a.approach_evaluation.is_optimal);

  const tleColor = getTleColor(a.worst_case_execution_estimate.will_it_tle);

  analysisContent.innerHTML = `
    <div style="
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
      margin-bottom:20px;
    ">

      <div style="
        background:#333333;
        padding:16px;
        border-radius:10px;
        border:1px solid #444;
      ">
        <div style="font-size:12px;color:#8a8a8a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
          Time Complexity
        </div>
        <div style="font-size:22px;font-weight:bold;color:#eff1f6;font-family:monospace;">
          ${a.asymptotic_complexity.time_complexity_big_o}
        </div>
      </div>

      <div style="
        background:#333333;
        padding:16px;
        border-radius:10px;
        border:1px solid #444;
      ">
        <div style="font-size:12px;color:#8a8a8a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
          Space Complexity
        </div>
        <div style="font-size:22px;font-weight:bold;color:#eff1f6;font-family:monospace;">
          ${a.asymptotic_complexity.space_complexity_big_o}
        </div>
      </div>

      <div style="
        background:#333333;
        padding:16px;
        border-radius:10px;
        border:1px solid #444;
      ">
        <div style="font-size:12px;color:#8a8a8a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
          Good to Go?
        </div>
        <div style="
          font-size:18px;
          font-weight:600;
          color:${verdictColor};
        ">
          ${verdictText}
        </div>
      </div>

      <div style="
        background:#333333;
        padding:16px;
        border-radius:10px;
        border:1px solid #444;
      ">
        <div style="font-size:12px;color:#8a8a8a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
          Timeout Risk
        </div>
        <div style="
          font-size:18px;
          font-weight:600;
          color:${tleColor};
        ">
          ${a.worst_case_execution_estimate.will_it_tle}
        </div>
      </div>
    </div>

    <div style="
      background:#333333;
      padding:16px;
      border-radius:10px;
      border:1px solid #444;
      margin-bottom:20px;
      border-left: 4px solid #ffa116;
    ">
      <div style="font-size:12px;color:#8a8a8a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
        Pro Tip
      </div>
      <div style="font-size:15px;color:#eff1f6;line-height:1.5;">
        ${a.approach_evaluation.optimal_method_recommended}
      </div>
    </div>

    <details class="lc-details-box">
      <summary>What we're working with (Constraints)</summary>
      <div class="lc-details-content">
        <div style="margin-bottom:8px;">
          <strong style="color:#eff1f6;">Variables:</strong>
          <span style="font-family:monospace; color:#ffa116;">${a.problem_constraints_extracted.variables.join(", ")}</span>
        </div>
        <div>
          <strong style="color:#eff1f6;">Maximum Bounds:</strong>
          <span style="font-family:monospace; color:#ffa116;">${a.problem_constraints_extracted.max_bounds.join(", ")}</span>
        </div>
      </div>
    </details>

    <details class="lc-details-box">
      <summary>Line-by-line breakdown</summary>
      <div class="lc-details-content" style="padding:0;">
        ${createCostAuditTable(a.block_by_block_cost_audit)}
      </div>
    </details>

    <details class="lc-details-box">
      <summary>The math behind it</summary>
      <div class="lc-details-content">
        <p style="margin-bottom:4px;"><strong style="color:#eff1f6;">Exact Time Formula</strong></p>
        <code style="display:block; padding:8px; background:#1e1e1e; border-radius:6px; margin-bottom:12px; color:#ffa116;">
          ${a.exact_performance_formulas.exact_time_formula}
        </code>

        <p style="margin-bottom:4px;"><strong style="color:#eff1f6;">Exact Space Formula</strong></p>
        <code style="display:block; padding:8px; background:#1e1e1e; border-radius:6px; margin-bottom:12px; color:#ffa116;">
          ${a.exact_performance_formulas.exact_space_formula}
        </code>

        <p style="margin-bottom:4px;"><strong style="color:#eff1f6;">Maximum Operations Estimate</strong></p>
        <code style="display:block; padding:8px; background:#1e1e1e; border-radius:6px; color:#ffa116;">
          ${a.worst_case_execution_estimate.max_calculated_operations}
        </code>
      </div>
    </details>

    <details class="lc-details-box">
      <summary>Tips to make it better</summary>
      <div class="lc-details-content" style="white-space: pre-line;">
        ${a.detailed_optimization_feedback}
      </div>
    </details>
  `;

  // Replaced unicode characters with clean SVG icons in the buttons
  footerBar.innerHTML = `
  <button id="copy-analysis-btn" class="lc-action-btn">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    Copy Summary
  </button>

  <button id="reanalyze-btn" class="lc-action-btn">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"></polyline>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
    </svg>
    Re-Analyze
  </button>
  
  <button id="close-analysis-btn" style="display:none;"></button> `;

  document.getElementById("copy-analysis-btn").onclick = () => {
    const summary = `
Time Complexity: ${a.asymptotic_complexity.time_complexity_big_o}
Space Complexity: ${a.asymptotic_complexity.space_complexity_big_o}
Verdict: ${verdictText}
Recommended: ${a.approach_evaluation.optimal_method_recommended}
TLE Risk: ${a.worst_case_execution_estimate.will_it_tle}
`;

    navigator.clipboard.writeText(summary);

    // Quick visual feedback that it copied
    const btn = document.getElementById("copy-analysis-btn");
    const originalText = btn.innerHTML;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#2cbb5d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2000);
  };

  document.getElementById("close-analysis-btn").onclick = () => {
    analysisWindow.style.display = "none";
  };

  document.getElementById("reanalyze-btn").onclick = () => {
    document.getElementById("lc-llm-analyze-btn").click();
  };
}
