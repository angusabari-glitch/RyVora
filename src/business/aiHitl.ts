import type { AiRecommendation, DenialRecord, HumanReview } from "./denials";

export interface AIHITLRecord {
	recommendation: AiRecommendation;
	denial: DenialRecord;
	reviewStatus: DenialRecord["reviewStatus"];
	reviews: HumanReview[];
	claimPriority: string | null;
}

export interface AIHITLFilters {
	search: string;
	recommendationType: string;
	reviewStatus: "all" | DenialRecord["reviewStatus"];
	humanDecision: string;
	claimPriority: string;
	generatedFrom: string;
	generatedTo: string;
}

export type AIHITLSortField =
	| "recommendationId"
	| "claimId"
	| "recommendationType"
	| "sourceStatus"
	| "reviewStatus"
	| "confidence"
	| "generatedDate"
	| "claimPriority";

export interface AIHITLSort {
	field: AIHITLSortField;
	direction: "ascending" | "descending";
}

export interface AIHITLGroup {
	label: string;
	count: number;
	percent: number;
}

export interface AIHITLSummary {
	recommendationCount: number;
	pendingHumanReview: number;
	reviewedRecommendations: number;
	reviewRecordRate: number | null;
	sourcePendingReview: number;
	sourceReviewedWithoutReview: number;
	humanReviewRecordCount: number;
	recommendationTypes: AIHITLGroup[];
	sourceStatuses: AIHITLGroup[];
	humanDecisions: AIHITLGroup[];
}

export interface AIHITLPage<T> {
	items: T[];
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
}

export const EMPTY_AIHITL_FILTERS: AIHITLFilters = {
	search: "",
	recommendationType: "",
	reviewStatus: "all",
	humanDecision: "",
	claimPriority: "",
	generatedFrom: "",
	generatedTo: "",
};

function groups(values: string[], total: number): AIHITLGroup[] {
	const counts = new Map<string, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	return [...counts]
		.map(([label, count]) => ({
			label,
			count,
			percent: total ? (count / total) * 100 : 0,
		}))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Uses the Denials module's existing AI recommendation and linked Human_Reviews projection. */
export function buildAIHITLRecords(denials: DenialRecord[]): AIHITLRecord[] {
	return denials.flatMap((denial) => {
		const recommendation = denial.aiRecommendation;
		if (!recommendation?.id) return [];
		return [
			{
				recommendation,
				denial,
				// Reuse Denials' status rule: a linked Human_Review means Reviewed; otherwise Pending.
				reviewStatus: denial.reviewStatus,
				reviews: denial.humanReviews,
				claimPriority: denial.claim?.priority ?? null,
			},
		];
	});
}

export function summarizeAIHITL(records: AIHITLRecord[]): AIHITLSummary {
	const reviewed = records.filter(
		(record) => record.reviewStatus === "Reviewed",
	);
	const reviewRecords = records.flatMap((record) => record.reviews);
	return {
		recommendationCount: records.length,
		pendingHumanReview: records.filter(
			(record) => record.reviewStatus === "Pending",
		).length,
		reviewedRecommendations: reviewed.length,
		reviewRecordRate: records.length ? reviewed.length / records.length : null,
		sourcePendingReview: records.filter(
			(record) => record.recommendation.status === "Pending Human Review",
		).length,
		sourceReviewedWithoutReview: records.filter(
			(record) =>
				record.recommendation.status === "Reviewed" &&
				record.reviews.length === 0,
		).length,
		humanReviewRecordCount: reviewRecords.length,
		recommendationTypes: groups(
			records.map(
				(record) =>
					record.recommendation.type ?? "Recommendation type not recorded",
			),
			records.length,
		),
		sourceStatuses: groups(
			records.map(
				(record) =>
					record.recommendation.status ?? "Source status not recorded",
			),
			records.length,
		),
		humanDecisions: groups(
			reviewRecords.map((review) => review.decision ?? "Decision not recorded"),
			reviewRecords.length,
		),
	};
}

function inDateRange(value: string | null, from: string, to: string): boolean {
	if (from && (!value || value < from)) return false;
	if (to && (!value || value > to)) return false;
	return true;
}

export function filterAIHITLRecords(
	records: AIHITLRecord[],
	filters: AIHITLFilters,
): AIHITLRecord[] {
	const query = filters.search.trim().toLocaleLowerCase("en-US");
	return records.filter((record) => {
		if (
			filters.recommendationType &&
			record.recommendation.type !== filters.recommendationType
		)
			return false;
		if (
			filters.reviewStatus !== "all" &&
			record.reviewStatus !== filters.reviewStatus
		)
			return false;
		if (
			filters.humanDecision &&
			!record.reviews.some(
				(review) => review.decision === filters.humanDecision,
			)
		)
			return false;
		if (filters.claimPriority && record.claimPriority !== filters.claimPriority)
			return false;
		if (
			!inDateRange(
				record.recommendation.generatedDate,
				filters.generatedFrom,
				filters.generatedTo,
			)
		)
			return false;
		if (!query) return true;
		return [
			record.recommendation.id,
			record.recommendation.claimId,
			record.recommendation.type,
			record.recommendation.text,
			record.recommendation.status,
			record.reviewStatus,
			record.claimPriority,
			record.denial.reason,
			record.denial.code,
		].some((value) => value?.toLocaleLowerCase("en-US").includes(query));
	});
}

function sortValue(
	record: AIHITLRecord,
	field: AIHITLSortField,
): string | number {
	switch (field) {
		case "recommendationId":
			return record.recommendation.id;
		case "claimId":
			return record.recommendation.claimId;
		case "recommendationType":
			return record.recommendation.type ?? "";
		case "sourceStatus":
			return record.recommendation.status ?? "";
		case "reviewStatus":
			return record.reviewStatus;
		case "confidence":
			return record.recommendation.confidence ?? -1;
		case "generatedDate":
			return record.recommendation.generatedDate ?? "";
		case "claimPriority":
			return record.claimPriority ?? "";
	}
}

export function sortAIHITLRecords(
	records: AIHITLRecord[],
	sort: AIHITLSort | null,
): AIHITLRecord[] {
	if (!sort) return records;
	const direction = sort.direction === "ascending" ? 1 : -1;
	return records
		.map((record, index) => ({ record, index }))
		.sort((a, b) => {
			const left = sortValue(a.record, sort.field);
			const right = sortValue(b.record, sort.field);
			const comparison =
				typeof left === "number" && typeof right === "number"
					? left - right
					: String(left).localeCompare(String(right), "en-US", {
							numeric: true,
							sensitivity: "base",
						});
			return (
				comparison * direction ||
				a.record.recommendation.id.localeCompare(b.record.recommendation.id) ||
				a.index - b.index
			);
		})
		.map(({ record }) => record);
}

export function paginateAIHITL<T>(
	records: T[],
	page: number,
	pageSize: number,
): AIHITLPage<T> {
	const safePageSize = Math.max(1, Math.trunc(pageSize));
	const totalPages = Math.ceil(records.length / safePageSize);
	const safePage = Math.max(
		1,
		Math.min(Math.trunc(page), Math.max(1, totalPages)),
	);
	return {
		items: records.slice(
			(safePage - 1) * safePageSize,
			safePage * safePageSize,
		),
		page: safePage,
		pageSize: safePageSize,
		totalItems: records.length,
		totalPages,
	};
}

export function findAIHITLRecord(
	records: AIHITLRecord[],
	recommendationId: string,
): AIHITLRecord | undefined {
	const id = recommendationId.trim().toLocaleUpperCase("en-US");
	return records.find(
		(record) => record.recommendation.id.toLocaleUpperCase("en-US") === id,
	);
}
