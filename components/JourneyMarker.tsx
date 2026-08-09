export function createJourneyMarker(isFirst: boolean) {
  const element = document.createElement("div");

  element.className = "journey-marker";

  const inner = document.createElement("div");

  inner.className = `
    flex h-8 w-8 items-center justify-center
    rounded-full border-2 border-white
    shadow-lg
    transition-transform duration-200
    hover:scale-110
  `;

  inner.style.backgroundColor = isFirst ? "#292524" : "#78716c";

  const dot = document.createElement("div");

  dot.className = "h-2.5 w-2.5 rounded-full bg-white";

  inner.appendChild(dot);
  element.appendChild(inner);

  return element;
}