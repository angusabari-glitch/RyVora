import { describe, expect, it } from "vitest";
import { buildClaimRecords } from "../../src/business/claims";
import {
	buildDenialRecords,
	EMPTY_DENIAL_FILTERS,
	filterDenials,
	findDenialByClaimId,
	findDenialById,
	getDenialSummary,
	groupDenialsByReason,
	sortDenials,
} from "../../src/business/denials";
import { getApprovedClaimsDataset } from "../../src/data/claimsDataset";

const dataset = getApprovedClaimsDataset();
const claims = buildClaimRecords(dataset);
const denials = buildDenialRecords(dataset, claims);

describe("Denial workbench business and approved dataset integration", () => {
	it("calculates denial, recommendation, human review, and KPI totals from v1.2", () => {
		expect(denials).toHaveLength(290);
		expect(dataset.aiRecommendations).toHaveLength(290);
		expect(dataset.humanReviews).toHaveLength(180);
		expect(getDenialSummary(denials, claims)).toMatchObject({
			totalDenials: 290,
			denialRate: 0.29,
			humanReviewPending: 110,
		});
		expect(getDenialSummary([], [])).toEqual({
			totalDenials: 0,
			denialRate: 0,
			deniedAmount: 0,
			followUpRequired: 0,
			humanReviewPending: 0,
		});
	});

	it("groups denial reason and code using calculated counts and percentages", () => {
		const groups = groupDenialsByReason(denials);
		expect(groups.reduce((total, group) => total + group.count, 0)).toBe(290);
		expect(
			groups.reduce((total, group) => total + group.percent, 0),
		).toBeCloseTo(100);
		expect(groups[0]).toMatchObject({
			reason: "Deductible",
			code: "PR-1",
			count: 90,
		});
		expect(groupDenialsByReason([])).toEqual([]);
	});

	it("searches case-insensitively across denial and linked claim fields", () => {
		const denial = denials[0];
		expect(
			filterDenials(denials, {
				...EMPTY_DENIAL_FILTERS,
				search: denial.denialId.toLowerCase(),
			}),
		).toEqual([denial]);
		expect(
			filterDenials(denials, {
				...EMPTY_DENIAL_FILTERS,
				search: denial.claimId.toLowerCase(),
			}),
		).toContain(denial);
		expect(
			filterDenials(denials, {
				...EMPTY_DENIAL_FILTERS,
				search: denial.code ?? "",
			}),
		).toContain(denial);
		expect(
			filterDenials(denials, {
				...EMPTY_DENIAL_FILTERS,
				search: "no-such-record",
			}),
		).toEqual([]);
	});

	it("applies individual and combined reason, payer, insurance, follow-up, review, and claim filters", () => {
		const candidate = denials.find(
			(denial) => denial.claim?.payerName && denial.claim.insuranceType,
		);
		expect(candidate?.claim).toBeDefined();
		if (!candidate?.claim?.payerName || !candidate.claim.insuranceType) return;
		const expectedClaim = candidate.claim;
		const result = filterDenials(denials, {
			...EMPTY_DENIAL_FILTERS,
			reason: candidate.reason ?? "",
			code: candidate.code ?? "",
			payer: expectedClaim.payerName ?? "",
			insuranceType: expectedClaim.insuranceType ?? "",
			followUp: candidate.followUpRequired ? "required" : "not-required",
			reviewStatus: candidate.reviewStatus,
			claimStatus: expectedClaim.status,
		});
		expect(result.length).toBeGreaterThan(0);
		expect(
			result.every(
				(item) =>
					item.reason === candidate.reason &&
					item.code === candidate.code &&
					item.claim?.payerName === expectedClaim.payerName &&
					item.claim?.insuranceType === expectedClaim.insuranceType &&
					item.followUpRequired === candidate.followUpRequired &&
					item.reviewStatus === candidate.reviewStatus &&
					item.claim?.status === expectedClaim.status,
			),
		).toBe(true);
	});

	it("sorts deterministically with stable identifier tie breaking", () => {
		const ascending = sortDenials(denials, {
			field: "denialId",
			direction: "ascending",
		});
		const descending = sortDenials(denials, {
			field: "deniedAmount",
			direction: "descending",
		});
		expect(ascending.map((item) => item.denialId)).toEqual(
			[...ascending.map((item) => item.denialId)].sort(),
		);
		expect(descending[0].deniedAmount ?? 0).toBeGreaterThanOrEqual(
			descending.at(-1)?.deniedAmount ?? 0,
		);
		expect(sortDenials(denials, null)).toBe(denials);
	});

	it("looks up denial details and related claims, and returns undefined for unknown IDs", () => {
		const first = denials[0];
		expect(findDenialById(denials, ` ${first.denialId.toLowerCase()} `)).toBe(
			first,
		);
		expect(findDenialByClaimId(denials, first.claimId)).toBe(first);
		expect(findDenialById(denials, "missing")).toBeUndefined();
		expect(findDenialByClaimId(denials, "missing")).toBeUndefined();
	});

	it("joins actual AI recommendation and human review data and handles absent links", () => {
		const withReview = denials.find(
			(item) => item.aiRecommendation && item.humanReviews.length > 0,
		);
		const pending = denials.find(
			(item) => item.aiRecommendation && item.humanReviews.length === 0,
		);
		expect(withReview?.aiRecommendation?.text).toBeTruthy();
		expect(withReview?.humanReviews[0]?.decision).toBeTruthy();
		expect(pending?.reviewStatus).toBe("Pending");
		const withoutRecommendations = buildDenialRecords(
			{ ...dataset, aiRecommendations: [], humanReviews: [] },
			claims,
		);
		expect(withoutRecommendations[0].aiRecommendation).toBeNull();
		expect(withoutRecommendations[0].humanReviews).toEqual([]);
		expect(withoutRecommendations[0].reviewStatus).toBe("Pending");
	});

	it("preserves missing related-claim context without throwing", () => {
		const withoutClaims = buildDenialRecords(dataset, []);
		expect(withoutClaims[0].claim).toBeNull();
		expect(
			filterDenials(withoutClaims, {
				...EMPTY_DENIAL_FILTERS,
				claimStatus: "Denied",
			}),
		).toEqual([]);
	});
});
