import { useEffect, useMemo, useState } from "react";
import { formatCount, formatCurrency } from "../app/formatters";
import type {
	ExceptionFilters,
	ExceptionRecord,
	ExceptionSort,
	ExceptionSortField,
} from "../business/exceptions";
import {
	EMPTY_EXCEPTION_FILTERS,
	filterExceptions,
	findExceptionById,
	paginateExceptions,
	sortExceptions,
} from "../business/exceptions";
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
import type { ExceptionsData } from "../services/exceptionsService";
import { loadExceptions } from "../services/exceptionsService";

const PAGE_SIZES = [25, 50, 100];
const EMPTY_DATA: ExceptionsData = {
	records: [],
	summary: {
		totalRecords: 0,
		unresolvedRecords: 0,
		criticalUnresolved: 0,
		highUnresolved: 0,
		linkedClaimCount: 0,
	},
	typeGroups: [],
};

function money(value: number | null) {
	return value === null ? "Unavailable" : formatCurrency(value);
}

function showDate(value: string | null) {
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

function ExceptionDetail({
	record,
	onBack,
	onOpenClaim,
	onOpenPayment,
	onOpenDenial,
	onOpenAr,
}: {
	record: ExceptionRecord;
	onBack: () => void;
	onOpenClaim: (claimId: string) => void;
	onOpenPayment: (paymentId: string) => void;
	onOpenDenial: (denialId: string) => void;
	onOpenAr: (arId: string) => void;
}) {
	const claim = record.claim;
	return (
		<div className="exceptions-page ar-page">
			<button
				className="button-secondary ar-back"
				type="button"
				onClick={onBack}
			>
				<span aria-hidden="true">←</span> Back to Exceptions
			</button>
			<PageHeader
				title="Exception Detail"
				subtitle="Approved source exception and linked RCM context. This view is read-only."
			>
				<StatusBadge status={record.severity ?? "Severity unavailable"} />
			</PageHeader>
			<section className="ar-detail-panel" aria-label="Exception overview">
				<SectionHeader
					title="Exception Overview"
					description={record.exceptionId}
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
					<DetailField
						label="Exception ID"
						value={record.exceptionId || "Unavailable"}
					/>
					<DetailField
						label="Claim ID"
						value={record.claimId || "Unavailable"}
					/>
					<DetailField label="Type" value={record.type ?? "Not recorded"} />
					<DetailField label="Source Workstream" value={record.sourceModule} />
					<DetailField
						label="Severity"
						value={record.severity ?? "Unavailable"}
					/>
					<DetailField label="Status" value={record.status ?? "Unavailable"} />
					<DetailField label="Owner" value={record.owner ?? "Not recorded"} />
					<DetailField
						label="Created Date"
						value={showDate(record.createdDate)}
					/>
					<DetailField
						label="Follow-Up"
						value={
							record.status
								? record.followUpRequired
									? "Required"
									: "Not required"
								: "Unavailable"
						}
					/>
				</div>
				{record.description ? (
					<p className="exception-description">{record.description}</p>
				) : (
					<p className="exception-description exception-description--muted">
						Description not recorded in the approved data.
					</p>
				)}
				{!claim ? (
					<EmptyState
						title="Related claim unavailable"
						description="The source Claim_ID is retained, but no matching claim record was found."
					/>
				) : null}
			</section>
			{claim ? (
				<section className="ar-detail-panel" aria-label="Linked claim context">
					<SectionHeader
						title="Linked Claim Context"
						description="Joined through the source Claim_ID."
					/>
					<div className="ar-detail-grid">
						<DetailField label="Claim ID" value={claim.claimId} />
						<DetailField
							label="Payer"
							value={claim.payerName ?? claim.payerId ?? "Unavailable"}
						/>
						<DetailField label="Claim Status" value={claim.status} />
						<DetailField
							label="Billed Amount"
							value={money(claim.billedAmount)}
						/>
					</div>
				</section>
			) : null}
			{record.sourceModule === "Interoperability" ? (
				<section
					className="ar-detail-panel"
					aria-label="837 transaction context"
				>
					<SectionHeader
						title="837 Transaction Context"
						description="Transaction relationship follows Claim_ID."
					/>
					{record.transaction ? (
						<div className="ar-detail-grid">
							<DetailField
								label="Transaction ID"
								value={record.transaction.transactionId || "Unavailable"}
							/>
							<DetailField
								label="Transaction Status"
								value={record.transaction.status ?? "Unavailable"}
							/>
							<DetailField
								label="Rejection Code"
								value={record.transaction.rejectionCode ?? "Unavailable"}
							/>
							<DetailField
								label="Rejection Reason"
								value={record.transaction.rejectionReason ?? "Unavailable"}
							/>
							<DetailField
								label="Response Date"
								value={showDate(record.transaction.responseDate)}
							/>
						</div>
					) : (
						<EmptyState
							title="837 transaction unavailable"
							description="No 837 transaction with this Claim_ID is present in the approved projection."
						/>
					)}
				</section>
			) : null}
			{record.sourceModule === "Payments" ? (
				<section
					className="ar-detail-panel"
					aria-label="Linked unmatched 835 payments"
				>
					<SectionHeader
						title="Unmatched 835 Payments"
						description="Only source payment rows marked Unmatched and linked by Claim_ID are shown."
					/>
					{record.payments.length ? (
						<ul className="ar-related-list exception-related-list">
							{record.payments.map((payment) => (
								<li key={payment.paymentId}>
									<button
										type="button"
										className="ar-open-button"
										onClick={() => onOpenPayment(payment.paymentId)}
										aria-label={`Open payment ${payment.paymentId}`}
									>
										{payment.paymentId}
									</button>
									<span>
										{payment.transactionId || "Transaction unavailable"}
									</span>
									<span>{payment.reconciliationStatus}</span>
									<strong>{money(payment.paidAmount)}</strong>
								</li>
							))}
						</ul>
					) : (
						<EmptyState
							title="Linked payment unavailable"
							description="No unmatched 835 payment row with this Claim_ID is present in the approved data."
						/>
					)}
				</section>
			) : null}
			{record.sourceModule === "AR Management" ? (
				<section className="ar-detail-panel" aria-label="Linked AR records">
					<SectionHeader
						title="AR Context"
						description="AR rows joined using Claim_ID; no aging value is recalculated here."
					/>
					{record.arRecords.length ? (
						<ul className="ar-related-list exception-related-list">
							{record.arRecords.map((ar) => (
								<li key={ar.arId}>
									<button
										type="button"
										className="ar-open-button"
										onClick={() => onOpenAr(ar.arId)}
										aria-label={`Open AR ${ar.arId}`}
									>
										{ar.arId}
									</button>
									<span>
										{ar.arAge === null
											? "Age unavailable"
											: `${ar.arAge} days · ${ar.agingBucket ?? "Aging bucket unavailable"}`}
									</span>
									<span>{ar.status ?? "Status unavailable"}</span>
									<strong>{money(ar.currentBalance)}</strong>
								</li>
							))}
						</ul>
					) : (
						<EmptyState
							title="Linked AR record unavailable"
							description="No AR row with this Claim_ID is present in the approved data."
						/>
					)}
				</section>
			) : null}
			{record.denials.length ? (
				<section
					className="ar-detail-panel"
					aria-label="Other claim-linked denial context"
				>
					<SectionHeader
						title="Claim-Linked Denial Context"
						description="These denial records share Claim_ID; the source does not identify a direct exception-to-denial key."
					/>
					<ul className="ar-related-list exception-related-list">
						{record.denials.map((denial) => (
							<li key={denial.denialId}>
								<button
									type="button"
									className="ar-open-button"
									onClick={() => onOpenDenial(denial.denialId)}
									aria-label={`Open denial ${denial.denialId}`}
								>
									{denial.denialId}
								</button>
								<span>
									{denial.code ?? "Reason code unavailable"} ·{" "}
									{denial.reason ?? "Reason unavailable"}
								</span>
								<span>{denial.resolutionStatus ?? "Status unavailable"}</span>
								<strong>{money(denial.deniedAmount)}</strong>
							</li>
						))}
					</ul>
				</section>
			) : null}
		</div>
	);
}

export function ExceptionsPage({
	onOpenClaim,
	onOpenPayment,
	onOpenDenial,
	onOpenAr,
	loadData = loadExceptions,
}: {
	onOpenClaim: (claimId: string) => void;
	onOpenPayment: (paymentId: string) => void;
	onOpenDenial: (denialId: string) => void;
	onOpenAr: (arId: string) => void;
	loadData?: () => Promise<ExceptionsData>;
}) {
	const [data, setData] = useState<ExceptionsData>(EMPTY_DATA);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [retry, setRetry] = useState(0);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [filters, setFilters] = useState<ExceptionFilters>(
		EMPTY_EXCEPTION_FILTERS,
	);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const [sort, setSort] = useState<ExceptionSort>({
		field: "severity",
		direction: "ascending",
	});

	useEffect(() => {
		let active = true;
		const request = retry;
		setLoading(true);
		setError(null);
		loadData().then(
			(result) => {
				if (!active || request !== retry) return;
				setData(result);
				setLoading(false);
			},
			(reason: unknown) => {
				if (!active || request !== retry) return;
				setError(reason instanceof Error ? reason.message : String(reason));
				setLoading(false);
			},
		);
		return () => {
			active = false;
		};
	}, [loadData, retry]);

	const filtered = useMemo(
		() => filterExceptions(data.records, filters),
		[data.records, filters],
	);
	const sorted = useMemo(
		() => sortExceptions(filtered, sort),
		[filtered, sort],
	);
	const paginated = useMemo(
		() => paginateExceptions(sorted, page, pageSize),
		[sorted, page, pageSize],
	);
	const selected = selectedId
		? findExceptionById(data.records, selectedId)
		: undefined;
	const statusOptions = useMemo(
		() => unique(data.records.map((record) => record.status)),
		[data.records],
	);
	const typeOptions = useMemo(
		() => unique(data.records.map((record) => record.type)),
		[data.records],
	);
	const severityOptions = useMemo(
		() => unique(data.records.map((record) => record.severity)),
		[data.records],
	);
	const ownerOptions = useMemo(
		() => unique(data.records.map((record) => record.owner)),
		[data.records],
	);
	const activeFilterCount =
		Number(Boolean(filters.status)) +
		Number(Boolean(filters.type)) +
		Number(Boolean(filters.severity)) +
		Number(Boolean(filters.owner)) +
		Number(Boolean(filters.sourceModule)) +
		Number(filters.followUp !== "all");
	const hasQuery = Boolean(filters.search || activeFilterCount);
	function updateFilter<Key extends keyof ExceptionFilters>(
		key: Key,
		value: ExceptionFilters[Key],
	) {
		setFilters((current) => ({ ...current, [key]: value }));
		setPage(1);
	}
	function updateSort(next: DataTableSort) {
		setSort({
			field: next.id as ExceptionSortField,
			direction: next.direction,
		});
		setPage(1);
	}

	if (loading) return <LoadingState label="Loading exceptions" />;
	if (error)
		return (
			<ErrorState
				title="Exception data could not be loaded"
				message={error}
				onRetry={() => setRetry((value) => value + 1)}
			/>
		);
	if (selected) {
		return (
			<ExceptionDetail
				record={selected}
				onBack={() => setSelectedId(null)}
				onOpenClaim={onOpenClaim}
				onOpenPayment={onOpenPayment}
				onOpenDenial={onOpenDenial}
				onOpenAr={onOpenAr}
			/>
		);
	}

	const columns: DataTableColumn<ExceptionRecord>[] = [
		{
			id: "exceptionId",
			label: "Exception ID",
			cell: (record) => (
				<button
					className="ar-open-button"
					type="button"
					aria-label={`Open exception ${record.exceptionId}`}
					onClick={() => setSelectedId(record.exceptionId)}
				>
					{record.exceptionId}
				</button>
			),
			sortValue: (record) => record.exceptionId,
		},
		{
			id: "sourceModule",
			label: "Workstream",
			cell: (record) => record.sourceModule,
			sortValue: (record) => record.sourceModule,
		},
		{
			id: "claimId",
			label: "Claim ID",
			cell: (record) =>
				record.claim ? (
					<button
						className="ar-open-button"
						type="button"
						aria-label={`Open claim ${record.claimId}`}
						onClick={() => onOpenClaim(record.claimId)}
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
			sortValue: (record) => record.claim?.payerName ?? "",
		},
		{
			id: "type",
			label: "Exception Type",
			cell: (record) => record.type ?? "Not recorded",
			sortValue: (record) => record.type ?? "",
		},
		{
			id: "severity",
			label: "Severity",
			cell: (record) =>
				record.severity ? (
					<StatusBadge status={record.severity} />
				) : (
					"Unavailable"
				),
			sortValue: (record) => record.severity ?? "",
		},
		{
			id: "status",
			label: "Status",
			cell: (record) =>
				record.status ? <StatusBadge status={record.status} /> : "Unavailable",
			sortValue: (record) => record.status ?? "",
		},
		{
			id: "createdDate",
			label: "Created Date",
			cell: (record) => showDate(record.createdDate),
			sortValue: (record) => record.createdDate ?? "",
		},
		{
			id: "owner",
			label: "Owner",
			cell: (record) => record.owner ?? "Not recorded",
			sortValue: (record) => record.owner ?? "",
		},
		{
			id: "followUpRequired",
			label: "Follow-Up",
			cell: (record) =>
				record.status
					? record.followUpRequired
						? "Required"
						: "Not required"
					: "Unavailable",
			sortValue: (record) => Number(record.followUpRequired),
		},
	];
	const bars: BarItem[] = data.typeGroups.map((group) => ({
		key: group.type,
		label: group.type,
		detail: "Approved exception records",
		value: formatCount(group.count),
		percent: group.percent,
		color: "var(--chart-violet-1)",
	}));

	return (
		<div className="exceptions-page ar-page">
			<PageHeader
				title="Exceptions"
				subtitle="Operational exception records from the approved synthetic RCM dataset."
			/>
			<section
				className="kpi-grid ar-kpi-grid"
				aria-label="Exception performance indicators"
			>
				<KpiCard
					label="Exception Records"
					value={formatCount(data.summary.totalRecords)}
					description="Records in the approved Exceptions worksheet"
					icon="exceptions"
					variant="violet"
				/>
				<KpiCard
					label="Unresolved"
					value={formatCount(data.summary.unresolvedRecords)}
					description="Status is not Resolved, Closed, Cancelled, or Canceled"
					icon="alert"
					variant="amber"
				/>
				<KpiCard
					label="Critical Unresolved"
					value={formatCount(data.summary.criticalUnresolved)}
					description="Unresolved source records with Critical severity"
					icon="alert"
					variant="blue"
				/>
				<KpiCard
					label="Linked Claims"
					value={formatCount(data.summary.linkedClaimCount)}
					description="Distinct source Claim_ID values matched to Claims"
					icon="claims"
					variant="teal"
				/>
			</section>
			<section className="ar-panel" aria-label="Exception type analysis">
				<SectionHeader
					title="Exception Type Analysis"
					description="Counts and share grouped by the source Exception_Type."
				/>
				<HorizontalBarList
					items={bars}
					ariaLabel="Exception records by source type"
				/>
			</section>
			<section
				className="claims-workspace exceptions-workspace"
				aria-label="Exception work queue"
			>
				<SectionHeader
					title="Exception Work Queue"
					description="Search and review approved exception records and their Claim_ID-linked source context."
				/>
				<div className="claims-search-row">
					<label className="claims-search">
						<Icon name="search" />
						<input
							type="search"
							value={filters.search}
							onChange={(event) => updateFilter("search", event.target.value)}
							placeholder="Search exception ID, claim, payer, type, or owner"
							aria-label="Search exception ID, claim, payer, type, or owner"
						/>
					</label>
					{hasQuery ? (
						<button
							className="clear-filters-button"
							type="button"
							onClick={() => {
								setFilters(EMPTY_EXCEPTION_FILTERS);
								setPage(1);
							}}
						>
							Clear filters
						</button>
					) : null}
				</div>
				<fieldset className="claims-filters exceptions-filters">
					<legend>Filter Exceptions</legend>
					<FilterSelect
						label="Status"
						value={filters.status}
						onChange={(value) => updateFilter("status", value)}
						options={[
							{ value: "", label: "All statuses" },
							...statusOptions.map((value) => ({ value, label: value })),
						]}
					/>
					<FilterSelect
						label="Exception Type"
						value={filters.type}
						onChange={(value) => updateFilter("type", value)}
						options={[
							{ value: "", label: "All types" },
							...typeOptions.map((value) => ({ value, label: value })),
						]}
					/>
					<FilterSelect
						label="Severity"
						value={filters.severity}
						onChange={(value) => updateFilter("severity", value)}
						options={[
							{ value: "", label: "All severities" },
							...severityOptions.map((value) => ({ value, label: value })),
						]}
					/>
					<FilterSelect
						label="Owner"
						value={filters.owner}
						onChange={(value) => updateFilter("owner", value)}
						options={[
							{ value: "", label: "All owners" },
							...ownerOptions.map((value) => ({ value, label: value })),
						]}
					/>
					<FilterSelect
						label="Workstream"
						value={filters.sourceModule}
						onChange={(value) => updateFilter("sourceModule", value)}
						options={[
							{ value: "", label: "All workstreams" },
							...unique(data.records.map((record) => record.sourceModule)).map(
								(value) => ({ value, label: value }),
							),
						]}
					/>
					<FilterSelect
						label="Follow-Up"
						value={filters.followUp}
						onChange={(value) =>
							updateFilter("followUp", value as ExceptionFilters["followUp"])
						}
						options={[
							{ value: "all", label: "All follow-up states" },
							{ value: "required", label: "Required" },
							{ value: "not-required", label: "Not required" },
						]}
					/>
				</fieldset>
				<div className="claims-table-meta">
					<p role="status">
						Showing {paginated.totalItems ? (page - 1) * pageSize + 1 : 0}–
						{Math.min(page * pageSize, paginated.totalItems)} of{" "}
						{formatCount(paginated.totalItems)} exceptions
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
						rowKey={(record) => record.exceptionId}
						label="Exception work queue results"
						sortState={{ id: sort.field, direction: sort.direction }}
						onSortChange={updateSort}
					/>
				) : (
					<EmptyState
						title="No exception records found"
						description={
							hasQuery
								? "Try changing or clearing the search and filters."
								: "No exception records are present in the approved dataset."
						}
					/>
				)}
				<nav
					className="claims-pagination"
					aria-label="Exception work queue pages"
				>
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
