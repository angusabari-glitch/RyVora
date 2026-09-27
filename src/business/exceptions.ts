import type {
	ApprovedClaimsDataset,
	ClaimPage,
	ClaimRecord,
	WorkbookRecord,
} from "../data/claimsTypes";
import type { ArRecord } from "./ar";
import type { DenialRecord } from "./denials";
import type { PaymentRecord } from "./payments";

export type ExceptionSourceModule =
	| "Interoperability"
	| "Payments"
	| "AR Management"
	| "Unavailable";

export interface ExceptionRecord {
	exceptionId: string;
	claimId: string;
	type: string | null;
	severity: string | null;
	description: string | null;
	owner: string | null;
	status: string | null;
	createdDate: string | null;
	sourceModule: ExceptionSourceModule;
	followUpRequired: boolean;
	claim: ClaimRecord | null;
	transaction: ClaimRecord["transaction837"];
	payments: PaymentRecord[];
	arRecords: ArRecord[];
	denials: DenialRecord[];
}

export interface ExceptionFilters {
	search: string;
	status: string;
	type: string;
	severity: string;
	owner: string;
	sourceModule: string;
	followUp: "all" | "required" | "not-required";
}

export type ExceptionSortField =
	| "exceptionId"
	| "sourceModule"
	| "claimId"
	| "payerName"
	| "type"
	| "severity"
	| "status"
	| "createdDate"
	| "owner"
	| "followUpRequired";

export interface ExceptionSort {
	field: ExceptionSortField;
	direction: "ascending" | "descending";
}

export interface ExceptionSummary {
	totalRecords: number;
	unresolvedRecords: number;
	criticalUnresolved: number;
	highUnresolved: number;
	linkedClaimCount: number;
}

export interface ExceptionTypeGroup {
	type: string;
	count: number;
	percent: number;
}

const RESOLVED_STATUSES = new Set([
	"resolved",
	"closed",
	"cancelled",
	"canceled",
]);

const SOURCE_MODULE_BY_TYPE: Record<string, ExceptionSourceModule> = {
	"837 Rejection": "Interoperability",
	"835 Unmatched": "Payments",
	"High AR Aging": "AR Management",
};

function text(value: unknown): string | null {
	if (typeof value === "string" && value.trim()) return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return null;
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

export function isExceptionUnresolved(status: string | null): boolean {
	return Boolean(
		status && !RESOLVED_STATUSES.has(status.trim().toLocaleLowerCase("en-US")),
	);
}

function sourceModuleFor(type: string | null): ExceptionSourceModule {
	return type ? (SOURCE_MODULE_BY_TYPE[type] ?? "Unavailable") : "Unavailable";
}

/**
 * Maps source Exceptions rows and attaches only validated Claim_ID relationships.
 * Type-to-workstream labels come from the three observed Exception_Type values.
 * The source has no direct payment, denial, or AR IDs; related rows are joined
 * through Claim_ID and restricted to the workflow named by Exception_Type.
 */
export function buildExceptionRecords(
	dataset: ApprovedClaimsDataset,
	claims: ClaimRecord[],
	payments: PaymentRecord[],
	denials: DenialRecord[],
	arRecords: ArRecord[],
): ExceptionRecord[] {
	const claimsById = new Map(claims.map((claim) => [claim.claimId, claim]));
	const paymentsByClaim = new Map<string, PaymentRecord[]>();
	for (const payment of payments) {
		const rows = paymentsByClaim.get(payment.claimId) ?? [];
		rows.push(payment);
		paymentsByClaim.set(payment.claimId, rows);
	}
	const denialsByClaim = new Map<string, DenialRecord[]>();
	for (const denial of denials) {
		const rows = denialsByClaim.get(denial.claimId) ?? [];
		rows.push(denial);
		denialsByClaim.set(denial.claimId, rows);
	}
	const arByClaim = new Map<string, ArRecord[]>();
	for (const record of arRecords) {
		const rows = arByClaim.get(record.claimId) ?? [];
		rows.push(record);
		arByClaim.set(record.claimId, rows);
	}

	return dataset.exceptions.map((row: WorkbookRecord) => {
		const claimId = text(row.Claim_ID) ?? "";
		const type = text(row.Exception_Type);
		const claim = claimsById.get(claimId) ?? null;
		const sourceModule = sourceModuleFor(type);
		const linkedPayments =
			sourceModule === "Payments"
				? (paymentsByClaim
						.get(claimId)
						?.filter(
							(payment) => payment.reconciliationStatus === "Unmatched",
						) ?? [])
				: [];
		const linkedAr =
			sourceModule === "AR Management" ? (arByClaim.get(claimId) ?? []) : [];
		const transaction =
			sourceModule === "Interoperability"
				? (claim?.transaction837 ?? null)
				: null;
		return {
			exceptionId: text(row.Exception_ID) ?? "",
			claimId,
			type,
			severity: text(row.Severity),
			description: text(row.Description),
			owner: text(row.Owner),
			status: text(row.Status),
			createdDate: dateOnly(row.Created_Date),
			sourceModule,
			followUpRequired: isExceptionUnresolved(text(row.Status)),
			claim,
			transaction,
			payments: linkedPayments,
			arRecords: linkedAr,
			denials: denialsByClaim.get(claimId) ?? [],
		};
	});
}

export const EMPTY_EXCEPTION_FILTERS: ExceptionFilters = {
	search: "",
	status: "",
	type: "",
	severity: "",
	owner: "",
	sourceModule: "",
	followUp: "all",
};

export function getExceptionSummary(
	records: ExceptionRecord[],
): ExceptionSummary {
	const unresolved = records.filter((record) => record.followUpRequired);
	return {
		totalRecords: records.length,
		unresolvedRecords: unresolved.length,
		criticalUnresolved: unresolved.filter(
			(record) => record.severity?.toLocaleLowerCase("en-US") === "critical",
		).length,
		highUnresolved: unresolved.filter(
			(record) => record.severity?.toLocaleLowerCase("en-US") === "high",
		).length,
		linkedClaimCount: new Set(
			records
				.filter((record) => record.claim !== null && record.claimId)
				.map((record) => record.claimId),
		).size,
	};
}

export function groupExceptionsByType(
	records: ExceptionRecord[],
): ExceptionTypeGroup[] {
	const groups = new Map<string, number>();
	for (const record of records) {
		const type = record.type ?? "Type not recorded";
		groups.set(type, (groups.get(type) ?? 0) + 1);
	}
	return [...groups]
		.map(([type, count]) => ({
			type,
			count,
			percent: records.length ? (count / records.length) * 100 : 0,
		}))
		.sort((a, b) => b.count - a.count || a.type.localeCompare(b.type, "en-US"));
}

export function filterExceptions(
	records: ExceptionRecord[],
	filters: ExceptionFilters,
): ExceptionRecord[] {
	const query = filters.search.trim().toLocaleLowerCase("en-US");
	return records.filter((record) => {
		if (filters.status && record.status !== filters.status) return false;
		if (filters.type && record.type !== filters.type) return false;
		if (filters.severity && record.severity !== filters.severity) return false;
		if (filters.owner && record.owner !== filters.owner) return false;
		if (filters.sourceModule && record.sourceModule !== filters.sourceModule)
			return false;
		if (filters.followUp === "required" && !record.followUpRequired)
			return false;
		if (filters.followUp === "not-required" && record.followUpRequired)
			return false;
		if (!query) return true;
		const values = [
			record.exceptionId,
			record.claimId,
			record.type,
			record.severity,
			record.description,
			record.owner,
			record.status,
			record.sourceModule,
			record.claim?.payerId,
			record.claim?.payerName,
			record.transaction?.transactionId,
			record.transaction?.rejectionCode,
			record.transaction?.rejectionReason,
			...record.payments.flatMap((payment) => [
				payment.paymentId,
				payment.transactionId,
			]),
			...record.arRecords.map((ar) => ar.arId),
			...record.denials.map((denial) => denial.denialId),
		];
		return values.some((value) =>
			value?.toLocaleLowerCase("en-US").includes(query),
		);
	});
}

const SEVERITY_ORDER = new Map([
	["Critical", 0],
	["High", 1],
]);

function compare(left: string | number | null, right: string | number | null) {
	if (left === null && right === null) return 0;
	if (left === null) return 1;
	if (right === null) return -1;
	if (typeof left === "number" && typeof right === "number")
		return left - right;
	return String(left).localeCompare(String(right), "en-US", {
		numeric: true,
		sensitivity: "base",
	});
}

export function sortExceptions(
	records: ExceptionRecord[],
	sort: ExceptionSort | null,
): ExceptionRecord[] {
	if (!sort) return records;
	const direction = sort.direction === "ascending" ? 1 : -1;
	return records
		.map((record, index) => ({ record, index }))
		.sort((a, b) => {
			const value = (record: ExceptionRecord): string | number | null => {
				switch (sort.field) {
					case "payerName":
						return record.claim?.payerName ?? null;
					case "severity":
						return record.severity === null
							? null
							: (SEVERITY_ORDER.get(record.severity) ?? 2);
					case "followUpRequired":
						return Number(record.followUpRequired);
					default:
						return record[sort.field];
				}
			};
			const left = value(a.record);
			const right = value(b.record);
			const nullOrder =
				left === null ? (right === null ? 0 : 1) : right === null ? -1 : 0;
			return (
				nullOrder ||
				compare(left, right) * direction ||
				a.record.exceptionId.localeCompare(b.record.exceptionId, "en-US", {
					numeric: true,
				}) ||
				a.index - b.index
			);
		})
		.map(({ record }) => record);
}

export function paginateExceptions<T>(
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

export function findExceptionById(
	records: ExceptionRecord[],
	exceptionId: string,
): ExceptionRecord | undefined {
	const key = exceptionId.trim().toLocaleUpperCase("en-US");
	return records.find(
		(record) => record.exceptionId.toLocaleUpperCase("en-US") === key,
	);
}
