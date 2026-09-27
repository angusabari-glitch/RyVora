import { beforeAll, describe, expect, it } from "vitest";
import {
	buildInteroperabilityRecords,
	EMPTY_INTEROPERABILITY_FILTERS,
	filterInteroperability,
	getInteroperabilityOptions,
	groupInteroperabilityByStatus,
	groupInteroperabilityByType,
	paginateInteroperability,
	sortInteroperability,
	summarizeInteroperability,
} from "../../src/business/interoperability";
import { getApprovedClaimsDataset } from "../../src/data/claimsDataset";
import { loadArManagement } from "../../src/services/arService";
import { loadClaims } from "../../src/services/claimsService";
import { loadDenials } from "../../src/services/denialsService";
import { loadExceptions } from "../../src/services/exceptionsService";
import { loadInteroperability } from "../../src/services/interoperabilityService";
import { loadPayments } from "../../src/services/paymentsService";

describe("Interoperability business logic", () => {
	let data: Awaited<ReturnType<typeof loadInteroperability>>;

	beforeAll(async () => {
		data = await loadInteroperability();
	});

	it("derives total, successful, failed, and success-rate KPIs from 837 rows", () => {
		expect(data.summary).toEqual({
			totalRecords: 1000,
			successfulTransactions: 900,
			failedTransactions: 100,
			successRate: 0.9,
		});
		expect(data.records).toHaveLength(data.summary.totalRecords);
	});

	it("groups source statuses and transaction types with the full-population denominator", () => {
		expect(groupInteroperabilityByStatus(data.records)).toEqual([
			{ key: "Accepted", label: "Accepted", count: 900, percent: 90 },
			{ key: "Rejected", label: "Rejected", count: 100, percent: 10 },
		]);
		expect(groupInteroperabilityByType(data.records)).toEqual([
			{ key: "837P", label: "837P", count: 1000, percent: 100 },
		]);
	});

	it("uses actual 837 rows and joins Claim_ID-linked RCM context", () => {
		const rejected = data.records.find(
			(record) => record.status === "Rejected",
		);
		expect(rejected).toBeDefined();
		expect(rejected?.claim?.claimId).toBe(rejected?.claimId);
		expect(rejected?.rejectionCode).toBeTruthy();
		expect(rejected?.errorMessage).toBeTruthy();
		expect(rejected?.exceptions.length).toBeGreaterThan(0);
		expect(rejected?.interfaceName).toBeNull();
		expect(rejected?.sourceSystem).toBeNull();
	});

	it("combines search and filters, including source fields that are not recorded", () => {
		const rejected = data.records.find(
			(record) => record.status === "Rejected",
		);
		expect(rejected).toBeDefined();
		if (!rejected) return;
		const results = filterInteroperability(data.records, {
			...EMPTY_INTEROPERABILITY_FILTERS,
			search: rejected.transactionId.toLowerCase(),
			status: "Rejected",
			transactionType: "837P",
			errorState: "Error recorded",
		});
		expect(results.map((record) => record.transactionId)).toEqual([
			rejected.transactionId,
		]);
		expect(
			filterInteroperability(data.records, {
				...EMPTY_INTEROPERABILITY_FILTERS,
				interfaceName: "Not recorded",
				sourceSystem: "Not recorded",
				destinationSystem: "Not recorded",
			}),
		).toHaveLength(data.records.length);
		expect(getInteroperabilityOptions(data.records, "status")).toEqual([
			"Accepted",
			"Rejected",
		]);
	});

	it("sorts records and paginates the filtered result set", () => {
		const sorted = sortInteroperability(data.records.slice(0, 4), {
			field: "transactionId",
			direction: "descending",
		});
		expect(sorted.map((record) => record.transactionId)).toEqual(
			data.records
				.slice(0, 4)
				.map((record) => record.transactionId)
				.sort((a, b) => b.localeCompare(a, "en-US", { numeric: true })),
		);
		const page = paginateInteroperability(data.records.slice(0, 51), 2, 25);
		expect(page.items).toHaveLength(25);
		expect(page.page).toBe(2);
		expect(page.totalItems).toBe(51);
		expect(page.totalPages).toBe(3);
	});

	it("handles empty data and missing optional source fields", async () => {
		expect(summarizeInteroperability([])).toEqual({
			totalRecords: 0,
			successfulTransactions: 0,
			failedTransactions: 0,
			successRate: null,
		});
		expect(paginateInteroperability([], 4, 25)).toMatchObject({
			items: [],
			page: 1,
			totalItems: 0,
		});
		const dataset = getApprovedClaimsDataset();
		const [record] = buildInteroperabilityRecords(
			[
				{
					Transaction_ID: "TXN-MISSING-OPTIONALS",
					Claim_ID: "NO-CLAIM",
					Transaction_Type: null,
					"837_Status": null,
					Submission_Date: null,
					Response_Date: null,
					Rejection_Code: null,
					Rejection_Reason: null,
				},
			],
			[],
			[],
			[],
			[],
			[],
		);
		expect(record?.claim).toBeNull();
		expect(record?.errorState).toBe("Unavailable");
		expect(record?.submissionDate).toBeNull();
		expect(record?.responseDate).toBeNull();
		expect(record?.transactionType).toBeNull();
		expect(dataset.transactions837).toHaveLength(1000);
	});

	it("keeps all joins constrained to existing claim identifiers", async () => {
		const [ar, exceptions] = await Promise.all([
			loadArManagement(),
			loadExceptions(),
		]);
		const records = buildInteroperabilityRecords(
			getApprovedClaimsDataset().transactions837,
			loadClaims(),
			ar.records,
			loadPayments(),
			loadDenials(),
			exceptions.records,
		);
		for (const record of records.slice(0, 30)) {
			for (const linked of [
				...record.arRecords,
				...record.payments,
				...record.denials,
				...record.exceptions,
			]) {
				expect(linked.claimId).toBe(record.claimId);
			}
		}
	});
});
