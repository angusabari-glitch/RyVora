import type {
	ApprovedClaimsDataset,
	ClaimFilters,
	ClaimPage,
	ClaimRecord,
	ClaimSort,
	WorkbookRecord,
} from "../data/claimsTypes";

const FOLLOW_UP_STATUSES = new Set([
	"Denied",
	"Rejected",
	"Pending",
	"Partially Paid",
]);

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

function sumAmounts(rows: WorkbookRecord[], key: string): number | null {
	const values = rows
		.map((row) => amount(row[key]))
		.filter((item) => item !== null);
	return values.length
		? values.reduce((total, item) => total + Math.round(item * 100), 0) / 100
		: null;
}

export function buildClaimRecords(
	dataset: ApprovedClaimsDataset,
): ClaimRecord[] {
	const patients = indexBy(dataset.patients, "Patient_ID");
	const providers = indexBy(dataset.providers, "Provider_ID");
	const payers = indexBy(dataset.payers, "Payer_ID");
	const arByClaim = indexBy(dataset.arRecords, "Claim_ID");
	const transactionByClaim = indexBy(dataset.transactions837, "Claim_ID");
	const denialByClaim = indexBy(dataset.denials, "Claim_ID");
	const paymentsByClaim = new Map<string, WorkbookRecord[]>();
	for (const payment of dataset.payments835) {
		const claimId = String(payment.Claim_ID ?? "");
		const payments = paymentsByClaim.get(claimId) ?? [];
		payments.push(payment);
		paymentsByClaim.set(claimId, payments);
	}

	return dataset.claims.map((row) => {
		const claimId = String(row.Claim_ID ?? "");
		const ar = arByClaim.get(claimId);
		const transaction = transactionByClaim.get(claimId);
		const denial = denialByClaim.get(claimId);
		const payments = paymentsByClaim.get(claimId) ?? [];
		const nextAction = text(ar?.Next_Action);
		const claimPayments = payments.map((payment) => ({
			paymentId: String(payment.Payment_ID ?? ""),
			transactionId: String(payment["835_Transaction_ID"] ?? ""),
			allowedAmount: amount(payment.Allowed_Amount),
			paidAmount: amount(payment.Paid_Amount),
			adjustmentAmount: amount(payment.Adjustment_Amount),
			matchStatus: text(payment["835_Match_Status"]),
			paymentDate: dateOnly(payment.Payment_Date),
		}));
		const status = text(row.Claim_Status) ?? "Unknown";
		const denialFollowUp = Boolean(
			denial &&
				(text(denial.Resolution_Status)?.toLowerCase() === "open" ||
					text(denial.Appeal_Status)?.toLowerCase() === "pending"),
		);
		const transactionFollowUp =
			text(transaction?.["837_Status"])?.toLowerCase() === "rejected";
		const followUpRequired =
			FOLLOW_UP_STATUSES.has(status) ||
			Boolean(nextAction && nextAction.toLowerCase() !== "none") ||
			denialFollowUp ||
			transactionFollowUp;
		return {
			claimId,
			patientId: String(row.Patient_ID ?? ""),
			providerId: String(row.Provider_ID ?? ""),
			providerName:
				text(providers.get(String(row.Provider_ID ?? ""))?.Provider_Name) ??
				null,
			payerId: String(row.Payer_ID ?? ""),
			payerName:
				text(payers.get(String(row.Payer_ID ?? ""))?.Payer_Name) ?? null,
			serviceDate: dateOnly(row.Service_Date),
			submissionDate: dateOnly(row.Submission_Date),
			claimType: text(row.Claim_Type),
			insuranceType:
				text(patients.get(String(row.Patient_ID ?? ""))?.Insurance_Plan) ??
				null,
			billedAmount: amount(row.Billed_Amount),
			allowedAmount: sumAmounts(payments, "Allowed_Amount"),
			paidAmount: sumAmounts(payments, "Paid_Amount"),
			outstandingAmount: amount(ar?.Current_Balance),
			status,
			arStatus: text(ar?.AR_Status),
			arAge: amount(ar?.AR_Age) ?? amount(row.AR_Age),
			priority: text(row.Priority),
			followUpRequired,
			nextAction,
			currentOwner: text(row.Current_Owner) ?? text(ar?.Owner),
			arAgingBucket: text(ar?.Aging_Bucket),
			transaction837: transaction
				? {
						transactionId: String(transaction.Transaction_ID ?? ""),
						type: text(transaction.Transaction_Type),
						status: text(transaction["837_Status"]),
						rejectionCode: text(transaction.Rejection_Code),
						rejectionReason: text(transaction.Rejection_Reason),
						submissionDate: dateOnly(transaction.Submission_Date),
						responseDate: dateOnly(transaction.Response_Date),
					}
				: null,
			payments: claimPayments,
			denial: denial
				? {
						denialId: String(denial.Denial_ID ?? ""),
						code: text(denial.Denial_Code),
						reason: text(denial.Denial_Reason),
						category: text(denial.Denial_Category),
						amount: amount(denial.Denial_Amount),
						date: dateOnly(denial.Denial_Date),
						appealStatus: text(denial.Appeal_Status),
						resolutionStatus: text(denial.Resolution_Status),
					}
				: null,
		};
	});
}

export function getClaimSummary(claims: ClaimRecord[]) {
	return {
		totalClaims: claims.length,
		pendingClaims: claims.filter((claim) => claim.status === "Pending").length,
		deniedClaims: claims.filter((claim) => claim.status === "Denied").length,
		rejectedClaims: claims.filter((claim) => claim.status === "Rejected")
			.length,
		totalBilledAmount:
			claims.reduce(
				(total, claim) => total + Math.round((claim.billedAmount ?? 0) * 100),
				0,
			) / 100,
	};
}

export const EMPTY_CLAIM_FILTERS: ClaimFilters = {
	search: "",
	status: "",
	insuranceType: "",
	arStatus: "",
	followUp: "all",
	serviceDateFrom: "",
	serviceDateTo: "",
};

export function filterClaims(
	claims: ClaimRecord[],
	filters: ClaimFilters,
): ClaimRecord[] {
	const query = filters.search.trim().toLocaleLowerCase("en-US");
	return claims.filter((claim) => {
		if (filters.status && claim.status !== filters.status) return false;
		if (filters.insuranceType && claim.insuranceType !== filters.insuranceType)
			return false;
		if (filters.arStatus && claim.arStatus !== filters.arStatus) return false;
		if (filters.followUp === "required" && !claim.followUpRequired)
			return false;
		if (filters.followUp === "not-required" && claim.followUpRequired)
			return false;
		if (
			filters.serviceDateFrom &&
			(!claim.serviceDate || claim.serviceDate < filters.serviceDateFrom)
		)
			return false;
		if (
			filters.serviceDateTo &&
			(!claim.serviceDate || claim.serviceDate > filters.serviceDateTo)
		)
			return false;
		if (!query) return true;
		return [
			claim.claimId,
			claim.patientId,
			claim.providerId,
			claim.providerName,
			claim.payerId,
			claim.payerName,
		]
			.filter((value): value is string => Boolean(value))
			.some((value) => value.toLocaleLowerCase("en-US").includes(query));
	});
}

function compareClaims(
	a: ClaimRecord,
	b: ClaimRecord,
	field: keyof ClaimRecord,
) {
	const left = a[field];
	const right = b[field];
	if (typeof left === "number" && typeof right === "number")
		return left - right;
	return String(left ?? "").localeCompare(String(right ?? ""), "en-US", {
		numeric: true,
		sensitivity: "base",
	});
}

export function sortClaims(
	claims: ClaimRecord[],
	sort: ClaimSort | null,
): ClaimRecord[] {
	if (!sort) return claims;
	const direction = sort.direction === "ascending" ? 1 : -1;
	return claims
		.map((claim, index) => ({ claim, index }))
		.sort(
			(a, b) =>
				compareClaims(a.claim, b.claim, sort.field) * direction ||
				a.claim.claimId.localeCompare(b.claim.claimId, "en-US") ||
				a.index - b.index,
		)
		.map(({ claim }) => claim);
}

export function paginateClaims<T>(
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

export function findClaimById(
	claims: ClaimRecord[],
	claimId: string,
): ClaimRecord | undefined {
	const key = claimId.trim().toLocaleUpperCase("en-US");
	return claims.find(
		(claim) => claim.claimId.toLocaleUpperCase("en-US") === key,
	);
}
