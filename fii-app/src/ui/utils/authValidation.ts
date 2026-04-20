export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function getPasswordValidationMessage(value: string): string | null {
  if (value.trim().length < 8) {
    return "Use uma senha com pelo menos 8 caracteres.";
  }

  return null;
}
