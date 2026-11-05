function escapeCsvValue(value) {
  if (value === null || value === undefined) return "";

  const stringValue = String(value);
  const escapedValue = stringValue.replace(/"/g, '""');

  if (/[",\n]/.test(escapedValue)) {
    return `"${escapedValue}"`;
  }

  return escapedValue;
}

export function downloadCsv({ rows, columns, filename = "export.csv" }) {
  if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(columns) || columns.length === 0) {
    return;
  }

  const headerRow = columns.map((column) => escapeCsvValue(column.header)).join(",");
  const dataRows = rows.map((row) =>
    columns
      .map((column) => {
        const rawValue = typeof column.accessor === "function" ? column.accessor(row) : row?.[column.key];
        return escapeCsvValue(rawValue);
      })
      .join(","),
  );

  const csv = [headerRow, ...dataRows].join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
