import { describe, expect, it } from "vitest";
import {
	buildClaimRecords,
	EMPTY_CLAIM_FILTERS,
	filterClaims,
	findClaimById,
	getClaimSummary,
	paginateClaims,
	sortClaims,
} from "../../src/business/claims";
import { getApprovedClaimsDataset } from "../../src/data/claimsDataset";

const dataset = getApprovedClaimsDataset();
const claims = buildClaimRecords(dataset);

function requireRow<T>(row: T | undefined): T {
	if (!row) throw new Error("Expected a row in the approved dataset fixture.");
	return row;
}

describe("Claims business and dataset integration", () => {
	it("projects all 1,000 validated claims and calculates the queue summary", () => {
		expect(claims).toHaveLength(1_000);
		expect(getClaimSummary(claims)).toEqual({
			totalClaims: 1_000,
			pendingClaims: 100,
			deniedClaims: 290,
			rejectedClaims: 100,
			totalBilledAmount: 4_621_631.63,
		});
	});

	it("searches case-insensitively across available claim identifiers and payer", () => {
		expect(
			filterClaims(claims, { ...EMPTY_CLAIM_FILTERS, search: "clm1001" }).map(
				(claim) => claim.claimId,
			),
		).toEqual(["CLM1001"]);
		expect(
			filterClaims(claims, { ...EMPTY_CLAIM_FILTERS, search: "aEtNa" }).length,
		).toBeGreaterThan(0);
		expect(
			filterClaims(claims, {
				...EMPTY_CLAIM_FILTERS,
				search: "not-a-real-claim",
			}),
		).toEqual([]);
	});

	it("combines claim status, insurance, AR, follow-up, and service date filters", () => {
		const claim = claims.find(
			(item) =>
				item.status === "Denied" &&
				item.followUpRequired &&
				item.insuranceType &&
				item.arStatus &&
				item.serviceDate,
		);
		expect(claim).toBeDefined();
		if (!claim?.insuranceType || !claim.arStatus || !claim.serviceDate) return;
		const result = filterClaims(claims, {
			...EMPTY_CLAIM_FILTERS,
			status: claim.status,
			insuranceType: claim.insuranceType,
			arStatus: claim.arStatus,
			followUp: "required",
			serviceDateFrom: claim.serviceDate,
			serviceDateTo: claim.serviceDate,
		});
		expect(result.length).toBeGreaterThan(0);
		expect(
			result.every(
				(item) =>
					item.status === "Denied" &&
					item.insuranceType === claim.insuranceType &&
					item.arStatus === claim.arStatus &&
					item.followUpRequired &&
					item.serviceDate === claim.serviceDate,
			),
		).toBe(true);
	});

	it("sorts deterministically and paginates without duplicate or missing records", () => {
		const ascending = sortClaims(claims, {
			field: "claimId",
			direction: "ascending",
		});
		const firstPage = paginateClaims(ascending, 1, 25);
		const secondPage = paginateClaims(ascending, 2, 25);
		expect(firstPage.items).toHaveLength(25);
		expect(secondPage.items).toHaveLength(25);
		expect(
			new Set(
				[...firstPage.items, ...secondPage.items].map((claim) => claim.claimId),
			).size,
		).toBe(50);
		expect(paginateClaims(ascending, 100, 25).page).toBe(40);
		expect(paginateClaims([], 1, 25)).toEqual({
			items: [],
			page: 1,
			pageSize: 25,
			totalItems: 0,
			totalPages: 0,
		});
		expect(paginateClaims(ascending, -1, 0).pageSize).toBe(25);
	});

	it("resolves claim detail by trimmed case-insensitive identifier and handles invalid IDs", () => {
		const detail = findClaimById(claims, " clm1001 ");
		expect(detail?.claimId).toBe("CLM1001");
		expect(findClaimById(claims, "missing")).toBeUndefined();
	});

	it("maps actual financial and related 837, 835, denial, and AR records", () => {
		const denied = findClaimById(claims, "CLM1001");
		const paid = claims.find((claim) => claim.payments.length > 0);
		expect(denied?.transaction837?.transactionId).toBe("TXN11001");
		expect(denied?.denial?.denialId).toBe("DEN3001");
		expect(denied?.outstandingAmount).toBe(0);
		expect(denied?.followUpRequired).toBe(true);
		expect(paid?.payments[0]?.paymentId).toBeTruthy();
		expect(paid?.allowedAmount).toBe(
			paid?.payments.reduce(
				(sum, payment) => sum + (payment.allowedAmount ?? 0),
				0,
			),
		);
		expect(paid?.paidAmount).toBe(
			paid?.payments.reduce(
				(sum, payment) => sum + (payment.paidAmount ?? 0),
				0,
			),
		);
	});

	it("handles missing payment, denial, and 837 relationships without throwing", () => {
		const firstClaim = requireRow(dataset.claims[0]);
		const reduced = {
			...dataset,
			claims: [firstClaim],
			patients: [
				requireRow(
					dataset.patients.find(
						(row) => row.Patient_ID === firstClaim.Patient_ID,
					),
				),
			],
			providers: [
				requireRow(
					dataset.providers.find(
						(row) => row.Provider_ID === firstClaim.Provider_ID,
					),
				),
			],
			payers: [
				requireRow(
					dataset.payers.find((row) => row.Payer_ID === firstClaim.Payer_ID),
				),
			],
			transactions837: [],
			payments835: [],
			denials: [],
			arRecords: [],
		};
		const [claim] = buildClaimRecords(reduced);
		expect(claim?.transaction837).toBeNull();
		expect(claim?.payments).toEqual([]);
		expect(claim?.denial).toBeNull();
		expect(claim?.outstandingAmount).toBeNull();
		expect(claim?.allowedAmount).toBeNull();
		expect(claim?.paidAmount).toBeNull();
	});
});
