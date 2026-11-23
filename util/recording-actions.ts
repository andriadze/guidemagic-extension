export const popupOptionSelector =
  '[role="option"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';

const fieldSelector =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

const textInputTypes = new Set(["text", "search", "email", "url", "tel", "password"]);
const editableSelector = '[contenteditable]:not([contenteditable="false"])';

export function findTextField(target: HTMLElement): HTMLElement | null {
  if (target instanceof HTMLTextAreaElement) return target.disabled ? null : target;
  if (target instanceof HTMLInputElement) {
    return !target.disabled && textInputTypes.has(target.type) ? target : null;
  }
  if (!target.isContentEditable) return null;

  // Nested editable elements share one editing host until a non-editable boundary.
  let field = target.closest<HTMLElement>(editableSelector);
  while (field?.parentElement?.isContentEditable) {
    const parentField = field.parentElement.closest<HTMLElement>(editableSelector);
    if (!parentField) break;
    field = parentField;
  }
  return field;
}

export function isHandledField(target: HTMLElement) {
  if (target instanceof HTMLInputElement) {
    return !["button", "submit", "reset", "image"].includes(target.type);
  }
  return Boolean(target.closest(fieldSelector));
}

export function isPopupTrigger(target: HTMLElement) {
  return Boolean(
    target.closest(
      '[aria-expanded][aria-haspopup="listbox"], [aria-expanded][aria-haspopup="menu"], [aria-expanded][aria-haspopup="true"]',
    ),
  );
}

export function controlLabel(target: HTMLElement) {
  const referencedLabel = target
    .getAttribute("aria-labelledby")
    ?.split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent)
    .filter(Boolean)
    .join(" ");
  const labels =
    "labels" in target
      ? Array.from(
          (target as HTMLInputElement).labels || [],
          (label) => label.textContent,
        ).join(" ")
      : "";
  const label =
    target.getAttribute("aria-label") ||
    referencedLabel ||
    labels ||
    target.getAttribute("placeholder") ||
    target.getAttribute("name");
  return label?.trim().slice(0, 160) || "";
}

export function describeFieldChange(target: HTMLElement) {
  const label = controlLabel(target);
  if (target instanceof HTMLSelectElement) {
    const selected = Array.from(
      target.selectedOptions,
      (option) => option.label,
    )
      .join(", ")
      .slice(0, 160);
    return selected
      ? `Select ${selected}${label ? ` in ${label}` : ""}`
      : "Change selection";
  }
  if (target instanceof HTMLInputElement) {
    if (target.type === "checkbox") {
      return `${target.checked ? "Check" : "Uncheck"} ${label || "the checkbox"}`;
    }
    if (target.type === "radio") return `Select ${label || "the option"}`;
  }
  return `Update ${label || "the field"}`;
}

export function safeElementTag(target: HTMLElement) {
  const tag = target.localName;
  const role = target.getAttribute("role");
  return role && /^[a-z-]+$/.test(role)
    ? `<${tag} role="${role}">`
    : `<${tag}>`;
}

export function describePopupOption(option: HTMLElement) {
  const label = controlLabel(option) || option.innerText?.trim().slice(0, 160);
  return label ? `Choose ${label}` : "Choose an option";
}

const backgroundTags = new Set([
  "html",
  "body",
  "main",
  "section",
  "article",
  "aside",
  "header",
  "footer",
  "div",
]);

export function isLikelyBackgroundClick(target: HTMLElement) {
  if (!backgroundTags.has(target.localName)) return false;
  if (
    target.closest(
      'a, button, label, [role], [tabindex], [onclick], [aria-controls], [aria-expanded], [contenteditable], [draggable="true"]',
    )
  )
    return false;
  if (
    Array.from(target.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    )
  )
    return false;

  const cursor = getComputedStyle(target).cursor;
  return cursor === "auto" || cursor === "default";
}
