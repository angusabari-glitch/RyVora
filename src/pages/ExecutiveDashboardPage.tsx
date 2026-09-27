import { useEffect, useMemo, useState } from "react";
import { formatCount, formatCurrency } from "../app/formatters";
import {
	type ExecutiveDashboardModel,
	filterPriorityClaims,
} from "../business/executiveDashboard";
import { ChartContainer } from "../components/ChartContainer";
import type { DataTableColumn } from "../components/DataTable";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FilterSelect } from "../components/FilterSelect";
import type { BarItem } from "../components/HorizontalBarList";
import { HorizontalBarList } from "../components/HorizontalBarList";
import { Icon } from "../components/Icon";
import { InsightCard } from "../components/InsightCard";
import { KpiCard } from "../components/KpiCard";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import { loadExecutiveDashboard } from "../services/executiveDashboardService";

const statusColors: Record<string, string> = {
	Denied: "var(--status-critical)",
	Paid: "var(--status-positive)",
	Rejected: "var(--status-warning)",
	Pending: "var(--status-info)",
	"Partially Paid": "var(--chart-violet-2)",
};

const categoryColors: Record<string, string> = {
	Clinical: "var(--chart-violet-1)",
	Contractual: "var(--chart-violet-2)",
	"Patient Responsibility": "var(--chart-violet-3)",
	"Technical/Data": "var(--chart-violet-4)",
};

const filterOptions = [
	{ value: "all", label: "All priority claims" },
	{ value: "denied", label: "Denied claims" },
	{ value: "aged", label: "AR aged over 60 days" },
	{ value: "critical", label: "Critical priority" },
];

export function ExecutiveDashboardPage({
	onModelLoaded,
}: {
	onModelLoaded: (model: ExecutiveDashboardModel) => void;
}) {
	const [model, setModel] = useState<ExecutiveDashboardModel | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState("all");
	const [retry, setRetry] = useState(0);

	useEffect(() => {
		let current = true;
		const requestSequence = retry;
		setLoading(true);
		setError(null);
		loadExecutiveDashboard().then(
			(nextModel) => {
				if (!current || requestSequence !== retry) return;
				setModel(nextModel);
				setLoading(false);
				onModelLoaded(nextModel);
			},
			(reason: unknown) => {
				if (!current || requestSequence !== retry) return;
				setError(reason instanceof Error ? reason.message : String(reason));
				setLoading(false);
			},
		);
		return () => {
			current = false;
		};
	}, [onModelLoaded, retry]);

	const filteredPriorityClaims = useMemo(
		() =>
			model
				? filterPriorityClaims(
						model.priorityClaims,
						filter as "all" | "denied" | "aged" | "critical",
					)
				: [],
		[filter, model],
	);

	const priorityColumns: DataTableColumn<
		NonNullable<ExecutiveDashboardModel>["priorityClaims"][number]
	>[] = [
		{
			id: "claim",
			label: "Claim ID",
			cell: (row) => <span className="claim-id">{row.claimId}</span>,
			sortValue: (row) => row.claimId,
		},
		{
			id: "payer",
			label: "Payer",
			cell: (row) => row.payer,
			sortValue: (row) => row.payer,
		},
		{
			id: "amount",
			label: "Billed amount",
			className: "table-number",
			cell: (row) => formatCurrency(row.billedAmount),
			sortValue: (row) => row.billedAmount,
		},
		{
			id: "status",
			label: "Claim status",
			cell: (row) => <StatusBadge status={row.status} />,
		},
		{
			id: "age",
			label: "AR age",
			className: "table-number",
			cell: (row) => (
				<span className="age-value">
					{row.arAge}
					<small> days</small>
				</span>
			),
			sortValue: (row) => row.arAge,
		},
		{
			id: "followup",
			label: "Follow-up",
			cell: () => (
				<span className="followup-label">
					<span className="followup-dot" aria-hidden="true" />
					Required
				</span>
			),
		},
		{
			id: "priority",
			label: "Priority",
			cell: (row) => <StatusBadge status={row.priority} />,
			sortValue: (row) =>
				({ Critical: 0, High: 1, Medium: 2 })[row.priority] ?? 3,
		},
	];

	if (loading) return <LoadingState />;
	if (error || !model)
		return (
			<ErrorState
				message={error ?? "No dashboard data is available."}
				onRetry={() => setRetry((current) => current + 1)}
			/>
		);

	const statusBars: BarItem[] = model.claimStatusDistribution.map((item) => ({
		key: item.label,
		label: item.label,
		value: formatCount(item.count),
		percent: item.percent,
		color: statusColors[item.label] ?? "#6b7f91",
	}));
	const denialBars: BarItem[] = model.denialReasons.map((item) => ({
		key: `${item.code}-${item.label}`,
		label: item.label,
		detail: `${item.code} · ${item.category}`,
		value: formatCount(item.count),
		percent: item.percent,
		color: categoryColors[item.category] ?? "#167f86",
	}));
	const arBars: BarItem[] = model.agingBuckets.map((item) => ({
		key: item.label,
		label: `${item.label} days`,
		value: formatCount(item.count),
		percent: item.percent,
		color: item.label.startsWith("90")
			? "var(--status-critical)"
			: item.label.startsWith("61")
				? "var(--status-warning)"
				: "var(--chart-violet-2)",
	}));
	const formatDiscrepancyValue = (value: number, unit: string) => {
		if (unit === "USD") return formatCurrency(value);
		if (unit === "%") return `${value.toFixed(1)}%`;
		if (unit === "days") return `${value.toFixed(2)} days`;
		return `${formatCount(value)} claims`;
	};

	return (
		<div className="dashboard-page" id="dashboard">
			<PageHeader
				title="Executive Dashboard"
				subtitle="US Healthcare RCM Performance Overview"
			>
				<div className="source-chip">
					<span className="source-chip-dot" aria-hidden="true" />
					Approved synthetic dataset <strong>v1.2</strong>
				</div>
			</PageHeader>
			{model.kpiDiscrepancies.length > 0 ? (
				<div
					className="reconciliation-banner"
					role="alert"
					aria-labelledby="reconciliation-title"
				>
					<div>
						<strong id="reconciliation-title">
							KPI validation discrepancy
						</strong>
						<p>
							Calculated values remain in use. One or more results differ from
							the approved validation targets.
						</p>
					</div>
					<ul>
						{model.kpiDiscrepancies.map((item) => (
							<li key={item.label}>
								<strong>{item.label}</strong>
								<span>
									Calculated {formatDiscrepancyValue(item.actual, item.unit)} ·
									Target {formatDiscrepancyValue(item.target, item.unit)}
								</span>
							</li>
						))}
					</ul>
				</div>
			) : null}

			<section
				className="kpi-grid"
				aria-label="Executive performance indicators"
			>
				<KpiCard
					label="Total Claims"
					value={formatCount(model.kpis.totalClaims)}
					description="Claims represented in the current RCM population"
					icon="claims"
					variant="teal"
				/>
				<KpiCard
					label="Billed Amount"
					value={formatCurrency(model.kpis.billedAmount)}
					description="Aggregate billed charges across claims"
					icon="dollar"
					variant="blue"
				/>
				<KpiCard
					label="Denial Rate"
					value={`${(model.kpis.denialRate * 100).toFixed(1)}%`}
					description="Distinct denied claims as a share of claim volume"
					icon="denials"
					variant="amber"
				/>
				<KpiCard
					label="Average AR Age"
					value={`${model.kpis.averageArAge.toFixed(2)} days`}
					description="Mean age across the available AR population"
					icon="clock"
					variant="violet"
				/>
			</section>

			<section
				className="analytics-grid"
				aria-label="Claim and denial analyses"
			>
				<ChartContainer
					title="Claim status distribution"
					description="Current adjudication status across the full claim population."
				>
					<HorizontalBarList
						items={statusBars}
						ariaLabel="Claim counts by status"
					/>
					<div className="chart-footnote">
						<Icon name="activity" />
						{formatCount(model.kpis.totalClaims)} claims included in this view
					</div>
				</ChartContainer>
				<ChartContainer
					title="Denial reason analysis"
					description="Denial reasons and codes ranked by volume."
				>
					<div className="chart-summary">
						<strong>
							{formatCount(
								model.denialReasons.reduce((sum, item) => sum + item.count, 0),
							)}
						</strong>
						<span>
							denials across {model.denialReasons.length} reason groups
						</span>
					</div>
					<HorizontalBarList
						items={denialBars}
						ariaLabel="Denial counts by reason code"
					/>
					<ul className="category-strip" aria-label="Denial categories">
						{model.denialCategories.map((item) => (
							<li className="category-chip" key={item.label}>
								<i
									style={{
										backgroundColor: categoryColors[item.label] ?? "#167f86",
									}}
								/>
								{item.label}
								<b>{formatCount(item.count)}</b>
							</li>
						))}
					</ul>
				</ChartContainer>
			</section>

			<section
				className="operations-grid"
				aria-label="Revenue cycle operations"
			>
				<ChartContainer
					title="Accounts receivable profile"
					description="Age and current balance across the complete AR population."
					className="ar-panel"
				>
					<div className="ar-summary">
						<div>
							<span>Current AR balance</span>
							<strong>{formatCurrency(model.kpis.currentArBalance)}</strong>
						</div>
						<div>
							<span>Average age</span>
							<strong>
								{model.kpis.averageArAge.toFixed(2)} <small>days</small>
							</strong>
						</div>
						<div>
							<span>AR records</span>
							<strong>{formatCount(model.kpis.arPopulation)}</strong>
						</div>
					</div>
					<div className="subsection-label">AR aging distribution</div>
					<HorizontalBarList
						items={arBars}
						ariaLabel="Accounts receivable records by aging bucket"
					/>
					<div className="chart-footnote">
						Bars show share of AR records; current balance by bucket is derived
						from the AR ledger.
					</div>
					<div className="ar-balance-list">
						{model.agingBuckets.map((item) => (
							<div key={item.label}>
								<span>{item.label} days</span>
								<strong>{formatCurrency(item.currentBalance)}</strong>
							</div>
						))}
					</div>
				</ChartContainer>
				<section
					className="attention-panel panel"
					id="management-attention"
					aria-labelledby="management-attention-title"
				>
					<SectionHeader
						title="Management attention"
						description="Open conditions from the approved dataset."
					/>
					{model.managementAlerts.length === 0 ? (
						<EmptyState
							title="No active management alerts"
							description="No unresolved conditions were found in the current dataset."
						/>
					) : (
						<div className="alert-list">
							{model.managementAlerts.map((alert) => (
								<InsightCard key={alert.id} alert={alert} />
							))}
						</div>
					)}
				</section>
			</section>

			<section
				className="priority-panel panel"
				aria-labelledby="priority-claims-title"
			>
				<SectionHeader
					title="Priority claims"
					description="Unpaid claims with elevated priority or AR older than 60 days."
				>
					<FilterSelect
						label="Filter claims"
						value={filter}
						options={filterOptions}
						onChange={setFilter}
					/>
				</SectionHeader>
				<div className="table-meta">
					<span>
						{formatCount(filteredPriorityClaims.length)} matching claims
					</span>
					<span>Sorted by priority, AR age, then billed amount</span>
				</div>
				{filteredPriorityClaims.length === 0 ? (
					<EmptyState
						title="No priority claims match"
						description="Choose another filter to review available follow-up records."
					/>
				) : (
					<DataTable
						rows={filteredPriorityClaims.slice(0, 8)}
						columns={priorityColumns}
						rowKey={(row) => row.claimId}
						label="Priority claims requiring follow-up"
					/>
				)}
				<div className="table-caption">
					Showing up to 8 records · Priority conditions are calculated from
					claim status, priority, and AR age.
				</div>
			</section>
			<div className="dashboard-endnote">
				<span>Source: approved synthetic healthcare RCM dataset v1.2</span>
				<span>
					Calculated from workbook records · No historical trend data included
				</span>
			</div>
		</div>
	);
}
