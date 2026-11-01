export const COLUMN_WIDTH = /^(\d+(?:\.\d+)?)(%|px)$/;

export const cleanWidth = value => {
  const text = String(value ?? '').trim();
  return COLUMN_WIDTH.test(text) ? text : '';
};

export const columnWidths = (widths, count) => Array.from({ length: count }, (_, index) => cleanWidth(Array.isArray(widths) ? widths[index] : ''));
