const LOGIN_FIELD_PATTERN = /password|captcha|otp|login|user id/i;
const FORM_URL_PATTERN = /admin-mkp|catalog|offering|product/i;
const MANUAL_CLASS = "acxxel-gem-manual-field";
let activeJob = null;
let activePayloadSignature = "";
let fillTimer = null;
let lastReport = "";
let filling = false;
let completedFields = new Set();
let attemptedFields = new Set();
let fieldAttempts = new Map();
let manuallyEditedFields = new Set();
let mrpDocumentRequested = false;
let mrpDocumentUploaded = false;
let bisDocumentRequested = false;
let bisDocumentUploaded = false;
let productImagesRequested = false;
let productImagesUploaded = false;
let productImageSlotsUploaded = new Set();

function runtimeAvailable() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

function sendRuntimeMessage(message, callback = () => {}) {
  if (!runtimeAvailable()) return false;
  try {
    chrome.runtime.sendMessage(message, (response) => {
      // Reading lastError prevents Chrome from logging an unhandled callback error.
      if (chrome.runtime.lastError) return;
      callback(response);
    });
    return true;
  } catch {
    return false;
  }
}

function requestRuntimeMessage(message) {
  return new Promise((resolve) => {
    const sent = sendRuntimeMessage(message, (response) => resolve(response));
    if (!sent) resolve({ ok: false });
  });
}

function visible(element) {
  return Boolean(element && element.getClientRects().length && !element.disabled);
}

function controlText(control) {
  const id = control.id || "";
  const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
  const container = control.closest(".form-group, .row, td, fieldset, div");
  return `${label?.textContent || ""} ${control.name || ""} ${id} ${control.placeholder || ""} ${container?.textContent?.slice(0, 250) || ""}`.trim();
}

function candidateControls() {
  return [...document.querySelectorAll(
    "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]), select, textarea, [role=combobox]"
  )].filter((control) => visible(control) && !LOGIN_FIELD_PATTERN.test(controlText(control)));
}

function controlNearText(control, pattern) {
  let node = control;
  for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
    const text = String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length < 1200 && pattern.test(text)) return true;
  }
  return false;
}

function checkboxNearText(pattern) {
  return candidateControls().find((control) => (
    control.type === "checkbox" && controlNearText(control, pattern)
  )) || null;
}

function checkboxInFieldsetContaining(pattern) {
  return [...document.querySelectorAll("fieldset")].map((fieldset) => ({
    fieldset,
    text: String(fieldset.innerText || fieldset.textContent || "")
      .replace(/\s+/g, " ")
      .trim(),
  })).filter(({ text }) => pattern.test(text)).map(({ fieldset }) => (
    [...fieldset.querySelectorAll("input[type='checkbox']")]
      .find((control) => !control.disabled && controlNearText(control, /select all/i))
  )).find(Boolean) || null;
}

function selectAllCheckboxes() {
  return candidateControls().filter((control) => (
    control.type === "checkbox"
    && String(controlText(control)).replace(/\s+/g, " ").trim().toLowerCase() === "select all"
  ));
}

function monitorSelectAllCheckbox() {
  const checkboxes = selectAllCheckboxes();
  return checkboxes[checkboxes.length - 1] || null;
}

function monitorPortControl() {
  const checkbox = monitorSelectAllCheckbox();
  let node = checkbox?.parentElement;
  for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
    const container = node.querySelector(".ui-select-container");
    const control = container?.querySelector(
      "input:not([type='hidden']), [role='combobox'], .ui-select-toggle"
    );
    if (control) return control;
  }
  return null;
}

function uncheckedSelectAllCheckbox() {
  const checkboxes = selectAllCheckboxes();
  return checkboxes.find((control) => !control.checked)
    || checkboxes[checkboxes.length - 1]
    || null;
}

function checkboxForExactVisibleText(wantedText) {
  const wanted = String(wantedText).toLowerCase().replace(/\s+/g, " ").trim();
  const checkboxes = [...document.querySelectorAll("input[type='checkbox']")]
    .filter((item) => !item.disabled);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();
  while (textNode) {
    const text = String(textNode.textContent || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (text === wanted) {
      let element = textNode.parentElement;
      for (let depth = 0; element && depth < 5; depth += 1, element = element.parentElement) {
        if (element.matches("label") && element.htmlFor) {
          const labelled = document.getElementById(element.htmlFor);
          if (labelled?.matches("input[type='checkbox']") && !labelled.disabled) {
            return labelled;
          }
        }
        const contained = checkboxes.find((control) => element.contains(control));
        if (contained) return contained;
        const sibling = element.previousElementSibling;
        if (sibling?.matches?.("input[type='checkbox']") && !sibling.disabled) {
          return sibling;
        }
        const tableCell = element.closest("td");
        const cellCheckbox = tableCell?.querySelector("input[type='checkbox']");
        if (cellCheckbox && !cellCheckbox.disabled) return cellCheckbox;
      }
    }
    textNode = walker.nextNode();
  }
  return null;
}

function graphicsSectionControl(labelText) {
  const legends = [...document.querySelectorAll("legend")];
  const legend = legends.find((item) => (
    String(item.textContent || "").replace(/\s+/g, " ").trim().toLowerCase() === "graphics"
  ));
  const section = legend?.closest("fieldset") || legend?.parentElement;
  if (!section) return null;
  const customSelects = [...section.querySelectorAll(".ui-select-container")]
    .filter((item) => item.getClientRects().length);
  const index = /graphics type/i.test(labelText) ? 0 : 1;
  const container = customSelects[index];
  if (!container) return null;
  return container.querySelector(
    "input:not([type='hidden']), [role='combobox'], .ui-select-toggle"
  );
}

function fieldByLabel(labelText, selector = "") {
  if (selector) {
    const direct = document.querySelector(selector);
    return visible(direct) ? direct : null;
  }
  if (/make in india declaration/i.test(labelText)) {
    return checkboxNearText(
      /confirmed that the offered product is having local content/i
    );
  }
  if (/manufactured by us as ppp-mse oem/i.test(labelText)) {
    const radios = candidateControls().filter((control) => (
      control.type === "radio" && control.name === "mse_valid"
    ));
    return radios.find((control) => (
      /^(?:yes|true|1)$/i.test(String(control.value || ""))
      || controlNearText(control, /^\s*yes\b/i)
    )) || radios[0] || null;
  }
  if (/^ppp-mse declaration$/i.test(labelText)) {
    return checkboxNearText(/ppp-mse declaration/i);
  }
  if (/manufactured by us as startup/i.test(labelText)) {
    const radios = candidateControls().filter((control) => (
      control.type === "radio" && control.name === "startup_valid"
    ));
    return radios.find((control) => (
      /dpiit/i.test(String(control.value || control.getAttribute("aria-label") || ""))
      || controlNearText(control, /dpiit registered startup/i)
    )) || radios[0] || null;
  }
  if (/^startup declaration$/i.test(labelText)) {
    return checkboxNearText(/startup declaration/i);
  }
  if (/ppp-mse oem manufacturer/i.test(labelText)) {
    return candidateControls().find((control) => (
      control.type === "checkbox"
      && Boolean(control.closest("table"))
      && /laps n tabs technology private limited/i.test(
        control.closest("tr")?.innerText || control.closest("table")?.innerText || ""
      )
    )) || null;
  }
  if (/offering state.*uttar pradesh/i.test(labelText)) {
    return checkboxForExactVisibleText("Uttar Pradesh");
  }
  if (/^audio interface type$/i.test(labelText)) {
    return checkboxForExactVisibleText("Select All");
  }
  if (/^monitor port$/i.test(labelText)) {
    return monitorPortControl();
  }
  if (
    /^graphics type$/i.test(labelText)
    || /size of memory in case of dedicated graphic card/i.test(labelText)
  ) {
    const graphicsControl = graphicsSectionControl(labelText);
    if (graphicsControl) return graphicsControl;
  }
  const normalizeLabel = (text) => String(text || "")
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const wanted = normalizeLabel(labelText);
  const allControls = candidateControls();
  let labelNodes = [...document.querySelectorAll("label, span, p, td, div")].filter((node) => {
    if (!visible(node)) return false;
    const ownText = [...node.childNodes]
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent)
      .join(" ")
      .trim();
    const normalized = normalizeLabel(ownText);
    return normalized
      && normalized.length < 180
      && (wanted !== "product name" || normalized === wanted)
      && (normalized.includes(wanted) || wanted.includes(normalized));
  });
  const exactLabelNodes = labelNodes.filter((node) => {
    const ownText = [...node.childNodes]
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent)
      .join(" ");
    return normalizeLabel(ownText) === wanted;
  });
  if (exactLabelNodes.length) labelNodes = exactLabelNodes;
  for (const label of labelNodes) {
    let row = label.parentElement;
    for (let depth = 0; row && depth < 6; depth += 1, row = row.parentElement) {
      const controls = [...row.querySelectorAll(
        "input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea, [role=combobox]"
      )].filter((control) => (
        control.getClientRects().length && !LOGIN_FIELD_PATTERN.test(controlText(control))
      ));
      // A dependent GeM field stays disabled until its parent is selected.
      // Treat that as "not ready" instead of falling back to an adjacent row.
      if (controls.length === 1) return visible(controls[0]) ? controls[0] : null;
      if (controls.length > 1) break;
    }
  }
  const geometricMatches = [];
  for (const label of labelNodes) {
    const labelBox = label.getBoundingClientRect();
    const labelY = labelBox.top + labelBox.height / 2;
    for (const control of allControls) {
      const controlBox = control.getBoundingClientRect();
      const controlY = controlBox.top + controlBox.height / 2;
      const verticalDistance = Math.abs(controlY - labelY);
      if (verticalDistance > Math.max(70, labelBox.height / 2 + 20)
        || controlBox.left < labelBox.left) continue;
      geometricMatches.push({
        control,
        score: verticalDistance + Math.abs(controlBox.left - labelBox.right) / 20,
      });
    }
  }
  geometricMatches.sort((a, b) => a.score - b.score);
  if (
    geometricMatches.length
    && geometricMatches[0].score < 45
    && (!geometricMatches[1] || geometricMatches[0].score + 12 < geometricMatches[1].score)
  ) {
    return geometricMatches[0].control;
  }
  if (wanted === "product name") return null;
  const scored = allControls.map((control) => {
    const text = controlText(control).toLowerCase();
    let score = 0;
    if (text.includes(wanted)) score += 10;
    if ((control.getAttribute("aria-label") || "").toLowerCase().includes(wanted)) score += 8;
    if ((control.placeholder || "").toLowerCase().includes(wanted)) score += 6;
    return { control, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length || (scored[1] && scored[0].score === scored[1].score)) return null;
  return scored[0].control;
}

function normalizeOption(text) {
  return String(text).toLowerCase()
    .replace(/\bwindows\b/g, "window")
    .replace(/\byears?\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function optionSimilarity(left, right) {
  const a = normalizeOption(left);
  const b = normalizeOption(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;

  const leftNumbers = String(left).match(/\d+(?:\.\d+)?/g) || [];
  const rightNumbers = String(right).match(/\d+(?:\.\d+)?/g) || [];
  if (
    leftNumbers.length
    && rightNumbers.length
    && !leftNumbers.some((number) => rightNumbers.includes(number))
  ) {
    return 0;
  }

  const bigrams = (value) => {
    const result = [];
    for (let index = 0; index < value.length - 1; index += 1) {
      result.push(value.slice(index, index + 2));
    }
    return result;
  };
  const leftBigrams = bigrams(a);
  const rightBigrams = bigrams(b);
  if (!leftBigrams.length || !rightBigrams.length) return 0;
  const remaining = [...rightBigrams];
  let overlap = 0;
  for (const bigram of leftBigrams) {
    const index = remaining.indexOf(bigram);
    if (index >= 0) {
      overlap += 1;
      remaining.splice(index, 1);
    }
  }
  return (2 * overlap) / (leftBigrams.length + rightBigrams.length);
}

function optionMatches(left, right) {
  const a = normalizeOption(left);
  const b = normalizeOption(right);
  return Boolean(
    a && b && (a === b || a.includes(b) || b.includes(a) || optionSimilarity(left, right) >= 0.58)
  );
}

function specValue(specs, ...names) {
  for (const name of names) {
    if (specs[name] !== undefined && specs[name] !== null && specs[name] !== "") {
      return specs[name];
    }
  }
  return "";
}

function cabinetBayValue(label, selectedCabinet, fallback) {
  const tower = /tower/i.test(selectedCabinet);
  const sff = /small\s*form\s*factor|\bsff\b|\bssf\b/i.test(selectedCabinet);
  if (!tower && !sff) return fallback;
  const values = tower
    ? {
      "Number of Internal Bays Available, Size 2 Point 5 Inch": "1",
      "Number of Internal Bay Populated, Size 2 Point 5 Inch": "0",
      "Number of Internal Bays Available, Size 3 Point 5 inch": "2",
      "Number of Internal Bay Populated, Size 3 Point 5 inch": "1",
    }
    : {
      "Number of Internal Bays Available, Size 2 Point 5 Inch": "1",
      "Number of Internal Bay Populated, Size 2 Point 5 Inch": "0",
      "Number of Internal Bays Available, Size 3 Point 5 inch": "1",
      "Number of Internal Bay Populated, Size 3 Point 5 inch": "0",
    };
  return values[label] ?? fallback;
}

async function setAngularSelectValue(control, value, label = "") {
  const container = control.closest(".ui-select-container");
  if (!container) return false;
  const controlId = `acxxel-control-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  container.setAttribute("data-acxxel-control-id", controlId);
  let bridgeSelected = false;
  const onSelected = (event) => {
    if (event.detail?.controlId === controlId) {
      bridgeSelected = Boolean(event.detail?.selected);
    }
  };
  document.addEventListener("acxxel-gem-value-selected", onSelected);
  document.dispatchEvent(new CustomEvent("acxxel-gem-select-value", {
    detail: { controlId, value: String(value), label },
  }));
  await new Promise((resolve) => setTimeout(resolve, 700));
  document.removeEventListener("acxxel-gem-value-selected", onSelected);
  container.removeAttribute("data-acxxel-control-id");
  if (!bridgeSelected) return false;
  return controlHasValue(label ? fieldByLabel(label) : control, value);
}

async function setCustomSelect(control, value, label = "") {
  if (await setAngularSelectValue(control, value, label)) {
    control.blur();
    return true;
  }
  const wanted = normalizeOption(value);
  const container = control.closest(".ui-select-container") || control.parentElement;
  const selectedValue = () => normalizeOption(
    (
      container?.querySelector(".ui-select-match-text")
      || container?.querySelector(".ui-select-match")
    )?.textContent || ""
  );
  const current = selectedValue();
  if (optionMatches(value, current)) return true;
  const trigger = container?.querySelector(
    ".ui-select-toggle, .ui-select-match, [role=combobox]"
  ) || control;
  trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  trigger.click();
  control.focus();

  const inputSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype, "value"
  )?.set;
  const readChoices = () => [...document.querySelectorAll(
      ".ui-select-choices-row, .ui-select-choices li, [role=option], .select2-results__option"
    )].filter(visible);
  const findChoice = (choices) => {
    const uniqueChoices = [...new Map(choices.map((item) => [
      normalizeOption(item.textContent), item,
    ])).values()];
    if (value === "__FIRST_NON_PLACEHOLDER__") {
      const validChoices = uniqueChoices.filter((item) => {
        const text = normalizeOption(item.textContent);
        return text && !/^(?:select|none)$/.test(text);
      });
      return validChoices.length === 1 ? validChoices[0] : null;
    }
    const exact = uniqueChoices.filter((item) => normalizeOption(item.textContent) === wanted);
    const partial = uniqueChoices.filter((item) => {
      const option = normalizeOption(item.textContent);
      return option && wanted && (option.includes(wanted) || wanted.includes(option));
    });
    if (exact.length === 1) return exact[0];
    if (partial.length === 1) return partial[0];

    const ranked = uniqueChoices
      .map((item) => ({ item, score: optionSimilarity(value, item.textContent) }))
      .sort((left, right) => right.score - left.score);
    if (
      ranked[0]?.score >= 0.58
      && (!ranked[1] || ranked[0].score - ranked[1].score >= 0.08)
    ) {
      return ranked[0].item;
    }
    return null;
  };

  let choices = [];
  for (let attempt = 0; attempt < 5 && !choices.length; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    choices = readChoices();
  }
  if (await setAngularSelectValue(control, value, label)) {
    control.blur();
    return true;
  }
  let choice = findChoice(choices);

  // Only use the visible search box when the complete open list has no safe match.
  if (!choice && control.tagName === "INPUT" && inputSetter) {
    inputSetter.call(control, String(value));
    control.dispatchEvent(new Event("input", { bubbles: true }));
    for (let attempt = 0; attempt < 8 && !choice; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      choice = findChoice(readChoices());
    }
  }
  if (!choice) {
    control.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true,
    }));
    control.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true,
    }));
    control.dispatchEvent(new KeyboardEvent("keyup", {
      key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true,
    }));
    await new Promise((resolve) => setTimeout(resolve, 600));
    if (controlHasValue(label ? fieldByLabel(label) : control, value)) {
      control.blur();
      return true;
    }
    if (control.tagName === "INPUT" && inputSetter) {
      inputSetter.call(control, "");
      control.dispatchEvent(new Event("input", { bubbles: true }));
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    control.blur();
    return false;
  }
  const choiceId = `acxxel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  choice.setAttribute("data-acxxel-choice-id", choiceId);
  document.dispatchEvent(new CustomEvent("acxxel-gem-select-option", {
    detail: { choiceId },
  }));
  await new Promise((resolve) => setTimeout(resolve, 600));
  const pageSelection = selectedValue();
  const freshControl = label ? fieldByLabel(label) : null;
  if (optionMatches(value, pageSelection) || controlHasValue(freshControl, value)) {
    control.blur();
    return true;
  }
  choice.removeAttribute("data-acxxel-choice-id");

  const choiceRow = choice.closest(".ui-select-choices-row") || choice;
  const clickableChoice = choiceRow.querySelector(
    ".ui-select-choices-row-inner, a, button"
  ) || choiceRow;
  clickableChoice.click();
  await new Promise((resolve) => setTimeout(resolve, 500));
  let selectedText = selectedValue();
  let selected = optionMatches(value, selectedText)
    || controlHasValue(label ? fieldByLabel(label) : null, value);
  if (!selected) {
    control.focus();
    control.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true,
    }));
    control.dispatchEvent(new KeyboardEvent("keyup", {
      key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true,
    }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    selectedText = selectedValue();
    selected = optionMatches(value, selectedText)
      || controlHasValue(label ? fieldByLabel(label) : null, value);
  }
  if (!selected && control.tagName === "INPUT" && inputSetter) {
    inputSetter.call(control, "");
    control.dispatchEvent(new Event("input", { bubbles: true }));
  }
  control.blur();
  return selected;
}

async function setMonitorPorts(control) {
  const selectAll = monitorSelectAllCheckbox();
  if (selectAll?.checked) {
    selectAll.click();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  for (const port of ["HDMI", "VGA"]) {
    let freshControl = fieldByLabel("Monitor Port") || control;
    if (optionMatches(port, controlCurrentValue(freshControl))) continue;
    if (!await setCustomSelect(freshControl, port, "Monitor Port")) return false;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const selected = controlCurrentValue(fieldByLabel("Monitor Port") || control);
  return /hdmi/i.test(selected) && /vga/i.test(selected);
}

async function setNative(control, value, label = "") {
  if (
    !(control instanceof Element)
    || !control.isConnected
    || value === undefined
    || value === null
    || value === ""
  ) return false;
  try {
    const wanted = String(value).trim();
    if (/^monitor port$/i.test(label)) {
      return setMonitorPorts(control);
    }
    if (control.type === "checkbox" || control.type === "radio") {
    const shouldCheck = control.type === "radio"
      ? !/^(?:false|0|no|unchecked)$/i.test(wanted)
      : /^(?:true|1|yes|checked)$/i.test(wanted);
    if (control.checked !== shouldCheck) {
      control.click();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype, "checked"
    )?.set;
    if (control.checked !== shouldCheck) {
      setter ? setter.call(control, shouldCheck) : (control.checked = shouldCheck);
    }
    if (control.type === "radio" && shouldCheck) {
      control.dataset.acxxelApprovedValue = wanted;
    }
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    control.classList.remove(MANUAL_CLASS);
      return control.checked === shouldCheck;
    }
    if (
      String(control.id || "").startsWith("focusser-")
      || control.getAttribute("role") === "combobox"
      || control.closest(".ui-select-container")
    ) {
      const selected = await setCustomSelect(control, wanted, label);
      if (selected && control.isConnected) control.classList.remove(MANUAL_CLASS);
      return selected;
    }
    if (control.tagName === "SELECT") {
    const options = [...control.options];
    if (wanted === "__FIRST_NON_PLACEHOLDER__") {
      const validOptions = options.filter((item) => {
        const text = normalizeOption(item.text);
        return text && !/^(?:select|none)$/.test(text);
      });
      if (validOptions.length !== 1) return false;
      control.value = validOptions[0].value;
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      control.classList.remove(MANUAL_CLASS);
      return true;
    }
    const normalizedWanted = normalizeOption(wanted);
    const exact = options.filter((item) => normalizeOption(item.text) === normalizedWanted);
    const partial = options.filter((item) => {
      const option = normalizeOption(item.text);
      return option && normalizedWanted
        && (option.includes(normalizedWanted) || normalizedWanted.includes(option));
    });
    const option = exact.length === 1 ? exact[0] : partial.length === 1 ? partial[0] : null;
    if (!option) return false;
    control.value = option.value;
    } else if (control.getAttribute("role") === "combobox" && control.tagName !== "INPUT") {
      return false;
    } else {
    const prototype = control.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter ? setter.call(control, wanted) : (control.value = wanted);
    }
    if (!control.isConnected) return false;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    control.classList.remove(MANUAL_CLASS);
    return true;
  } catch (error) {
    if (!/extension context invalidated|disconnected|not connected/i.test(
      String(error?.message || error)
    )) {
      console.warn(`Acxxel could not fill ${label || "field"}; it will retry.`, error);
    }
    return false;
  }
}

function controlCurrentValue(control) {
  if (!control) return "";
  if (control.type === "checkbox") return control.checked ? "true" : "";
  if (control.type === "radio") {
    return control.checked
      ? String(control.dataset.acxxelApprovedValue || control.value || "true")
      : "";
  }
  if (
    control.id.startsWith("focusser-")
    || control.getAttribute("role") === "combobox"
    || control.closest(".ui-select-container")
  ) {
    const container = control.closest(".ui-select-container") || control.parentElement;
    const selectedItems = [...(container?.querySelectorAll(
      ".ui-select-match-item, .ui-select-match-text"
    ) || [])].map((item) => item.textContent.trim()).filter(Boolean);
    if (selectedItems.length) return [...new Set(selectedItems)].join(", ");
    return container?.querySelector(".ui-select-match")?.textContent || "";
  }
  if (control.tagName === "SELECT") {
    return control.options[control.selectedIndex]?.text || "";
  }
  return control.value || "";
}

function controlHasValue(control, value) {
  if (value === "__FIRST_NON_PLACEHOLDER__") return hasMeaningfulValue(control);
  return optionMatches(value, controlCurrentValue(control));
}

function hasMeaningfulValue(control) {
  const current = String(controlCurrentValue(control)).trim();
  return Boolean(current && !/^--?\s*(select|none)\s*--?$/i.test(current));
}

function gemOptionValue(label, value) {
  const text = String(value ?? "").trim();
  const lower = text.toLowerCase();
  if (/factory pre-loaded operating system/i.test(label)) {
    return text.replace(/\bWindows\b/i, "Window");
  }
  if (/type of storage installed/i.test(label)) {
    const hasHdd = /\bhdd\b/.test(lower) && !/\bnone\b/.test(lower);
    const hasSsd = /ssd|nvme|sata|\btb\b|\bgb\b/.test(lower);
    if (hasSsd && hasHdd) return "NVMe-SSD Plus HDD@5400 RPM";
    if (hasSsd) return "NVMe-SSD";
    if (hasHdd) return "HDD @5400RPM";
  }
  if (/hdd - storage capacity/i.test(label) && /^0(?:\D|$)/.test(text)) {
    return "0 as SSD only Installed";
  }
  if (/ssd - storage capacity/i.test(label)) {
    const capacity = Number(text.match(/\d+/)?.[0]);
    const gemCapacities = new Map([
      [1000, "1024"],
      [2000, "2048"],
      [4000, "4096"],
    ]);
    return gemCapacities.get(capacity) || text;
  }
  if (/availability of monitor|availibility of monitor/i.test(label) && /^yes\b/i.test(text)) {
    return "Yes as per IS 13252 (Part 1)";
  }
  if (/screen size/i.test(label)) {
    const inches = Number(text.match(/(\d+(?:\.\d+)?)\s*(?:inch|")/i)?.[1]);
    if (Number.isFinite(inches)) {
      const ranges = [
        [19, 20.87, '48.26 - 53 (19.0" - 20.87")'],
        [20.91, 22.83, '53.1 - 58 (20.91" - 22.83")'],
        [22.87, 24.8, '58.1 - 63 (22.87" - 24.8")'],
        [24.84, 26.77, '63.1 - 68 (24.84" - 26.77")'],
        [26.81, 28.74, '68.1 - 73 (26.81" - 28.74")'],
        [28.78, 30.71, '73.1 - 78 (28.78" - 30.71")'],
        [30.75, 32.68, '78.1 - 83 (30.75" - 32.68")'],
        [32.72, 34.65, '83.1 - 88 (32.72" - 34.65")'],
      ];
      return ranges.find(([minimum, maximum]) => inches >= minimum && inches <= maximum)?.[2]
        || text;
    }
  }
  if (/on site oem warranty/i.test(label)) {
    return text.match(/\d+/)?.[0] || text;
  }
  return text;
}

function approvedFields(job) {
  const payload = job.payload || {};
  const specs = payload.specifications || {};
  const selectedCabinet = controlCurrentValue(fieldByLabel("Cabinet Form Factor"));
  const selectedGraphicsType = controlCurrentValue(fieldByLabel("Graphics Type"));
  const graphicsMemory = /dedicated|discrete/i.test(selectedGraphicsType)
    ? "4"
    : specValue(
      specs,
      "Size of Memory in Case of Dedicated Graphic Card (GB)",
      "Size of Memory in Case of Dedicated Graphic Card(GB)"
    );
  const productName = [
    String(payload.brand || "ACXXEL").trim().toUpperCase(),
    "DESKTOP",
    String(payload.model_number || "").trim().toUpperCase(),
  ].filter(Boolean).join(" ");
  const modelNumber = String(payload.model_number || "").trim().toUpperCase();
  const desktopMrp = modelNumber.startsWith("ACL-1082DS-") ? "122000" : "100000";
  const desktopOfferPrice = String(Math.round(Number(desktopMrp) * 0.9));
  const productIdentity = [
    payload.product_type,
    payload.workflow,
    payload.category?.label,
  ].filter(Boolean).join(" ").toLowerCase();
  const hsnNumber = /printer/.test(productIdentity) ? "8443" : "8471";
  const spec = (...names) => {
    for (const name of names) {
      if (specs[name] !== undefined && specs[name] !== null && specs[name] !== "") {
        return specs[name];
      }
    }
    return "";
  };
  const fields = [
    ["Brand", payload.brand, "select[name='brand']"],
    ["Product Category", payload.category?.label, ""],
    ["Model Number", payload.model_number, ""],
    ["Product Name", productName, ""],
    ["Description of Stores", spec("Description of Stores"), ""],
    ["Computer Type", spec("Computer Type"), ""],
    ["Processor Number", spec("Processor Number", "Processor"), ""],
    ["Factory Pre-loaded Operating System", spec(
      "Factory Pre-loaded Operating System by Desktop OEM",
      "Factory Pre-loaded Operating System by DesktopOEM",
      "Operating System"
    ), ""],
    ["RAM Size", spec(
      "RAM Size (Memory Card/Module) (in GB) (Capacity to be installed in the System)",
      "RAM"
    ), ""],
    ["Type of Storage Installed with the System", spec("Type of Storage Installed with the System"), ""],
    ["SSD - Storage Capacity (in GB)", spec("SSD - Storage Capacity (in GB)", "SSD"), ""],
    ["HDD - Storage Capacity (in GB)", spec("HDD - Storage Capacity (in GB)", "HDD"), ""],
    ["Availibility of Monitor", spec("Availibility of Monitor"), ""],
    ["Screen Size (in CMs)", spec("Screen Size (in CMs)", "Monitor"), ""],
    ["On Site OEM Warranty (in Year)", spec("On Site OEM Warranty (in Year)", "On Site OEM Warranty"), ""],
    ["Graphics Type", spec("Graphics Type"), ""],
    [
      "Graphic Card Make and Model - Must declare",
      spec("Graphic Card Make and Model - Must declare", "Graphic Card Make and Model"),
      "",
    ],
    [
      "Size of Memory in Case of Dedicated Graphic Card (GB)",
      graphicsMemory,
      "",
    ],
    ["Country Of Origin", "INDIA", ""],
    [
      "Local Content (%)",
      String(payload.local_content || "").replace(/%/g, "").trim(),
      "input[name='origin_country_percentage']",
    ],
    ["Make In India Declaration", "true", ""],
    ["This product is being manufactured by us as PPP-MSE OEM", "yes", ""],
    ["PPP-MSE Declaration", "true", ""],
    [
      "This product is being manufactured by us as Startup",
      "DPIIT Registered Startup",
      "",
    ],
    ["Startup Declaration", "true", ""],
    ["PPP-MSE OEM Manufacturer", "true", ""],
    ["Offering State: Uttar Pradesh", "true", ""],
    [
      "Harmonized System of Nomenclature (HSN) Number",
      hsnNumber,
      "input[name='hsn']",
    ],
    ["MRP In INR", desktopMrp, ""],
    ["Offer Price Including Tax and Duties as INR", desktopOfferPrice, ""],
    ["Terms Of Delivery", "Free Delivery At Consignee Premises", ""],
    ["Current stock /Maximum Quantity(To Be Delivered In 15 Days)", "99", ""],
    ["Minimum Quantity Per Consignee", "30", ""],
    ["Lead Time for Direct Purchase", "10", ""],
    ["Upload MRP Documents", "MRP Declaration on OEM Letterhead", ""],
    ["Upload Documents", "BIS Certificate", ""],
  ];
  const productSpecificationLabels = new Set([
    "Expansion Slots (PCIe x 1)",
    "Expansion Slots (PCIe x 4)",
    "Expansion Slots (PCIe x 16)",
    "Expansion Slots (M Dot 2) for SSD",
    "Expansion Slots (M Dot 2) for WiFi",
    "Trusted Platform Module",
    "Graphics Type",
    "Graphic Card Make and Model - Must declare",
    "Size of Memory in Case of Dedicated Graphic Card (GB)",
    "Recovery Media for OS",
    "Type of RAM",
    "Memory Expandable Up To (in GB)",
    "Total Numbers of DIMM Slots Available",
    "Number of DIMM Slots Populated with Memory Card/Module",
    "Cabinet Form Factor",
    "Number of Internal Bays Available, Size 2 Point 5 Inch",
    "Number of Internal Bay Populated, Size 2 Point 5 Inch",
    "Number of Internal Bays Available, Size 3 Point 5 inch",
    "Number of Internal Bay Populated, Size 3 Point 5 inch",
    "Bays for Optical Drive",
    "Optical Drive",
    "Audio Interface Type",
    "Type of Ethernet Ports",
    "Number of Ethernet Ports",
    "Number of USB Type A Port (Version 2 Point 0)",
    "Number of USB Type A Port (Version 3 point 2 Gen 1)",
    "Number of USB Ports Type C",
    "Number of VGA Ports",
    "Number of HDMI Ports",
    "Number of DP Ports",
    "Panel Type",
    "Display Technology",
    "Maximum Resolution (Pixels)",
    "Image Aspect Ratio",
    "Brightness (in Nits)",
    "Refresh Rate (in Hz)",
    "Monitor Port",
    "Integrated Webcam with Mic",
    "Power Supply for Monitor",
    "Speaker",
    "Mouse Connectivity",
    "Keyboard Connectivity",
    "Type of Keyboard",
    "Power Supply Capacity- Maximum (in Watt)",
    "Minimum Power Efficiency Range (%)",
    "Minimum Operating Temperature (in Degree Celsius)",
    "Maximum Operating Temperature (in Degree Celsius)",
    "Operating Humidity(RH) (in Percentage)",
    "Availibility of RoHS Certificate",
    "Availability of Certification for Environmental Management System with Manufacturer",
    "Compliance of Information Security, Cybersecurity and Privacy Protection-Information Security Management Systems Requirements",
    "Availability of EPR Registration in Respect of the Manufacturer as per e-Waste Rules as Amended Up To Date",
    "Agreed to Provide a copy of EPR Registration Certificate to Buyer on Demand",
  ]);
  const existingLabels = new Set(fields.map(([label]) => label));
  for (const label of productSpecificationLabels) {
    const value = cabinetBayValue(label, selectedCabinet, specs[label]);
    if (
      !existingLabels.has(label)
      && value !== undefined
      && value !== null
      && String(value).trim() !== ""
    ) {
      fields.push([label, value, ""]);
    }
  }
  return fields.map(([label, value, selector]) => [
    label,
    gemOptionValue(label, value),
    selector,
  ]);
}

async function attachMrpDocument() {
  if (mrpDocumentRequested || mrpDocumentUploaded || !activeJob) return;
  if (!/upload mrp documents/i.test(document.body.innerText)) return;
  const typeControl = fieldByLabel("Upload MRP Documents");
  if (!controlHasValue(typeControl, "MRP Declaration on OEM Letterhead")) return;
  const allFileInputs = [...document.querySelectorAll("input[type=file]")].filter(
    (input) => !input.disabled
  );
  let fileInput = null;
  let row = typeControl?.parentElement;
  for (let depth = 0; row && depth < 8 && !fileInput; depth += 1, row = row.parentElement) {
    fileInput = [...row.querySelectorAll("input[type=file]")].find((input) => !input.disabled)
      || null;
  }
  if (!fileInput && allFileInputs.length) {
    const controlBox = typeControl?.getBoundingClientRect();
    fileInput = allFileInputs
      .map((input) => {
        const box = input.getBoundingClientRect();
        return {
          input,
          distance: controlBox
            ? Math.abs(box.top - controlBox.top) + Math.abs(box.left - controlBox.right)
            : Number.MAX_SAFE_INTEGER,
        };
      })
      .sort((left, right) => left.distance - right.distance)[0]?.input || null;
  }
  if (!fileInput) return;

  mrpDocumentRequested = true;
  const response = await requestRuntimeMessage({
    type: "GET_MRP_DOCUMENT",
    jobId: activeJob.id,
  });
  if (!response?.ok || !response.document?.base64) {
    mrpDocumentRequested = false;
    return;
  }
  const binary = atob(response.document.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const file = new File([bytes], response.document.filename, {
    type: response.document.content_type || "application/pdf",
  });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  fileInput.dispatchEvent(new Event("input", { bubbles: true }));
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  fileInput.classList.remove(MANUAL_CLASS);
  mrpDocumentUploaded = true;
}

async function attachBisDocument() {
  if (bisDocumentRequested || bisDocumentUploaded || !activeJob) return;
  if (!/upload documents/i.test(document.body.innerText)) return;
  const typeControl = fieldByLabel("Upload Documents");
  if (!controlHasValue(typeControl, "BIS Certificate")) return;
  let fileInput = null;
  let uploadButton = null;
  let row = typeControl?.parentElement;
  for (let depth = 0; row && depth < 8; depth += 1, row = row.parentElement) {
    fileInput = [...row.querySelectorAll("input[type=file]")]
      .find((input) => !input.disabled) || null;
    uploadButton = [...row.querySelectorAll("button, [role='button'], .btn")]
      .find((button) => /^upload\b/i.test(String(button.textContent || "").trim()))
      || uploadButton;
    if (fileInput && uploadButton) break;
  }
  if (!fileInput && uploadButton) {
    uploadButton.click();
    await new Promise((resolve) => setTimeout(resolve, 400));
    fileInput = [...document.querySelectorAll("input[type=file]")]
      .filter((input) => !input.disabled && !input.files?.length)
      .at(-1) || null;
  }
  if (!fileInput) {
    const allFileInputs = [...document.querySelectorAll("input[type=file]")]
      .filter((input) => !input.disabled && !input.files?.length);
    const controlBox = typeControl?.getBoundingClientRect();
    fileInput = allFileInputs.map((input) => {
      const box = input.getBoundingClientRect();
      return {
        input,
        distance: controlBox
          ? Math.abs(box.top - controlBox.top) + Math.abs(box.left - controlBox.right)
          : Number.MAX_SAFE_INTEGER,
      };
    }).sort((left, right) => left.distance - right.distance)[0]?.input || null;
  }
  if (!fileInput) return;

  bisDocumentRequested = true;
  const response = await requestRuntimeMessage({
    type: "GET_BIS_DOCUMENT",
    jobId: activeJob.id,
  });
  if (!response?.ok || !response.document?.base64) {
    bisDocumentRequested = false;
    return;
  }
  const binary = atob(response.document.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const file = new File([bytes], response.document.filename, {
    type: response.document.content_type || "application/pdf",
  });
  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  fileInput.dispatchEvent(new Event("input", { bubbles: true }));
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  fileInput.classList.remove(MANUAL_CLASS);
  await new Promise((resolve) => setTimeout(resolve, 500));
  bisDocumentUploaded = true;
}

function fileInputForImageLabel(labelPattern) {
  const allFileInputs = [...document.querySelectorAll("input[type=file]")]
    .filter((input) => !input.disabled);
  for (const input of allFileInputs) {
    let node = input;
    for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
      const text = String(node.innerText || node.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length < 900 && labelPattern.test(text)) return input;
    }
  }
  const textNodes = [...document.querySelectorAll("label, th, td, span, p")]
    .filter((node) => labelPattern.test(
      String(node.textContent || "").replace(/\s+/g, " ").trim()
    ));
  for (const textNode of textNodes) {
    const forId = textNode.getAttribute?.("for");
    if (forId) {
      const linked = document.getElementById(forId);
      if (linked?.matches("input[type=file]") && !linked.disabled) return linked;
    }
    let row = textNode;
    for (let depth = 0; row && depth < 7; depth += 1, row = row.parentElement) {
      const inputs = [...row.querySelectorAll("input[type=file]")].filter(
        (input) => !input.disabled
      );
      if (inputs.length === 1) return inputs[0];
    }
  }
  return null;
}

const PRODUCT_IMAGE_SLOTS = [
  ["front", /upload front view of the product/i, 1],
  ["side", /upload side\s*\/\s*top\s*\/\s*back view of the product/i, 2],
  ["interior", /upload interior\s*\/\s*close-up\s*\/\s*other view of the product/i, 3],
];
const PRODUCT_IMAGE_PENDING_KEY = "acxxelGemPendingProductImage";

function productImageInputs() {
  const mapped = Object.fromEntries(PRODUCT_IMAGE_SLOTS.map(([slot, pattern]) => [
    slot,
    fileInputForImageLabel(pattern),
  ]));
  const mappedInputs = Object.values(mapped).filter(Boolean);
  if (mappedInputs.length === 3 && new Set(mappedInputs).size === 3) return mapped;
  if (new Set(mappedInputs).size !== mappedInputs.length) {
    Object.keys(mapped).forEach((slot) => {
      mapped[slot] = null;
    });
  }

  const pageText = String(document.body.innerText || "");
  if (
    !/upload front view of the product/i.test(pageText)
    || !/upload side\s*\/\s*top\s*\/\s*back view of the product/i.test(pageText)
    || !/upload interior\s*\/\s*close-up\s*\/\s*other view of the product/i.test(pageText)
  ) {
    return mapped;
  }
  const candidates = [...document.querySelectorAll("input[type=file]")]
    .filter((input) => {
      if (input.disabled) return false;
      let node = input;
      for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
        const text = String(node.innerText || node.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (/upload mrp documents|bis certificate|upload documents/i.test(text)) return false;
      }
      return true;
    });
  if (candidates.length >= 3) {
    PRODUCT_IMAGE_SLOTS.forEach(([slot], index) => {
      if (!mapped[slot]) mapped[slot] = candidates[index];
    });
  }
  return mapped;
}

function productImageButton(imageNumber) {
  return [...document.querySelectorAll("button, [role=button], a, .btn")]
    .find((element) => (
      visible(element)
      && new RegExp(`^\\s*choose\\s+image\\s*${imageNumber}\\s*$`, "i")
        .test(String(element.textContent || "").replace(/\s+/g, " "))
    )) || null;
}

function productImageAlreadyUploaded(imageNumber) {
  return [...document.querySelectorAll("button, [role=button], a, .btn")]
    .some((element) => (
      visible(element)
      && new RegExp(`^\\s*change\\s+image\\s*${imageNumber}\\s*$`, "i")
        .test(String(element.textContent || "").replace(/\s+/g, " "))
    ));
}

function pendingProductImage() {
  try {
    return JSON.parse(sessionStorage.getItem(PRODUCT_IMAGE_PENDING_KEY) || "null");
  } catch {
    return null;
  }
}

function recoverAfterProductImageUpload(slot, imageNumber) {
  const pending = {
    jobId: activeJob.id,
    slot,
    imageNumber,
    startedAt: Date.now(),
    reloaded: false,
  };
  sessionStorage.setItem(PRODUCT_IMAGE_PENDING_KEY, JSON.stringify(pending));
  const startedAt = Date.now();
  const watcher = setInterval(() => {
    const waiting = [...document.querySelectorAll("body *")].some((element) => (
      visible(element)
      && String(element.textContent || "").replace(/\s+/g, " ").trim() === "Please wait..."
    ));
    if (productImageAlreadyUploaded(imageNumber) && !waiting) {
      clearInterval(watcher);
      productImageSlotsUploaded.add(slot);
      sessionStorage.removeItem(PRODUCT_IMAGE_PENDING_KEY);
      productImagesRequested = false;
      // GeM removes this step shortly after its upload overlay closes. Start
      // the next missing image in the same Angular render, without reloading.
      setTimeout(() => {
        attachProductImages().catch((error) => {
          console.error("Acxxel product image upload failed:", error);
        });
      }, 0);
      return;
    }
    const imageStepPresent = /upload front view of the product/i.test(
      String(document.body.innerText || "")
    );
    if (!imageStepPresent) {
      clearInterval(watcher);
      sessionStorage.removeItem(PRODUCT_IMAGE_PENDING_KEY);
      productImagesRequested = false;
      return;
    }
    if (Date.now() - startedAt >= 6000) {
      clearInterval(watcher);
      sessionStorage.removeItem(PRODUCT_IMAGE_PENDING_KEY);
      productImagesRequested = false;
      scheduleFill();
    }
  }, 50);
}

async function prepareProductImageInput(slot, imageNumber) {
  const existing = productImageInputs()[slot];
  const allMapped = Object.values(productImageInputs()).filter(Boolean);
  if (existing && allMapped.length === 3 && new Set(allMapped).size === 3) return existing;

  const button = productImageButton(imageNumber);
  if (!button) return existing;
  const before = new Set(document.querySelectorAll("input[type=file]"));
  button.click();
  // ng-file-upload creates/retargets its hidden input synchronously. Keep this
  // delay short so all three uploads are queued before GeM rebuilds the step.
  await new Promise((resolve) => setTimeout(resolve, 25));
  const after = [...document.querySelectorAll("input[type=file]")].filter(
    (input) => !input.disabled
  );
  return after.find((input) => !before.has(input))
    || after.at(-1)
    || existing
    || null;
}

function fileFromEncodedDocument(documentData) {
  const binary = atob(documentData.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], documentData.filename, {
    type: documentData.content_type || "image/jpeg",
  });
}

async function attachProductImages() {
  if (productImagesRequested || productImagesUploaded || !activeJob) return;
  for (const [slot, , imageNumber] of PRODUCT_IMAGE_SLOTS) {
    if (productImageAlreadyUploaded(imageNumber)) {
      productImageSlotsUploaded.add(slot);
    }
  }
  if (productImageSlotsUploaded.size === 3) {
    productImagesUploaded = true;
    sessionStorage.removeItem(PRODUCT_IMAGE_PENDING_KEY);
    return;
  }
  productImagesRequested = true;
  const response = await requestRuntimeMessage({
    type: "GET_PRODUCT_IMAGES",
    jobId: activeJob.id,
  });
  const images = response?.result?.images;
  if (!response?.ok || !Array.isArray(images) || images.length !== 3) {
    productImagesRequested = false;
    return;
  }
  for (const image of images) {
    if (productImageSlotsUploaded.has(image.slot)) continue;
    const slotDefinition = PRODUCT_IMAGE_SLOTS.find(([slot]) => slot === image.slot);
    const input = await prepareProductImageInput(image.slot, slotDefinition?.[2]);
    if (!input) continue;
    if (input.files?.length) {
      productImageSlotsUploaded.add(image.slot);
      continue;
    }
    const transfer = new DataTransfer();
    transfer.items.add(fileFromEncodedDocument(image));
    const filesSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "files"
    )?.set;
    if (filesSetter) filesSetter.call(input, transfer.files);
    else input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.classList.remove(MANUAL_CLASS);
    if (input.files?.length) {
      recoverAfterProductImageUpload(image.slot, slotDefinition?.[2]);
      return;
    }
  }
  productImagesUploaded = productImageSlotsUploaded.size === 3;
  if (!productImagesUploaded) productImagesRequested = false;
}

function isProductForm() {
  if (/login|sso\.gem/i.test(location.href) || document.querySelector("input[type=password]")) return false;
  const text = document.body.innerText.slice(0, 12000);
  const signals = [
    /Add New Offering/i,
    /Find your Product Category/i,
    /Golden Parameters/i,
    /Product Specification/i,
    /Offering Quantity/i,
    /Model Number/i,
  ].filter((pattern) => pattern.test(text)).length;
  return FORM_URL_PATTERN.test(location.href) && signals >= 1 && candidateControls().length > 0;
}

function flagControl(control, reason) {
  control.classList.add(MANUAL_CLASS);
  control.title = reason;
}

function flagUnresolvedVisibleFields(resolvedControls) {
  const manual = [];
  for (const control of candidateControls()) {
    if (resolvedControls.has(control)) continue;
    if (control.type === "checkbox" || control.type === "radio") continue;
    const required = control.required
      || control.getAttribute("aria-required") === "true"
      || /\*/.test(controlText(control));
    if (!required) continue;
    const empty = control.tagName === "SELECT"
      ? !control.value || /select|none/i.test(control.options[control.selectedIndex]?.text || "")
      : !String(control.value || "").trim();
    if (!empty) continue;
    const label = controlText(control).replace(/\s+/g, " ").trim().slice(0, 90) || "Unidentified field";
    flagControl(control, "Acxxel could not confidently fill this field. Please review it manually.");
    manual.push(label);
  }
  for (const input of [...document.querySelectorAll("input[type=file]")].filter(
    (item) => visible(item) && !item.files?.length
  )) {
    if (/image_\d|ngf-spec-upload-btn|choose image/i.test(controlText(input))) continue;
    flagControl(input, "Select the approved document manually. Chrome blocks silent file-path selection.");
    manual.push(`Document: ${controlText(input).slice(0, 70) || "file upload"}`);
  }
  return [...new Set(manual)];
}

function renderAssistant(filled, manual) {
  let panel = document.getElementById("acxxel-gem-assistant");
  if (!panel) {
    panel = document.createElement("aside");
    panel.id = "acxxel-gem-assistant";
    panel.innerHTML = `
      <header><strong>Acxxel form assistant</strong><button type="button" title="Minimize">-</button></header>
      <div data-content><div data-summary></div><ul></ul></div>
    `;
    panel.querySelector("button").addEventListener("click", () => {
      const collapsed = panel.classList.toggle("is-collapsed");
      panel.querySelector("button").textContent = collapsed ? "+" : "-";
      panel.querySelector("button").title = collapsed ? "Expand" : "Minimize";
    });
    document.body.appendChild(panel);
  }
  panel.querySelector("[data-summary]").textContent =
    `${filled} approved field(s) filled. ${manual.length} field(s) need review.`;
  const list = panel.querySelector("ul");
  list.innerHTML = "";
  manual.slice(0, 12).forEach((label) => {
    const item = document.createElement("li");
    item.textContent = label;
    list.appendChild(item);
  });
}

function controlDiagnostics() {
  return candidateControls().slice(0, 40).map((control) => ({
    tag: control.tagName.toLowerCase(),
    id: String(control.id || "").slice(0, 100),
    name: String(control.name || "").slice(0, 100),
    type: String(control.type || control.getAttribute("role") || "").slice(0, 50),
    current: controlCurrentValue(control).replace(/\s+/g, " ").trim().slice(0, 120),
    label: controlText(control).replace(/\s+/g, " ").trim().slice(0, 180),
    options: control.tagName === "SELECT"
      ? [...control.options].slice(0, 30).map((option) => option.text.trim())
      : [],
  }));
}

async function fillCurrentStep() {
  if (filling || !activeJob || !runtimeAvailable() || !isProductForm()) return;
  filling = true;
  try {
    const diagnostics = controlDiagnostics();
    const resolved = new Set();
    const unresolvedApproved = [...attemptedFields].map((key) => key.split("|", 1)[0]);
    let filled = completedFields.size;
    const productPageLink = fieldByLabel("Product Page Link");
    if (
      productPageLink
      && normalizeOption(controlCurrentValue(productPageLink)) === "acxxel"
    ) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, "value"
      )?.set;
      setter ? setter.call(productPageLink, "") : (productPageLink.value = "");
      productPageLink.dispatchEvent(new Event("input", { bubbles: true }));
      productPageLink.dispatchEvent(new Event("change", { bubbles: true }));
    }
    for (const [label, value, selector] of approvedFields(activeJob)) {
      if (value === undefined || value === null || value === "") continue;
      const fieldKey = `${label}|${normalizeOption(value)}`;
      let control = fieldByLabel(label, selector);
      if (manuallyEditedFields.has(fieldKey)) continue;
      const currentValue = controlCurrentValue(control);
      const replaceableProductName = label === "Product Name"
        && /^(?:na|n\/a)$/i.test(String(currentValue).trim());
      const replaceableDefaultZero = (
        label === "Current stock /Maximum Quantity(To Be Delivered In 15 Days)"
        && /^0(?:\.0+)?$/.test(String(currentValue).trim())
      );
      const replaceableMrpDocumentDefault = (
        label === "Upload MRP Documents"
        && /^packaging photo$/i.test(String(currentValue).trim())
      );
      const replaceableDependentGraphicsMemory = (
        /size of memory in case of dedicated graphic card/i.test(label)
        && /^(?:0|4)$/.test(String(currentValue).trim())
        && /^(?:0|4)$/.test(String(value).trim())
      );
      const replaceableDependentCabinetBay = (
        /number of internal bays?.*(?:available|populated)/i.test(label)
        && /^(?:0|1|2)$/.test(String(currentValue).trim())
        && /^(?:0|1|2)$/.test(String(value).trim())
      );
      if (
        control
        && hasMeaningfulValue(control)
        && !replaceableProductName
        && !replaceableDefaultZero
        && !replaceableMrpDocumentDefault
        && !replaceableDependentGraphicsMemory
        && !replaceableDependentCabinetBay
        && !controlHasValue(control, value)
      ) {
        completedFields.delete(fieldKey);
        fieldAttempts.delete(fieldKey);
        manuallyEditedFields.add(fieldKey);
        filled = completedFields.size;
        continue;
      }
      if (completedFields.has(fieldKey)) {
        if (controlHasValue(control, value)) continue;
        completedFields.delete(fieldKey);
        filled = completedFields.size;
      }
      if (attemptedFields.has(fieldKey)) continue;
      if (!control) {
        continue;
      }
      if (!await setNative(control, value, label)) {
        const attempts = (fieldAttempts.get(fieldKey) || 0) + 1;
        fieldAttempts.set(fieldKey, attempts);
        if (attempts < 3) {
          scheduleFill();
          break;
        }
        attemptedFields.add(fieldKey);
        unresolvedApproved.push(label);
        flagControl(control, `Approved value could not be matched safely: ${value}`);
      } else {
        fieldAttempts.delete(fieldKey);
        completedFields.add(fieldKey);
        resolved.add(control);
        filled += 1;
        // GeM rebuilds dependent Angular controls after every selection.
        // Stop this pass and resolve the next field against the fresh DOM.
        scheduleFill();
        break;
      }
    }
    await attachMrpDocument();
    await attachBisDocument();
    await attachProductImages();
    const manual = [...unresolvedApproved, ...flagUnresolvedVisibleFields(resolved)];
    renderAssistant(filled, manual);
    const reportKey = `${location.href}|${filled}|${manual.join("|")}`;
    if (reportKey !== lastReport) {
      lastReport = reportKey;
      sendRuntimeMessage({
        type: "REPORT_JOB",
        jobId: activeJob.id,
        report: {
          status: "filled",
          progress: manual.length
            ? `${filled} fields filled; ${manual.length} fields flagged for manual review.`
            : `${filled} fields filled. Review and use GeM Next/Submit manually.`,
          page_url: location.href,
          diagnostics,
        },
      });
    }
  } catch (error) {
    if (!/extension context invalidated/i.test(String(error?.message || error))) {
      console.error("Acxxel GeM autofill failed:", error);
    }
  } finally {
    filling = false;
  }
}

function scheduleFill() {
  if (!runtimeAvailable()) return;
  clearTimeout(fillTimer);
  fillTimer = setTimeout(() => {
    fillCurrentStep().catch((error) => {
      if (!/extension context invalidated/i.test(String(error?.message || error))) {
        console.error("Acxxel GeM autofill failed:", error);
      }
    });
  }, 1000);
}

function activate(job) {
  const payloadSignature = JSON.stringify(job.payload || {});
  if (
    !activeJob
    || activeJob.id !== job.id
    || activePayloadSignature !== payloadSignature
  ) {
    completedFields = new Set();
    attemptedFields = new Set();
    fieldAttempts = new Map();
    manuallyEditedFields = new Set();
    mrpDocumentRequested = false;
    mrpDocumentUploaded = false;
    bisDocumentRequested = false;
    bisDocumentUploaded = false;
    productImagesRequested = false;
    productImagesUploaded = false;
    productImageSlotsUploaded = new Set();
    const pending = pendingProductImage();
    if (pending && pending.jobId !== job.id) {
      sessionStorage.removeItem(PRODUCT_IMAGE_PENDING_KEY);
    }
  }
  activeJob = job;
  activePayloadSignature = payloadSignature;
  scheduleFill();
  return { ok: true, waitingForForm: !isProductForm() };
}

function markManualEdit(target) {
  if (!activeJob || filling || !(target instanceof Element)) return;
  const container = target.closest(".ui-select-container");
  const targetControl = target.closest("input, select, textarea, [role=combobox]")
    || container?.querySelector("input, select, textarea, [role=combobox]");
  if (!targetControl) return;

  for (const [label, value, selector] of approvedFields(activeJob)) {
    if (value === undefined || value === null || value === "") continue;
    const control = fieldByLabel(label, selector);
    if (!control) continue;
    const sameField = control === targetControl
      || Boolean(container && control.closest(".ui-select-container") === container);
    if (!sameField) continue;
    const fieldKey = `${label}|${normalizeOption(value)}`;
    manuallyEditedFields.add(fieldKey);
    completedFields.delete(fieldKey);
    attemptedFields.delete(fieldKey);
    fieldAttempts.delete(fieldKey);
    break;
  }
}

for (const eventName of ["pointerdown", "input", "change"]) {
  document.addEventListener(eventName, (event) => {
    if (event.isTrusted) markManualEdit(event.target);
  }, true);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DEACTIVATE_JOB") {
    activeJob = null;
    activePayloadSignature = "";
    clearTimeout(fillTimer);
    sendResponse({ ok: true });
    return true;
  }
  if (message.type === "ACTIVATE_JOB" || message.type === "FILL_JOB") {
    sendResponse(activate(message.job));
    return true;
  }
});

sendRuntimeMessage({ type: "GET_ACTIVE_JOB" }, (response) => {
  if (response?.job) activate(response.job);
});

window.setInterval(() => {
  if (!runtimeAvailable() || activeJob) return;
  sendRuntimeMessage({ type: "GET_ACTIVE_JOB" }, (response) => {
    if (response?.job) activate(response.job);
  });
}, 3000);

new MutationObserver(scheduleFill).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
window.addEventListener("popstate", scheduleFill);
window.addEventListener("hashchange", scheduleFill);

const style = document.createElement("style");
style.textContent = `
  .${MANUAL_CLASS} { outline: 3px solid #f59e0b !important; outline-offset: 2px !important; }
  #acxxel-gem-assistant {
    position: fixed; right: 18px; bottom: 18px; z-index: 2147483647;
    width: 310px; max-height: 45vh; overflow: auto; padding: 12px;
    background: #fff; color: #172033; border: 2px solid #4f46e5;
    box-shadow: 0 10px 30px rgba(15,23,42,.24); font: 13px Arial,sans-serif;
  }
  #acxxel-gem-assistant strong { display:block; margin-bottom:6px; }
  #acxxel-gem-assistant header { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  #acxxel-gem-assistant header button {
    width:26px; height:26px; border:0; background:#eef2ff; color:#3730a3;
    font-size:18px; font-weight:700; cursor:pointer;
  }
  #acxxel-gem-assistant.is-collapsed { width:230px; max-height:none; }
  #acxxel-gem-assistant.is-collapsed [data-content] { display:none; }
  #acxxel-gem-assistant.is-collapsed strong { margin:0; }
  #acxxel-gem-assistant ul { margin:8px 0 0; padding-left:18px; color:#92400e; }
`;
document.documentElement.appendChild(style);
