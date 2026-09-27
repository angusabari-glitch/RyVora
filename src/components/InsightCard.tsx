import type { ManagementAlert } from "../business/executiveDashboard";
import { Icon } from "./Icon";

export function InsightCard({ alert }: { alert: ManagementAlert }) {
	return (
		<article className={`insight-card insight-card--${alert.severity}`}>
			<div className="insight-severity">
				<span className="severity-dot" aria-hidden="true" />
				{alert.severity} attention
			</div>
			<div className="insight-content">
				<div>
					<h3>{alert.title}</h3>
					<p>{alert.description}</p>
				</div>
				<div className="insight-metric">
					<strong>{alert.count.toLocaleString("en-US")}</strong>
					<span>{alert.count === 1 ? "record" : "records"}</span>
				</div>
			</div>
			{alert.amount !== undefined ? (
				<div className="insight-footer">
					<span>{alert.amountLabel}</span>
					<strong>
						{new Intl.NumberFormat("en-US", {
							style: "currency",
							currency: "USD",
							maximumFractionDigits: 0,
						}).format(alert.amount)}
					</strong>
					<Icon name="arrow" className="insight-arrow" />
				</div>
			) : null}
		</article>
	);
}
