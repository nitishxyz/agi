/**
 * Web implementation of secure storage using localStorage
 */

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error deleting from localStorage:', error);
  }
}
