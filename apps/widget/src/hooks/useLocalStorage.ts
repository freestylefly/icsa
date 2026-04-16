/**
 * LocalStorage Hook
 * 提供本地存储功能，用于保存会话 ID 等状态
 */

import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  // 从 localStorage 读取初始值
  const readValue = (): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`读取 localStorage 失败：${key}`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // 监听其他标签页的变化
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue) {
        setStoredValue(JSON.parse(event.newValue) as T);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  // 保存值到 localStorage
  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value));
        
        // 触发自定义事件，通知同一页面的其他组件
        window.dispatchEvent(new Event('local-storage'));
      }
    } catch (error) {
      console.warn(`保存 localStorage 失败：${key}`, error);
    }
  };

  return [storedValue, setValue];
}
