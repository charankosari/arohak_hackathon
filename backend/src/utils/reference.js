// Ambiguous characters (0/O, 1/I) are excluded so codes survive being read
// aloud at the reception desk.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Guest-facing booking confirmation code, e.g. "MG-7QK4ZB". */
export function generateBookingReference() {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `MG-${code}`;
}
