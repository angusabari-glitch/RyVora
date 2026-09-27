import { describe, expect, it } from "vitest";
import {
	buildExecutiveDashboardModel,
	filterPriorityClaims,
	getAverageArAge,
	getBilledAmount,
	getClaimStatusDistribution,
	getDenialRate,
	getDenialReasonDistribution,
	getManagementAlerts,
	getPriorityClaims,
	getTotalClaims,
} from "../../src/business/executiveDashboard";
import { getApprovedDashboardDataset } from "../../src/data/dashboardDataset";
import type { ApprovedDashboardDataset } from "../../src/data/dashboardTypes";

const approvedDataset = getApprovedDashboardDataset();

function emptyDataset(): ApprovedDashboardDataset {
	return {
		version: approvedDataset.version,
		validationTargets: approvedDataset.validationTargets,
		claims: [],
		payers: [],
		denials: [],
		arRecords: [],
		exceptions: [],
	};
}

describe("Executive Dashboard selectors", () => {
	it("calculates KPI values from the approved workbook and reconciles targets", () => {
		const model = buildExecutiveDashboardModel(approvedDataset);

		expect(getTotalClaims(approvedDataset.claims)).toBe(1000);
		expect(model.kpis.billedAmount).toBeCloseTo(4621631.63, 2);
		expect(model.kpis.denialRate).toBeCloseTo(0.29, 5);
		expect(model.kpis.averageArAge).toBeCloseTo(32.35, 2);
		expect(model.kpis.arPopulation).toBe(1000);
		expect(model.kpiDiscrepancies).toEqual([]);
	});

	it("groups every observed claim status and denial reason from source rows", () => {
		const statuses = getClaimStatusDistribution(approvedDataset.claims);
		const reasons = getDenialReasonDistribution(approvedDataset.denials);

		expect(statuses.reduce((total, item) => total + item.count, 0)).toBe(
			approvedDataset.claims.length,
		);
		expect(statuses.map((item) => item.label).sort()).toEqual([
			"Denied",
			"Paid",
			"Partially Paid",
			"Pending",
			"Rejected",
		]);
		expect(reasons.reduce((total, item) => total + item.count, 0)).toBe(
			approvedDataset.denials.length,
		);
		expect(reasons.map((item) => item.label)).toContain("Deductible");
		expect(
			reasons.every((item) => item.code.length > 0 && item.category.length > 0),
		).toBe(true);
	});

	it("selects and filters follow-up claims using status, priority, and AR age", () => {
		const priorityClaims = getPriorityClaims(approvedDataset);

		expect(priorityClaims.length).toBeGreaterThan(0);
		expect(priorityClaims.every((claim) => claim.followUpRequired)).toBe(true);
		expect(
			priorityClaims.every(
				(claim) =>
					claim.priority === "Critical" ||
					claim.priority === "High" ||
					claim.arAge > 60,
			),
		).toBe(true);
		expect(
			filterPriorityClaims(priorityClaims, "denied").every(
				(claim) => claim.status === "Denied",
			),
		).toBe(true);
		expect(
			filterPriorityClaims(priorityClaims, "aged").every(
				(claim) => claim.arAge > 60,
			),
		).toBe(true);
		expect(priorityClaims[0].priority).toBe("Critical");
	});

	it("creates management alerts from denied balances, active exceptions, and aged AR", () => {
		const alerts = getManagementAlerts(approvedDataset);

		expect(alerts.map((alert) => alert.id)).toEqual([
			"critical-exceptions",
			"denial-volume",
			"high-exceptions",
			"aged-ar",
		]);
		expect(
			alerts.find((alert) => alert.id === "critical-exceptions")?.count,
		).toBe(10);
		expect(alerts.find((alert) => alert.id === "high-exceptions")?.count).toBe(
			80,
		);
		expect(alerts.find((alert) => alert.id === "aged-ar")?.count).toBe(260);
		expect(
			alerts.find((alert) => alert.id === "denial-volume")?.amount,
		).toBeCloseTo(1052883.4, 2);
	});

	it("returns zero metrics and no alerts for empty data", () => {
		const dataset = emptyDataset();
		const model = buildExecutiveDashboardModel(dataset);

		expect(getTotalClaims(dataset.claims)).toBe(0);
		expect(getBilledAmount(dataset.claims)).toBe(0);
		expect(getDenialRate(dataset.claims, dataset.denials)).toBe(0);
		expect(getAverageArAge(dataset.arRecords)).toBe(0);
		expect(model.claimStatusDistribution).toEqual([]);
		expect(model.denialReasons).toEqual([]);
		expect(getPriorityClaims(dataset)).toEqual([]);
		expect(getManagementAlerts(dataset)).toEqual([]);
	});

	it("ignores missing or invalid optional financial and age values", () => {
		const claims = [
			{
				claimId: "A",
				payerId: "P",
				billedAmount: 120,
				status: "Pending",
				priority: "High",
				arAge: 10,
			},
			{
				claimId: "B",
				payerId: "P",
				billedAmount: null,
				status: "Pending",
				priority: "High",
				arAge: null,
			},
			{
				claimId: "C",
				payerId: "P",
				billedAmount: Number.NaN,
				status: "Pending",
				priority: "High",
				arAge: Number.POSITIVE_INFINITY,
			},
		];

		expect(getBilledAmount(claims)).toBe(120);
		expect(
			getAverageArAge([
				{
					claimId: "A",
					originalBalance: null,
					currentBalance: null,
					arAge: 20,
					agingBucket: "0-30",
					status: "Open",
				},
				{
					claimId: "B",
					originalBalance: null,
					currentBalance: null,
					arAge: null,
					agingBucket: "0-30",
					status: "Open",
				},
				{
					claimId: "C",
					originalBalance: null,
					currentBalance: null,
					arAge: Number.NaN,
					agingBucket: "0-30",
					status: "Open",
				},
			]),
		).toBe(20);
	});

	it("returns no priority claims when all eligible statuses are resolved or low-risk", () => {
		const dataset = emptyDataset();
		dataset.claims = [
			{
				claimId: "PAID-1",
				payerId: "P",
				billedAmount: 100,
				status: "Paid",
				priority: "Medium",
				arAge: 12,
			},
		];
		dataset.payers = [{ payerId: "P", payerName: "Synthetic Payer" }];

		expect(getPriorityClaims(dataset)).toEqual([]);
	});

	it("surfaces validation-target differences without replacing the calculated values", () => {
		const dataset = structuredClone(approvedDataset);
		dataset.validationTargets.billedAmount += 1;
		const model = buildExecutiveDashboardModel(dataset);

		const discrepancy = model.kpiDiscrepancies.find(
			(item) => item.label === "Billed Amount",
		);
		expect(discrepancy?.target).toBeCloseTo(4621632.63, 2);
		expect(discrepancy?.actual).toBeCloseTo(4621631.63, 2);
		expect(model.kpis.billedAmount).toBeCloseTo(4621631.63, 2);
	});
});
