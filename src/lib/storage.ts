import { GeneratedPrompt } from "./types";

const HISTORY_KEY = "suno-prompt-history";


export function getHistory(): GeneratedPrompt[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveToHistory(prompt: GeneratedPrompt) {
  const history = getHistory();
  const existing = history.findIndex((h) => h.id === prompt.id);
  if (existing !== -1) {
    history[existing] = prompt;
  } else {
    history.unshift(prompt);
    if (history.length > 50) history.pop();
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function toggleFavorite(id: string): boolean {
  const history = getHistory();
  const item = history.find((h) => h.id === id);
  if (item) {
    item.isFavorite = !item.isFavorite;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return item.isFavorite;
  }
  return false;
}

export function getFavorites(): GeneratedPrompt[] {
  return getHistory().filter((h) => h.isFavorite);
}

export function deleteFromHistory(id: string) {
  const history = getHistory().filter((h) => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}
