import type { IconName } from "./Icon";
import { Icon } from "./Icon";

export function KpiCard({
	label,
	value,
	description,
	icon,
	variant = "teal",
}: {
	label: string;
	value: string;
	description: string;
	icon: IconName;
	variant?: "teal" | "blue" | "amber" | "violet";
}) {
	return (
		<article className={`kpi-card kpi-card--${variant}`}>
			<div className="kpi-card-top">
				<span className="kpi-label">{label}</span>
				<span className="kpi-icon-wrap">
					<Icon name={icon} className="kpi-icon" />
				</span>
			</div>
			<div className="kpi-value">{value}</div>
			<p className="kpi-description">{description}</p>
		</article>
	);
}
