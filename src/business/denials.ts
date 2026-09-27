import type {
	ApprovedClaimsDataset,
	ClaimRecord,
	WorkbookRecord,
} from "../data/claimsTypes";

export interface AiRecommendation {
	id: string;
	claimId: string;
	text: string | null;
	confidence: number | null;
	type: string | null;
	status: string | null;
	generatedDate: string | null;
}

export interface HumanReview {
	id: string;
	reviewerRole: string | null;
	decision: string | null;
	override: string | null;
	overrideReason: string | null;
	reviewDate: string | null;
	finalAction: string | null;
}

export interface DenialRecord {
	denialId: string;
	claimId: string;
	claim: ClaimRecord | null;
	code: string | null;
	reason: string | null;
	category: string | null;
	deniedAmount: number | null;
	date: string | null;
	appealStatus: string | null;
	correctiveAction: string | null;
	resolutionStatus: string | null;
	legacyRecommendation: string | null;
	legacyConfidence: number | null;
	aiRecommendation: AiRecommendation | null;
	humanReviews: HumanReview[];
	followUpRequired: boolean;
	reviewStatus: "Reviewed" | "Pending";
}

export interface DenialFilters {
	search: string;
	reason: string;
	code: string;
	payer: string;
	insuranceType: string;
	followUp: "all" | "required" | "not-required";
	reviewStatus: "all" | "Reviewed" | "Pending";
	claimStatus: string;
}

export interface DenialSort {
	field:
		| "denialId"
		| "claimId"
		| "date"
		| "payer"
		| "code"
		| "reason"
		| "deniedAmount"
		| "followUpRequired"
		| "reviewStatus";
	direction: "ascending" | "descending";
}

function text(value: unknown): string | null {
	if (typeof value === "string" && value.trim()) return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return null;
}

function number(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dateOnly(value: unknown): string | null {
	if (value instanceof Date && Number.isFinite(value.getTime()))
		return value.toISOString().slice(0, 10);
	if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
		const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
		return Number.isFinite(date.getTime())
			? date.toISOString().slice(0, 10)
			: null;
	}
	if (typeof value === "string" && value.trim()) {
		const date = new Date(value);
		return Number.isFinite(date.getTime())
			? date.toISOString().slice(0, 10)
			: null;
	}
	return null;
}

function asIndex(rows: WorkbookRecord[], key: string) {
	return new Map(rows.map((row) => [String(row[key] ?? ""), row]));
}

export function buildDenialRecords(
	dataset: ApprovedClaimsDataset,
	claims: ClaimRecord[],
): DenialRecord[] {
	const claimsById = new Map(claims.map((claim) => [claim.claimId, claim]));
	const recommendationsByDenial = asIndex(
		dataset.aiRecommendations,
		"Denial_ID",
	);
	const reviewsByRecommendation = new Map<string, WorkbookRecord[]>();
	for (const review of dataset.humanReviews) {
		const key = String(review.AI_Recommendation_ID ?? "");
		const list = reviewsByRecommendation.get(key) ?? [];
		list.push(review);
		reviewsByRecommendation.set(key, list);
	}
	return dataset.denials.map((row) => {
		const denialId = String(row.Denial_ID ?? "");
		const claimId = String(row.Claim_ID ?? "");
		const recommendationRow = recommendationsByDenial.get(denialId);
		const recommendation = recommendationRow
			? {
					id: String(recommendationRow.AI_Recommendation_ID ?? ""),
					claimId: String(recommendationRow.Claim_ID ?? ""),
					text: text(recommendationRow.Recommendation),
					confidence: number(recommendationRow.Confidence_Score),
					type: text(recommendationRow.Recommendation_Type),
					status: text(recommendationRow.AI_Status),
					generatedDate: dateOnly(recommendationRow.Generated_Date),
				}
			: null;
		const humanReviews = (
			recommendation
				? (reviewsByRecommendation.get(recommendation.id) ?? [])
				: []
		)
			.map((review) => ({
				id: String(review.Review_ID ?? ""),
				reviewerRole: text(review.Reviewer_Role),
				decision: text(review.Human_Decision),
				override: text(review.Override_Flag),
				overrideReason: text(review.Override_Reason),
				reviewDate: dateOnly(review.Review_Date),
				finalAction: text(review.Final_Action),
			}))
			.sort((a, b) => (b.reviewDate ?? "").localeCompare(a.reviewDate ?? ""));
		const appealStatus = text(row.Appeal_Status);
		const resolutionStatus = text(row.Resolution_Status);
		return {
			denialId,
			claimId,
			claim: claimsById.get(claimId) ?? null,
			code: text(row.Denial_Code),
			reason: text(row.Denial_Reason),
			category: text(row.Denial_Category),
			deniedAmount: number(row.Denial_Amount),
			date: dateOnly(row.Denial_Date),
			appealStatus,
			correctiveAction: text(row.Corrective_Action),
			resolutionStatus,
			legacyRecommendation: text(row.AI_Recommendation),
			legacyConfidence: number(row.AI_Confidence),
			aiRecommendation: recommendation,
			humanReviews,
			followUpRequired:
				resolutionStatus?.toLocaleLowerCase("en-US") === "open" ||
				["pending", "submitted"].includes(
					appealStatus?.toLocaleLowerCase("en-US") ?? "",
				),
			reviewStatus: humanReviews.length > 0 ? "Reviewed" : "Pending",
		};
	});
}

export function getDenialSummary(
	denials: DenialRecord[],
	claims: ClaimRecord[],
) {
	const deniedClaimIds = new Set(
		claims
			.filter((claim) => claim.status === "Denied")
			.map((claim) => claim.claimId),
	);
	const claimIds = new Set(claims.map((claim) => claim.claimId));
	return {
		totalDenials: denials.length,
		denialRate: claimIds.size ? deniedClaimIds.size / claimIds.size : 0,
		deniedAmount:
			denials.reduce(
				(total, denial) => total + Math.round((denial.deniedAmount ?? 0) * 100),
				0,
			) / 100,
		followUpRequired: denials.filter((denial) => denial.followUpRequired)
			.length,
		humanReviewPending: denials.filter(
			(denial) => denial.reviewStatus === "Pending",
		).length,
	};
}

export function groupDenialsByReason(denials: DenialRecord[]) {
	const groups = new Map<
		string,
		{ code: string; reason: string; count: number }
	>();
	for (const denial of denials) {
		const reason = denial.reason ?? "Reason not recorded";
		const code = denial.code ?? "Code unavailable";
		const key = `${code}\u0000${reason}`;
		const group = groups.get(key) ?? { code, reason, count: 0 };
		group.count += 1;
		groups.set(key, group);
	}
	return [...groups.values()]
		.map((group) => ({
			...group,
			percent: denials.length ? (group.count / denials.length) * 100 : 0,
		}))
		.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

export const EMPTY_DENIAL_FILTERS: DenialFilters = {
	search: "",
	reason: "",
	code: "",
	payer: "",
	insuranceType: "",
	followUp: "all",
	reviewStatus: "all",
	claimStatus: "",
};

export function filterDenials(
	denials: DenialRecord[],
	filters: DenialFilters,
): DenialRecord[] {
	const query = filters.search.trim().toLocaleLowerCase("en-US");
	return denials.filter((denial) => {
		if (filters.reason && denial.reason !== filters.reason) return false;
		if (filters.code && denial.code !== filters.code) return false;
		if (filters.payer && denial.claim?.payerName !== filters.payer)
			return false;
		if (
			filters.insuranceType &&
			denial.claim?.insuranceType !== filters.insuranceType
		)
			return false;
		if (filters.followUp === "required" && !denial.followUpRequired)
			return false;
		if (filters.followUp === "not-required" && denial.followUpRequired)
			return false;
		if (
			filters.reviewStatus !== "all" &&
			denial.reviewStatus !== filters.reviewStatus
		)
			return false;
		if (filters.claimStatus && denial.claim?.status !== filters.claimStatus)
			return false;
		if (!query) return true;
		return [
			denial.denialId,
			denial.claimId,
			denial.claim?.patientId,
			denial.claim?.providerId,
			denial.claim?.payerId,
			denial.claim?.payerName,
			denial.claim?.insuranceType,
			denial.code,
			denial.reason,
			denial.category,
		]
			.filter((value): value is string => Boolean(value))
			.some((value) => value.toLocaleLowerCase("en-US").includes(query));
	});
}

function sortValue(
	denial: DenialRecord,
	field: DenialSort["field"],
): string | number {
	switch (field) {
		case "date":
			return denial.date ?? "";
		case "payer":
			return denial.claim?.payerName ?? denial.claim?.payerId ?? "";
		case "deniedAmount":
			return denial.deniedAmount ?? -1;
		case "followUpRequired":
			return Number(denial.followUpRequired);
		case "reviewStatus":
			return denial.reviewStatus;
		default:
			return denial[field] ?? "";
	}
}

export function sortDenials(
	denials: DenialRecord[],
	sort: DenialSort | null,
): DenialRecord[] {
	if (!sort) return denials;
	const direction = sort.direction === "ascending" ? 1 : -1;
	return denials
		.map((denial, index) => ({ denial, index }))
		.sort((a, b) => {
			const left = sortValue(a.denial, sort.field);
			const right = sortValue(b.denial, sort.field);
			const comparison =
				typeof left === "number" && typeof right === "number"
					? left - right
					: String(left).localeCompare(String(right), "en-US", {
							numeric: true,
							sensitivity: "base",
						});
			return (
				comparison * direction ||
				a.denial.denialId.localeCompare(b.denial.denialId) ||
				a.index - b.index
			);
		})
		.map(({ denial }) => denial);
}

export function findDenialById(
	denials: DenialRecord[],
	denialId: string,
): DenialRecord | undefined {
	const key = denialId.trim().toLocaleUpperCase("en-US");
	return denials.find(
		(denial) => denial.denialId.toLocaleUpperCase("en-US") === key,
	);
}

export function findDenialByClaimId(
	denials: DenialRecord[],
	claimId: string,
): DenialRecord | undefined {
	const key = claimId.trim().toLocaleUpperCase("en-US");
	return denials.find(
		(denial) => denial.claimId.toLocaleUpperCase("en-US") === key,
	);
}
