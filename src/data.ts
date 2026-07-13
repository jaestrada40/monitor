/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// LocalStorage helpers (used only for UI-only state, e.g. currentView)
export const loadData = <T>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(`monitorpro_${key}`);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    console.error(`Error loading key ${key} from localStorage:`, e);
    return defaultValue;
  }
};

export const saveData = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(`monitorpro_${key}`, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving key ${key} to localStorage:`, e);
  }
};
