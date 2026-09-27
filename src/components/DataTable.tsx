import type { ReactNode } from "react";
import { useMemo, useState } from "react";

export interface DataTableColumn<Row> {
	id: string;
	label: string;
	cell: (row: Row) => ReactNode;
	sortValue?: (row: Row) => string | number;
	className?: string;
}

export interface DataTableSort {
	id: string;
	direction: "ascending" | "descending";
}

export function DataTable<Row>({
	rows,
	columns,
	rowKey,
	label,
	sortState,
	onSortChange,
}: {
	rows: Row[];
	columns: DataTableColumn<Row>[];
	rowKey: (row: Row) => string;
	label: string;
	sortState?: DataTableSort | null;
	onSortChange?: (sort: DataTableSort) => void;
}) {
	const [internalSort, setInternalSort] = useState<DataTableSort | null>(null);
	const sort = sortState === undefined ? internalSort : sortState;
	const externallySorted =
		sortState !== undefined && onSortChange !== undefined;
	const sortedRows = useMemo(() => {
		// In controlled mode, the parent owns sorting and passes rows in final order.
		if (externallySorted) return rows;
		if (!sort) return rows;
		const column = columns.find((item) => item.id === sort.id);
		if (!column?.sortValue) return rows;
		const direction = sort.direction === "ascending" ? 1 : -1;
		return [...rows].sort((a, b) => {
			const left = column.sortValue?.(a) ?? "";
			const right = column.sortValue?.(b) ?? "";
			if (typeof left === "number" && typeof right === "number")
				return (left - right) * direction;
			return String(left).localeCompare(String(right)) * direction;
		});
	}, [columns, externallySorted, rows, sort]);

	function toggleSort(column: DataTableColumn<Row>) {
		if (!column.sortValue) return;
		const nextSort: DataTableSort = {
			id: column.id,
			direction:
				sort?.id === column.id && sort.direction === "ascending"
					? "descending"
					: "ascending",
		};
		if (onSortChange) onSortChange(nextSort);
		else setInternalSort(nextSort);
	}

	return (
		<section className="table-scroll" aria-label={label}>
			<table className="data-table" aria-label={label}>
				<thead>
					<tr>
						{columns.map((column) => (
							<th
								key={column.id}
								className={column.className}
								aria-sort={sort?.id === column.id ? sort.direction : undefined}
								scope="col"
							>
								{column.sortValue ? (
									<button
										type="button"
										className="table-sort"
										onClick={() => toggleSort(column)}
									>
										{column.label}
									</button>
								) : (
									column.label
								)}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{sortedRows.map((row) => (
						<tr key={rowKey(row)}>
							{columns.map((column) => (
								<td key={column.id} className={column.className}>
									{column.cell(row)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}
