import { describe, expect, it } from "vitest";
import {
	buildAIHITLRecords,
	EMPTY_AIHITL_FILTERS,
	filterAIHITLRecords,
	findAIHITLRecord,
	paginateAIHITL,
	sortAIHITLRecords,
	summarizeAIHITL,
} from "../../src/business/aiHitl";
import type { DenialRecord, HumanReview } from "../../src/business/denials";

function denial({
	id,
	type = "Correct & Resubmit",
	sourceStatus = "Reviewed",
	reviewStatus = "Reviewed",
	confidence = 0.82,
	reviews = [],
}: {
	id: string;
	type?: string | null;
	sourceStatus?: string | null;
	reviewStatus?: DenialRecord["reviewStatus"];
	confidence?: number | null;
	reviews?: HumanReview[];
}): DenialRecord {
	return {
		denialId: `DN-${id}`,
		claimId: `CL-${id}`,
		claim: null,
		code: "CO-16",
		reason: "Missing information",
		category: "Administrative",
		deniedAmount: 125,
		date: "2026-02-01",
		appealStatus: "Pending",
		correctiveAction: null,
		resolutionStatus: "Open",
		legacyRecommendation: null,
		legacyConfidence: null,
		aiRecommendation: {
			id: `AI-${id}`,
			claimId: `CL-${id}`,
			text: `Source recommendation ${id}`,
			confidence,
			type,
			status: sourceStatus,
			generatedDate: "2026-02-10",
		},
		humanReviews: reviews,
		followUpRequired: true,
		reviewStatus: reviewStatus,
	};
}

const review = (decision: string | null): HumanReview => ({
	id: "HR-1",
	reviewerRole: "RCM Analyst",
	decision,
	override: null,
	overrideReason: null,
	reviewDate: "2026-02-11",
	finalAction: "Review contract/allowed amount",
});

describe("AI/HITL business selectors", () => {
	it("maps only actual recommendations and reuses Denials review state", () => {
		const rows = buildAIHITLRecords([
			denial({ id: "1", reviewStatus: "Pending", sourceStatus: "Reviewed" }),
			{ ...denial({ id: "2" }), aiRecommendation: null },
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.reviewStatus).toBe("Pending");
		expect(rows[0]?.recommendation.status).toBe("Reviewed");
	});

	it("summarizes review coverage, source discrepancies, and observed human decisions", () => {
		const rows = buildAIHITLRecords([
			denial({
				id: "1",
				reviewStatus: "Reviewed",
				reviews: [review("Accepted")],
			}),
			denial({
				id: "2",
				reviewStatus: "Reviewed",
				reviews: [review("Override")],
			}),
			denial({
				id: "3",
				sourceStatus: "Pending Human Review",
				reviewStatus: "Pending",
			}),
			denial({ id: "4", sourceStatus: "Reviewed", reviewStatus: "Pending" }),
		]);
		const summary = summarizeAIHITL(rows);
		expect(summary).toMatchObject({
			recommendationCount: 4,
			pendingHumanReview: 2,
			reviewedRecommendations: 2,
			reviewRecordRate: 0.5,
			sourcePendingReview: 1,
			sourceReviewedWithoutReview: 1,
			humanReviewRecordCount: 2,
		});
		expect(
			summary.humanDecisions.map((item) => [item.label, item.count]),
		).toEqual([
			["Accepted", 1],
			["Override", 1],
		]);
		expect(summary.recommendationTypes[0]).toMatchObject({
			label: "Correct & Resubmit",
			count: 4,
			percent: 100,
		});
	});

	it("filters by search, type, human review, decision, priority, and source date", () => {
		const rows = buildAIHITLRecords([
			denial({ id: "1", type: "Review", reviews: [review("Override")] }),
			denial({
				id: "2",
				type: "Correct & Resubmit",
				sourceStatus: "Pending Human Review",
				reviewStatus: "Pending",
			}),
		]);
		expect(
			filterAIHITLRecords(rows, { ...EMPTY_AIHITL_FILTERS, search: "CL-1" }),
		).toHaveLength(1);
		expect(
			filterAIHITLRecords(rows, {
				...EMPTY_AIHITL_FILTERS,
				recommendationType: "Review",
			})[0]?.recommendation.id,
		).toBe("AI-1");
		expect(
			filterAIHITLRecords(rows, {
				...EMPTY_AIHITL_FILTERS,
				reviewStatus: "Pending",
			}),
		).toHaveLength(1);
		expect(
			filterAIHITLRecords(rows, {
				...EMPTY_AIHITL_FILTERS,
				humanDecision: "Override",
			}),
		).toHaveLength(1);
		expect(
			filterAIHITLRecords(rows, {
				...EMPTY_AIHITL_FILTERS,
				generatedFrom: "2026-02-11",
			}),
		).toHaveLength(0);
		expect(
			filterAIHITLRecords(rows, {
				...EMPTY_AIHITL_FILTERS,
				generatedTo: "2026-02-10",
			}),
		).toHaveLength(2);
	});

	it("sorts and paginates with safe bounds and resolves details case-insensitively", () => {
		const rows = buildAIHITLRecords([denial({ id: "2" }), denial({ id: "1" })]);
		const sorted = sortAIHITLRecords(rows, {
			field: "claimId",
			direction: "ascending",
		});
		expect(sorted.map((row) => row.recommendation.claimId)).toEqual([
			"CL-1",
			"CL-2",
		]);
		expect(paginateAIHITL(sorted, 2, 1).items[0]?.recommendation.id).toBe(
			"AI-2",
		);
		expect(paginateAIHITL(sorted, 99, 0)).toMatchObject({
			page: 2,
			pageSize: 1,
			totalPages: 2,
		});
		expect(findAIHITLRecord(rows, "ai-1")?.denial.denialId).toBe("DN-1");
	});

	it("handles missing recommendation, confidence, type, status, and review data", () => {
		const rows = buildAIHITLRecords([
			denial({
				id: "1",
				type: null,
				sourceStatus: null,
				reviewStatus: "Pending",
				confidence: null,
			}),
			{ ...denial({ id: "2" }), aiRecommendation: null },
		]);
		const summary = summarizeAIHITL(rows);
		expect(rows).toHaveLength(1);
		expect(summary.recommendationTypes[0]?.label).toBe(
			"Recommendation type not recorded",
		);
		expect(summary.sourceStatuses[0]?.label).toBe("Source status not recorded");
		expect(summary.reviewRecordRate).toBe(0);
		expect(summary.humanDecisions).toEqual([]);
	});

	it("returns zero-safe results for an empty dataset", () => {
		const summary = summarizeAIHITL(buildAIHITLRecords([]));
		expect(summary).toMatchObject({
			recommendationCount: 0,
			pendingHumanReview: 0,
			reviewedRecommendations: 0,
			reviewRecordRate: null,
		});
		expect(summary.sourceStatuses).toEqual([]);
	});
});
