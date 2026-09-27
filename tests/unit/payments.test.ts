import { describe, expect, it } from "vitest";
import { buildClaimRecords } from "../../src/business/claims";
import {
	buildPaymentRecords,
	EMPTY_PAYMENT_FILTERS,
	filterPayments,
	findPaymentById,
	getPaymentSummary,
	paginatePayments,
	sortPayments,
} from "../../src/business/payments";
import { getApprovedClaimsDataset } from "../../src/data/claimsDataset";

const dataset = getApprovedClaimsDataset();
const claims = buildClaimRecords(dataset);
const payments = buildPaymentRecords(dataset, claims);

describe("Payments workbench business and approved dataset integration", () => {
	it("calculates payment totals and status counts from approved v1.2 records", () => {
		expect(payments).toHaveLength(520);
		expect(new Set(payments.map((payment) => payment.paymentId)).size).toBe(
			520,
		);
		expect(new Set(payments.map((payment) => payment.transactionId)).size).toBe(
			520,
		);
		expect(getPaymentSummary(payments, claims)).toMatchObject({
			totalPayments: 520,
			totalPaidAmount: 2_121_910.42,
			totalAllowedAmount: 2_278_559.44,
			matchedCount: 470,
			unmatchedCount: 50,
			statusUnavailableCount: 0,
			missingClaimCount: 0,
			claimsWithoutPaymentCount: 480,
			billedVarianceCount: 0,
		});
		expect(getPaymentSummary(payments, claims).matchRate).toBeCloseTo(
			470 / 520,
		);
	});

	it("links payer and claim data and keeps the source status separate from billed variance", () => {
		const unmatched = payments.find(
			(payment) => payment.reconciliationStatus === "Unmatched",
		);
		expect(unmatched).toMatchObject({
			claim: { claimId: expect.any(String) },
			payerName: expect.any(String),
			billedVariance: 0,
		});
	});

	it("searches actual identifiers and linked payer/patient context case-insensitively", () => {
		const payment = payments[0];
		expect(
			filterPayments(payments, {
				...EMPTY_PAYMENT_FILTERS,
				search: payment.transactionId.toLowerCase(),
			}),
		).toEqual([payment]);
		expect(
			filterPayments(payments, {
				...EMPTY_PAYMENT_FILTERS,
				search: payment.claim?.patientId.toLowerCase() ?? "",
			}).length,
		).toBeGreaterThan(0);
		expect(
			filterPayments(payments, {
				...EMPTY_PAYMENT_FILTERS,
				search: "no-such-835-record",
			}),
		).toEqual([]);
	});

	it("combines payer, source match status, claim status, insurance, and date filters", () => {
		const payment = payments.find(
			(item) => item.claim?.insuranceType && item.paymentDate,
		);
		expect(payment).toBeDefined();
		if (!payment?.claim?.insuranceType || !payment.paymentDate) return;
		const filtered = filterPayments(payments, {
			...EMPTY_PAYMENT_FILTERS,
			payer: payment.payerId,
			reconciliationStatus: payment.reconciliationStatus,
			claimStatus: payment.claim.status,
			insuranceType: payment.claim.insuranceType,
			dateFrom: payment.paymentDate,
			dateTo: payment.paymentDate,
		});
		expect(filtered).toContainEqual(payment);
		expect(
			filtered.every(
				(item) =>
					item.payerId === payment.payerId &&
					item.reconciliationStatus === payment.reconciliationStatus &&
					item.claim?.status === payment.claim?.status &&
					item.claim?.insuranceType === payment.claim?.insuranceType &&
					item.paymentDate === payment.paymentDate,
			),
		).toBe(true);
	});

	it("sorts deterministically, paginates, and finds payment details case-insensitively", () => {
		const sorted = sortPayments(payments, {
			field: "paidAmount",
			direction: "descending",
		});
		expect(sorted[0].paidAmount).toBeGreaterThanOrEqual(
			sorted[1].paidAmount ?? 0,
		);
		const page = paginatePayments(sorted, 2, 25);
		expect(page).toMatchObject({
			page: 2,
			pageSize: 25,
			totalItems: 520,
			totalPages: 21,
		});
		expect(page.items).toHaveLength(25);
		expect(
			findPaymentById(payments, payments[0].paymentId.toLowerCase()),
		).toEqual(payments[0]);
		expect(findPaymentById(payments, "not-a-payment")).toBeUndefined();
	});

	it("handles empty data, absent claims, absent amounts, and unknown statuses", () => {
		expect(getPaymentSummary([], [])).toEqual({
			totalPayments: 0,
			totalPaidAmount: null,
			totalAllowedAmount: null,
			matchedCount: 0,
			unmatchedCount: 0,
			statusUnavailableCount: 0,
			matchRate: null,
			missingClaimCount: 0,
			claimsWithoutPaymentCount: 0,
			billedVarianceCount: 0,
		});
		const sample = dataset.payments835[0];
		const sparseDataset = {
			...dataset,
			payments835: [
				{
					...sample,
					Claim_ID: "MISSING-CLAIM",
					Billed_Amount: null,
					Allowed_Amount: null,
					Paid_Amount: null,
					Adjustment_Amount: null,
					"835_Match_Status": "Needs review",
				},
			],
		};
		const sparsePayment = buildPaymentRecords(sparseDataset, [])[0];
		expect(sparsePayment).toMatchObject({
			claim: null,
			billedAmount: null,
			allowedAmount: null,
			paidAmount: null,
			adjustmentAmount: null,
			reconciliationStatus: "Unavailable",
			billedVariance: null,
		});
		expect(getPaymentSummary([sparsePayment], [])).toMatchObject({
			totalPaidAmount: null,
			totalAllowedAmount: null,
			statusUnavailableCount: 1,
			matchRate: null,
			missingClaimCount: 1,
		});
	});

	it("preserves multiple payment rows that point to the same claim", () => {
		const first = dataset.payments835[0];
		const multipleDataset = {
			...dataset,
			payments835: [
				first,
				{
					...first,
					Payment_ID: `${first.Payment_ID}-SECOND`,
					"835_Transaction_ID": `${first["835_Transaction_ID"]}-SECOND`,
				},
			],
		};
		const multiple = buildPaymentRecords(multipleDataset, claims);
		expect(multiple).toHaveLength(2);
		expect(multiple[0].claimId).toBe(multiple[1].claimId);
		expect(multiple[0].claim).toBe(multiple[1].claim);
	});
});
