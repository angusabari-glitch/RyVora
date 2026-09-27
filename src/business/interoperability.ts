import type { ClaimRecord, WorkbookRecord } from "../data/claimsTypes";
import type { ArRecord } from "./ar";
import type { DenialRecord } from "./denials";
import type { ExceptionRecord } from "./exceptions";
import type { PaymentRecord } from "./payments";

export interface InteroperabilityRecord {
	transactionId: string;
	claimId: string;
	transactionType: string | null;
	status: string | null;
	interfaceName: string | null;
	sourceSystem: string | null;
	destinationSystem: string | null;
	direction: string | null;
	owner: string | null;
	createdDate: string | null;
	submissionDate: string | null;
	responseDate: string | null;
	rejectionCode: string | null;
	errorMessage: string | null;
	errorState: "Error recorded" | "No error recorded" | "Unavailable";
	claim: ClaimRecord | null;
	arRecords: ArRecord[];
	payments: PaymentRecord[];
	denials: DenialRecord[];
	exceptions: ExceptionRecord[];
}

export interface InteroperabilityFilters {
	search: string;
	status: string;
	interfaceName: string;
	transactionType: string;
	sourceSystem: string;
	destinationSystem: string;
	errorState: string;
}

export type InteroperabilitySortField =
	| "transactionId"
	| "interfaceName"
	| "transactionType"
	| "sourceSystem"
	| "destinationSystem"
	| "status"
	| "processedDate"
	| "claimId"
	| "errorState";

export interface InteroperabilitySort {
	field: InteroperabilitySortField;
	direction: "ascending" | "descending";
}

export interface InteroperabilitySummary {
	totalRecords: number;
	successfulTransactions: number;
	failedTransactions: number;
	successRate: number | null;
}

export interface InteroperabilityGroup {
	key: string;
	label: string;
	count: number;
	percent: number;
}

export interface InteroperabilityPage<T> {
	items: T[];
	page: number;
	pageSize: number;
	totalItems: number;
	totalPages: number;
}

export const EMPTY_INTEROPERABILITY_FILTERS: InteroperabilityFilters = {
	search: "",
	status: "",
	interfaceName: "",
	transactionType: "",
	sourceSystem: "",
	destinationSystem: "",
	errorState: "",
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

function isSuccessful(status: string | null): boolean {
	return status?.toLocaleLowerCase("en-US") === "accepted";
}

function isFailed(status: string | null): boolean {
	return ["failed", "rejected"].includes(
		status?.toLocaleLowerCase("en-US") ?? "",
	);
}

function normalize(value: string | null): string {
	return value?.trim().toLocaleLowerCase("en-US") ?? "";
}

export function buildInteroperabilityRecords(
	transactions: WorkbookRecord[],
	claims: ClaimRecord[],
	arRecords: ArRecord[],
	payments: PaymentRecord[],
	denials: DenialRecord[],
	exceptions: ExceptionRecord[],
): InteroperabilityRecord[] {
	const claimsById = new Map(claims.map((claim) => [claim.claimId, claim]));
	const groupByClaim = <T extends { claimId: string }>(rows: T[]) => {
		const grouped = new Map<string, T[]>();
		for (const row of rows) {
			const entries = grouped.get(row.claimId) ?? [];
			entries.push(row);
			grouped.set(row.claimId, entries);
		}
		return grouped;
	};
	const arByClaim = groupByClaim(arRecords);
	const paymentsByClaim = groupByClaim(payments);
	const denialsByClaim = groupByClaim(denials);
	const exceptionsByClaim = groupByClaim(exceptions);

	return transactions.map((row) => {
		const claimId = text(row.Claim_ID) ?? "";
		const status = text(row["837_Status"]);
		const rejectionCode = text(row.Rejection_Code);
		const errorMessage = text(row.Rejection_Reason);
		const hasError = Boolean(rejectionCode || errorMessage || isFailed(status));
		return {
			transactionId: text(row.Transaction_ID) ?? "",
			claimId,
			transactionType: text(row.Transaction_Type),
			status,
			// The approved 837 source does not define interface/system routing fields.
			interfaceName: null,
			sourceSystem: null,
			destinationSystem: null,
			direction: null,
			owner: null,
			createdDate: null,
			submissionDate: dateOnly(row.Submission_Date),
			responseDate: dateOnly(row.Response_Date),
			rejectionCode,
			errorMessage,
			errorState: hasError
				? "Error recorded"
				: status
					? "No error recorded"
					: "Unavailable",
			claim: claimsById.get(claimId) ?? null,
			arRecords: arByClaim.get(claimId) ?? [],
			payments: paymentsByClaim.get(claimId) ?? [],
			denials: denialsByClaim.get(claimId) ?? [],
			exceptions: (exceptionsByClaim.get(claimId) ?? []).filter(
				(exception) => exception.type === "837 Rejection",
			),
		};
	});
}

export function summarizeInteroperability(
	records: InteroperabilityRecord[],
): InteroperabilitySummary {
	const successfulTransactions = records.filter((record) =>
		isSuccessful(record.status),
	).length;
	return {
		totalRecords: records.length,
		successfulTransactions,
		failedTransactions: records.filter((record) => isFailed(record.status))
			.length,
		successRate: records.length
			? successfulTransactions / records.length
			: null,
	};
}

function groupBy(
	records: InteroperabilityRecord[],
	getValue: (record: InteroperabilityRecord) => string | null,
): InteroperabilityGroup[] {
	const counts = new Map<string, number>();
	for (const record of records) {
		const value = getValue(record) ?? "Not recorded";
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([label, count]) => ({
			key: label,
			label,
			count,
			percent: records.length ? (count / records.length) * 100 : 0,
		}))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function groupInteroperabilityByStatus(
	records: InteroperabilityRecord[],
) {
	return groupBy(records, (record) => record.status);
}

export function groupInteroperabilityByType(records: InteroperabilityRecord[]) {
	return groupBy(records, (record) => record.transactionType);
}

export function getInteroperabilityOptions(
	records: InteroperabilityRecord[],
	field:
		| "status"
		| "interfaceName"
		| "transactionType"
		| "sourceSystem"
		| "destinationSystem"
		| "errorState",
): string[] {
	return [
		...new Set(
			records.map(
				(record) =>
					record[field] ??
					(field === "errorState" ? "Unavailable" : "Not recorded"),
			),
		),
	].sort((a, b) => a.localeCompare(b, "en-US", { sensitivity: "base" }));
}

export function filterInteroperability(
	records: InteroperabilityRecord[],
	filters: InteroperabilityFilters,
): InteroperabilityRecord[] {
	const query = normalize(filters.search);
	return records.filter((record) => {
		const searchable = [
			record.transactionId,
			record.interfaceName,
			record.sourceSystem,
			record.destinationSystem,
			record.claimId,
			record.errorMessage,
			record.rejectionCode,
			record.transactionType,
		]
			.map(normalize)
			.join(" ");
		return (
			(!query || searchable.includes(query)) &&
			(!filters.status || record.status === filters.status) &&
			(!filters.interfaceName ||
				(filters.interfaceName === "Not recorded"
					? record.interfaceName === null
					: record.interfaceName === filters.interfaceName)) &&
			(!filters.transactionType ||
				record.transactionType === filters.transactionType) &&
			(!filters.sourceSystem ||
				(filters.sourceSystem === "Not recorded"
					? record.sourceSystem === null
					: record.sourceSystem === filters.sourceSystem)) &&
			(!filters.destinationSystem ||
				(filters.destinationSystem === "Not recorded"
					? record.destinationSystem === null
					: record.destinationSystem === filters.destinationSystem)) &&
			(!filters.errorState || record.errorState === filters.errorState)
		);
	});
}

function sortableValue(
	record: InteroperabilityRecord,
	field: InteroperabilitySortField,
): string | number | null {
	if (field === "processedDate")
		return record.responseDate ?? record.submissionDate;
	return record[field];
}

export function sortInteroperability(
	records: InteroperabilityRecord[],
	sort: InteroperabilitySort,
): InteroperabilityRecord[] {
	const direction = sort.direction === "ascending" ? 1 : -1;
	return [...records].sort((left, right) => {
		const a = sortableValue(left, sort.field);
		const b = sortableValue(right, sort.field);
		if (a === null && b === null) return 0;
		if (a === null) return 1;
		if (b === null) return -1;
		if (typeof a === "number" && typeof b === "number")
			return (a - b) * direction;
		return (
			String(a).localeCompare(String(b), "en-US", { sensitivity: "base" }) *
			direction
		);
	});
}

export function paginateInteroperability<T>(
	items: T[],
	page: number,
	pageSize: number,
): InteroperabilityPage<T> {
	const totalItems = items.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const safePage = Math.min(Math.max(1, page), totalPages);
	return {
		items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
		page: safePage,
		pageSize,
		totalItems,
		totalPages,
	};
}

export function findInteroperabilityById(
	records: InteroperabilityRecord[],
	transactionId: string,
) {
	return (
		records.find((record) => record.transactionId === transactionId) ?? null
	);
}

export function uniqueInteroperabilityValues(
	records: InteroperabilityRecord[],
	field:
		| "status"
		| "interfaceName"
		| "transactionType"
		| "sourceSystem"
		| "destinationSystem"
		| "errorState",
): string[] {
	return getInteroperabilityOptions(records, field);
}
