import { useEffect, useMemo, useState } from "react";
import { formatCount, formatCurrency } from "../app/formatters";
import type { ArFilters, ArRecord, ArSort, ArSortField } from "../business/ar";
import {
	EMPTY_AR_FILTERS,
	filterArRecords,
	findArRecordById,
	paginateArRecords,
	sortArRecords,
} from "../business/ar";
import type { DataTableColumn, DataTableSort } from "../components/DataTable";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FilterSelect } from "../components/FilterSelect";
import type { BarItem } from "../components/HorizontalBarList";
import { HorizontalBarList } from "../components/HorizontalBarList";
import { Icon } from "../components/Icon";
import { KpiCard } from "../components/KpiCard";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import type { ArManagementData } from "../services/arService";
import { loadArManagement } from "../services/arService";

const PAGE_SIZES = [25, 50, 100];
const EMPTY_DATA: ArManagementData = {
	records: [],
	summary: {
		totalRecords: 0,
		totalCurrentBalance: null,
		averageAge: null,
		followUpPopulation: 0,
	},
	agingGroups: [],
};

function money(value: number | null) {
	return value === null ? "Unavailable" : formatCurrency(value);
}

function date(value: string | null) {
	if (!value) return "Unavailable";
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(`${value}T00:00:00Z`));
}

function unique(values: Array<string | null | undefined>) {
	return [
		...new Set(values.filter((value): value is string => Boolean(value))),
	].sort((a, b) => a.localeCompare(b, "en-US", { sensitivity: "base" }));
}

function DetailField({ label, value }: { label: string; value: string }) {
	return (
		<div className="ar-detail-field">
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	);
}

function ArDetail({
	record,
	onBack,
	onOpenClaim,
}: {
	record: ArRecord;
	onBack: () => void;
	onOpenClaim: (claimId: string) => void;
}) {
	const claim = record.claim;
	return (
		<div className="ar-page">
			<button
				className="button-secondary ar-back"
				type="button"
				onClick={onBack}
			>
				<span aria-hidden="true">←</span> Back to AR Management
			</button>
			<PageHeader
				title="AR Detail"
				subtitle="Receivable balance, aging, and linked RCM activity."
			>
				<StatusBadge status={record.status ?? "Unavailable"} />
			</PageHeader>
			<section className="ar-detail-panel" aria-label="AR overview">
				<SectionHeader
					title="AR Overview"
					description={`AR record ${record.arId}`}
				>
					{claim ? (
						<button
							className="button-secondary"
							type="button"
							onClick={() => onOpenClaim(record.claimId)}
						>
							Open Claim Detail
						</button>
					) : null}
				</SectionHeader>
				<div className="ar-detail-grid">
					<DetailField label="AR ID" value={record.arId || "Unavailable"} />
					<DetailField
						label="Claim ID"
						value={record.claimId || "Unavailable"}
					/>
					<DetailField
						label="AR Status"
						value={record.status ?? "Unavailable"}
					/>
					<DetailField
						label="Payer"
						value={claim?.payerName ?? claim?.payerId ?? "Unavailable"}
					/>
					<DetailField
						label="AR Age"
						value={
							record.arAge === null ? "Unavailable" : `${record.arAge} days`
						}
					/>
					<DetailField
						label="Source Aging Bucket"
						value={record.agingBucket ?? "Not recorded"}
					/>
					<DetailField
						label="Follow-Up"
						value={record.followUpRequired ? "Required" : "Not required"}
					/>
					<DetailField
						label="Next Action"
						value={record.nextAction ?? "Not recorded"}
					/>
					<DetailField
						label="AR Owner"
						value={record.owner ?? "Not recorded"}
					/>
					<DetailField
						label="Priority"
						value={`${record.priority} — ${record.priorityReason}`}
					/>
					<DetailField
						label="Reconciliation Status"
						value={record.reconciliationStatus ?? "Not recorded"}
					/>
				</div>
				{!claim ? (
					<EmptyState
						title="Related claim unavailable"
						description="No matching Claim_ID was found in the approved dataset."
					/>
				) : null}
			</section>
			<section className="ar-detail-panel" aria-label="AR financial context">
				<SectionHeader
					title="Financial Context"
					description="Amounts are from approved AR, Claims, and 835 records."
				/>
				<div className="ar-detail-grid">
					<DetailField
						label="Original AR Balance"
						value={money(record.originalBalance)}
					/>
					<DetailField
						label="Current AR Balance"
						value={money(record.currentBalance)}
					/>
					<DetailField
						label="AR Adjustment Amount"
						value={money(record.adjustmentAmount)}
					/>
					<DetailField
						label="Claim Billed Amount"
						value={money(claim?.billedAmount ?? null)}
					/>
					<DetailField
						label="Linked 835 Allowed"
						value={money(claim?.allowedAmount ?? null)}
					/>
					<DetailField
						label="Linked 835 Paid"
						value={money(claim?.paidAmount ?? null)}
					/>
				</div>
			</section>
			<section className="ar-detail-panel" aria-label="Claim relationship">
				<SectionHeader title="Claim Relationship" />
				{claim ? (
					<div className="ar-detail-grid">
						<DetailField label="Claim Status" value={claim.status} />
						<DetailField
							label="Date of Service"
							value={date(claim.serviceDate)}
						/>
						<DetailField
							label="Claim Type"
							value={claim.claimType ?? "Unavailable"}
						/>
						<DetailField
							label="Insurance Type"
							value={claim.insuranceType ?? "Unavailable"}
						/>
						<DetailField
							label="Claim Priority"
							value={claim.priority ?? "Unavailable"}
						/>
					</div>
				) : (
					<EmptyState
						title="Claim relationship unavailable"
						description="Claim context is not available for this AR record."
					/>
				)}
			</section>
			<section
				className="ar-detail-panel"
				aria-label="Linked payments and denial"
			>
				<SectionHeader
					title="Payments and Denial"
					description="Linked through the related Claim_ID."
				/>
				<div className="ar-related-grid">
					<div>
						<h3>835 Payments</h3>
						{claim?.payments.length ? (
							<ul className="ar-related-list">
								{claim.payments.map((payment) => (
									<li key={payment.paymentId}>
										<strong>{payment.paymentId}</strong>
										<span className="ar-muted-field">
											{payment.transactionId || "Transaction unavailable"}
										</span>
										<span className="ar-muted-field">
											{payment.matchStatus ?? "Status unavailable"}
										</span>
										<b>{money(payment.paidAmount)}</b>
									</li>
								))}
							</ul>
						) : (
							<EmptyState
								title="No linked 835 payment"
								description="No payment row is linked to this Claim_ID."
							/>
						)}
					</div>
					<div>
						<h3>Denial</h3>
						{claim?.denial ? (
							<div className="ar-denial-context">
								<DetailField label="Denial ID" value={claim.denial.denialId} />
								<DetailField
									label="Reason Code"
									value={claim.denial.code ?? "Unavailable"}
								/>
								<DetailField
									label="Resolution Status"
									value={claim.denial.resolutionStatus ?? "Unavailable"}
								/>
								<DetailField
									label="Denied Amount"
									value={money(claim.denial.amount)}
								/>
							</div>
						) : (
							<EmptyState
								title="No linked denial"
								description="No denial row is linked to this Claim_ID."
							/>
						)}
					</div>
				</div>
			</section>
			<section className="ar-detail-panel" aria-label="Linked exceptions">
				<SectionHeader
					title="Exception Context"
					description="Existing exception records linked through Claim_ID; investigation and resolution remain future scope."
				/>
				{record.exceptions.length ? (
					<ul className="ar-exception-list">
						{record.exceptions.map((exception) => (
							<li key={exception.exceptionId}>
								<strong>{exception.exceptionId}</strong>
								<StatusBadge
									status={exception.severity ?? "Severity unavailable"}
								/>
								<span className="ar-muted-field">
									{exception.type ?? "Type unavailable"}
								</span>
								<span className="ar-muted-field">
									{exception.status ?? "Status unavailable"}
								</span>
								<span className="ar-muted-field">
									{exception.owner ?? "Owner unavailable"}
								</span>
								<span className="ar-muted-field">
									{date(exception.createdDate)}
								</span>
								{exception.description ? (
									<p className="ar-exception-description">
										{exception.description}
									</p>
								) : null}
							</li>
						))}
					</ul>
				) : (
					<EmptyState
						title="No linked exception"
						description="No exception row is linked to this Claim_ID."
					/>
				)}
			</section>
		</div>
	);
}

export function ARManagementPage({
	onOpenClaim,
	initialArId = null,
	onInitialArHandled,
	loadData = loadArManagement,
}: {
	onOpenClaim: (claimId: string) => void;
	initialArId?: string | null;
	onInitialArHandled?: () => void;
	loadData?: () => Promise<ArManagementData>;
}) {
	const [data, setData] = useState<ArManagementData>(EMPTY_DATA);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [retry, setRetry] = useState(0);
	const [selectedArId, setSelectedArId] = useState<string | null>(null);
	const [filters, setFilters] = useState<ArFilters>(EMPTY_AR_FILTERS);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const [sort, setSort] = useState<ArSort>({
		field: "arAge",
		direction: "descending",
	});
	useEffect(() => {
		if (!initialArId) return;
		setSelectedArId(initialArId);
		onInitialArHandled?.();
	}, [initialArId, onInitialArHandled]);

	useEffect(() => {
		let active = true;
		const requestSequence = retry;
		setLoading(true);
		setError(null);
		loadData().then(
			(result) => {
				if (!active || requestSequence !== retry) return;
				setData(result);
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
	}, [loadData, retry]);

	const filtered = useMemo(
		() => filterArRecords(data.records, filters),
		[data.records, filters],
	);
	const sorted = useMemo(() => sortArRecords(filtered, sort), [filtered, sort]);
	const paginated = useMemo(
		() => paginateArRecords(sorted, page, pageSize),
		[sorted, page, pageSize],
	);
	const selectedRecord = selectedArId
		? findArRecordById(data.records, selectedArId)
		: undefined;
	const payerOptions = useMemo(() => {
		const payers = new Map<string, string>();
		for (const record of data.records) {
			if (record.claim?.payerId)
				payers.set(
					record.claim.payerId,
					record.claim.payerName ?? record.claim.payerId,
				);
		}
		return [...payers]
			.map(([value, label]) => ({ value, label }))
			.sort((a, b) => a.label.localeCompare(b.label, "en-US"));
	}, [data.records]);
	const statusOptions = useMemo(
		() => unique(data.records.map((record) => record.status)),
		[data.records],
	);
	const agingOptions = useMemo(
		() => unique(data.records.map((record) => record.agingBucket)),
		[data.records],
	);
	const activeFilterCount =
		Number(Boolean(filters.status)) +
		Number(Boolean(filters.agingBucket)) +
		Number(Boolean(filters.payer)) +
		Number(filters.followUp !== "all") +
		Number(filters.priority !== "all");
	const hasQuery = Boolean(filters.search || activeFilterCount);

	function updateFilter<Key extends keyof ArFilters>(
		key: Key,
		value: ArFilters[Key],
	) {
		setFilters((current) => ({ ...current, [key]: value }));
		setPage(1);
	}

	function updateSort(next: DataTableSort) {
		setSort({ field: next.id as ArSortField, direction: next.direction });
		setPage(1);
	}

	if (loading) return <LoadingState label="Loading AR Management" />;
	if (error) {
		return (
			<ErrorState
				title="AR data could not be loaded"
				message={error}
				onRetry={() => setRetry((value) => value + 1)}
			/>
		);
	}
	if (selectedRecord) {
		return (
			<ArDetail
				record={selectedRecord}
				onBack={() => setSelectedArId(null)}
				onOpenClaim={onOpenClaim}
			/>
		);
	}

	const columns: DataTableColumn<ArRecord>[] = [
		{
			id: "arId",
			label: "AR ID",
			cell: (record) => (
				<button
					className="ar-open-button"
					type="button"
					onClick={() => setSelectedArId(record.arId)}
					aria-label={`Open AR ${record.arId}`}
				>
					{record.arId}
				</button>
			),
			sortValue: (record) => record.arId,
			className: "ar-id-cell",
		},
		{
			id: "claimId",
			label: "Claim ID",
			cell: (record) =>
				record.claim ? (
					<button
						className="ar-open-button"
						type="button"
						onClick={() => onOpenClaim(record.claimId)}
						aria-label={`Open claim ${record.claimId}`}
					>
						{record.claimId}
					</button>
				) : (
					record.claimId || "Unavailable"
				),
			sortValue: (record) => record.claimId,
		},
		{
			id: "payerName",
			label: "Payer",
			cell: (record) =>
				record.claim?.payerName ?? record.claim?.payerId ?? "Unavailable",
			sortValue: (record) =>
				record.claim?.payerName ?? record.claim?.payerId ?? "",
		},
		{
			id: "status",
			label: "AR Status",
			cell: (record) =>
				record.status ? <StatusBadge status={record.status} /> : "Unavailable",
			sortValue: (record) => record.status ?? "",
		},
		{
			id: "arAge",
			label: "AR Age",
			cell: (record) =>
				record.arAge === null ? "Unavailable" : `${record.arAge} days`,
			sortValue: (record) => record.arAge ?? -1,
			className: "table-number",
		},
		{
			id: "agingBucket",
			label: "Aging Bucket",
			cell: (record) => record.agingBucket ?? "Not recorded",
			sortValue: (record) => record.agingBucket ?? "",
		},
		{
			id: "currentBalance",
			label: "Current Balance",
			cell: (record) => money(record.currentBalance),
			sortValue: (record) => record.currentBalance ?? -1,
			className: "table-number",
		},
		{
			id: "nextAction",
			label: "Next Action",
			cell: (record) => record.nextAction ?? "Not recorded",
			sortValue: (record) => record.nextAction ?? "",
		},
		{
			id: "priority",
			label: "Priority",
			cell: (record) => (
				<span className="ar-priority-cell">
					<StatusBadge status={record.priority} />
					<small>{record.priorityReason}</small>
				</span>
			),
			sortValue: (record) => record.priority,
		},
	];

	const agingBars: BarItem[] = data.agingGroups.map((group) => ({
		key: group.label,
		label: `${group.label} days`,
		detail: `${formatCurrency(group.currentBalance)} current balance`,
		value: formatCount(group.count),
		percent: group.percent,
		color:
			group.label.startsWith("61") || group.label.startsWith("90")
				? "var(--status-warning)"
				: "var(--chart-violet-2)",
	}));

	return (
		<div className="ar-page">
			<PageHeader
				title="AR Management"
				subtitle="Accounts receivable aging, exposure, and follow-up operations."
			/>
			<section
				className="kpi-grid ar-kpi-grid"
				aria-label="AR performance indicators"
			>
				<KpiCard
					label="AR Records"
					value={formatCount(data.summary.totalRecords)}
					description="Receivable records in the approved AR worksheet"
					icon="clock"
					variant="violet"
				/>
				<KpiCard
					label="Outstanding AR"
					value={money(data.summary.totalCurrentBalance)}
					description="Aggregate current balance from AR records"
					icon="dollar"
					variant="blue"
				/>
				<KpiCard
					label="Average AR Age"
					value={
						data.summary.averageAge === null
							? "Unavailable"
							: `${data.summary.averageAge.toFixed(2)} days`
					}
					description="Mean age across available AR records"
					icon="activity"
					variant="teal"
				/>
				<KpiCard
					label="Follow-Up Population"
					value={formatCount(data.summary.followUpPopulation)}
					description="Active positive balances with source next action Follow Up"
					icon="alert"
					variant="amber"
				/>
			</section>
			<section
				className="ar-panel ar-aging-panel"
				aria-label="AR aging analysis"
			>
				<SectionHeader
					title="AR Aging Analysis"
					description="Uses the source Aging_Bucket; percentages use all AR records as the denominator."
				/>
				<HorizontalBarList
					items={agingBars}
					ariaLabel="AR record count and balance by source aging bucket"
				/>
			</section>
			<section
				className="claims-workspace ar-workspace"
				aria-label="AR work queue"
			>
				<SectionHeader
					title="AR Work Queue"
					description="Search, segment, and prioritize receivables using approved AR and linked claim data."
				/>
				<div className="claims-search-row">
					<label className="claims-search">
						<Icon name="search" />
						<input
							type="search"
							value={filters.search}
							onChange={(event) => updateFilter("search", event.target.value)}
							placeholder="Search AR ID, claim ID, payer, owner"
							aria-label="Search AR ID, claim ID, payer, or owner"
						/>
					</label>
					{hasQuery ? (
						<button
							className="clear-filters-button"
							type="button"
							onClick={() => {
								setFilters(EMPTY_AR_FILTERS);
								setPage(1);
							}}
						>
							Clear filters
						</button>
					) : null}
				</div>
				<fieldset className="claims-filters ar-filters">
					<legend>Filter AR</legend>
					<FilterSelect
						label="AR Status"
						value={filters.status}
						onChange={(value) => updateFilter("status", value)}
						options={[
							{ value: "", label: "All statuses" },
							...statusOptions.map((value) => ({ value, label: value })),
						]}
					/>
					<FilterSelect
						label="Aging Bucket"
						value={filters.agingBucket}
						onChange={(value) => updateFilter("agingBucket", value)}
						options={[
							{ value: "", label: "All aging buckets" },
							...agingOptions.map((value) => ({
								value,
								label: `${value} days`,
							})),
						]}
					/>
					<FilterSelect
						label="Payer"
						value={filters.payer}
						onChange={(value) => updateFilter("payer", value)}
						options={[{ value: "", label: "All payers" }, ...payerOptions]}
					/>
					<FilterSelect
						label="Follow-Up"
						value={filters.followUp}
						onChange={(value) =>
							updateFilter("followUp", value as ArFilters["followUp"])
						}
						options={[
							{ value: "all", label: "All follow-up states" },
							{ value: "required", label: "Follow-up required" },
							{ value: "not-required", label: "Not required" },
						]}
					/>
					<FilterSelect
						label="Priority"
						value={filters.priority}
						onChange={(value) =>
							updateFilter("priority", value as ArFilters["priority"])
						}
						options={[
							{ value: "all", label: "All priorities" },
							{ value: "Critical", label: "Critical" },
							{ value: "High", label: "High" },
							{ value: "Routine", label: "Routine" },
							{ value: "No follow-up", label: "No follow-up" },
						]}
					/>
				</fieldset>
				<div className="claims-table-meta">
					<p role="status">
						Showing {paginated.totalItems ? (page - 1) * pageSize + 1 : 0}–
						{Math.min(page * pageSize, paginated.totalItems)} of{" "}
						{formatCount(paginated.totalItems)} AR records
					</p>
					<label className="page-size-control">
						Rows per page{" "}
						<select
							value={pageSize}
							onChange={(event) => {
								setPageSize(Number(event.target.value));
								setPage(1);
							}}
						>
							{PAGE_SIZES.map((size) => (
								<option key={size} value={size}>
									{size}
								</option>
							))}
						</select>
					</label>
				</div>
				{paginated.items.length ? (
					<DataTable
						rows={paginated.items}
						columns={columns}
						rowKey={(record) => record.arId}
						label="AR work queue results"
						sortState={{ id: sort.field, direction: sort.direction }}
						onSortChange={updateSort}
					/>
				) : (
					<EmptyState
						title="No AR records found"
						description={
							hasQuery
								? "Try changing or clearing the search and filters."
								: "No AR records are available in the approved dataset."
						}
					/>
				)}
				<nav className="claims-pagination" aria-label="AR work queue pages">
					<span>
						Page {paginated.totalPages ? paginated.page : 0} of{" "}
						{paginated.totalPages}
					</span>
					<button
						className="button-secondary"
						type="button"
						onClick={() => setPage((current) => Math.max(1, current - 1))}
						disabled={paginated.page <= 1}
					>
						Previous
					</button>
					<button
						className="button-secondary"
						type="button"
						onClick={() =>
							setPage((current) => Math.min(paginated.totalPages, current + 1))
						}
						disabled={
							!paginated.totalPages || paginated.page >= paginated.totalPages
						}
					>
						Next
					</button>
				</nav>
			</section>
		</div>
	);
}
