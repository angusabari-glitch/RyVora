import { useEffect, useMemo, useState } from "react";
import { formatCount, formatCurrency } from "../app/formatters";
import {
	type AnalyticsFilters,
	type AnalyticsModel,
	EMPTY_ANALYTICS_FILTERS,
} from "../business/analytics";
import { ChartContainer } from "../components/ChartContainer";
import type { DataTableColumn } from "../components/DataTable";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FilterSelect } from "../components/FilterSelect";
import type { BarItem } from "../components/HorizontalBarList";
import { HorizontalBarList } from "../components/HorizontalBarList";
import { KpiCard } from "../components/KpiCard";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import { loadAnalytics } from "../services/analyticsService";

function percent(value: number | null) {
	return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function nullableCurrency(value: number | null) {
	return value === null ? "—" : formatCurrency(value);
}

function bars<T extends { label: string; count: number; percent: number }>(
	items: T[],
): BarItem[] {
	return items.map((item) => ({
		key: item.label,
		label: item.label,
		value: formatCount(item.count),
		percent: item.percent,
	}));
}

export function AnalyticsPage({
	onOpenClaim,
}: {
	onOpenClaim: (claimId: string) => void;
}) {
	const [filters, setFilters] = useState<AnalyticsFilters>(
		EMPTY_ANALYTICS_FILTERS,
	);
	const [model, setModel] = useState<AnalyticsModel | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [retry, setRetry] = useState(0);

	useEffect(() => {
		let active = true;
		const requestSequence = retry;
		setError(null);
		loadAnalytics(filters).then(
			(value) => {
				if (!active || requestSequence !== retry) return;
				setModel(value);
				setLoading(false);
			},
			(reason: unknown) => {
				if (!active || requestSequence !== retry) return;
				setError(reason instanceof Error ? reason.message : String(reason));
				setLoading(false);
			},
		);
		return () => {
			active = false;
		};
	}, [filters, retry]);

	const payerRows = useMemo(() => model?.payers ?? [], [model]);
	const payerColumns: DataTableColumn<(typeof payerRows)[number]>[] = [
		{
			id: "payer",
			label: "Payer",
			cell: (row) => row.payerName,
			sortValue: (row) => row.payerName,
		},
		{
			id: "claims",
			label: "Claims",
			className: "table-number",
			cell: (row) => formatCount(row.claimCount),
			sortValue: (row) => row.claimCount,
		},
		{
			id: "billed",
			label: "Billed",
			className: "table-number",
			cell: (row) => nullableCurrency(row.billedAmount),
			sortValue: (row) => row.billedAmount ?? -1,
		},
		{
			id: "paid",
			label: "Paid",
			className: "table-number",
			cell: (row) => nullableCurrency(row.paidAmount),
			sortValue: (row) => row.paidAmount ?? -1,
		},
		{
			id: "ar",
			label: "Outstanding AR",
			className: "table-number",
			cell: (row) => nullableCurrency(row.outstandingAr),
			sortValue: (row) => row.outstandingAr ?? -1,
		},
		{
			id: "denials",
			label: "Denials",
			className: "table-number",
			cell: (row) => formatCount(row.denialCount),
			sortValue: (row) => row.denialCount,
		},
		{
			id: "exceptions",
			label: "Exceptions",
			className: "table-number",
			cell: (row) => formatCount(row.exceptionCount),
			sortValue: (row) => row.exceptionCount,
		},
		{
			id: "drilldown",
			label: "Linked claim",
			cell: (row) =>
				row.claimIds[0] ? (
					<button
						type="button"
						className="analytics-link"
						onClick={() => onOpenClaim(row.claimIds[0])}
					>
						Open {row.claimIds[0]}
					</button>
				) : (
					"—"
				),
		},
	];

	if (loading && !model) return <LoadingState label="Loading analytics" />;
	if (error && !model)
		return (
			<ErrorState
				message={error}
				onRetry={() => {
					setLoading(true);
					setRetry((value) => value + 1);
				}}
			/>
		);
	if (!model)
		return (
			<EmptyState
				title="Analytics unavailable"
				description="No analytical model is available."
			/>
		);

	const noClaims = model.summary.claims.totalClaims === 0;
	const trendBars: BarItem[] = model.trend.map((point) => ({
		key: point.period,
		label: point.period,
		value: formatCount(point.claimCount),
		detail: nullableCurrency(point.billedAmount),
		percent: model.summary.claims.totalClaims
			? (point.claimCount / model.summary.claims.totalClaims) * 100
			: 0,
	}));
	const denialBars = bars(
		model.denialReasons.slice(0, 8).map((item) => ({
			label: `${item.code} · ${item.reason}`,
			count: item.count,
			percent: item.percent,
		})),
	);
	const exceptionBars = bars(
		model.exceptionTypes.map((item) => ({
			label: item.type,
			count: item.count,
			percent: item.percent,
		})),
	);
	const dateControl = (
		label: string,
		value: string,
		onChange: (value: string) => void,
	) => (
		<label className="filter-control">
			<span>{label}</span>
			<input
				type="date"
				value={value}
				min={model.dateBounds.from || undefined}
				max={model.dateBounds.to || undefined}
				onChange={(event) => onChange(event.target.value)}
			/>
		</label>
	);
	const updateFilter = (key: keyof AnalyticsFilters, value: string) =>
		setFilters((current) => ({ ...current, [key]: value }));

	return (
		<div className="dashboard-page analytics-page" id="analytics">
			<PageHeader
				title="Analytics"
				subtitle="RCM performance trends, operational exposure, and cross-module analysis."
			>
				<div className="source-chip">
					<span className="source-chip-dot" aria-hidden="true" />
					Approved synthetic dataset <strong>v1.2</strong>
				</div>
			</PageHeader>
			<section
				className="analytics-filter-panel panel"
				aria-label="Analytics filters"
			>
				<div className="analytics-filter-heading">
					<SectionHeader
						title="Portfolio scope"
						description="Payer, claim status, and service date filter claims and linked records across sections."
					/>
					<button
						type="button"
						className="button-secondary"
						onClick={() => setFilters(EMPTY_ANALYTICS_FILTERS)}
						disabled={
							!filters.payerId &&
							!filters.claimStatus &&
							!filters.serviceDateFrom &&
							!filters.serviceDateTo
						}
					>
						Reset filters
					</button>
				</div>
				<div className="analytics-filter-grid">
					<FilterSelect
						label="Payer"
						value={filters.payerId}
						options={[
							{ value: "", label: "All payers" },
							...model.options.payers,
						]}
						onChange={(value) => updateFilter("payerId", value)}
					/>
					<FilterSelect
						label="Claim status"
						value={filters.claimStatus}
						options={[
							{ value: "", label: "All statuses" },
							...model.options.statuses.map((status) => ({
								value: status,
								label: status,
							})),
						]}
						onChange={(value) => updateFilter("claimStatus", value)}
					/>
					{dateControl("Service date from", filters.serviceDateFrom, (value) =>
						updateFilter("serviceDateFrom", value),
					)}
					{dateControl("Service date to", filters.serviceDateTo, (value) =>
						updateFilter("serviceDateTo", value),
					)}
				</div>
				<p className="analytics-filter-note">
					Linked module records follow the selected claims through Claim_ID.
					Payment and transaction event dates remain source-specific and are not
					used as the global date filter.
				</p>
			</section>
			{error ? (
				<div className="analytics-inline-error" role="status">
					Analytics refresh issue: {error}
				</div>
			) : null}
			{noClaims ? (
				<EmptyState
					title="No claims in this scope"
					description="Adjust the payer, status, or service date filters to view analytical results."
				/>
			) : (
				<>
					<section
						aria-label="Cross-module portfolio summary"
						className="analytics-kpi-grid"
					>
						<KpiCard
							label="Claims"
							value={formatCount(model.summary.claims.totalClaims)}
							description="Claims in the selected service-date and payer scope"
							icon="claims"
						/>
						<KpiCard
							label="Billed Amount"
							value={formatCurrency(model.summary.claims.totalBilledAmount)}
							description="Sum of linked claims billed amounts"
							icon="dollar"
							variant="blue"
						/>
						<KpiCard
							label="Denial Rate"
							value={percent(model.summary.denials.denialRate)}
							description={`${formatCount(model.summary.denials.totalDenials)} denial records · denied claims / claims`}
							icon="denials"
							variant="amber"
						/>
						<KpiCard
							label="Paid Amount"
							value={nullableCurrency(model.summary.payments.totalPaidAmount)}
							description={`${formatCount(model.summary.payments.totalPayments)} payment records in scope`}
							icon="payments"
							variant="violet"
						/>
						<KpiCard
							label="Outstanding AR"
							value={nullableCurrency(model.summary.ar.totalCurrentBalance)}
							description={`${formatCount(model.summary.ar.totalRecords)} linked AR records`}
							icon="clock"
						/>
						<KpiCard
							label="837 Success"
							value={percent(model.summary.interoperability.successRate)}
							description={`${formatCount(model.summary.interoperability.successfulTransactions)} accepted / ${formatCount(model.summary.interoperability.totalRecords)} linked transactions`}
							icon="interoperability"
							variant="blue"
						/>
					</section>
					<div className="analytics-grid">
						<ChartContainer
							title={model.trendLabel}
							description="Claim counts grouped by the source Service_Date month. Bar percentages are share of the selected claim population; billed amounts are shown as context."
						>
							<HorizontalBarList
								items={trendBars}
								ariaLabel="Claims by service date month"
							/>
						</ChartContainer>
						<ChartContainer
							title="Claims Analytics"
							description="Status distribution from the Claims worksheet."
						>
							<HorizontalBarList
								items={bars(model.claimStatuses)}
								ariaLabel="Claim status distribution"
							/>
						</ChartContainer>
						<ChartContainer
							title="Denial Analytics"
							description={`Denial reason distribution · ${formatCount(model.summary.denials.totalDenials)} records · ${formatCurrency(model.summary.denials.deniedAmount)} denied amount`}
						>
							<HorizontalBarList
								items={denialBars}
								ariaLabel="Denial reason distribution"
							/>
						</ChartContainer>
						<ChartContainer
							title="Payment & Reconciliation"
							description={`835 status from the existing Payments definition · ${formatCount(model.summary.payments.unmatchedCount)} unmatched · ${percent(model.summary.payments.matchRate)} match rate among records with a known status`}
						>
							<HorizontalBarList
								items={bars(model.paymentStatuses)}
								ariaLabel="Payment reconciliation status distribution"
							/>
						</ChartContainer>
						<ChartContainer
							title="AR Analytics"
							description={
								model.summary.ar.averageAge === null
									? "Source AR aging bucket distribution."
									: `Average AR age ${model.summary.ar.averageAge.toFixed(2)} days · source aging buckets`
							}
						>
							<HorizontalBarList
								items={model.arAging.map((item) => ({
									key: item.label,
									label: item.label,
									detail: nullableCurrency(item.currentBalance),
									value: formatCount(item.count),
									percent: item.percent,
								}))}
								ariaLabel="AR source aging bucket distribution"
							/>
						</ChartContainer>
						<ChartContainer
							title="Exception Analytics"
							description={`${formatCount(model.summary.exceptions.unresolvedRecords)} unresolved records using the Exceptions module rule.`}
						>
							<HorizontalBarList
								items={exceptionBars}
								ariaLabel="Exception type distribution"
							/>
						</ChartContainer>
						<ChartContainer
							title="Interoperability Analytics"
							description="837 source status distribution; system/interface routing fields are not present in the workbook."
						>
							<HorizontalBarList
								items={bars(model.interoperabilityStatuses)}
								ariaLabel="Interoperability transaction status distribution"
							/>
						</ChartContainer>
						<ChartContainer
							title="Cross-Module Analysis"
							description="Distinct selected claims associated by validated Claim_ID relationships."
						>
							<ol className="analytics-lifecycle-list">
								{model.lifecycle.map((row) => (
									<li key={row.label}>
										<div>
											<strong>{row.label}</strong>
											<span>{formatCount(row.claimCount)} claims</span>
										</div>
										<progress
											max={100}
											value={row.percent}
											aria-label={`${row.label}: ${formatCount(row.claimCount)} claims, ${row.percent.toFixed(1)} percent`}
										/>
									</li>
								))}
							</ol>
						</ChartContainer>
					</div>
					<section
						className="panel analytics-table-panel"
						aria-label="Payer analytics"
					>
						<SectionHeader
							title="Payer Analytics"
							description="Claims, denials, exceptions, and AR relate through Claim_ID; payment amounts retain Payments_835.Payer_ID. Missing amounts remain blank."
						/>
						<DataTable
							rows={payerRows}
							columns={payerColumns}
							rowKey={(row) => row.payerId ?? "payer-not-recorded"}
							label="Payer analytics table"
						/>
					</section>
					<section
						className="panel analytics-table-panel"
						aria-label="Claims requiring follow-up"
					>
						<SectionHeader
							title="Priority Claims"
							description="Existing Claims follow-up flag; highest AR age and billed amount first."
						/>
						{model.priorityClaims.length ? (
							<DataTable
								rows={model.priorityClaims}
								label="Priority claims table"
								rowKey={(claim) => claim.claimId}
								columns={[
									{
										id: "claim",
										label: "Claim ID",
										cell: (claim) => (
											<button
												type="button"
												className="analytics-link"
												onClick={() => onOpenClaim(claim.claimId)}
											>
												{claim.claimId}
											</button>
										),
										sortValue: (claim) => claim.claimId,
									},
									{
										id: "payer",
										label: "Payer",
										cell: (claim) => claim.payerName ?? "Payer not recorded",
										sortValue: (claim) => claim.payerName ?? "",
									},
									{
										id: "amount",
										label: "Billed Amount",
										className: "table-number",
										cell: (claim) => nullableCurrency(claim.billedAmount),
										sortValue: (claim) => claim.billedAmount ?? -1,
									},
									{
										id: "status",
										label: "Status",
										cell: (claim) => <StatusBadge status={claim.status} />,
									},
									{
										id: "age",
										label: "AR Age",
										className: "table-number",
										cell: (claim) =>
											claim.arAge === null ? "—" : `${claim.arAge} days`,
										sortValue: (claim) => claim.arAge ?? -1,
									},
								]}
							/>
						) : (
							<EmptyState
								title="No priority claims"
								description="No claims in the selected scope currently require follow-up under the existing Claims selector."
							/>
						)}
					</section>
				</>
			)}
			<p className="analytics-footnote">
				Analytics is read-only and reflects this simulated synthetic / non-PHI
				portfolio. It is not production payer, EHR, clearinghouse, or live
				reporting analytics.
			</p>
		</div>
	);
}
