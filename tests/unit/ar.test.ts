import { describe, expect, it } from "vitest";
import {
	buildArRecords,
	EMPTY_AR_FILTERS,
	filterArRecords,
	findArRecordById,
	getArAgingGroups,
	getArSummary,
	paginateArRecords,
	sortArRecords,
} from "../../src/business/ar";
import { buildClaimRecords } from "../../src/business/claims";
import { getApprovedClaimsDataset } from "../../src/data/claimsDataset";

const dataset = getApprovedClaimsDataset();
const claims = buildClaimRecords(dataset);
const arRecords = buildArRecords(dataset, claims);

describe("AR Management business and approved v1.2 data", () => {
	it("maps the approved AR fields and calculates source-backed KPIs", () => {
		expect(arRecords).toHaveLength(1000);
		expect(new Set(arRecords.map((record) => record.arId)).size).toBe(1000);
		expect(arRecords.every((record) => record.claim !== null)).toBe(true);
		expect(getArSummary(arRecords)).toMatchObject({
			totalRecords: 1000,
			totalCurrentBalance: 2_498_225.77,
			averageAge: 32.35,
			followUpPopulation: 590,
		});
	});

	it("uses source aging buckets and reports count and balance with full-population percentages", () => {
		const groups = getArAgingGroups(arRecords);
		expect(groups.map(({ label, count }) => ({ label, count }))).toEqual([
			{ label: "0-30", count: 530 },
			{ label: "31-60", count: 210 },
			{ label: "61-90", count: 230 },
			{ label: "90+", count: 30 },
		]);
		expect(groups.reduce((sum, group) => sum + group.percent, 0)).toBeCloseTo(
			100,
		);
		expect(
			groups.reduce((sum, group) => sum + group.currentBalance, 0),
		).toBeCloseTo(2_498_225.77);
	});

	it("joins the related claim, payer, payment, denial, and only claim-linked exceptions", () => {
		const withPayments = arRecords.find(
			(record) => record.claim?.payments.length,
		);
		expect(withPayments?.claim?.payerName).toBeTruthy();
		expect(withPayments?.claim?.payments.length).toBeGreaterThan(0);
		const withDenial = arRecords.find((record) => record.claim?.denial);
		expect(withDenial?.claim?.denial?.denialId).toBeTruthy();
		const withException = arRecords.find((record) => record.exceptions.length);
		expect(withException?.exceptions[0].exceptionId).toMatch(/^EXC/);
	});

	it("maps each displayed AR financial and relationship field from its source rows", () => {
		const source = dataset.arRecords[0];
		const record = arRecords.find((item) => item.arId === source.AR_ID);
		expect(record).toMatchObject({
			arId: source.AR_ID,
			claimId: source.Claim_ID,
			originalBalance: source.Original_Balance,
			currentBalance: source.Current_Balance,
			arAge: source.AR_Age,
			agingBucket: source.Aging_Bucket,
			status: source.AR_Status,
			nextAction: source.Next_Action,
			owner: source.Owner,
			adjustmentAmount: source.Adjustment_Amount,
			reconciliationStatus: source.Reconciliation_Status,
			claim: { claimId: source.Claim_ID },
		});
	});

	it("preserves missing payment and denial relationships as absent", () => {
		const source = dataset.arRecords[0];
		const linkedClaim = claims.find(
			(claim) => claim.claimId === source.Claim_ID,
		);
		expect(linkedClaim).toBeDefined();
		if (!linkedClaim) return;
		const record = buildArRecords(dataset, [
			{ ...linkedClaim, payments: [], denial: null },
		]).find((item) => item.arId === source.AR_ID);
		expect(record?.claim?.payments).toEqual([]);
		expect(record?.claim?.denial).toBeNull();
	});

	it("derives explainable priority from source follow-up, linked claim priority, age, and balance", () => {
		const aged = arRecords.find(
			(record) =>
				record.followUpRequired && record.arAge !== null && record.arAge > 60,
		);
		expect(aged).toBeDefined();
		if (!aged?.claim) return;
		const criticalClaims = claims.map((claim) =>
			claim.claimId === aged.claimId
				? { ...claim, priority: "Critical" }
				: claim,
		);
		const critical = buildArRecords(dataset, criticalClaims).find(
			(record) => record.arId === aged.arId,
		);
		expect(critical).toMatchObject({
			priority: "Critical",
			priorityReason: "Critical priority from the linked claim",
		});
		const standardPriorityClaims = claims.map((claim) =>
			claim.claimId === aged.claimId ? { ...claim, priority: "Medium" } : claim,
		);
		const agedHigh = buildArRecords(dataset, standardPriorityClaims).find(
			(record) => record.arId === aged.arId,
		);
		expect(agedHigh).toMatchObject({
			priority: "High",
			priorityReason: "AR age exceeds 60 days with an outstanding balance",
		});
	});

	it("combines case-insensitive search and operational filters", () => {
		const target = arRecords.find(
			(record) =>
				record.followUpRequired &&
				record.agingBucket &&
				record.claim?.payerId &&
				record.status,
		);
		expect(target).toBeDefined();
		if (!target?.agingBucket || !target.claim?.payerId || !target.status)
			return;
		const results = filterArRecords(arRecords, {
			...EMPTY_AR_FILTERS,
			search: target.arId.toLowerCase(),
			status: target.status,
			agingBucket: target.agingBucket,
			payer: target.claim.payerId,
			followUp: "required",
			priority: target.priority,
		});
		expect(results).toEqual([target]);
		expect(
			filterArRecords(arRecords, {
				...EMPTY_AR_FILTERS,
				search: "not-an-ar-record",
			}),
		).toEqual([]);
	});

	it("sorts deterministically without mutating input and keeps missing values last", () => {
		const rows = [
			{ ...arRecords[0], arAge: null, arId: "AR-Z" },
			{ ...arRecords[1], arAge: 40, arId: "AR-B" },
			{ ...arRecords[2], arAge: 20, arId: "AR-A" },
		];
		const originalIds = rows.map((record) => record.arId);
		expect(
			sortArRecords(rows, { field: "arAge", direction: "descending" }).map(
				(row) => row.arId,
			),
		).toEqual(["AR-B", "AR-A", "AR-Z"]);
		expect(
			sortArRecords(rows, { field: "arAge", direction: "ascending" }).map(
				(row) => row.arId,
			),
		).toEqual(["AR-A", "AR-B", "AR-Z"]);
		expect(rows.map((record) => record.arId)).toEqual(originalIds);
	});

	it("paginates safely and looks up AR identifiers case-insensitively", () => {
		const firstId = arRecords[0].arId;
		expect(paginateArRecords(arRecords, 2, 25)).toMatchObject({
			page: 2,
			pageSize: 25,
			totalItems: 1000,
			totalPages: 40,
		});
		expect(paginateArRecords([], 2, 0)).toMatchObject({
			page: 1,
			pageSize: 25,
			totalPages: 0,
		});
		expect(findArRecordById(arRecords, firstId.toLowerCase())?.arId).toBe(
			firstId,
		);
	});

	it("handles missing claims, nullable data, zero balances, and empty input", () => {
		const sparse = {
			...dataset,
			arRecords: [
				{
					AR_ID: "AR-MISSING",
					Claim_ID: "MISSING-CLAIM",
					Original_Balance: null,
					Current_Balance: null,
					AR_Age: null,
					Aging_Bucket: null,
					AR_Status: null,
					Next_Action: null,
					Owner: null,
					Adjustment_Amount: null,
					Reconciliation_Status: null,
				},
				{
					AR_ID: "AR-ZERO",
					Claim_ID: "MISSING-CLAIM",
					Original_Balance: 0,
					Current_Balance: 0,
					AR_Age: 0,
					Aging_Bucket: "0-30",
					AR_Status: "Closed",
					Next_Action: "None",
					Owner: null,
					Adjustment_Amount: 0,
					Reconciliation_Status: "Reconciled",
				},
			],
			exceptions: [],
		};
		const rows = buildArRecords(sparse, []);
		expect(rows[0]).toMatchObject({
			claim: null,
			currentBalance: null,
			arAge: null,
			followUpRequired: false,
			priority: "No follow-up",
			exceptions: [],
		});
		expect(rows[1]).toMatchObject({
			currentBalance: 0,
			followUpRequired: false,
		});
		expect(getArSummary([])).toEqual({
			totalRecords: 0,
			totalCurrentBalance: null,
			averageAge: null,
			followUpPopulation: 0,
		});
		expect(getArAgingGroups([])).toEqual([]);
	});

	it("does not model coding fields absent from the approved Claims worksheet", () => {
		expect(dataset.claims[0]).not.toHaveProperty("Procedure_Code");
		expect(dataset.claims[0]).not.toHaveProperty("Diagnosis_Code");
		expect(claims[0]).not.toHaveProperty("procedureCode");
		expect(claims[0]).not.toHaveProperty("diagnosisCode");
	});
});
