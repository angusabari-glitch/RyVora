import { useEffect, useMemo, useState } from "react";
import { formatCount } from "../app/formatters";
import type {
	InteroperabilityFilters,
	InteroperabilityRecord,
	InteroperabilitySort,
	InteroperabilitySortField,
} from "../business/interoperability";
import {
	EMPTY_INTEROPERABILITY_FILTERS,
	filterInteroperability,
	findInteroperabilityById,
	getInteroperabilityOptions,
	paginateInteroperability,
	sortInteroperability,
} from "../business/interoperability";
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
import type { InteroperabilityData } from "../services/interoperabilityService";
import { loadInteroperability } from "../services/interoperabilityService";

const PAGE_SIZES = [25, 50, 100];

function showDate(value: string | null) {
	if (!value) return "Not recorded";
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(`${value}T00:00:00Z`));
}

function Field({ label, value }: { label: string; value: string }) {
	return (
		<div className="ar-detail-field">
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	);
}

function LinkedList({
	label,
	titles,
	description,
}: {
	label: string;
	titles: string[];
	description: string;
}) {
	if (!titles.length) return null;
	return (
		<section className="ar-detail-panel" aria-label={label}>
			<SectionHeader title={label} description={description} />
			<ul className="ar-related-list">
				{titles.map((title) => (
					<li key={title}>
						<strong>{title}</strong>
					</li>
				))}
			</ul>
		</section>
	);
}

function InteroperabilityDetail({
	record,
	onBack,
	onOpenClaim,
}: {
	record: InteroperabilityRecord;
	onBack: () => void;
	onOpenClaim: (claimId: string) => void;
}) {
	return (
		<div className="interoperability-page ar-page">
			<button
				className="button-secondary ar-back"
				type="button"
				onClick={onBack}
			>
				<span aria-hidden="true">←</span> Back to Interoperability
			</button>
			<PageHeader
				title="Interoperability Detail"
				subtitle="Approved source transaction and linked RCM context. This view is read-only."
			>
				<StatusBadge status={record.status ?? "Status unavailable"} />
			</PageHeader>
			<section className="ar-detail-panel" aria-label="Transaction overview">
				<SectionHeader
					title="Transaction Overview"
					description={record.transactionId}
				>
					{record.claim ? (
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
					<Field label="Transaction ID" value={record.transactionId} />
					<Field
						label="Interface"
						value={record.interfaceName ?? "Not recorded"}
					/>
					<Field
						label="Transaction Type"
						value={record.transactionType ?? "Not recorded"}
					/>
					<Field label="Status" value={record.status ?? "Not recorded"} />
					<Field
						label="Source System"
						value={record.sourceSystem ?? "Not recorded"}
					/>
					<Field
						label="Destination System"
						value={record.destinationSystem ?? "Not recorded"}
					/>
					<Field
						label="Processed Date"
						value={showDate(record.responseDate ?? record.submissionDate)}
					/>
					<Field label="Direction" value={record.direction ?? "Not recorded"} />
					<Field label="Owner" value={record.owner ?? "Not recorded"} />
					<Field label="Created Date" value={showDate(record.createdDate)} />
				</div>
			</section>
			<section className="ar-detail-panel" aria-label="Processing context">
				<SectionHeader
					title="Processing Context"
					description="Fields available from Claim_Transactions_837."
				/>
				<div className="ar-detail-grid">
					<Field
						label="Source Status"
						value={record.status ?? "Not recorded"}
					/>
					<Field
						label="Submission Date"
						value={showDate(record.submissionDate)}
					/>
					<Field label="Response Date" value={showDate(record.responseDate)} />
					<Field
						label="Rejection Code"
						value={record.rejectionCode ?? "Not recorded"}
					/>
				</div>
			</section>
			{record.errorState === "Error recorded" ? (
				<section
					className="ar-detail-panel"
					aria-label="Error and exception context"
				>
					<SectionHeader
						title="Error / Exception Context"
						description="Error fields and exception links come from the approved source records."
					/>
					<div className="ar-detail-grid">
						<Field
							label="Error Code"
							value={record.rejectionCode ?? "Not recorded"}
						/>
						<Field
							label="Error Category"
							value={
								record.rejectionCode ? "837 rejection" : "Status rejection"
							}
						/>
						<Field
							label="Resolution / Follow-Up"
							value={
								record.exceptions.length
									? record.exceptions
											.map((item) => item.status ?? "Not recorded")
											.join(", ")
									: "No linked 837 exception record"
							}
						/>
					</div>
					<p className="exception-description">
						{record.errorMessage ??
							"No source rejection description was recorded."}
					</p>
					{record.exceptions.length ? (
						<ul className="ar-related-list">
							{record.exceptions.map((exception) => (
								<li key={exception.exceptionId}>
									<strong>Related exception {exception.exceptionId}</strong>
									<span>{exception.status ?? "Status not recorded"}</span>
								</li>
							))}
						</ul>
					) : null}
				</section>
			) : (
				<section
					className="ar-detail-panel"
					aria-label="Error and exception context"
				>
					<SectionHeader title="Error / Exception Context" />
					<EmptyState
						title="No processing exception"
						description="This transaction has no recorded interoperability exception."
					/>
				</section>
			)}
			{record.claim ? (
				<section className="ar-detail-panel" aria-label="Linked claim context">
					<SectionHeader
						title="Linked Claim Context"
						description="Joined by the source Claim_ID."
					>
						<button
							className="ar-open-button"
							type="button"
							aria-label={`Open claim ${record.claimId}`}
							onClick={() => onOpenClaim(record.claimId)}
						>
							{record.claimId}
						</button>
					</SectionHeader>
					<div className="ar-detail-grid">
						<Field
							label="Payer"
							value={record.claim.payerName ?? "Not recorded"}
						/>
						<Field label="Claim Status" value={record.claim.status} />
						<Field
							label="Billed Amount"
							value={
								record.claim.billedAmount === null
									? "Not recorded"
									: new Intl.NumberFormat("en-US", {
											style: "currency",
											currency: "USD",
										}).format(record.claim.billedAmount)
							}
						/>
						<Field
							label="AR Status"
							value={record.claim.arStatus ?? "Not recorded"}
						/>
					</div>
				</section>
			) : (
				<section className="ar-detail-panel" aria-label="Linked claim context">
					<SectionHeader title="Linked Claim Context" />
					<EmptyState
						title="No linked claim"
						description="This source transaction has no matching Claim_ID in the approved claim data."
					/>
				</section>
			)}
			<LinkedList
				label="AR Context"
				description="AR records sharing this transaction’s Claim_ID."
				titles={record.arRecords.map(
					(item) =>
						`${item.arId} · ${item.status ?? "Status not recorded"} · ${item.agingBucket ?? "Aging bucket not recorded"}`,
				)}
			/>
			<LinkedList
				label="Payment Context"
				description="Payment records sharing this transaction’s Claim_ID."
				titles={record.payments.map(
					(item) =>
						`${item.paymentId} · ${item.reconciliationStatus} · 835 ${item.transactionId}`,
				)}
			/>
			<LinkedList
				label="Denial Context"
				description="Denial records sharing this transaction’s Claim_ID."
				titles={record.denials.map(
					(item) =>
						`${item.denialId} · ${item.code ?? "Code not recorded"} · ${item.resolutionStatus ?? "Status not recorded"}`,
				)}
			/>
		</div>
	);
}

export function InteroperabilityPage({
	transactionId,
	onOpenTransaction,
	onBackToQueue,
	onOpenClaim,
	loadData = loadInteroperability,
}: {
	transactionId: string | null;
	onOpenTransaction: (transactionId: string) => void;
	onBackToQueue: () => void;
	onOpenClaim: (claimId: string) => void;
	loadData?: () => Promise<InteroperabilityData>;
}) {
	const [data, setData] = useState<InteroperabilityData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [retry, setRetry] = useState(0);
	const [filters, setFilters] = useState<InteroperabilityFilters>(
		EMPTY_INTEROPERABILITY_FILTERS,
	);
	const [sort, setSort] = useState<InteroperabilitySort>({
		field: "transactionId",
		direction: "ascending",
	});
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);

	useEffect(() => {
		void retry;
		let active = true;
		setLoading(true);
		setError(null);
		loadData()
			.then((result) => {
				if (active) setData(result);
			})
			.catch((reason: unknown) => {
				if (active)
					setError(
						reason instanceof Error
							? reason.message
							: "An unexpected error occurred.",
					);
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [loadData, retry]);

	const filtered = useMemo(
		() => (data ? filterInteroperability(data.records, filters) : []),
		[data, filters],
	);
	const sorted = useMemo(
		() => sortInteroperability(filtered, sort),
		[filtered, sort],
	);
	const paginated = useMemo(
		() => paginateInteroperability(sorted, page, pageSize),
		[sorted, page, pageSize],
	);
	const selected =
		data && transactionId
			? findInteroperabilityById(data.records, transactionId)
			: null;
	const options = useMemo(
		() =>
			data
				? {
						status: getInteroperabilityOptions(data.records, "status"),
						interfaceName: getInteroperabilityOptions(
							data.records,
							"interfaceName",
						),
						transactionType: getInteroperabilityOptions(
							data.records,
							"transactionType",
						),
						sourceSystem: getInteroperabilityOptions(
							data.records,
							"sourceSystem",
						),
						destinationSystem: getInteroperabilityOptions(
							data.records,
							"destinationSystem",
						),
						errorState: getInteroperabilityOptions(data.records, "errorState"),
					}
				: {
						status: [],
						interfaceName: [],
						transactionType: [],
						sourceSystem: [],
						destinationSystem: [],
						errorState: [],
					},
		[data],
	);

	function updateFilter<Key extends keyof InteroperabilityFilters>(
		key: Key,
		value: InteroperabilityFilters[Key],
	) {
		setFilters((current) => ({ ...current, [key]: value }));
		setPage(1);
	}

	function updateSort(next: DataTableSort) {
		setSort({
			field: next.id as InteroperabilitySortField,
			direction: next.direction,
		});
		setPage(1);
	}

	if (loading) return <LoadingState label="Loading interoperability" />;
	if (error)
		return (
			<ErrorState
				title="Interoperability data could not be loaded"
				message={error}
				onRetry={() => setRetry((value) => value + 1)}
			/>
		);
	if (!data)
		return (
			<EmptyState
				title="Interoperability data unavailable"
				description="No interoperability dataset was returned."
			/>
		);
	if (transactionId) {
		if (!selected)
			return (
				<div className="interoperability-page ar-page">
					<button
						className="button-secondary ar-back"
						type="button"
						onClick={onBackToQueue}
					>
						Back to Interoperability
					</button>
					<EmptyState
						title="Transaction not found"
						description={`No approved transaction was found for ${transactionId}.`}
					/>
				</div>
			);
		return (
			<InteroperabilityDetail
				record={selected}
				onBack={onBackToQueue}
				onOpenClaim={onOpenClaim}
			/>
		);
	}

	const statusBars: BarItem[] = data.statusGroups.map((group) => ({
		key: group.key,
		label: group.label,
		detail: "Source 837 processing status",
		value: formatCount(group.count),
		percent: group.percent,
		color:
			group.label.toLowerCase() === "rejected"
				? "#b74752"
				: "var(--chart-violet-1)",
	}));
	const typeBars: BarItem[] = data.typeGroups.map((group) => ({
		key: group.key,
		label: group.label,
		detail: "Source transaction type",
		value: formatCount(group.count),
		percent: group.percent,
		color: "var(--chart-violet-2)",
	}));
	const columns: DataTableColumn<InteroperabilityRecord>[] = [
		{
			id: "transactionId",
			label: "Transaction ID",
			cell: (record) => (
				<button
					className="ar-open-button"
					type="button"
					aria-label={`Open transaction ${record.transactionId}`}
					onClick={() => onOpenTransaction(record.transactionId)}
				>
					{record.transactionId}
				</button>
			),
			sortValue: (record) => record.transactionId,
		},
		{
			id: "interfaceName",
			label: "Interface",
			cell: (record) => record.interfaceName ?? "Not recorded",
			sortValue: (record) => record.interfaceName ?? "",
		},
		{
			id: "transactionType",
			label: "Transaction Type",
			cell: (record) => record.transactionType ?? "Not recorded",
			sortValue: (record) => record.transactionType ?? "",
		},
		{
			id: "sourceSystem",
			label: "Source",
			cell: (record) => record.sourceSystem ?? "Not recorded",
			sortValue: (record) => record.sourceSystem ?? "",
		},
		{
			id: "destinationSystem",
			label: "Destination",
			cell: (record) => record.destinationSystem ?? "Not recorded",
			sortValue: (record) => record.destinationSystem ?? "",
		},
		{
			id: "status",
			label: "Status",
			cell: (record) =>
				record.status ? <StatusBadge status={record.status} /> : "Unavailable",
			sortValue: (record) => record.status ?? "",
		},
		{
			id: "processedDate",
			label: "Processed Date",
			cell: (record) => showDate(record.responseDate ?? record.submissionDate),
			sortValue: (record) => record.responseDate ?? record.submissionDate ?? "",
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
					record.claimId || "Not recorded"
				),
			sortValue: (record) => record.claimId,
		},
		{
			id: "errorState",
			label: "Error / Exception",
			cell: (record) =>
				record.errorState === "Error recorded" ? (
					<span
						title={record.errorMessage ?? record.rejectionCode ?? undefined}
					>
						{record.exceptions.length
							? `${record.exceptions.length} linked exception${record.exceptions.length === 1 ? "" : "s"}`
							: (record.rejectionCode ?? record.errorState)}
					</span>
				) : (
					record.errorState
				),
			sortValue: (record) => record.errorState,
		},
	];
	const activeFilterCount =
		Number(Boolean(filters.status)) +
		Number(Boolean(filters.interfaceName)) +
		Number(Boolean(filters.transactionType)) +
		Number(Boolean(filters.sourceSystem)) +
		Number(Boolean(filters.destinationSystem)) +
		Number(Boolean(filters.errorState));
	const hasQuery = Boolean(filters.search || activeFilterCount);

	return (
		<div className="interoperability-page ar-page">
			<PageHeader
				title="Interoperability"
				subtitle="Healthcare data exchange, interface activity, and transaction operations."
			/>
			<p className="interop-source-note">
				Source: approved synthetic dataset {data.version}. This view uses the
				Claim_Transactions_837 worksheet; interface and system endpoints are not
				recorded in that source.
			</p>
			<section
				className="kpi-grid ar-kpi-grid"
				aria-label="Interoperability operational summary"
			>
				<KpiCard
					label="Interface Records"
					value={formatCount(data.summary.totalRecords)}
					description="Total interface transaction records in the approved interoperability dataset."
					icon="interoperability"
					variant="violet"
				/>
				<KpiCard
					label="Successful Transactions"
					value={formatCount(data.summary.successfulTransactions)}
					description="Transactions accepted in the source 837 response status."
					icon="activity"
					variant="teal"
				/>
				<KpiCard
					label="Failed Transactions"
					value={formatCount(data.summary.failedTransactions)}
					description="Rejected transactions requiring operational review."
					icon="alert"
					variant="amber"
				/>
				<KpiCard
					label="Success Rate"
					value={
						data.summary.successRate === null
							? "Unavailable"
							: `${(data.summary.successRate * 100).toFixed(1)}%`
					}
					description="Accepted transactions divided by all source transactions."
					icon="analytics"
					variant="blue"
				/>
			</section>
			<div className="interop-analysis-grid">
				<section className="ar-panel" aria-label="Interface Health">
					<SectionHeader
						title="Interface Health"
						description="Distribution by the source 837_Status vocabulary."
					/>
					<HorizontalBarList
						items={statusBars}
						ariaLabel="Interoperability records by source status"
					/>
				</section>
				<section className="ar-panel" aria-label="Transaction type analysis">
					<SectionHeader
						title="Transaction Type Analysis"
						description="Counts and share grouped by source Transaction_Type."
					/>
					<HorizontalBarList
						items={typeBars}
						ariaLabel="Interoperability records by transaction type"
					/>
				</section>
			</div>
			<section
				className="claims-workspace interoperability-workspace"
				aria-label="Interoperability work queue"
			>
				<SectionHeader
					title="Interoperability Work Queue"
					description="Search and review approved 837 transactions and their Claim_ID-linked processing context."
				/>
				<div className="claims-search-row">
					<label className="claims-search">
						<Icon name="search" />
						<input
							type="search"
							value={filters.search}
							onChange={(event) => updateFilter("search", event.target.value)}
							placeholder="Search transaction ID, interface, source, destination, claim, or error"
							aria-label="Search transaction ID, interface, source, destination, claim, or error"
						/>
					</label>
					{hasQuery ? (
						<button
							className="clear-filters-button"
							type="button"
							onClick={() => {
								setFilters(EMPTY_INTEROPERABILITY_FILTERS);
								setPage(1);
							}}
						>
							Clear filters
						</button>
					) : null}
				</div>
				<fieldset className="claims-filters interoperability-filters">
					<legend>Filter Interoperability</legend>
					{(
						[
							["status", "Status", "All statuses"],
							["interfaceName", "Interface", "All interfaces"],
							["transactionType", "Transaction Type", "All transaction types"],
							["sourceSystem", "Source System", "All source systems"],
							[
								"destinationSystem",
								"Destination System",
								"All destination systems",
							],
							["errorState", "Error / Exception", "All error states"],
						] as const
					).map(([key, label, allLabel]) => (
						<FilterSelect
							key={key}
							label={label}
							value={filters[key]}
							onChange={(value) => updateFilter(key, value)}
							options={[
								{ value: "", label: allLabel },
								...options[key].map((value) => ({ value, label: value })),
							]}
						/>
					))}
				</fieldset>
				<div className="claims-table-meta">
					<p role="status">
						Showing{" "}
						{paginated.totalItems ? (paginated.page - 1) * pageSize + 1 : 0}–
						{Math.min(paginated.page * pageSize, paginated.totalItems)} of{" "}
						{formatCount(paginated.totalItems)} interoperability records
					</p>
					<label className="page-size-control">
						Rows per page{" "}
						<select
							aria-label="Rows per page"
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
						rowKey={(record) => record.transactionId}
						label="Interoperability work queue results"
						sortState={{ id: sort.field, direction: sort.direction }}
						onSortChange={updateSort}
					/>
				) : (
					<EmptyState
						title="No interoperability records found"
						description={
							hasQuery
								? "Try changing or clearing the search and filters."
								: "No interoperability transaction records are present in the approved dataset."
						}
					/>
				)}
				<nav
					className="claims-pagination"
					aria-label="Interoperability work queue pages"
				>
					<span>
						Page {paginated.totalItems ? paginated.page : 0} of{" "}
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
						disabled={paginated.page >= paginated.totalPages}
					>
						Next
					</button>
				</nav>
			</section>
		</div>
	);
}
