// Chart.js helpers — currently charts are rendered directly in views.
// This file is reserved for shared chart utilities if needed later.

export function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    text: style.getPropertyValue('--color-text').trim(),
    textSecondary: style.getPropertyValue('--color-text-secondary').trim(),
    border: style.getPropertyValue('--color-border').trim(),
    primary: style.getPropertyValue('--color-primary').trim(),
    green: style.getPropertyValue('--color-green').trim(),
    red: style.getPropertyValue('--color-red').trim()
  };
}
