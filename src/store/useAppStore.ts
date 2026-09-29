import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AppState {
  currentClass: string;
  setCurrentClass: (newClass: string) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentClass: 'Hạng A1',
      setCurrentClass: (newClass) => set({ currentClass: newClass }),
      logout: () => set({ currentClass: 'Hạng A1' }), // Xóa dữ liệu khi đăng xuất
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
