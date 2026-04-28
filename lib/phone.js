const E164 = /^\+[1-9]\d{7,14}$/;

export function isE164(value) {
  return typeof value === 'string' && E164.test(value);
}

export function stripCountry(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/^\+1/, '').replace(/^\+/, '');
}
