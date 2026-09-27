import { useEffect, useMemo, useState } from "react";
import { formatCount, formatCurrency } from "../app/formatters";
import {
	EMPTY_CLAIM_FILTERS,
	filterClaims,
	paginateClaims,
	sortClaims,
} from "../business/claims";
import type { DataTableColumn, DataTableSort } from "../components/DataTable";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { FilterSelect } from "../components/FilterSelect";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import type { ClaimFilters, ClaimRecord } from "../data/claimsTypes";
import {
	getClaimsQueueSummary,
	loadClaimDetail,
	loadClaims,
} from "../services/claimsService";

const claims = loadClaims();
const summary = getClaimsQueueSummary();
const PAGE_SIZES = [25, 50, 100];

function showAmount(value: number | null) {
	return value === null ? "—" : formatCurrency(value);
}

function showDate(value: string | null) {
	if (!value) return "—";
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(`${value}T00:00:00Z`));
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="claims-summary-metric">
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	);
}

function DetailField({
	label,
	children,
}: React.PropsWithChildren<{ label: string }>) {
	return (
		<div className="claim-detail-field">
			<span>{label}</span>
			<strong>{children}</strong>
		</div>
	);
}

function ClaimDetail({
	claim,
	onBack,
}: {
	claim: ClaimRecord;
	onBack: () => void;
}) {
	return (
		<div className="claims-page">
			<button
				className="button-secondary claim-back"
				type="button"
				onClick={onBack}
			>
				<span aria-hidden="true">←</span> Back to Claims
			</button>
			<PageHeader
				title="Claim Detail"
				subtitle="Claim-level financial, RCM, and transaction information."
			>
				<StatusBadge status={claim.status} />
			</PageHeader>
			<section className="claim-detail-panel" aria-label="Claim overview">
				<SectionHeader
					title="Claim Overview"
					description={`Claim ${claim.claimId} · ${claim.claimType ?? "Claim type unavailable"}`}
				/>
				<div className="claim-detail-grid">
					<DetailField label="Claim ID">{claim.claimId}</DetailField>
					<DetailField label="Date of Service">
						{showDate(claim.serviceDate)}
					</DetailField>
					<DetailField label="Submission Date">
						{showDate(claim.submissionDate)}
					</DetailField>
					<DetailField label="Patient ID">{claim.patientId}</DetailField>
					<DetailField label="Provider ID">
						{claim.providerId}
						{claim.providerName ? ` · ${claim.providerName}` : ""}
					</DetailField>
					<DetailField label="Payer">
						{claim.payerName ?? claim.payerId}
					</DetailField>
					<DetailField label="Insurance Type">
						{claim.insuranceType ?? "—"}
					</DetailField>
					<DetailField label="Follow-Up">
						{claim.followUpRequired ? "Required" : "Not required"}
					</DetailField>
				</div>
			</section>
			<section
				className="claim-detail-panel"
				aria-label="Claim financial summary"
			>
				<SectionHeader
					title="Financial Summary"
					description="Amounts from claim, remittance, and AR records."
				/>
				<div className="claim-financial-grid">
					<DetailField label="Billed Amount">
						{showAmount(claim.billedAmount)}
					</DetailField>
					<DetailField label="Allowed Amount">
						{showAmount(claim.allowedAmount)}
					</DetailField>
					<DetailField label="Paid Amount">
						{showAmount(claim.paidAmount)}
					</DetailField>
					<DetailField label="Outstanding Amount">
						{showAmount(claim.outstandingAmount)}
					</DetailField>
				</div>
			</section>
			<div className="claim-detail-sections">
				<section className="claim-detail-panel">
					<SectionHeader title="Coding Information" />
					<p className="claim-muted-note">
						Procedure and diagnosis codes are not columns in the approved v1.2
						Claims worksheet.
					</p>
				</section>
				<section className="claim-detail-panel">
					<SectionHeader title="RCM Operations" />
					<div className="claim-detail-grid">
						<DetailField label="Claim Status">
							<StatusBadge status={claim.status} />
						</DetailField>
						<DetailField label="AR Status">{claim.arStatus ?? "—"}</DetailField>
						<DetailField label="AR Age">
							{claim.arAge === null ? "—" : `${claim.arAge} days`}
						</DetailField>
						<DetailField label="AR Aging Bucket">
							{claim.arAgingBucket ?? "—"}
						</DetailField>
						<DetailField label="Follow-Up">
							{claim.followUpRequired
								? claim.nextAction && claim.nextAction.toLowerCase() !== "none"
									? claim.nextAction
									: "Required by claim status or unresolved record"
								: "Not required"}
						</DetailField>
						<DetailField label="Current Owner">
							{claim.currentOwner ?? "—"}
						</DetailField>
					</div>
				</section>
			</div>
			<section className="claim-detail-panel">
				<SectionHeader
					title="Interoperability · 837"
					description="Electronic claim submission record."
				/>
				{claim.transaction837 ? (
					<div className="claim-detail-grid">
						<DetailField label="Transaction ID">
							{claim.transaction837.transactionId}
						</DetailField>
						<DetailField label="Transaction Type">
							{claim.transaction837.type ?? "—"}
						</DetailField>
						<DetailField label="837 Status">
							{claim.transaction837.status ?? "—"}
						</DetailField>
						<DetailField label="Submission Date">
							{showDate(claim.transaction837.submissionDate)}
						</DetailField>
						<DetailField label="Response Date">
							{showDate(claim.transaction837.responseDate)}
						</DetailField>
						<DetailField label="Rejection Code">
							{claim.transaction837.rejectionCode ?? "—"}
						</DetailField>
						{claim.transaction837.rejectionReason ? (
							<DetailField label="Rejection Reason">
								{claim.transaction837.rejectionReason}
							</DetailField>
						) : null}
					</div>
				) : (
					<EmptyState
						title="No 837 transaction available"
						description="The approved dataset has no 837 transaction associated with this claim."
					/>
				)}
			</section>
			<section className="claim-detail-panel">
				<SectionHeader
					title="Payment · 835"
					description="Remittance records linked to this claim."
				/>
				{claim.payments.length ? (
					<div className="claim-related-table-wrap">
						<table
							className="data-table claim-related-table"
							aria-label="Linked 835 payment records"
						>
							<thead>
								<tr>
									<th scope="col">Payment ID</th>
									<th scope="col">835 Transaction</th>
									<th scope="col">Payment Date</th>
									<th scope="col">Allowed</th>
									<th scope="col">Paid</th>
									<th scope="col">Adjustment</th>
									<th scope="col">Match Status</th>
								</tr>
							</thead>
							<tbody>
								{claim.payments.map((payment) => (
									<tr key={payment.paymentId}>
										<td>{payment.paymentId}</td>
										<td>{payment.transactionId}</td>
										<td>{showDate(payment.paymentDate)}</td>
										<td>{showAmount(payment.allowedAmount)}</td>
										<td>{showAmount(payment.paidAmount)}</td>
										<td>{showAmount(payment.adjustmentAmount)}</td>
										<td>{payment.matchStatus ?? "—"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<EmptyState
						title="No payment transaction available"
						description="There is no 835/payment record linked to this claim."
					/>
				)}
			</section>
			<section className="claim-detail-panel">
				<SectionHeader
					title="Denial Information"
					description="Denial record from the approved dataset."
				/>
				{claim.denial ? (
					<div className="claim-detail-grid">
						<DetailField label="Denial ID">{claim.denial.denialId}</DetailField>
						<DetailField label="Denial Code">
							{claim.denial.code ?? "—"}
						</DetailField>
						<DetailField label="Reason">
							{claim.denial.reason ?? "—"}
						</DetailField>
						<DetailField label="Category">
							{claim.denial.category ?? "—"}
						</DetailField>
						<DetailField label="Denial Amount">
							{showAmount(claim.denial.amount)}
						</DetailField>
						<DetailField label="Denial Date">
							{showDate(claim.denial.date)}
						</DetailField>
						<DetailField label="Appeal Status">
							{claim.denial.appealStatus ?? "—"}
						</DetailField>
						<DetailField label="Resolution Status">
							{claim.denial.resolutionStatus ?? "—"}
						</DetailField>
					</div>
				) : (
					<EmptyState
						title="No denial record"
						description="This claim has no denial associated with it in the approved dataset."
					/>
				)}
			</section>
		</div>
	);
}

export function ClaimsPage({
	initialClaimId = null,
	onInitialClaimHandled,
}: {
	initialClaimId?: string | null;
	onInitialClaimHandled?: () => void;
} = {}) {
	const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
	useEffect(() => {
		if (initialClaimId) {
			setSelectedClaimId(initialClaimId);
			onInitialClaimHandled?.();
		}
	}, [initialClaimId, onInitialClaimHandled]);
	const [filters, setFilters] = useState<ClaimFilters>(EMPTY_CLAIM_FILTERS);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const [sort, setSort] = useState<DataTableSort>({
		id: "serviceDate",
		direction: "descending",
	});
	const selectedClaim = selectedClaimId
		? loadClaimDetail(selectedClaimId)
		: undefined;
	const statusOptions = useMemo(
		() => [...new Set(claims.map((claim) => claim.status))].sort(),
		[],
	);
	const insuranceOptions = useMemo(
		() =>
			[
				...new Set(
					claims
						.map((claim) => claim.insuranceType)
						.filter((value): value is string => Boolean(value)),
				),
			].sort(),
		[],
	);
	const arOptions = useMemo(
		() =>
			[
				...new Set(
					claims
						.map((claim) => claim.arStatus)
						.filter((value): value is string => Boolean(value)),
				),
			].sort(),
		[],
	);
	const filtered = useMemo(() => filterClaims(claims, filters), [filters]);
	const sorted = useMemo(
		() =>
			sortClaims(filtered, {
				field: sort.id as keyof ClaimRecord,
				direction: sort.direction,
			}),
		[filtered, sort],
	);
	const paginated = useMemo(
		() => paginateClaims(sorted, page, pageSize),
		[sorted, page, pageSize],
	);
	const activeFilterCount = Object.entries(filters).filter(
		([key, value]) => key !== "search" && value !== "" && value !== "all",
	).length;
	const columns: DataTableColumn<ClaimRecord>[] = [
		{
			id: "claimId",
			label: "Claim ID",
			cell: (claim) => (
				<button
					className="claim-open-button"
					type="button"
					onClick={() => setSelectedClaimId(claim.claimId)}
					aria-label={`Open claim ${claim.claimId}`}
				>
					{claim.claimId}
				</button>
			),
			sortValue: (claim) => claim.claimId,
			className: "claim-id-cell",
		},
		{
			id: "serviceDate",
			label: "Date of Service",
			cell: (claim) => showDate(claim.serviceDate),
			sortValue: (claim) => claim.serviceDate ?? "",
		},
		{
			id: "patientId",
			label: "Patient ID",
			cell: (claim) => claim.patientId,
			sortValue: (claim) => claim.patientId,
		},
		{
			id: "providerId",
			label: "Provider ID",
			cell: (claim) => claim.providerId,
			sortValue: (claim) => claim.providerId,
		},
		{
			id: "insuranceType",
			label: "Insurance Type",
			cell: (claim) => claim.insuranceType ?? "—",
			sortValue: (claim) => claim.insuranceType ?? "",
		},
		{
			id: "billedAmount",
			label: "Billed Amount",
			cell: (claim) => showAmount(claim.billedAmount),
			sortValue: (claim) => claim.billedAmount ?? -1,
			className: "table-number",
		},
		{
			id: "allowedAmount",
			label: "Allowed Amount",
			cell: (claim) => showAmount(claim.allowedAmount),
			sortValue: (claim) => claim.allowedAmount ?? -1,
			className: "table-number",
		},
		{
			id: "paidAmount",
			label: "Paid Amount",
			cell: (claim) => showAmount(claim.paidAmount),
			sortValue: (claim) => claim.paidAmount ?? -1,
			className: "table-number",
		},
		{
			id: "status",
			label: "Claim Status",
			cell: (claim) => <StatusBadge status={claim.status} />,
			sortValue: (claim) => claim.status,
		},
		{
			id: "arStatus",
			label: "AR Status",
			cell: (claim) => claim.arStatus ?? "—",
			sortValue: (claim) => claim.arStatus ?? "",
		},
		{
			id: "followUpRequired",
			label: "Follow-Up Required",
			cell: (claim) => (
				<span
					className={
						claim.followUpRequired
							? "followup-label"
							: "followup-label followup-label--none"
					}
				>
					{claim.followUpRequired ? "Required" : "No"}
				</span>
			),
			sortValue: (claim) => Number(claim.followUpRequired),
		},
	];

	function updateFilter<K extends keyof ClaimFilters>(
		key: K,
		value: ClaimFilters[K],
	) {
		setFilters((current) => ({ ...current, [key]: value }));
		setPage(1);
	}

	function updateSort(next: DataTableSort) {
		setSort(next);
		setPage(1);
	}

	if (selectedClaimId && selectedClaim) {
		return (
			<ClaimDetail
				claim={selectedClaim}
				onBack={() => setSelectedClaimId(null)}
			/>
		);
	}
	if (selectedClaimId) {
		return (
			<div className="claims-page">
				<button
					className="button-secondary claim-back"
					type="button"
					onClick={() => setSelectedClaimId(null)}
				>
					← Back to Claims
				</button>
				<EmptyState
					title="Claim not found"
					description={`No claim with ID ${selectedClaimId} exists in the approved v1.2 dataset.`}
				/>
			</div>
		);
	}

	return (
		<div className="claims-page">
			<PageHeader
				title="Claims"
				subtitle="Claims work queue and RCM operational visibility."
			/>
			<section className="claims-summary" aria-label="Claim population summary">
				<SummaryMetric
					label="Total Claims"
					value={formatCount(summary.totalClaims)}
				/>
				<SummaryMetric
					label="Pending Claims"
					value={formatCount(summary.pendingClaims)}
				/>
				<SummaryMetric
					label="Denied Claims"
					value={formatCount(summary.deniedClaims)}
				/>
				<SummaryMetric
					label="Rejected Claims"
					value={formatCount(summary.rejectedClaims)}
				/>
				<SummaryMetric
					label="Total Billed Amount"
					value={formatCurrency(summary.totalBilledAmount)}
				/>
			</section>
			<section className="claims-workspace" aria-label="Claims work queue page">
				<SectionHeader
					title="Work Queue"
					description="Search, filter, and prioritize claims across the approved RCM dataset."
				/>
				<div className="claims-search-row">
					<label className="claims-search">
						<Icon name="search" />
						<input
							type="search"
							value={filters.search}
							onChange={(event) => updateFilter("search", event.target.value)}
							placeholder="Search claim, patient, provider, or payer"
							aria-label="Search by claim ID, patient ID, provider ID, or payer"
						/>
					</label>
					{activeFilterCount > 0 || filters.search ? (
						<button
							className="clear-filters-button"
							type="button"
							onClick={() => {
								setFilters(EMPTY_CLAIM_FILTERS);
								setPage(1);
							}}
						>
							Clear filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
						</button>
					) : null}
				</div>
				<fieldset className="claims-filters">
					<legend>Filter Claims</legend>
					<FilterSelect
						label="Claim Status"
						value={filters.status}
						onChange={(value) => updateFilter("status", value)}
						options={[
							{ value: "", label: "All statuses" },
							...statusOptions.map((value) => ({ value, label: value })),
						]}
					/>
					<FilterSelect
						label="Insurance Type"
						value={filters.insuranceType}
						onChange={(value) => updateFilter("insuranceType", value)}
						options={[
							{ value: "", label: "All insurance types" },
							...insuranceOptions.map((value) => ({ value, label: value })),
						]}
					/>
					<FilterSelect
						label="AR Status"
						value={filters.arStatus}
						onChange={(value) => updateFilter("arStatus", value)}
						options={[
							{ value: "", label: "All AR statuses" },
							...arOptions.map((value) => ({ value, label: value })),
						]}
					/>
					<FilterSelect
						label="Follow-Up Required"
						value={filters.followUp}
						onChange={(value) =>
							updateFilter("followUp", value as ClaimFilters["followUp"])
						}
						options={[
							{ value: "all", label: "All claims" },
							{ value: "required", label: "Required" },
							{ value: "not-required", label: "Not required" },
						]}
					/>
					<label className="filter-control">
						<span>Date of Service from</span>
						<input
							type="date"
							value={filters.serviceDateFrom}
							max={filters.serviceDateTo || undefined}
							onChange={(event) =>
								updateFilter("serviceDateFrom", event.target.value)
							}
						/>
					</label>
					<label className="filter-control">
						<span>Date of Service to</span>
						<input
							type="date"
							value={filters.serviceDateTo}
							min={filters.serviceDateFrom || undefined}
							onChange={(event) =>
								updateFilter("serviceDateTo", event.target.value)
							}
						/>
					</label>
				</fieldset>
				<div className="claims-table-meta">
					<p role="status">
						Showing {paginated.totalItems ? (page - 1) * pageSize + 1 : 0}–
						{Math.min(page * pageSize, paginated.totalItems)} of{" "}
						{formatCount(paginated.totalItems)} claims
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
						rowKey={(claim) => claim.claimId}
						label="Claims work queue"
						sortState={sort}
						onSortChange={updateSort}
					/>
				) : (
					<EmptyState
						title="No claims found"
						description={
							filters.search || activeFilterCount
								? "Try changing or clearing your search and filters."
								: "There are no claims in this dataset."
						}
					/>
				)}
				<nav className="claims-pagination" aria-label="Claims work queue pages">
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
