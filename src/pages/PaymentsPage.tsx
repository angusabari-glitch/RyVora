import { useEffect, useMemo, useState } from "react";
import { formatCount, formatCurrency } from "../app/formatters";
import type {
	PaymentFilters,
	PaymentRecord,
	PaymentSort,
} from "../business/payments";
import {
	EMPTY_PAYMENT_FILTERS,
	filterPayments,
	paginatePayments,
	sortPayments,
} from "../business/payments";
import type { DataTableColumn, DataTableSort } from "../components/DataTable";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { FilterSelect } from "../components/FilterSelect";
import { Icon } from "../components/Icon";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import {
	getPaymentsWorkbenchSummary,
	loadPaymentDetail,
	loadPayments,
} from "../services/paymentsService";

const PAGE_SIZES = [25, 50, 100];
const payments = loadPayments();
const summary = getPaymentsWorkbenchSummary();

function showAmount(value: number | null) {
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

function DetailField({
	label,
	children,
}: React.PropsWithChildren<{ label: string }>) {
	return (
		<div className="payment-detail-field">
			<span>{label}</span>
			<strong>{children}</strong>
		</div>
	);
}

function PaymentDetail({
	payment,
	onBack,
	onOpenClaim,
}: {
	payment: PaymentRecord;
	onBack: () => void;
	onOpenClaim: (claimId: string) => void;
}) {
	return (
		<div className="payments-page">
			<button
				className="button-secondary payment-back"
				type="button"
				onClick={onBack}
			>
				<span aria-hidden="true">←</span> Back to Payments
			</button>
			<PageHeader
				title="Payment Detail"
				subtitle="835 remittance and claim-level financial context."
			>
				<StatusBadge status={payment.reconciliationStatus} />
			</PageHeader>
			<section className="payment-detail-panel" aria-label="Payment overview">
				<SectionHeader
					title="Payment Overview"
					description={`Payment ${payment.paymentId}`}
				>
					{payment.claim ? (
						<button
							className="button-secondary"
							type="button"
							onClick={() => onOpenClaim(payment.claimId)}
						>
							Open Claim Detail
						</button>
					) : null}
				</SectionHeader>
				<div className="payment-detail-grid">
					<DetailField label="Payment ID">{payment.paymentId}</DetailField>
					<DetailField label="835 Transaction ID">
						{payment.transactionId || "Unavailable"}
					</DetailField>
					<DetailField label="Payment Date">
						{showDate(payment.paymentDate)}
					</DetailField>
					<DetailField label="Payer">
						{(payment.payerName ?? payment.payerId) || "Unavailable"}
					</DetailField>
					<DetailField label="835 Match Status">
						<StatusBadge status={payment.reconciliationStatus} />
					</DetailField>
					<DetailField label="Payment Method">
						Not available in approved v1.2 data
					</DetailField>
					<DetailField label="Trace / Check / EFT ID">
						Not available in approved v1.2 data
					</DetailField>
				</div>
				{!payment.claim ? (
					<EmptyState
						title="Related claim unavailable"
						description="This payment record has no matching Claim_ID in the approved dataset."
					/>
				) : null}
			</section>
			<section
				className="payment-detail-panel"
				aria-label="Financial reconciliation"
			>
				<SectionHeader
					title="Financial Reconciliation"
					description="Payment and linked claim amounts; missing source amounts remain unavailable."
				/>
				<div className="payment-detail-grid">
					<DetailField label="835 Billed Amount">
						{showAmount(payment.billedAmount)}
					</DetailField>
					<DetailField label="Claim Billed Amount">
						{showAmount(payment.claim?.billedAmount ?? null)}
					</DetailField>
					<DetailField label="Billed Amount Variance">
						{showAmount(payment.billedVariance)}
					</DetailField>
					<DetailField label="Allowed Amount">
						{showAmount(payment.allowedAmount)}
					</DetailField>
					<DetailField label="Paid Amount">
						{showAmount(payment.paidAmount)}
					</DetailField>
					<DetailField label="Adjustment Amount">
						{showAmount(payment.adjustmentAmount)}
					</DetailField>
					<DetailField label="Claim Current AR Balance">
						{showAmount(payment.claim?.outstandingAmount ?? null)}
					</DetailField>
					<DetailField label="Patient Responsibility">
						Not available in approved v1.2 data
					</DetailField>
				</div>
				<p className="payment-detail-note">
					The billed variance compares Payments_835.Billed_Amount with the
					linked Claims.Billed_Amount at cent precision. It is separate from the
					source 835_Match_Status and does not override it.
				</p>
			</section>
			<section className="payment-detail-panel" aria-label="Claim relationship">
				<SectionHeader title="Claim Relationship" />
				{payment.claim ? (
					<div className="payment-detail-grid">
						<DetailField label="Claim ID">{payment.claim.claimId}</DetailField>
						<DetailField label="Claim Status">
							<StatusBadge status={payment.claim.status} />
						</DetailField>
						<DetailField label="Date of Service">
							{showDate(payment.claim.serviceDate)}
						</DetailField>
						<DetailField label="Insurance Type">
							{payment.claim.insuranceType ?? "Unavailable"}
						</DetailField>
					</div>
				) : (
					<EmptyState
						title="Claim relationship unavailable"
						description="No claim-level context can be shown for this payment."
					/>
				)}
			</section>
			<section
				className="payment-detail-panel"
				aria-label="835 remittance context"
			>
				<SectionHeader
					title="835 / ERA Context"
					description="Fields exposed by the approved Payments_835 worksheet."
				/>
				<div className="payment-detail-grid">
					<DetailField label="835 Transaction ID">
						{payment.transactionId || "Unavailable"}
					</DetailField>
					<DetailField label="Payer ID">
						{payment.payerId || "Unavailable"}
					</DetailField>
					<DetailField label="835 Match Status">
						{payment.reconciliationStatus}
					</DetailField>
					<DetailField label="Payment Date">
						{showDate(payment.paymentDate)}
					</DetailField>
				</div>
				<p className="payment-detail-note">
					The workbook contains summary payment fields, not an X12 835 payload,
					payment method, trace number, or patient responsibility amount.
				</p>
			</section>
		</div>
	);
}

export function PaymentsPage({
	onOpenClaim,
	initialPaymentId = null,
	onInitialPaymentHandled,
}: {
	onOpenClaim: (claimId: string) => void;
	initialPaymentId?: string | null;
	onInitialPaymentHandled?: () => void;
}) {
	const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(
		null,
	);
	const [filters, setFilters] = useState<PaymentFilters>(EMPTY_PAYMENT_FILTERS);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const [sort, setSort] = useState<PaymentSort>({
		field: "paymentDate",
		direction: "descending",
	});
	useEffect(() => {
		if (!initialPaymentId) return;
		setSelectedPaymentId(initialPaymentId);
		onInitialPaymentHandled?.();
	}, [initialPaymentId, onInitialPaymentHandled]);
	const filtered = useMemo(() => filterPayments(payments, filters), [filters]);
	const sorted = useMemo(() => sortPayments(filtered, sort), [filtered, sort]);
	const paginated = useMemo(
		() => paginatePayments(sorted, page, pageSize),
		[sorted, page, pageSize],
	);
	const selectedPayment = selectedPaymentId
		? loadPaymentDetail(selectedPaymentId)
		: undefined;
	const payerOptions = useMemo(() => {
		const options = new Map(
			payments.map((payment) => [
				payment.payerId,
				payment.payerName ?? payment.payerId,
			]),
		);
		return [...options.entries()]
			.map(([value, label]) => ({ value, label }))
			.sort((a, b) => a.label.localeCompare(b.label, "en-US"));
	}, []);
	const claimStatusOptions = useMemo(
		() => unique(payments.map((payment) => payment.claim?.status)),
		[],
	);
	const insuranceOptions = useMemo(
		() => unique(payments.map((payment) => payment.claim?.insuranceType)),
		[],
	);
	const activeFilterCount =
		Number(Boolean(filters.payer)) +
		Number(filters.reconciliationStatus !== "all") +
		Number(Boolean(filters.claimStatus)) +
		Number(Boolean(filters.insuranceType)) +
		Number(Boolean(filters.dateFrom)) +
		Number(Boolean(filters.dateTo));
	const countText = `${formatCount(summary.totalPayments)} payment records`;

	function updateFilter<Key extends keyof PaymentFilters>(
		key: Key,
		value: PaymentFilters[Key],
	) {
		setFilters((current) => ({ ...current, [key]: value }));
		setPage(1);
	}

	function updateSort(next: DataTableSort) {
		setSort({
			field: next.id as PaymentSort["field"],
			direction: next.direction,
		});
		setPage(1);
	}

	const columns: DataTableColumn<PaymentRecord>[] = [
		{
			id: "paymentId",
			label: "Payment ID",
			cell: (payment) => (
				<button
					className="payment-open-button"
					type="button"
					onClick={() => setSelectedPaymentId(payment.paymentId)}
					aria-label={`Open payment ${payment.paymentId}`}
				>
					{payment.paymentId}
				</button>
			),
			sortValue: (payment) => payment.paymentId,
			className: "payment-id-cell",
		},
		{
			id: "transactionId",
			label: "835 Transaction ID",
			cell: (payment) => payment.transactionId || "Unavailable",
			sortValue: (payment) => payment.transactionId,
		},
		{
			id: "claimId",
			label: "Claim ID",
			cell: (payment) => payment.claimId || "Unavailable",
			sortValue: (payment) => payment.claimId,
		},
		{
			id: "paymentDate",
			label: "Payment Date",
			cell: (payment) => showDate(payment.paymentDate),
			sortValue: (payment) => payment.paymentDate ?? "",
		},
		{
			id: "payerName",
			label: "Payer",
			cell: (payment) =>
				(payment.payerName ?? payment.payerId) || "Unavailable",
			sortValue: (payment) => payment.payerName ?? payment.payerId,
		},
		{
			id: "billedAmount",
			label: "Billed Amount",
			cell: (payment) => showAmount(payment.billedAmount),
			sortValue: (payment) => payment.billedAmount ?? -1,
			className: "table-number",
		},
		{
			id: "allowedAmount",
			label: "Allowed Amount",
			cell: (payment) => showAmount(payment.allowedAmount),
			sortValue: (payment) => payment.allowedAmount ?? -1,
			className: "table-number",
		},
		{
			id: "paidAmount",
			label: "Paid Amount",
			cell: (payment) => showAmount(payment.paidAmount),
			sortValue: (payment) => payment.paidAmount ?? -1,
			className: "table-number",
		},
		{
			id: "adjustmentAmount",
			label: "Adjustment Amount",
			cell: (payment) => showAmount(payment.adjustmentAmount),
			sortValue: (payment) => payment.adjustmentAmount ?? -1,
			className: "table-number",
		},
		{
			id: "reconciliationStatus",
			label: "835 Match Status",
			cell: (payment) => <StatusBadge status={payment.reconciliationStatus} />,
			sortValue: (payment) => payment.reconciliationStatus,
		},
	];

	if (selectedPaymentId && selectedPayment) {
		return (
			<PaymentDetail
				payment={selectedPayment}
				onBack={() => setSelectedPaymentId(null)}
				onOpenClaim={onOpenClaim}
			/>
		);
	}
	if (selectedPaymentId) {
		return (
			<div className="payments-page">
				<button
					className="button-secondary payment-back"
					type="button"
					onClick={() => setSelectedPaymentId(null)}
				>
					← Back to Payments
				</button>
				<EmptyState
					title="Payment not found"
					description={`No payment with ID ${selectedPaymentId} exists in the approved v1.2 dataset.`}
				/>
			</div>
		);
	}

	const hasActiveQuery = Boolean(filters.search) || activeFilterCount > 0;
	return (
		<div className="payments-page">
			<PageHeader
				title="Payments"
				subtitle="835 payment reconciliation and remittance operations."
			>
				<div className="source-chip">
					<span className="source-chip-dot" aria-hidden="true" />
					835 payment processing <strong>{countText}</strong>
				</div>
			</PageHeader>
			<section
				className="kpi-grid payment-kpi-grid"
				aria-label="Payment performance indicators"
			>
				<KpiCard
					label="835 Records"
					value={formatCount(summary.totalPayments)}
					description="Payment remittance records"
					icon="payments"
					variant="violet"
				/>
				<KpiCard
					label="Total Paid"
					value={showAmount(summary.totalPaidAmount)}
					description="Sum of recorded paid amounts"
					icon="dollar"
					variant="blue"
				/>
				<KpiCard
					label="Total Allowed"
					value={showAmount(summary.totalAllowedAmount)}
					description="Sum of recorded allowed amounts"
					icon="activity"
					variant="teal"
				/>
				<KpiCard
					label="835 Match Rate"
					value={
						summary.matchRate === null
							? "Unavailable"
							: `${(summary.matchRate * 100).toFixed(1)}%`
					}
					description={`${formatCount(summary.matchedCount)} matched · ${formatCount(summary.unmatchedCount)} unmatched source statuses`}
					icon="payments"
					variant="amber"
				/>
			</section>
			<div className="payment-integrity-strip" role="status">
				<span>
					<StatusBadge status="Unmatched" />{" "}
					{formatCount(summary.unmatchedCount)}
					835 records are marked unmatched in the source.
				</span>
				<span>
					{formatCount(summary.billedVarianceCount)} billed amount variances
					across linked claims
				</span>
				{summary.claimsWithoutPaymentCount ? (
					<span>
						{formatCount(summary.claimsWithoutPaymentCount)} claims have no
						linked 835 payment
					</span>
				) : null}
				{summary.statusUnavailableCount ? (
					<span>
						{formatCount(summary.statusUnavailableCount)} reconciliation
						statuses unavailable
					</span>
				) : null}
			</div>
			<section
				className="claims-workspace payments-workspace"
				aria-label="835 reconciliation workbench"
			>
				<SectionHeader
					title="835 Reconciliation Workbench"
					description="Search, review, and compare remittance records with their linked claims."
				/>
				<div className="claims-search-row">
					<label className="claims-search">
						<Icon name="search" />
						<input
							type="search"
							value={filters.search}
							onChange={(event) => updateFilter("search", event.target.value)}
							placeholder="Search payment, 835 transaction, claim, patient, payer"
							aria-label="Search by payment ID, 835 transaction ID, claim ID, patient ID, or payer"
						/>
					</label>
					{hasActiveQuery ? (
						<button
							className="clear-filters-button"
							type="button"
							onClick={() => {
								setFilters(EMPTY_PAYMENT_FILTERS);
								setPage(1);
							}}
						>
							Clear filters
						</button>
					) : null}
				</div>
				<fieldset className="claims-filters payment-filters">
					<legend>Filter Payments</legend>
					<FilterSelect
						label="Payer"
						value={filters.payer}
						onChange={(value) => updateFilter("payer", value)}
						options={[{ value: "", label: "All payers" }, ...payerOptions]}
					/>
					<FilterSelect
						label="835 Match Status"
						value={filters.reconciliationStatus}
						onChange={(value) =>
							updateFilter(
								"reconciliationStatus",
								value as PaymentFilters["reconciliationStatus"],
							)
						}
						options={[
							{ value: "all", label: "All source statuses" },
							{ value: "Matched", label: "Matched" },
							{ value: "Unmatched", label: "Unmatched" },
							{ value: "Unavailable", label: "Unavailable" },
						]}
					/>
					<FilterSelect
						label="Claim Status"
						value={filters.claimStatus}
						onChange={(value) => updateFilter("claimStatus", value)}
						options={[
							{ value: "", label: "All claim statuses" },
							...claimStatusOptions.map((value) => ({ value, label: value })),
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
					<label className="filter-control">
						<span>Payment date from</span>
						<input
							type="date"
							value={filters.dateFrom}
							max={filters.dateTo || undefined}
							onChange={(event) => updateFilter("dateFrom", event.target.value)}
						/>
					</label>
					<label className="filter-control">
						<span>Payment date to</span>
						<input
							type="date"
							value={filters.dateTo}
							min={filters.dateFrom || undefined}
							onChange={(event) => updateFilter("dateTo", event.target.value)}
						/>
					</label>
				</fieldset>
				<div className="claims-table-meta">
					<p role="status">
						Showing {paginated.totalItems ? (page - 1) * pageSize + 1 : 0}–
						{Math.min(page * pageSize, paginated.totalItems)} of{" "}
						{formatCount(paginated.totalItems)} payments
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
						rowKey={(payment) => payment.paymentId}
						label="Payments workbench results"
						sortState={{ id: sort.field, direction: sort.direction }}
						onSortChange={updateSort}
					/>
				) : (
					<EmptyState
						title="No payments found"
						description={
							hasActiveQuery
								? "Try changing or clearing the search and filters."
								: "No 835 payment records are available in the approved dataset."
						}
					/>
				)}
				<nav className="claims-pagination" aria-label="Payment workbench pages">
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
