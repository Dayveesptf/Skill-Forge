import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  className?: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  empty: ReactNode;
  minWidth?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  minWidth = "720px",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="overflow-x-auto">
        <table
          className="w-full text-left"
          style={{ minWidth }}
        >
          <thead>
            <tr className="border-b border-line bg-slate-900/40">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 ${
                    column.className ?? ""
                  }`}
                >
                  {column.label}
                </th>
              ))}

              {onRowClick && <th className="w-12 px-4" />}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const key = rowKey
                ? rowKey(row, index)
                : getDefaultRowKey(row, index);

              const clickable = Boolean(onRowClick);

              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={[
                    "border-b border-line last:border-b-0",
                    "transition-colors duration-150",
                    clickable
                      ? "cursor-pointer hover:bg-panel2"
                      : "",
                  ].join(" ")}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-5 py-4 text-sm text-slate-400 ${
                        column.className ?? ""
                      }`}
                    >
                      {column.render
                        ? column.render(row)
                        : getCellValue(row, column.key)}
                    </td>
                  ))}

                  {onRowClick && (
                    <td className="px-4">
                      <div className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 transition-colors group-hover:text-slate-300">
                        <ArrowRight size={15} />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getCellValue<T>(row: T, key: string): ReactNode {
  const value = getNestedValue(row, key);

  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function getNestedValue<T>(object: T, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (
      current !== null &&
      typeof current === "object" &&
      segment in current
    ) {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, object);
}

function getDefaultRowKey<T>(row: T, index: number): string {
  if (
    row !== null &&
    typeof row === "object"
  ) {
    const record = row as Record<string, unknown>;

    if (typeof record._id === "string") {
      return record._id;
    }

    if (typeof record.id === "string") {
      return record.id;
    }
  }

  return `row-${index}`;
}