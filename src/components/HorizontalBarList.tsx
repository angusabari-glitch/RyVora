import type { CSSProperties } from "react";
import { EmptyState } from "./EmptyState";

export interface BarItem {
	key: string;
	label: string;
	detail?: string;
	value: string;
	percent: number;
	color?: string;
}

export function HorizontalBarList({
	items,
	ariaLabel,
}: {
	items: BarItem[];
	ariaLabel: string;
}) {
	if (items.length === 0)
		return (
			<EmptyState
				title="No records to display"
				description="This dataset has no rows for this analysis."
			/>
		);
	return (
		<ol className="bar-list" aria-label={ariaLabel}>
			{items.map((item) => (
				<li className="bar-list-item" key={item.key}>
					<div className="bar-row-heading">
						<div className="bar-row-label">
							<strong>{item.label}</strong>
							{item.detail ? <span>{item.detail}</span> : null}
						</div>
						<div className="bar-row-value">
							<strong>{item.value}</strong>
							<span>{item.percent.toFixed(1)}%</span>
						</div>
					</div>
					<progress
						className="distribution-progress"
						max={100}
						value={item.percent}
						aria-label={`${item.label}, ${item.value}, ${item.percent.toFixed(1)} percent`}
						style={{ "--bar-color": item.color ?? "#167f86" } as CSSProperties}
					/>
				</li>
			))}
		</ol>
	);
}
