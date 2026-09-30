import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'pantry-items';

export type PantryItem = {
  id: string;
  code: string;
  name: string;
  expiryYear: number;
  expiryMonth: number;
  createdAt: number;
};

export async function getPantryItems(): Promise<PantryItem[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PantryItem[];
  } catch {
    return [];
  }
}

export async function addPantryItem(item: Omit<PantryItem, 'id' | 'createdAt'>): Promise<PantryItem> {
  const items = await getPantryItems();
  const created: PantryItem = { ...item, id: `${Date.now()}-${item.code}`, createdAt: Date.now() };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...items, created]));
  return created;
}
