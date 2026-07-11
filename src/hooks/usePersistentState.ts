/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { loadData, saveData } from '../data';

export function usePersistentState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => loadData<T>(key, defaultValue));

  useEffect(() => {
    saveData(key, value);
  }, [value]);

  return [value, setValue] as const;
}
