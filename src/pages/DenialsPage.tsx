import { useEffect, useMemo, useState } from "react";
import { formatCount, formatCurrency } from "../app/formatters";
import type {
	DenialFilters,
	DenialRecord,
	DenialSort,
} from "../business/denials";
import {
	EMPTY_DENIAL_FILTERS,
	filterDenials,
	groupDenialsByReason,
	sortDenials,
} from "../business/denials";
import type { DataTableColumn, DataTableSort } from "../components/DataTable";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { FilterSelect } from "../components/FilterSelect";
import { HorizontalBarList } from "../components/HorizontalBarList";
import { Icon } from "../components/Icon";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import {
	getDenialsWorkbenchSummary,
	loadDenialDetail,
	loadDenials,
} from "../services/denialsService";

const PAGE_SIZES = [25, 50, 100];
const denials = loadDenials();
const summary = getDenialsWorkbenchSummary();
const reasonGroups = groupDenialsByReason(denials);

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

function DetailField({
	label,
	children,
}: React.PropsWithChildren<{ label: string }>) {
	return (
		<div className="denial-detail-field">
			<span>{label}</span>
			<strong>{children}</strong>
		</div>
	);
}

function DenialDetail({
	denial,
	onBack,
	onOpenClaim,
}: {
	denial: DenialRecord;
	onBack: () => void;
	onOpenClaim: (claimId: string) => void;
}) {
	const recommendation = denial.aiRecommendation;
	return (
		<div className="denials-page">
			<button
				className="button-secondary denial-back"
				type="button"
				onClick={onBack}
			>
				<span aria-hidden="true">←</span> Back to Denials
			</button>
			<PageHeader
				title="Denial Detail"
				subtitle="Denial, claim, recommendation, and human-review context."
			>
				<StatusBadge status={denial.resolutionStatus ?? "Status unavailable"} />
			</PageHeader>
			<section className="denial-detail-panel" aria-label="Denial overview">
				<SectionHeader
					title="Denial Overview"
					description={`Denial ${denial.denialId}`}
				>
					{denial.claim ? (
						<button
							className="button-secondary"
							type="button"
							onClick={() => onOpenClaim(denial.claimId)}
						>
							Open Claim Detail
						</button>
					) : null}
				</SectionHeader>
				<div className="denial-detail-grid">
					<DetailField label="Denial ID">{denial.denialId}</DetailField>
					<DetailField label="Claim ID">{denial.claimId}</DetailField>
					<DetailField label="Claim Status">
						{denial.claim ? <StatusBadge status={denial.claim.status} /> : "—"}
					</DetailField>
					<DetailField label="Denial Reason">
						{denial.reason ?? "—"}
					</DetailField>
					<DetailField label="Reason Code">{denial.code ?? "—"}</DetailField>
					<DetailField label="Denial Category">
						{denial.category ?? "—"}
					</DetailField>
					<DetailField label="Date of Service">
						{showDate(denial.claim?.serviceDate ?? null)}
					</DetailField>
					<DetailField label="Denial Date">{showDate(denial.date)}</DetailField>
					<DetailField label="Payer">
						{denial.claim?.payerName ?? denial.claim?.payerId ?? "—"}
					</DetailField>
					<DetailField label="Insurance Type">
						{denial.claim?.insuranceType ?? "—"}
					</DetailField>
					<DetailField label="Appeal Status">
						{denial.appealStatus ?? "—"}
					</DetailField>
					<DetailField label="Resolution Status">
						{denial.resolutionStatus ?? "—"}
					</DetailField>
					<DetailField label="Follow-Up">
						{denial.followUpRequired ? "Required" : "Not required"}
					</DetailField>
					<DetailField label="Corrective Action">
						{denial.correctiveAction ?? "—"}
					</DetailField>
				</div>
				{!denial.claim ? (
					<EmptyState
						title="Related claim unavailable"
						description="No matching claim record was found in the approved dataset."
					/>
				) : null}
			</section>
			<section
				className="denial-detail-panel"
				aria-label="Denial financial context"
			>
				<SectionHeader
					title="Financial Context"
					description="Amounts from the denial, claim, payment, and AR records."
				/>
				<div className="denial-detail-grid">
					<DetailField label="Denied Amount">
						{showAmount(denial.deniedAmount)}
					</DetailField>
					<DetailField label="Billed Amount">
						{showAmount(denial.claim?.billedAmount ?? null)}
					</DetailField>
					<DetailField label="Allowed Amount">
						{showAmount(denial.claim?.allowedAmount ?? null)}
					</DetailField>
					<DetailField label="Paid Amount">
						{showAmount(denial.claim?.paidAmount ?? null)}
					</DetailField>
					<DetailField label="Outstanding Amount">
						{showAmount(denial.claim?.outstandingAmount ?? null)}
					</DetailField>
				</div>
			</section>
			<section
				className="denial-detail-panel denial-recommendation"
				aria-label="AI recommendation"
			>
				<SectionHeader
					title="AI Recommendation"
					description="Dataset-provided recommendation · informational only"
				/>
				{recommendation ? (
					<>
						{recommendation.text ? (
							<p className="denial-recommendation-text">
								{recommendation.text}
							</p>
						) : (
							<EmptyState
								title="Recommendation text unavailable"
								description="The recommendation record does not contain recommendation text."
							/>
						)}
						<div className="denial-detail-grid">
							<DetailField label="Recommendation ID">
								{recommendation.id || "—"}
							</DetailField>
							<DetailField label="Recommendation Type">
								{recommendation.type ?? "—"}
							</DetailField>
							<DetailField label="Recommendation Status">
								{recommendation.status ?? "—"}
							</DetailField>
							<DetailField label="Confidence">
								{recommendation.confidence === null
									? "—"
									: `${(recommendation.confidence * 100).toFixed(0)}%`}
							</DetailField>
							<DetailField label="Generated Date">
								{showDate(recommendation.generatedDate)}
							</DetailField>
						</div>
					</>
				) : (
					<EmptyState
						title="No AI recommendation"
						description="No recommendation record is linked to this denial in the approved dataset."
					/>
				)}
				<p className="denial-human-control-note">
					AI recommendation ≠ final human decision. This view is read-only; the
					AI does not resolve or update the denial.
				</p>
			</section>
			<section className="denial-detail-panel" aria-label="Human review">
				<SectionHeader
					title="Human Review"
					description="Human-in-the-loop review records are separate from AI output."
				/>
				{denial.humanReviews.length ? (
					<div className="denial-review-list">
						{denial.humanReviews.map((review) => (
							<article className="denial-review-record" key={review.id}>
								<div className="denial-review-heading">
									<strong>{review.decision ?? "Review recorded"}</strong>
									<span>{showDate(review.reviewDate)}</span>
								</div>
								<div className="denial-detail-grid">
									<DetailField label="Review ID">
										{review.id || "—"}
									</DetailField>
									<DetailField label="Reviewer Role">
										{review.reviewerRole ?? "—"}
									</DetailField>
									<DetailField label="Override">
										{review.override ?? "—"}
									</DetailField>
									<DetailField label="Final Action">
										{review.finalAction ?? "—"}
									</DetailField>
									{review.overrideReason ? (
										<DetailField label="Override Reason">
											{review.overrideReason}
										</DetailField>
									) : null}
								</div>
							</article>
						))}
					</div>
				) : (
					<EmptyState
						title="Human review pending"
						description="No human review record is linked to this recommendation. No reviewer decision has been inferred."
					/>
				)}
			</section>
		</div>
	);
}

export function DenialsPage({
	onOpenClaim,
	initialDenialId = null,
	onInitialDenialHandled,
}: {
	onOpenClaim: (claimId: string) => void;
	initialDenialId?: string | null;
	onInitialDenialHandled?: () => void;
}) {
	const [selectedDenialId, setSelectedDenialId] = useState<string | null>(null);
	const [filters, setFilters] = useState<DenialFilters>(EMPTY_DENIAL_FILTERS);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const [sort, setSort] = useState<DenialSort>({
		field: "followUpRequired",
		direction: "descending",
	});
	useEffect(() => {
		if (!initialDenialId) return;
		setSelectedDenialId(initialDenialId);
		onInitialDenialHandled?.();
	}, [initialDenialId, onInitialDenialHandled]);
	const filtered = useMemo(() => filterDenials(denials, filters), [filters]);
	const sorted = useMemo(() => sortDenials(filtered, sort), [filtered, sort]);
	const totalPages = Math.ceil(sorted.length / pageSize);
	const safePage = Math.min(page, Math.max(totalPages, 1));
	const visibleDenials = sorted.slice(
		(safePage - 1) * pageSize,
		safePage * pageSize,
	);
	const selectedDenial = selectedDenialId
		? loadDenialDetail(selectedDenialId)
		: undefined;
	const activeFilterCount = Object.entries(filters).filter(
		([key, value]) => key !== "search" && value !== "" && value !== "all",
	).length;
	const unique = (values: Array<string | null | undefined>) =>
		[
			...new Set(values.filter((value): value is string => Boolean(value))),
		].sort((a, b) => a.localeCompare(b));
	const payerOptions = unique(
		denials.map((denial) => denial.claim?.payerName ?? denial.claim?.payerId),
	);
	const insuranceOptions = unique(
		denials.map((denial) => denial.claim?.insuranceType),
	);
	const claimStatusOptions = unique(
		denials.map((denial) => denial.claim?.status),
	);
	const reasonOptions = unique(denials.map((denial) => denial.reason));
	const codeOptions = unique(denials.map((denial) => denial.code));

	function updateFilter<K extends keyof DenialFilters>(
		key: K,
		value: DenialFilters[K],
	) {
		setFilters((current) => ({ ...current, [key]: value }));
		setPage(1);
	}
	function updateSort(next: DataTableSort) {
		setSort({
			field: next.id as DenialSort["field"],
			direction: next.direction,
		});
		setPage(1);
	}
	const columns: DataTableColumn<DenialRecord>[] = [
		{
			id: "denialId",
			label: "Denial ID",
			cell: (denial) => (
				<button
					className="claim-open-button"
					type="button"
					aria-label={`Open denial ${denial.denialId}`}
					onClick={() => setSelectedDenialId(denial.denialId)}
				>
					{denial.denialId}
				</button>
			),
			sortValue: (denial) => denial.denialId,
			className: "denial-id-cell",
		},
		{
			id: "claimId",
			label: "Claim ID",
			cell: (denial) => denial.claimId,
			sortValue: (denial) => denial.claimId,
		},
		{
			id: "date",
			label: "Date of Service",
			cell: (denial) => showDate(denial.claim?.serviceDate ?? null),
			sortValue: (denial) => denial.claim?.serviceDate ?? "",
		},
		{
			id: "payer",
			label: "Payer / Plan",
			cell: (denial) => denial.claim?.payerName ?? denial.claim?.payerId ?? "—",
			sortValue: (denial) =>
				denial.claim?.payerName ?? denial.claim?.payerId ?? "",
		},
		{
			id: "code",
			label: "Reason Code",
			cell: (denial) => denial.code ?? "—",
			sortValue: (denial) => denial.code ?? "",
		},
		{
			id: "reason",
			label: "Denial Reason",
			cell: (denial) => (
				<span className="denial-reason-cell">
					{denial.reason ?? "Reason not recorded"}
				</span>
			),
			sortValue: (denial) => denial.reason ?? "",
		},
		{
			id: "deniedAmount",
			label: "Denied Amount",
			cell: (denial) => showAmount(denial.deniedAmount),
			sortValue: (denial) => denial.deniedAmount ?? -1,
			className: "table-number",
		},
		{
			id: "followUpRequired",
			label: "Follow-Up",
			cell: (denial) => (
				<span
					className={
						denial.followUpRequired
							? "followup-label"
							: "followup-label followup-label--none"
					}
				>
					{denial.followUpRequired ? "Required" : "No"}
				</span>
			),
			sortValue: (denial) => Number(denial.followUpRequired),
		},
		{
			id: "reviewStatus",
			label: "Human Review",
			cell: (denial) => <StatusBadge status={denial.reviewStatus} />,
			sortValue: (denial) => denial.reviewStatus,
		},
	];

	if (selectedDenialId && selectedDenial) {
		return (
			<DenialDetail
				denial={selectedDenial}
				onBack={() => setSelectedDenialId(null)}
				onOpenClaim={onOpenClaim}
			/>
		);
	}
	if (selectedDenialId) {
		return (
			<div className="denials-page">
				<button
					className="button-secondary denial-back"
					type="button"
					onClick={() => setSelectedDenialId(null)}
				>
					← Back to Denials
				</button>
				<EmptyState
					title="Denial not found"
					description={`No denial with ID ${selectedDenialId} exists in the approved v1.2 dataset.`}
				/>
			</div>
		);
	}

	const barItems = reasonGroups.map((group) => ({
		key: `${group.code}-${group.reason}`,
		label: group.reason,
		detail: group.code,
		value: formatCount(group.count),
		percent: group.percent,
		color: "var(--chart-violet-1)",
	}));
	const countText = `${formatCount(summary.totalDenials)} denial records`;
	return (
		<div className="denials-page">
			<PageHeader
				title="Denials"
				subtitle="Denial workbench and recovery operations."
			>
				<div className="source-chip">
					<span className="source-chip-dot" aria-hidden="true" />
					Denial management <strong>{countText}</strong>
				</div>
			</PageHeader>
			<section
				className="kpi-grid denial-kpi-grid"
				aria-label="Denial performance indicators"
			>
				<KpiCard
					label="Total Denials"
					value={formatCount(summary.totalDenials)}
					description="Denial records in the approved dataset"
					icon="denials"
					variant="violet"
				/>
				<KpiCard
					label="Denial Rate"
					value={`${(summary.denialRate * 100).toFixed(1)}%`}
					description="Denied claims as a share of claims"
					icon="activity"
					variant="amber"
				/>
				<KpiCard
					label="Denied Amount"
					value={formatCurrency(summary.deniedAmount)}
					description="Aggregate amount from denial records"
					icon="dollar"
					variant="blue"
				/>
				<KpiCard
					label="Follow-Up Required"
					value={formatCount(summary.followUpRequired)}
					description="Open denials or pending/submitted appeals"
					icon="alert"
					variant="teal"
				/>
			</section>
			<section
				className="denials-analysis panel"
				aria-label="Denial reason analysis"
			>
				<SectionHeader
					title="Denial Reason Analysis"
					description="Frequency and share of recorded denial reasons."
				/>
				<HorizontalBarList
					items={barItems}
					ariaLabel="Denial volume by reason and code"
				/>
			</section>
			<section
				className="denials-workspace panel"
				aria-label="Denial workbench"
			>
				<SectionHeader
					title="Denial Workbench"
					description="Search and prioritize denial recovery using linked claim and review records."
				/>
				<div className="claims-search-row">
					<label className="claims-search">
						<Icon name="search" />
						<input
							type="search"
							value={filters.search}
							onChange={(event) => updateFilter("search", event.target.value)}
							placeholder="Search denial, claim, patient, payer, reason code"
							aria-label="Search denials by denial ID, claim ID, patient ID, provider ID, payer, or reason"
						/>
					</label>
					{activeFilterCount > 0 || filters.search ? (
						<button
							className="clear-filters-button"
							type="button"
							onClick={() => {
								setFilters(EMPTY_DENIAL_FILTERS);
								setPage(1);
							}}
						>
							Clear filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
						</button>
					) : null}
				</div>
				<fieldset className="claims-filters denial-filters">
					<legend>Filter Denials</legend>
					<FilterSelect
						label="Denial Reason"
						value={filters.reason}
						onChange={(value) => updateFilter("reason", value)}
						options={[
							{ value: "", label: "All reasons" },
							...reasonOptions.map((value) => ({ value, label: value })),
						]}
					/>
					<FilterSelect
						label="Reason Code"
						value={filters.code}
						onChange={(value) => updateFilter("code", value)}
						options={[
							{ value: "", label: "All codes" },
							...codeOptions.map((value) => ({ value, label: value })),
						]}
					/>
					<FilterSelect
						label="Payer"
						value={filters.payer}
						onChange={(value) => updateFilter("payer", value)}
						options={[
							{ value: "", label: "All payers" },
							...payerOptions.map((value) => ({ value, label: value })),
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
						label="Follow-Up Required"
						value={filters.followUp}
						onChange={(value) =>
							updateFilter("followUp", value as DenialFilters["followUp"])
						}
						options={[
							{ value: "all", label: "All denials" },
							{ value: "required", label: "Required" },
							{ value: "not-required", label: "Not required" },
						]}
					/>
					<FilterSelect
						label="Human Review"
						value={filters.reviewStatus}
						onChange={(value) =>
							updateFilter(
								"reviewStatus",
								value as DenialFilters["reviewStatus"],
							)
						}
						options={[
							{ value: "all", label: "All review states" },
							{ value: "Reviewed", label: "Reviewed" },
							{ value: "Pending", label: "Pending" },
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
				</fieldset>
				<div className="claims-table-meta">
					<p role="status">
						Showing {sorted.length ? (safePage - 1) * pageSize + 1 : 0}–
						{Math.min(safePage * pageSize, sorted.length)} of{" "}
						{formatCount(sorted.length)} denials
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
				{visibleDenials.length ? (
					<DataTable
						rows={visibleDenials}
						columns={columns}
						rowKey={(denial) => denial.denialId}
						label="Denial workbench results"
						sortState={{ id: sort.field, direction: sort.direction }}
						onSortChange={updateSort}
					/>
				) : (
					<EmptyState
						title="No denials found"
						description="No denial records match the current search and filters. Try changing or clearing your criteria."
					/>
				)}
				<nav className="claims-pagination" aria-label="Denial workbench pages">
					<span>
						Page {totalPages ? safePage : 0} of {totalPages}
					</span>
					<button
						className="button-secondary"
						type="button"
						onClick={() => setPage((current) => Math.max(1, current - 1))}
						disabled={safePage <= 1}
					>
						Previous
					</button>
					<button
						className="button-secondary"
						type="button"
						onClick={() =>
							setPage((current) => Math.min(totalPages, current + 1))
						}
						disabled={!totalPages || safePage >= totalPages}
					>
						Next
					</button>
				</nav>
			</section>
		</div>
	);
}
