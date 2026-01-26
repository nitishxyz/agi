import { customAlphabet } from 'nanoid';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const generateShareId = customAlphabet(alphabet, 21);
export const generateSecret = customAlphabet(alphabet, 32);
