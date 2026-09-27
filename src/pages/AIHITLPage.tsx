import { useEffect, useMemo, useState } from "react";
import { formatCount, formatCurrency } from "../app/formatters";
import {
	type AIHITLFilters,
	type AIHITLRecord,
	type AIHITLSort,
	type AIHITLSortField,
	EMPTY_AIHITL_FILTERS,
	filterAIHITLRecords,
	findAIHITLRecord,
	paginateAIHITL,
	sortAIHITLRecords,
} from "../business/aiHitl";
import { ChartContainer } from "../components/ChartContainer";
import type { DataTableColumn, DataTableSort } from "../components/DataTable";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FilterSelect } from "../components/FilterSelect";
import { HorizontalBarList } from "../components/HorizontalBarList";
import { KpiCard } from "../components/KpiCard";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import { loadAIHITL } from "../services/aiHitlService";

const PAGE_SIZES = [25, 50, 100];

function showDate(value: string | null | undefined) {
	if (!value) return "—";
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isFinite(date.getTime())
		? new Intl.DateTimeFormat("en-US", {
				month: "short",
				day: "2-digit",
				year: "numeric",
				timeZone: "UTC",
			}).format(date)
		: "—";
}

function confidence(value: number | null) {
	return value === null || !Number.isFinite(value)
		? "—"
		: `${(value * 100).toFixed(0)}%`;
}

function percentage(value: number | null) {
	return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function DetailField({ label, value }: { label: string; value: string }) {
	return (
		<div className="ai-hitl-detail-field">
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	);
}

function RecommendationDetail({
	record,
	onBack,
	onOpenDenial,
	onOpenClaim,
}: {
	record: AIHITLRecord;
	onBack: () => void;
	onOpenDenial: (denialId: string) => void;
	onOpenClaim: (claimId: string) => void;
}) {
	const denial = record.denial;
	const claim = denial.claim;
	return (
		<div className="ai-hitl-page">
			<button
				className="button-secondary ai-hitl-back"
				type="button"
				onClick={onBack}
			>
				← Back to AI / HITL
			</button>
			<PageHeader
				title="AI / HITL"
				subtitle="AI-assisted RCM decision support with human review and controlled outcomes."
			/>
			<div className="ai-hitl-boundary-note">
				<strong>AI recommendation ≠ human decision.</strong> This synthetic,
				read-only view does not infer approval or execute a downstream action.
			</div>
			<section className="ai-hitl-panel" aria-label="Recommendation overview">
				<SectionHeader
					title="Recommendation Overview"
					description={`Recommendation ${record.recommendation.id} · linked denial ${denial.denialId}`}
				>
					<StatusBadge status={record.reviewStatus} />
				</SectionHeader>
				<div className="ai-hitl-detail-grid">
					<DetailField
						label="Recommendation ID"
						value={record.recommendation.id}
					/>
					<DetailField
						label="Claim ID"
						value={record.recommendation.claimId || "—"}
					/>
					<DetailField
						label="Recommendation Type"
						value={record.recommendation.type ?? "Not recorded"}
					/>
					<DetailField
						label="Source AI Status"
						value={record.recommendation.status ?? "Not recorded"}
					/>
					<DetailField
						label="Human Review Status"
						value={record.reviewStatus}
					/>
					<DetailField
						label="Confidence"
						value={confidence(record.recommendation.confidence)}
					/>
					<DetailField
						label="Generated Date"
						value={showDate(record.recommendation.generatedDate)}
					/>
					<DetailField label="Source Workstream" value="Denials" />
				</div>
				<div className="ai-hitl-detail-actions">
					<button
						className="button-secondary"
						type="button"
						onClick={() => onOpenDenial(denial.denialId)}
					>
						Open Denial
					</button>
					{claim ? (
						<button
							className="button-secondary"
							type="button"
							onClick={() => onOpenClaim(claim.claimId)}
						>
							Open Claim
						</button>
					) : null}
				</div>
			</section>
			<section
				className="ai-hitl-panel"
				aria-label="Source facts and RCM context"
			>
				<SectionHeader
					title="Source Facts & RCM Context"
					description="Fields from the linked Denials and Claims projections; missing values remain unavailable."
				/>
				{claim ? (
					<div className="ai-hitl-detail-grid">
						<DetailField
							label="Claim Status"
							value={claim.status || "Not recorded"}
						/>
						<DetailField
							label="Payer"
							value={claim.payerName ?? claim.payerId ?? "Not recorded"}
						/>
						<DetailField
							label="Billed Amount"
							value={
								claim.billedAmount === null
									? "—"
									: formatCurrency(claim.billedAmount)
							}
						/>
						<DetailField
							label="Outstanding Amount"
							value={
								claim.outstandingAmount === null
									? "—"
									: formatCurrency(claim.outstandingAmount)
							}
						/>
						<DetailField
							label="AR Age"
							value={
								claim.arAge === null ? "—" : `${formatCount(claim.arAge)} days`
							}
						/>
						<DetailField
							label="Claim Priority"
							value={claim.priority ?? "Not recorded"}
						/>
						<DetailField
							label="Denial Code"
							value={denial.code ?? "Not recorded"}
						/>
						<DetailField
							label="Denial Category"
							value={denial.category ?? "Not recorded"}
						/>
						<DetailField
							label="Denial Amount"
							value={
								denial.deniedAmount === null
									? "—"
									: formatCurrency(denial.deniedAmount)
							}
						/>
						<DetailField
							label="Denial Reason"
							value={denial.reason ?? "Not recorded"}
						/>
						<DetailField
							label="Denial Follow-Up"
							value={denial.followUpRequired ? "Required" : "Not required"}
						/>
					</div>
				) : (
					<EmptyState
						title="Linked claim context unavailable"
						description="No matching claim record is available for this recommendation in the approved projection."
					/>
				)}
			</section>
			<section className="ai-hitl-panel" aria-label="AI recommendation text">
				<SectionHeader
					title="AI Recommendation"
					description="Dataset-provided text only; no inference service is used."
				/>
				{record.recommendation.text ? (
					<p className="ai-hitl-recommendation-text">
						{record.recommendation.text}
					</p>
				) : (
					<EmptyState
						title="Recommendation text unavailable"
						description="The source recommendation record contains no recommendation text."
					/>
				)}
			</section>
			<section className="ai-hitl-panel" aria-label="Human decision records">
				<SectionHeader
					title="Human Review & Decision"
					description="Human_Reviews rows are shown independently from the AI recommendation and its status."
				/>
				{record.reviews.length ? (
					<div className="ai-hitl-review-list">
						{record.reviews.map((review) => (
							<article key={review.id} className="ai-hitl-review-record">
								<div className="ai-hitl-review-heading">
									<strong>{review.decision ?? "Decision not recorded"}</strong>
									<span>{showDate(review.reviewDate)}</span>
								</div>
								<div className="ai-hitl-detail-grid">
									<DetailField label="Review ID" value={review.id || "—"} />
									<DetailField
										label="Reviewer Role"
										value={review.reviewerRole ?? "Not recorded"}
									/>
									<DetailField
										label="Override Flag"
										value={review.override ?? "Not recorded"}
									/>
									<DetailField
										label="Final Action"
										value={review.finalAction ?? "Not recorded"}
									/>
									{review.overrideReason ? (
										<DetailField
											label="Override Reason"
											value={review.overrideReason}
										/>
									) : null}
								</div>
							</article>
						))}
					</div>
				) : (
					<EmptyState
						title="No linked human review record"
						description="No Human_Reviews row is linked to this recommendation. A reviewer or decision has not been inferred."
					/>
				)}
			</section>
			<section
				className="ai-hitl-panel"
				aria-label="Workflow and auditability limitations"
			>
				<SectionHeader
					title="Related Workflow & Traceability"
					description="Explicit source relationships only."
				/>
				<div className="ai-hitl-detail-grid">
					<DetailField
						label="Related Automation Workflow"
						value="No stable workflow relationship is present in the source."
					/>
					<DetailField
						label="Audit Trail"
						value="Audit_Trail is not projected into the current runtime model; record-level audit history is unavailable here."
					/>
				</div>
			</section>
		</div>
	);
}

export function AIHITLPage({
	recommendationId,
	onOpenRecommendation,
	onBack,
	onOpenDenial,
	onOpenClaim,
	loadData = loadAIHITL,
}: {
	recommendationId: string | null;
	onOpenRecommendation: (recommendationId: string) => void;
	onBack: () => void;
	onOpenDenial: (denialId: string) => void;
	onOpenClaim: (claimId: string) => void;
	loadData?: () => Promise<Awaited<ReturnType<typeof loadAIHITL>>>;
}) {
	const [data, setData] = useState<Awaited<
		ReturnType<typeof loadAIHITL>
	> | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [retry, setRetry] = useState(0);
	const [filters, setFilters] = useState<AIHITLFilters>(EMPTY_AIHITL_FILTERS);
	const [sort, setSort] = useState<AIHITLSort>({
		field: "generatedDate",
		direction: "descending",
	});
	const [page, setPage] = useState(1);
	const [pendingPage, setPendingPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const loadRequest = useMemo(
		() => ({ generation: retry, load: loadData }),
		[loadData, retry],
	);
	useEffect(() => {
		let active = true;
		setLoading(true);
		setError(null);
		loadRequest
			.load()
			.then((value) => {
				if (active) setData(value);
			})
			.catch((reason: unknown) => {
				if (active)
					setError(
						reason instanceof Error
							? reason.message
							: "AI/HITL data could not be loaded.",
					);
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [loadRequest]);
	const records = data?.recommendations ?? [];
	const summary = data?.summary;
	const detail = useMemo(
		() =>
			recommendationId
				? findAIHITLRecord(records, recommendationId)
				: undefined,
		[records, recommendationId],
	);
	const filtered = useMemo(
		() => filterAIHITLRecords(records, filters),
		[records, filters],
	);
	const sorted = useMemo(
		() => sortAIHITLRecords(filtered, sort),
		[filtered, sort],
	);
	const queuePage = useMemo(
		() => paginateAIHITL(sorted, page, pageSize),
		[sorted, page, pageSize],
	);
	const pendingRecords = useMemo(
		() => filtered.filter((record) => record.reviewStatus === "Pending"),
		[filtered],
	);
	const pending = useMemo(
		() => paginateAIHITL(pendingRecords, pendingPage, 10),
		[pendingRecords, pendingPage],
	);
	const recommendationTypeOptions = useMemo(
		() =>
			[
				...new Set(
					records
						.map((record) => record.recommendation.type)
						.filter((value): value is string => Boolean(value)),
				),
			].sort(),
		[records],
	);
	const decisionOptions = useMemo(
		() =>
			[
				...new Set(
					records.flatMap((record) =>
						record.reviews
							.map((review) => review.decision)
							.filter((value): value is string => Boolean(value)),
					),
				),
			].sort(),
		[records],
	);
	const priorityOptions = useMemo(
		() =>
			[
				...new Set(
					records
						.map((record) => record.claimPriority)
						.filter((value): value is string => Boolean(value)),
				),
			].sort(),
		[records],
	);
	const updateFilter = <Key extends keyof AIHITLFilters>(
		key: Key,
		value: AIHITLFilters[Key],
	) => {
		setFilters((current) => ({ ...current, [key]: value }));
		setPage(1);
		setPendingPage(1);
	};
	const updateSort = (next: DataTableSort) => {
		setSort({ field: next.id as AIHITLSortField, direction: next.direction });
		setPage(1);
	};
	const openDetail = (record: AIHITLRecord) =>
		onOpenRecommendation(record.recommendation.id);
	const recommendationColumns: DataTableColumn<AIHITLRecord>[] = [
		{
			id: "recommendationId",
			label: "Recommendation ID",
			cell: (record) => (
				<button
					type="button"
					className="ai-hitl-link"
					onClick={() => openDetail(record)}
					aria-label={`Open recommendation ${record.recommendation.id}`}
				>
					{record.recommendation.id}
				</button>
			),
			sortValue: (record) => record.recommendation.id,
		},
		{
			id: "claimId",
			label: "Claim ID",
			cell: (record) => (
				<button
					type="button"
					className="ai-hitl-link"
					onClick={() => onOpenClaim(record.recommendation.claimId)}
				>
					{record.recommendation.claimId}
				</button>
			),
			sortValue: (record) => record.recommendation.claimId,
		},
		{
			id: "recommendationType",
			label: "Type",
			cell: (record) => record.recommendation.type ?? "—",
			sortValue: (record) => record.recommendation.type ?? "",
		},
		{
			id: "recommendation",
			label: "AI Recommendation",
			cell: (record) => (
				<span className="ai-hitl-text-cell">
					{record.recommendation.text ?? "Not recorded"}
				</span>
			),
		},
		{
			id: "sourceStatus",
			label: "Source AI Status",
			cell: (record) => (
				<StatusBadge status={record.recommendation.status ?? "Not recorded"} />
			),
			sortValue: (record) => record.recommendation.status ?? "",
		},
		{
			id: "reviewStatus",
			label: "Human Review",
			cell: (record) => <StatusBadge status={record.reviewStatus} />,
			sortValue: (record) => record.reviewStatus,
		},
		{
			id: "confidence",
			label: "Confidence",
			cell: (record) => confidence(record.recommendation.confidence),
			sortValue: (record) => record.recommendation.confidence ?? -1,
			className: "table-number",
		},
		{
			id: "generatedDate",
			label: "Generated",
			cell: (record) => showDate(record.recommendation.generatedDate),
			sortValue: (record) => record.recommendation.generatedDate ?? "",
		},
	];
	const pendingColumns: DataTableColumn<AIHITLRecord>[] = [
		{
			id: "recommendationId",
			label: "Recommendation ID",
			cell: (record) => (
				<button
					type="button"
					className="ai-hitl-link"
					onClick={() => openDetail(record)}
				>
					{record.recommendation.id}
				</button>
			),
			sortValue: (record) => record.recommendation.id,
		},
		{
			id: "claimId",
			label: "Claim ID",
			cell: (record) => record.recommendation.claimId,
			sortValue: (record) => record.recommendation.claimId,
		},
		{
			id: "recommendationType",
			label: "Type",
			cell: (record) => record.recommendation.type ?? "—",
			sortValue: (record) => record.recommendation.type ?? "",
		},
		{
			id: "recommendation",
			label: "AI Recommendation",
			cell: (record) => (
				<span className="ai-hitl-text-cell">
					{record.recommendation.text ?? "Not recorded"}
				</span>
			),
		},
		{
			id: "sourceStatus",
			label: "Source AI Status",
			cell: (record) => (
				<StatusBadge status={record.recommendation.status ?? "Not recorded"} />
			),
		},
		{
			id: "reviewer",
			label: "Reviewer",
			cell: () => "No linked review record",
		},
		{ id: "reviewDate", label: "Review Date", cell: () => "Not recorded" },
		{ id: "decision", label: "Human Decision", cell: () => "Not recorded" },
	];
	const dateFilter = (
		label: string,
		key: "generatedFrom" | "generatedTo",
		value: string,
	) => (
		<label className="filter-control">
			<span>{label}</span>
			<input
				type="date"
				value={value}
				onChange={(event) => updateFilter(key, event.target.value)}
			/>
		</label>
	);
	if (loading) return <LoadingState label="Loading AI / HITL" />;
	if (error)
		return (
			<ErrorState
				title="AI/HITL data could not be loaded"
				message={error}
				onRetry={() => setRetry((current) => current + 1)}
			/>
		);
	if (!data || !summary)
		return (
			<ErrorState
				title="AI/HITL data unavailable"
				message="No approved AI/HITL projection was returned."
				onRetry={() => setRetry((current) => current + 1)}
			/>
		);
	if (recommendationId)
		return detail ? (
			<RecommendationDetail
				record={detail}
				onBack={onBack}
				onOpenDenial={onOpenDenial}
				onOpenClaim={onOpenClaim}
			/>
		) : (
			<div className="ai-hitl-page">
				<PageHeader
					title="AI / HITL"
					subtitle="AI-assisted RCM decision support with human review and controlled outcomes."
				/>
				<EmptyState
					title="Recommendation not found"
					description="No source recommendation with this identifier exists in the approved projection."
				/>
				<button className="button-secondary" type="button" onClick={onBack}>
					Back to AI / HITL
				</button>
			</div>
		);
	const recommendationBars = summary.recommendationTypes.map((group) => ({
		key: group.label,
		label: group.label,
		value: formatCount(group.count),
		percent: group.percent,
		color: "#7660b8",
	}));
	const sourceStatusBars = summary.sourceStatuses.map((group) => ({
		key: group.label,
		label: group.label,
		value: formatCount(group.count),
		percent: group.percent,
		color: group.label === "Pending Human Review" ? "#be7a31" : "#7660b8",
	}));
	const decisionBars = summary.humanDecisions.map((group) => ({
		key: group.label,
		label: group.label,
		value: formatCount(group.count),
		percent: group.percent,
		color: group.label === "Override" ? "#be7a31" : "#50816f",
	}));
	return (
		<div className="ai-hitl-page">
			<PageHeader
				title="AI / HITL"
				subtitle="AI-assisted RCM decision support with human review and controlled outcomes."
			/>
			<div className="ai-hitl-boundary-note">
				<strong>AI recommendation ≠ human decision.</strong> Source
				recommendations are informational and no action is executed by this
				read-only prototype.
			</div>
			<section
				className="ai-hitl-kpi-grid"
				aria-label="AI and human review overview"
			>
				<KpiCard
					label="AI Recommendations"
					value={formatCount(summary.recommendationCount)}
					description="Dataset-provided recommendations linked to denials"
					icon="hitl"
					variant="violet"
				/>
				<KpiCard
					label="Pending Human Review"
					value={formatCount(summary.pendingHumanReview)}
					description="No linked Human_Reviews record per the existing Denials status rule"
					icon="activity"
					variant="amber"
				/>
				<KpiCard
					label="Reviewed Recommendations"
					value={formatCount(summary.reviewedRecommendations)}
					description="Recommendations with a linked human review record"
					icon="claims"
					variant="blue"
				/>
				<KpiCard
					label="Reviewed Coverage"
					value={percentage(summary.reviewRecordRate)}
					description="Recommendations with linked Human_Reviews / total recommendations"
					icon="analytics"
				/>
			</section>
			{summary.sourceReviewedWithoutReview > 0 ? (
				<div className="ai-hitl-data-note" role="status">
					<strong>
						{formatCount(summary.sourceReviewedWithoutReview)} source status
						discrepancy
					</strong>
					: AI_Status is “Reviewed” but no linked Human_Reviews record exists.
					These remain Pending under the existing Denials review-status rule.
				</div>
			) : null}
			{!records.length ? (
				<EmptyState
					title="No AI/HITL data is available for this analysis"
					description="The approved dataset projection contains no linked AI recommendation records."
				/>
			) : (
				<>
					<div className="ai-hitl-analysis-grid">
						<ChartContainer
							title="AI Recommendation Analysis"
							description="Counts and distribution from source recommendation types and statuses."
						>
							<div className="ai-hitl-chart-grid">
								<div>
									<h3>Recommendations by Type</h3>
									<HorizontalBarList
										items={recommendationBars}
										ariaLabel="AI recommendations by source type"
									/>
								</div>
								<div>
									<h3>Source AI Status</h3>
									<HorizontalBarList
										items={sourceStatusBars}
										ariaLabel="Recommendations by source AI status"
									/>
								</div>
							</div>
						</ChartContainer>
						<ChartContainer
							title="Human Review Outcomes"
							description="Actual Human_Decision values; counts are review records, not model performance."
						>
							<HorizontalBarList
								items={decisionBars}
								ariaLabel="Human review decision distribution"
							/>
							<p className="ai-hitl-note">
								Accepted and Override are the observed decision values. No
								acceptance rate or model-accuracy metric is inferred.
							</p>
						</ChartContainer>
					</div>
					<section
						className="ai-hitl-panel"
						aria-label="AI recommendation filters"
					>
						<SectionHeader
							title="Filter Recommendations"
							description="Search and filter fields sourced from recommendations, linked denials, claims, and review rows."
						/>
						<div className="ai-hitl-filter-grid">
							<label className="filter-control">
								<span>Search</span>
								<input
									type="search"
									aria-label="Search recommendations"
									placeholder="Claim, recommendation, type, or status"
									value={filters.search}
									onChange={(event) =>
										updateFilter("search", event.target.value)
									}
								/>
							</label>
							<FilterSelect
								label="Recommendation type"
								value={filters.recommendationType}
								options={[
									{ value: "", label: "All types" },
									...recommendationTypeOptions.map((value) => ({
										value,
										label: value,
									})),
								]}
								onChange={(value) => updateFilter("recommendationType", value)}
							/>
							<FilterSelect
								label="Human review status"
								value={filters.reviewStatus}
								options={[
									{ value: "all", label: "All review states" },
									{ value: "Pending", label: "Pending" },
									{ value: "Reviewed", label: "Reviewed" },
								]}
								onChange={(value) =>
									updateFilter(
										"reviewStatus",
										value as AIHITLFilters["reviewStatus"],
									)
								}
							/>
							<FilterSelect
								label="Human decision"
								value={filters.humanDecision}
								options={[
									{ value: "", label: "All decisions" },
									...decisionOptions.map((value) => ({ value, label: value })),
								]}
								onChange={(value) => updateFilter("humanDecision", value)}
							/>
							<FilterSelect
								label="Claim priority"
								value={filters.claimPriority}
								options={[
									{ value: "", label: "All priorities" },
									...priorityOptions.map((value) => ({ value, label: value })),
								]}
								onChange={(value) => updateFilter("claimPriority", value)}
							/>
							{dateFilter(
								"Generated from",
								"generatedFrom",
								filters.generatedFrom,
							)}
							{dateFilter("Generated to", "generatedTo", filters.generatedTo)}
						</div>
					</section>
					<section
						className="ai-hitl-panel"
						aria-label="AI recommendation queue"
					>
						<SectionHeader
							title="AI Recommendation Queue"
							description={`${formatCount(filtered.length)} recommendation records · source status and human-review status are shown separately.`}
						/>
						{queuePage.totalItems ? (
							<>
								<div className="claims-table-meta">
									<p>
										Showing {formatCount(queuePage.items.length)} of{" "}
										{formatCount(queuePage.totalItems)} recommendations
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
								<DataTable
									rows={queuePage.items}
									columns={recommendationColumns}
									rowKey={(record) => record.recommendation.id}
									label="AI recommendation queue"
									sortState={{ id: sort.field, direction: sort.direction }}
									onSortChange={updateSort}
								/>
								<div className="claims-pagination">
									<span>
										Page {queuePage.page} of {Math.max(queuePage.totalPages, 1)}
									</span>
									<button
										type="button"
										className="button-secondary"
										disabled={queuePage.page <= 1}
										onClick={() => setPage((current) => current - 1)}
									>
										Previous
									</button>
									<button
										type="button"
										className="button-secondary"
										disabled={queuePage.page >= queuePage.totalPages}
										onClick={() => setPage((current) => current + 1)}
									>
										Next
									</button>
								</div>
							</>
						) : (
							<EmptyState
								title="No recommendations match these filters"
								description="Adjust the search, type, status, priority, decision, or date range."
							/>
						)}
					</section>
					<section className="ai-hitl-panel" aria-label="Human review queue">
						<SectionHeader
							title="Human Review Queue"
							description={`${formatCount(filtered.filter((record) => record.reviewStatus === "Pending").length)} recommendation records have no linked Human_Reviews row under the existing Denials definition.`}
						/>
						{pending.totalItems ? (
							<>
								<DataTable
									rows={pending.items}
									columns={pendingColumns}
									rowKey={(record) => record.recommendation.id}
									label="Pending human review queue"
								/>
								{pending.totalPages > 1 ? (
									<div className="claims-pagination">
										<span>
											Page {pending.page} of {pending.totalPages} ·{" "}
											{formatCount(pending.totalItems)} pending records
										</span>
										<button
											type="button"
											className="button-secondary"
											disabled={pending.page <= 1}
											onClick={() => setPendingPage((current) => current - 1)}
										>
											Previous
										</button>
										<button
											type="button"
											className="button-secondary"
											disabled={pending.page >= pending.totalPages}
											onClick={() => setPendingPage((current) => current + 1)}
										>
											Next
										</button>
									</div>
								) : null}
							</>
						) : (
							<EmptyState
								title="No recommendations are pending review in this scope"
								description="No source recommendation without a linked human review record matches the current filters."
							/>
						)}
					</section>
					<section
						className="ai-hitl-source-note"
						aria-label="AI and auditability limitations"
					>
						<strong>Prototype limitations</strong>
						<p>
							No external AI inference, persistence, or write action is present.
							Recommendation content and confidence come from synthetic dataset
							fields. Audit_Trail is not included in the current runtime
							projection, so complete record-level traceability is unavailable
							here.
						</p>
					</section>
				</>
			)}
		</div>
	);
}
