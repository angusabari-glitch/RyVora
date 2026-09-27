import { describe, expect, it } from "vitest";
import { buildArRecords } from "../../src/business/ar";
import { buildClaimRecords } from "../../src/business/claims";
import { buildDenialRecords } from "../../src/business/denials";
import {
	buildExceptionRecords,
	EMPTY_EXCEPTION_FILTERS,
	filterExceptions,
	findExceptionById,
	getExceptionSummary,
	groupExceptionsByType,
	isExceptionUnresolved,
	paginateExceptions,
	sortExceptions,
} from "../../src/business/exceptions";
import { buildPaymentRecords } from "../../src/business/payments";
import { getApprovedClaimsDataset } from "../../src/data/claimsDataset";

const dataset = getApprovedClaimsDataset();
const claims = buildClaimRecords(dataset);
const payments = buildPaymentRecords(dataset, claims);
const denials = buildDenialRecords(dataset, claims);
const arRecords = buildArRecords(dataset, claims);
const exceptionRecords = buildExceptionRecords(
	dataset,
	claims,
	payments,
	denials,
	arRecords,
);

describe("Exceptions business rules and approved v1.2 data", () => {
	it("maps the exact source fields and does not invent an exception amount", () => {
		const source = dataset.exceptions[0];
		const record = exceptionRecords.find(
			(item) => item.exceptionId === source.Exception_ID,
		);
		expect(record).toMatchObject({
			exceptionId: source.Exception_ID,
			claimId: source.Claim_ID,
			type: source.Exception_Type,
			severity: source.Severity,
			description: source.Description,
			owner: source.Owner,
			status: source.Status,
		});
		expect(record).toHaveProperty("createdDate");
		expect(record).not.toHaveProperty("amount");
	});

	it("uses the existing resolved-status convention and source severity", () => {
		expect(isExceptionUnresolved("Open")).toBe(true);
		expect(isExceptionUnresolved("In Progress")).toBe(true);
		expect(isExceptionUnresolved("Resolved")).toBe(false);
		expect(isExceptionUnresolved("Closed")).toBe(false);
		expect(isExceptionUnresolved(null)).toBe(false);
		expect(getExceptionSummary(exceptionRecords)).toMatchObject({
			totalRecords: 180,
			unresolvedRecords: 90,
			criticalUnresolved: 10,
			highUnresolved: 80,
		});
	});

	it("groups source exception types and maps each observed type to its workstream", () => {
		expect(
			groupExceptionsByType(exceptionRecords).map(({ type, count }) => ({
				type,
				count,
			})),
		).toEqual([
			{ type: "837 Rejection", count: 100 },
			{ type: "835 Unmatched", count: 50 },
			{ type: "High AR Aging", count: 30 },
		]);
		const counts = new Map<string, number>();
		for (const group of groupExceptionsByType(exceptionRecords))
			counts.set(group.type, group.percent);
		expect(
			[...counts.values()].reduce((sum, value) => sum + value, 0),
		).toBeCloseTo(100);
		expect(
			new Set(exceptionRecords.map((record) => record.sourceModule)),
		).toEqual(new Set(["Interoperability", "Payments", "AR Management"]));
	});

	it("links only the supported source workflow records through Claim_ID", () => {
		const rejected = exceptionRecords.find(
			(record) => record.type === "837 Rejection",
		);
		const unmatched = exceptionRecords.find(
			(record) => record.type === "835 Unmatched",
		);
		const aged = exceptionRecords.find(
			(record) => record.type === "High AR Aging",
		);
		expect(rejected?.claim?.claimId).toBe(rejected?.claimId);
		expect(rejected?.transaction?.status).toBe("Rejected");
		expect(unmatched?.payments.length).toBeGreaterThan(0);
		expect(
			unmatched?.payments.every(
				(payment) => payment.reconciliationStatus === "Unmatched",
			),
		).toBe(true);
		expect(aged?.arRecords.length).toBeGreaterThan(0);
		expect(
			aged?.arRecords.every((record) => record.claimId === aged.claimId),
		).toBe(true);
		expect(
			rejected?.denials.every((denial) => denial.claimId === rejected.claimId),
		).toBe(true);
	});

	it("filters by source properties and searches linked record context", () => {
		const target = exceptionRecords.find(
			(record) => record.type === "835 Unmatched" && record.payments.length > 0,
		);
		expect(target).toBeDefined();
		if (!target?.owner || !target.status || !target.payments[0]) return;
		const results = filterExceptions(exceptionRecords, {
			...EMPTY_EXCEPTION_FILTERS,
			search: target.payments[0].paymentId.toLowerCase(),
			status: target.status,
			type: "835 Unmatched",
			severity: target.severity ?? "",
			owner: target.owner,
			sourceModule: "Payments",
			followUp: "required",
		});
		expect(results).toContain(target);
		expect(
			filterExceptions(exceptionRecords, {
				...EMPTY_EXCEPTION_FILTERS,
				followUp: "not-required",
			}).every((record) => !record.followUpRequired),
		).toBe(true);
	});

	it("sorts by the source severity order and keeps missing values last", () => {
		const rows = [
			{ ...exceptionRecords[0], exceptionId: "EX-UNAVAILABLE", severity: null },
			{ ...exceptionRecords[1], exceptionId: "EX-HIGH", severity: "High" },
			{
				...exceptionRecords[2],
				exceptionId: "EX-CRITICAL",
				severity: "Critical",
			},
		];
		expect(
			sortExceptions(rows, { field: "severity", direction: "ascending" }).map(
				(record) => record.exceptionId,
			),
		).toEqual(["EX-CRITICAL", "EX-HIGH", "EX-UNAVAILABLE"]);
	});

	it("paginates safely and looks up stable exception IDs case-insensitively", () => {
		expect(paginateExceptions(exceptionRecords, 2, 25)).toMatchObject({
			page: 2,
			pageSize: 25,
			totalItems: 180,
			totalPages: 8,
		});
		const id = exceptionRecords[0].exceptionId;
		expect(
			findExceptionById(exceptionRecords, id.toLowerCase())?.exceptionId,
		).toBe(id);
		expect(findExceptionById([], id)).toBeUndefined();
	});

	it("preserves missing claims and optional source fields without fabricating context", () => {
		const source = dataset.exceptions[0];
		const sparseDataset = {
			...dataset,
			exceptions: [
				{
					Exception_ID: source.Exception_ID,
					Claim_ID: "CLAIM-NOT-IN-PROJECTION",
					Exception_Type: null,
					Severity: null,
					Description: null,
					Owner: null,
					Status: null,
					Created_Date: null,
				},
			],
		};
		const [record] = buildExceptionRecords(sparseDataset, [], [], [], []);
		expect(record).toMatchObject({
			exceptionId: source.Exception_ID,
			claimId: "CLAIM-NOT-IN-PROJECTION",
			type: null,
			severity: null,
			description: null,
			owner: null,
			status: null,
			createdDate: null,
			sourceModule: "Unavailable",
			followUpRequired: false,
			claim: null,
			payments: [],
			arRecords: [],
			denials: [],
		});
		expect(getExceptionSummary([])).toMatchObject({
			totalRecords: 0,
			unresolvedRecords: 0,
			criticalUnresolved: 0,
			highUnresolved: 0,
			linkedClaimCount: 0,
		});
		expect(groupExceptionsByType([])).toEqual([]);
	});
});
