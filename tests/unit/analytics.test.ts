import { describe, expect, it } from "vitest";
import { buildAnalyticsModel } from "../../src/business/analytics";
import {
	arRecord,
	claim,
	denial,
	exception,
	interoperability,
	payment,
} from "../helpers/analyticsFixtures";

function source() {
	const claims = [
		claim(),
		claim({
			claimId: "CLM-2",
			payerId: "P2",
			payerName: "Payer Two",
			status: "Paid",
			serviceDate: "2026-02-14",
			billedAmount: 200.2,
			arAge: null,
			followUpRequired: false,
		}),
		claim({
			claimId: "CLM-3",
			status: "Rejected",
			serviceDate: "2026-02-25",
			billedAmount: null,
		}),
	];
	return {
		claims,
		denials: [denial()],
		payments: [
			payment(),
			payment({
				paymentId: "PAY-2",
				claimId: "CLM-2",
				payerId: "P2",
				payerName: "Payer Two",
				paidAmount: null,
				reconciliationStatus: "Unmatched",
				claim: claims[1],
			}),
		],
		arRecords: [
			arRecord(),
			arRecord({
				arId: "AR-2",
				claimId: "CLM-2",
				claim: claims[1],
				currentBalance: null,
				arAge: null,
				agingBucket: null,
			}),
		],
		exceptions: [exception()],
		interoperability: [interoperability()],
		payers: [
			{ payerId: "P1", payerName: "Payer One" },
			{ payerId: "P2", payerName: "Payer Two" },
		],
	};
}

describe("Analytics business model", () => {
	it("reuses module summaries and derives cross-module and payer views from Claim_ID", () => {
		const model = buildAnalyticsModel(source());
		expect(model.summary.claims.totalClaims).toBe(3);
		expect(model.summary.claims.totalBilledAmount).toBe(300.25);
		expect(model.summary.denials.denialRate).toBeCloseTo(1 / 3);
		expect(model.summary.payments.totalPaidAmount).toBe(50);
		expect(model.summary.ar.totalRecords).toBe(2);
		expect(model.summary.exceptions.totalRecords).toBe(1);
		expect(model.summary.interoperability.successfulTransactions).toBe(1);
		expect(
			model.lifecycle.find((row) => row.label === "With denial")?.claimCount,
		).toBe(1);
		expect(model.payers.find((row) => row.payerId === "P1")).toMatchObject({
			claimCount: 2,
			billedAmount: 100.05,
			paidAmount: 50,
			outstandingAr: 50,
			denialCount: 1,
			exceptionCount: 1,
		});
	});

	it("groups a real source date trend and exposes module distributions", () => {
		const model = buildAnalyticsModel(source());
		expect(model.trendLabel).toBe("Monthly claims by service date");
		expect(model.trend).toEqual([
			{ period: "2026-01", claimCount: 1, billedAmount: 100.05 },
			{ period: "2026-02", claimCount: 2, billedAmount: 200.2 },
		]);
		expect(model.claimStatuses.map((row) => row.label)).toEqual([
			"Denied",
			"Paid",
			"Rejected",
		]);
		expect(model.denialReasons[0]).toMatchObject({ code: "CO-1", count: 1 });
		expect(model.paymentStatuses.map((row) => row.label)).toEqual([
			"Matched",
			"Unmatched",
		]);
		expect(model.interoperabilityStatuses[0]).toMatchObject({
			label: "Accepted",
			count: 1,
		});
	});

	it("uses the payment worksheet payer field instead of inferring from Claim_ID", () => {
		const data = source();
		data.payments[0] = payment({
			payerId: "P2",
			payerName: "Payer Two",
			claim: data.claims[0] ?? null,
		});
		const model = buildAnalyticsModel(data);
		expect(
			model.payers.find((row) => row.payerId === "P1")?.paidAmount,
		).toBeNull();
		expect(model.payers.find((row) => row.payerId === "P2")?.paidAmount).toBe(
			50,
		);
	});

	it("does not invent a period when source service dates are missing", () => {
		const model = buildAnalyticsModel({
			...source(),
			claims: [claim({ serviceDate: null })],
		});
		expect(model.trend).toEqual([]);
		expect(model.trendLabel).toBe("Service-date population distribution");
	});

	it("applies payer, status, and service-date filters to linked module records", () => {
		const model = buildAnalyticsModel({
			...source(),
			filters: {
				payerId: "P1",
				claimStatus: "Denied",
				serviceDateFrom: "2026-01-01",
				serviceDateTo: "2026-01-31",
			},
		});
		expect(model.summary.claims.totalClaims).toBe(1);
		expect(model.summary.denials.denialRate).toBe(1);
		expect(model.summary.payments.totalPayments).toBe(1);
		expect(model.summary.ar.totalRecords).toBe(1);
		expect(model.summary.exceptions.totalRecords).toBe(1);
		expect(model.summary.interoperability.totalRecords).toBe(1);
		expect(model.lifecycle.every((row) => row.claimCount === 1)).toBe(true);
	});

	it("handles empty populations and missing financial values without fabricated totals", () => {
		const data = source();
		const empty = buildAnalyticsModel({
			...data,
			claims: [],
			denials: [],
			payments: [],
			arRecords: [],
			exceptions: [],
			interoperability: [],
		});
		expect(empty.summary.claims.totalClaims).toBe(0);
		expect(empty.summary.denials.denialRate).toBe(0);
		expect(empty.summary.payments.totalPaidAmount).toBeNull();
		expect(empty.summary.ar.totalCurrentBalance).toBeNull();
		expect(empty.trend).toEqual([]);
		expect(
			empty.lifecycle.every((row) => row.claimCount === 0 && row.percent === 0),
		).toBe(true);
		const zeroValue = buildAnalyticsModel({
			...data,
			claims: [claim({ billedAmount: 0 })],
			payments: [payment({ paidAmount: 0 })],
		});
		expect(zeroValue.summary.claims.totalBilledAmount).toBe(0);
		expect(zeroValue.summary.payments.totalPaidAmount).toBe(0);
		const unavailableAmount = buildAnalyticsModel({
			...data,
			claims: [claim({ billedAmount: null })],
		});
		expect(unavailableAmount.trend[0]?.billedAmount).toBeNull();
	});
});
