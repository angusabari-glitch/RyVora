import type {
	ApprovedClaimsDataset,
	ClaimPage,
	ClaimRecord,
	WorkbookRecord,
} from "../data/claimsTypes";

export type PaymentReconciliationStatus =
	| "Matched"
	| "Unmatched"
	| "Unavailable";

export interface PaymentRecord {
	paymentId: string;
	claimId: string;
	payerId: string;
	payerName: string | null;
	transactionId: string;
	paymentDate: string | null;
	billedAmount: number | null;
	allowedAmount: number | null;
	paidAmount: number | null;
	adjustmentAmount: number | null;
	reconciliationStatus: PaymentReconciliationStatus;
	claim: ClaimRecord | null;
	billedVariance: number | null;
}

export interface PaymentFilters {
	search: string;
	payer: string;
	reconciliationStatus: "all" | PaymentReconciliationStatus;
	claimStatus: string;
	insuranceType: string;
	dateFrom: string;
	dateTo: string;
}

export type PaymentSortField =
	| "paymentId"
	| "transactionId"
	| "claimId"
	| "paymentDate"
	| "payerName"
	| "billedAmount"
	| "allowedAmount"
	| "paidAmount"
	| "adjustmentAmount"
	| "reconciliationStatus";

export interface PaymentSort {
	field: PaymentSortField;
	direction: "ascending" | "descending";
}

export interface PaymentSummary {
	totalPayments: number;
	totalPaidAmount: number | null;
	totalAllowedAmount: number | null;
	matchedCount: number;
	unmatchedCount: number;
	statusUnavailableCount: number;
	matchRate: number | null;
	missingClaimCount: number;
	claimsWithoutPaymentCount: number;
	billedVarianceCount: number;
}

function text(value: unknown): string | null {
	if (typeof value === "string" && value.trim()) return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return null;
}

function amount(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dateOnly(value: unknown): string | null {
	if (value instanceof Date && Number.isFinite(value.getTime())) {
		return value.toISOString().slice(0, 10);
	}
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

function indexBy(rows: WorkbookRecord[], key: string) {
	return new Map(rows.map((row) => [String(row[key] ?? ""), row]));
}

function toCents(value: number): number {
	return Math.round(value * 100);
}

function sumNullable(values: Array<number | null>): number | null {
	const present = values.filter((value): value is number => value !== null);
	if (present.length === 0) return null;
	return present.reduce((sum, value) => sum + toCents(value), 0) / 100;
}

function normalizeStatus(value: unknown): PaymentReconciliationStatus {
	const normalized = text(value)?.toLocaleLowerCase("en-US");
	if (normalized === "matched") return "Matched";
	if (normalized === "unmatched") return "Unmatched";
	return "Unavailable";
}

/**
 * The workbook's 835_Match_Status is the sole reconciliation outcome source.
 * Billed variance is calculated separately, in cents, by comparing the
 * payment-row Billed_Amount with its linked Claims.Billed_Amount.
 */
export function buildPaymentRecords(
	dataset: ApprovedClaimsDataset,
	claims: ClaimRecord[],
): PaymentRecord[] {
	const claimsById = new Map(claims.map((claim) => [claim.claimId, claim]));
	const payersById = indexBy(dataset.payers, "Payer_ID");
	return dataset.payments835.map((row) => {
		const claimId = text(row.Claim_ID) ?? "";
		const claim = claimsById.get(claimId) ?? null;
		const billedAmount = amount(row.Billed_Amount);
		const claimBilledAmount = claim?.billedAmount ?? null;
		const billedVariance =
			billedAmount === null || claimBilledAmount === null
				? null
				: (toCents(billedAmount) - toCents(claimBilledAmount)) / 100;
		const payerId = text(row.Payer_ID) ?? "";
		const payer = payersById.get(payerId);
		return {
			paymentId: text(row.Payment_ID) ?? "",
			claimId,
			payerId,
			payerName: text(payer?.Payer_Name),
			transactionId: text(row["835_Transaction_ID"]) ?? "",
			paymentDate: dateOnly(row.Payment_Date),
			billedAmount,
			allowedAmount: amount(row.Allowed_Amount),
			paidAmount: amount(row.Paid_Amount),
			adjustmentAmount: amount(row.Adjustment_Amount),
			reconciliationStatus: normalizeStatus(row["835_Match_Status"]),
			claim,
			billedVariance,
		};
	});
}

export function getPaymentSummary(
	payments: PaymentRecord[],
	claims: ClaimRecord[],
): PaymentSummary {
	const matchedCount = payments.filter(
		(payment) => payment.reconciliationStatus === "Matched",
	).length;
	const unmatchedCount = payments.filter(
		(payment) => payment.reconciliationStatus === "Unmatched",
	).length;
	const knownStatusCount = matchedCount + unmatchedCount;
	const paymentClaimIds = new Set(
		payments.map((payment) => payment.claimId).filter(Boolean),
	);
	return {
		totalPayments: payments.length,
		totalPaidAmount: sumNullable(payments.map((payment) => payment.paidAmount)),
		totalAllowedAmount: sumNullable(
			payments.map((payment) => payment.allowedAmount),
		),
		matchedCount,
		unmatchedCount,
		statusUnavailableCount: payments.length - knownStatusCount,
		matchRate: knownStatusCount ? matchedCount / knownStatusCount : null,
		missingClaimCount: payments.filter((payment) => !payment.claim).length,
		claimsWithoutPaymentCount: claims.filter(
			(claim) => !paymentClaimIds.has(claim.claimId),
		).length,
		billedVarianceCount: payments.filter(
			(payment) =>
				payment.billedVariance !== null && payment.billedVariance !== 0,
		).length,
	};
}

export const EMPTY_PAYMENT_FILTERS: PaymentFilters = {
	search: "",
	payer: "",
	reconciliationStatus: "all",
	claimStatus: "",
	insuranceType: "",
	dateFrom: "",
	dateTo: "",
};

export function filterPayments(
	payments: PaymentRecord[],
	filters: PaymentFilters,
): PaymentRecord[] {
	const query = filters.search.trim().toLocaleLowerCase("en-US");
	return payments.filter((payment) => {
		if (filters.payer && payment.payerId !== filters.payer) return false;
		if (
			filters.reconciliationStatus !== "all" &&
			payment.reconciliationStatus !== filters.reconciliationStatus
		)
			return false;
		if (filters.claimStatus && payment.claim?.status !== filters.claimStatus)
			return false;
		if (
			filters.insuranceType &&
			payment.claim?.insuranceType !== filters.insuranceType
		)
			return false;
		if (
			filters.dateFrom &&
			(!payment.paymentDate || payment.paymentDate < filters.dateFrom)
		)
			return false;
		if (
			filters.dateTo &&
			(!payment.paymentDate || payment.paymentDate > filters.dateTo)
		)
			return false;
		if (!query) return true;
		return [
			payment.paymentId,
			payment.transactionId,
			payment.claimId,
			payment.payerId,
			payment.payerName,
			payment.claim?.patientId,
		]
			.filter((value): value is string => Boolean(value))
			.some((value) => value.toLocaleLowerCase("en-US").includes(query));
	});
}

function sortValue(payment: PaymentRecord, field: PaymentSortField) {
	return payment[field];
}

export function sortPayments(
	payments: PaymentRecord[],
	sort: PaymentSort | null,
): PaymentRecord[] {
	if (!sort) return payments;
	const direction = sort.direction === "ascending" ? 1 : -1;
	return payments
		.map((payment, index) => ({ payment, index }))
		.sort((a, b) => {
			const left = sortValue(a.payment, sort.field);
			const right = sortValue(b.payment, sort.field);
			let comparison = 0;
			if (typeof left === "number" && typeof right === "number") {
				comparison = left - right;
			} else {
				comparison = String(left ?? "").localeCompare(
					String(right ?? ""),
					"en-US",
					{ numeric: true, sensitivity: "base" },
				);
			}
			return (
				comparison * direction ||
				a.payment.paymentId.localeCompare(b.payment.paymentId, "en-US", {
					numeric: true,
				}) ||
				a.index - b.index
			);
		})
		.map(({ payment }) => payment);
}

export function paginatePayments<T>(
	items: T[],
	page: number,
	pageSize: number,
): ClaimPage<T> {
	const safePageSize =
		Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 25;
	const totalPages = Math.ceil(items.length / safePageSize);
	const safePage = Math.min(
		Math.max(1, Number.isInteger(page) ? page : 1),
		Math.max(totalPages, 1),
	);
	const start = (safePage - 1) * safePageSize;
	return {
		items: items.slice(start, start + safePageSize),
		page: safePage,
		pageSize: safePageSize,
		totalItems: items.length,
		totalPages,
	};
}

export function findPaymentById(
	payments: PaymentRecord[],
	paymentId: string,
): PaymentRecord | undefined {
	const key = paymentId.trim().toLocaleUpperCase("en-US");
	return payments.find(
		(payment) => payment.paymentId.toLocaleUpperCase("en-US") === key,
	);
}
