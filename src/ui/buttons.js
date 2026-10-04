// Shared button looks (donbr.github.io style), used by every demo. Add size and layout
// classes at the call site, e.g. `${primaryButton} px-6 py-2`.
const base = 'rounded-md font-medium disabled:cursor-not-allowed';

export const primaryButton = `${base} text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300`;
export const secondaryButton = `${base} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50`;
