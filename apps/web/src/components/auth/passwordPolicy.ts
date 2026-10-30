export function passwordRequirements(password: string) {
  return [
    { label: '12–128 characters', met: password.length >= 12 && password.length <= 128 },
    { label: '6 different characters', met: new Set(password).size >= 6 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Symbol', met: /[^a-zA-Z0-9]/.test(password) },
  ];
}
