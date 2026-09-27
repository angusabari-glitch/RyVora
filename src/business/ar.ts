import type {
	ApprovedClaimsDataset,
	ClaimPage,
	ClaimRecord,
	WorkbookRecord,
} from "../data/claimsTypes";

export type ArPriority = "Critical" | "High" | "Routine" | "No follow-up";

export interface ArException {
	exceptionId: string;
	type: string | null;
	severity: string | null;
	description: string | null;
	owner: string | null;
	status: string | null;
	createdDate: string | null;
}

export interface ArRecord {
	arId: string;
	claimId: string;
	originalBalance: number | null;
	currentBalance: number | null;
	arAge: number | null;
	agingBucket: string | null;
	status: string | null;
	nextAction: string | null;
	owner: string | null;
	adjustmentAmount: number | null;
	reconciliationStatus: string | null;
	claim: ClaimRecord | null;
	exceptions: ArException[];
	followUpRequired: boolean;
	priority: ArPriority;
	priorityReason: string;
}

export interface ArFilters {
	search: string;
	status: string;
	agingBucket: string;
	payer: string;
	followUp: "all" | "required" | "not-required";
	priority: "all" | ArPriority;
}

export type ArSortField =
	| "arId"
	| "claimId"
	| "payerName"
	| "status"
	| "arAge"
	| "agingBucket"
	| "currentBalance"
	| "nextAction"
	| "priority";

export interface ArSort {
	field: ArSortField;
	direction: "ascending" | "descending";
}

export interface ArSummary {
	totalRecords: number;
	totalCurrentBalance: number | null;
	averageAge: number | null;
	followUpPopulation: number;
}

export interface ArAgingGroup {
	label: string;
	count: number;
	percent: number;
	currentBalance: number;
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

function priorityFor(
	arStatus: string | null,
	nextAction: string | null,
	balance: number | null,
	age: number | null,
	claimPriority: string | null,
): { followUpRequired: boolean; priority: ArPriority; priorityReason: string } {
	const followUpRequired =
		arStatus?.toLocaleLowerCase("en-US") === "active" &&
		nextAction?.toLocaleLowerCase("en-US") === "follow up" &&
		balance !== null &&
		balance > 0;
	if (!followUpRequired) {
		return {
			followUpRequired: false,
			priority: "No follow-up",
			priorityReason:
				balance === 0
					? "No outstanding balance"
					: "Source status or next action does not indicate follow-up",
		};
	}
	if (claimPriority?.toLocaleLowerCase("en-US") === "critical")
		return {
			followUpRequired,
			priority: "Critical",
			priorityReason: "Critical priority from the linked claim",
		};
	if (
		claimPriority?.toLocaleLowerCase("en-US") === "high" ||
		(age !== null && age > 60)
	)
		return {
			followUpRequired,
			priority: "High",
			priorityReason:
				claimPriority?.toLocaleLowerCase("en-US") === "high"
					? "High priority from the linked claim"
					: "AR age exceeds 60 days with an outstanding balance",
		};
	return {
		followUpRequired,
		priority: "Routine",
		priorityReason: "Source next action is Follow Up",
	};
}

function mapException(row: WorkbookRecord): ArException {
	return {
		exceptionId: text(row.Exception_ID) ?? "",
		type: text(row.Exception_Type),
		severity: text(row.Severity),
		description: text(row.Description),
		owner: text(row.Owner),
		status: text(row.Status),
		createdDate: dateOnly(row.Created_Date),
	};
}

/** Maps validated AR and exception worksheet rows into UI-safe domain records. */
export function buildArRecords(
	dataset: ApprovedClaimsDataset,
	claims: ClaimRecord[],
): ArRecord[] {
	const claimsById = new Map(claims.map((claim) => [claim.claimId, claim]));
	const exceptionsByClaim = new Map<string, ArException[]>();
	for (const row of dataset.exceptions) {
		const claimId = text(row.Claim_ID);
		if (!claimId) continue;
		const items = exceptionsByClaim.get(claimId) ?? [];
		items.push(mapException(row));
		exceptionsByClaim.set(claimId, items);
	}

	return dataset.arRecords.map((row) => {
		const claimId = text(row.Claim_ID) ?? "";
		const claim = claimsById.get(claimId) ?? null;
		const currentBalance = amount(row.Current_Balance);
		const arAge = amount(row.AR_Age);
		const status = text(row.AR_Status);
		const nextAction = text(row.Next_Action);
		const priority = priorityFor(
			status,
			nextAction,
			currentBalance,
			arAge,
			claim?.priority ?? null,
		);
		return {
			arId: text(row.AR_ID) ?? "",
			claimId,
			originalBalance: amount(row.Original_Balance),
			currentBalance,
			arAge,
			agingBucket: text(row.Aging_Bucket),
			status,
			nextAction,
			owner: text(row.Owner),
			adjustmentAmount: amount(row.Adjustment_Amount),
			reconciliationStatus: text(row.Reconciliation_Status),
			claim,
			exceptions: exceptionsByClaim.get(claimId) ?? [],
			...priority,
		};
	});
}

export const EMPTY_AR_FILTERS: ArFilters = {
	search: "",
	status: "",
	agingBucket: "",
	payer: "",
	followUp: "all",
	priority: "all",
};

export function getArSummary(records: ArRecord[]): ArSummary {
	const balances = records
		.map((record) => record.currentBalance)
		.filter((value): value is number => value !== null);
	const ages = records
		.map((record) => record.arAge)
		.filter(
			(value): value is number =>
				value !== null && Number.isFinite(value) && value >= 0,
		);
	return {
		totalRecords: records.length,
		totalCurrentBalance:
			balances.length === 0
				? null
				: balances.reduce((sum, value) => sum + Math.round(value * 100), 0) /
					100,
		averageAge:
			ages.length === 0
				? null
				: ages.reduce((sum, value) => sum + value, 0) / ages.length,
		followUpPopulation: records.filter((record) => record.followUpRequired)
			.length,
	};
}

export function getArAgingGroups(records: ArRecord[]): ArAgingGroup[] {
	const groups = new Map<string, ArAgingGroup>();
	for (const record of records) {
		const label = record.agingBucket ?? "Not recorded";
		const group = groups.get(label) ?? {
			label,
			count: 0,
			percent: 0,
			currentBalance: 0,
		};
		group.count += 1;
		if (record.currentBalance !== null)
			group.currentBalance =
				(Math.round(group.currentBalance * 100) +
					Math.round(record.currentBalance * 100)) /
				100;
		groups.set(label, group);
	}
	return [...groups.values()]
		.map((group) => ({
			...group,
			percent: records.length ? (group.count / records.length) * 100 : 0,
		}))
		.sort((a, b) => {
			const lowValue = (label: string) => {
				const value = Number.parseInt(label, 10);
				return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
			};
			return (
				lowValue(a.label) - lowValue(b.label) || a.label.localeCompare(b.label)
			);
		});
}

export function filterArRecords(
	records: ArRecord[],
	filters: ArFilters,
): ArRecord[] {
	const query = filters.search.trim().toLocaleLowerCase("en-US");
	return records.filter((record) => {
		if (filters.status && record.status !== filters.status) return false;
		if (filters.agingBucket && record.agingBucket !== filters.agingBucket)
			return false;
		if (filters.payer && record.claim?.payerId !== filters.payer) return false;
		if (filters.followUp === "required" && !record.followUpRequired)
			return false;
		if (filters.followUp === "not-required" && record.followUpRequired)
			return false;
		if (filters.priority !== "all" && record.priority !== filters.priority)
			return false;
		if (!query) return true;
		return [
			record.arId,
			record.claimId,
			record.claim?.payerId,
			record.claim?.payerName,
			record.status,
			record.nextAction,
			record.owner,
		]
			.filter((value): value is string => Boolean(value))
			.some((value) => value.toLocaleLowerCase("en-US").includes(query));
	});
}

const PRIORITY_ORDER: Record<ArPriority, number> = {
	Critical: 0,
	High: 1,
	Routine: 2,
	"No follow-up": 3,
};

function compareNullable(
	left: string | number | null,
	right: string | number | null,
): number {
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

export function sortArRecords(
	records: ArRecord[],
	sort: ArSort | null,
): ArRecord[] {
	if (!sort) return records;
	const direction = sort.direction === "ascending" ? 1 : -1;
	return records
		.map((record, index) => ({ record, index }))
		.sort((a, b) => {
			const value = (record: ArRecord): string | number | null => {
				switch (sort.field) {
					case "payerName":
						return record.claim?.payerName ?? null;
					case "priority":
						return PRIORITY_ORDER[record.priority];
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
				compareNullable(left, right) * direction ||
				a.record.arId.localeCompare(b.record.arId, "en-US", {
					numeric: true,
				}) ||
				a.index - b.index
			);
		})
		.map(({ record }) => record);
}

export function paginateArRecords<T>(
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

export function findArRecordById(
	records: ArRecord[],
	arId: string,
): ArRecord | undefined {
	const key = arId.trim().toLocaleUpperCase("en-US");
	return records.find(
		(record) => record.arId.toLocaleUpperCase("en-US") === key,
	);
}
