import type {
	ApprovedDashboardDataset,
	ArFact,
	ClaimFact,
	DenialFact,
} from "../data/dashboardTypes";

export interface DashboardKpis {
	totalClaims: number;
	billedAmount: number;
	denialRate: number;
	averageArAge: number;
	arPopulation: number;
	currentArBalance: number;
}

export interface DistributionItem {
	label: string;
	count: number;
	percent: number;
}

export interface DenialReasonItem extends DistributionItem {
	code: string;
	category: string;
	deniedAmount: number;
}

export interface AgingBucketItem extends DistributionItem {
	currentBalance: number;
}

export interface PriorityClaim {
	claimId: string;
	payer: string;
	billedAmount: number;
	status: string;
	arAge: number;
	priority: string;
	followUpRequired: boolean;
}

export interface ManagementAlert {
	id: string;
	severity: "critical" | "high" | "medium";
	title: string;
	description: string;
	count: number;
	amount?: number;
	amountLabel?: string;
}

export interface KpiDiscrepancy {
	label: string;
	actual: number;
	target: number;
	unit: "claims" | "USD" | "%" | "days";
}

export interface ExecutiveDashboardModel {
	kpis: DashboardKpis;
	kpiDiscrepancies: KpiDiscrepancy[];
	claimStatusDistribution: DistributionItem[];
	denialReasons: DenialReasonItem[];
	denialCategories: DistributionItem[];
	agingBuckets: AgingBucketItem[];
	priorityClaims: PriorityClaim[];
	managementAlerts: ManagementAlert[];
}

const FOLLOW_UP_STATUSES = new Set([
	"Denied",
	"Rejected",
	"Pending",
	"Partially Paid",
]);
const RESOLVED_EXCEPTION_STATUSES = new Set([
	"Resolved",
	"Closed",
	"Cancelled",
	"Canceled",
]);
const PRIORITY_ORDER: Record<string, number> = {
	Critical: 0,
	High: 1,
	Medium: 2,
};

function validAmount(value: number | null | undefined): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function validAge(value: number | null | undefined): number | null {
	return typeof value === "number" && Number.isFinite(value) && value >= 0
		? value
		: null;
}

function percentOf(count: number, total: number): number {
	return total === 0 ? 0 : (count / total) * 100;
}

function sumBy<T>(items: T[], select: (item: T) => number): number {
	return items.reduce((total, item) => total + select(item), 0);
}

export function getTotalClaims(claims: ClaimFact[]): number {
	return claims.length;
}

export function getBilledAmount(claims: ClaimFact[]): number {
	return sumBy(claims, (claim) => validAmount(claim.billedAmount));
}

export function getDenialRate(
	claims: ClaimFact[],
	denials: DenialFact[],
): number {
	if (claims.length === 0) return 0;
	const claimIds = new Set(claims.map((claim) => claim.claimId));
	const deniedClaimIds = new Set(
		denials
			.map((denial) => denial.claimId)
			.filter((claimId) => claimIds.has(claimId)),
	);
	return deniedClaimIds.size / claims.length;
}

export function getAverageArAge(arRecords: ArFact[]): number {
	const ages = arRecords
		.map((record) => validAge(record.arAge))
		.filter((age): age is number => age !== null);
	return ages.length === 0 ? 0 : sumBy(ages, Number) / ages.length;
}

export function getClaimStatusDistribution(
	claims: ClaimFact[],
): DistributionItem[] {
	const counts = new Map<string, number>();
	for (const claim of claims)
		counts.set(claim.status, (counts.get(claim.status) ?? 0) + 1);
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([label, count]) => ({
			label,
			count,
			percent: percentOf(count, claims.length),
		}));
}

export function getDenialReasonDistribution(
	denials: DenialFact[],
): DenialReasonItem[] {
	const groups = new Map<string, DenialReasonItem>();
	for (const denial of denials) {
		const groupKey = `${denial.denialCode}\u0000${denial.reason}\u0000${denial.category}`;
		const group = groups.get(groupKey) ?? {
			label: denial.reason || "Unspecified reason",
			code: denial.denialCode || "Unspecified code",
			category: denial.category || "Uncategorized",
			count: 0,
			percent: 0,
			deniedAmount: 0,
		};
		group.count += 1;
		group.deniedAmount += validAmount(denial.denialAmount);
		groups.set(groupKey, group);
	}
	return [...groups.values()]
		.map((group) => ({
			...group,
			percent: percentOf(group.count, denials.length),
		}))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function getDenialCategoryDistribution(
	denials: DenialFact[],
): DistributionItem[] {
	const counts = new Map<string, number>();
	for (const denial of denials) {
		const category = denial.category || "Uncategorized";
		counts.set(category, (counts.get(category) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([label, count]) => ({
			label,
			count,
			percent: percentOf(count, denials.length),
		}));
}

export function getArAgingDistribution(arRecords: ArFact[]): AgingBucketItem[] {
	const groups = new Map<string, AgingBucketItem>();
	for (const record of arRecords) {
		const label = record.agingBucket || "Unclassified";
		const group = groups.get(label) ?? {
			label,
			count: 0,
			percent: 0,
			currentBalance: 0,
		};
		group.count += 1;
		group.currentBalance += validAmount(record.currentBalance);
		groups.set(label, group);
	}
	return [...groups.values()]
		.map((group) => ({
			...group,
			percent: percentOf(group.count, arRecords.length),
		}))
		.sort((a, b) => {
			const lower = (label: string) => Number.parseInt(label, 10);
			return lower(a.label) - lower(b.label);
		});
}

export function getPriorityClaims(
	dataset: ApprovedDashboardDataset,
): PriorityClaim[] {
	const payerNames = new Map(
		dataset.payers.map((payer) => [payer.payerId, payer.payerName]),
	);
	return dataset.claims
		.filter((claim) => {
			const age = validAge(claim.arAge) ?? 0;
			return (
				FOLLOW_UP_STATUSES.has(claim.status) &&
				(PRIORITY_ORDER[claim.priority] <= PRIORITY_ORDER.High || age > 60)
			);
		})
		.map((claim) => ({
			claimId: claim.claimId,
			payer: payerNames.get(claim.payerId) ?? "Payer not matched",
			billedAmount: validAmount(claim.billedAmount),
			status: claim.status,
			arAge: validAge(claim.arAge) ?? 0,
			priority: claim.priority,
			followUpRequired: true,
		}))
		.sort(
			(a, b) =>
				(PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3) ||
				b.arAge - a.arAge ||
				b.billedAmount - a.billedAmount,
		);
}

export function filterPriorityClaims(
	claims: PriorityClaim[],
	filter: "all" | "denied" | "aged" | "critical",
): PriorityClaim[] {
	if (filter === "denied")
		return claims.filter((claim) => claim.status === "Denied");
	if (filter === "aged") return claims.filter((claim) => claim.arAge > 60);
	if (filter === "critical")
		return claims.filter((claim) => claim.priority === "Critical");
	return claims;
}

export function getManagementAlerts(
	dataset: ApprovedDashboardDataset,
): ManagementAlert[] {
	const alerts: ManagementAlert[] = [];
	const deniedClaims = dataset.claims.filter(
		(claim) => claim.status === "Denied",
	);
	const deniedAmounts = new Map(
		dataset.denials.map((denial) => [
			denial.claimId,
			validAmount(denial.denialAmount),
		]),
	);
	const denialExposure = sumBy(
		deniedClaims,
		(claim) => deniedAmounts.get(claim.claimId) ?? 0,
	);
	if (deniedClaims.length > 0) {
		alerts.push({
			id: "denial-volume",
			severity: "high",
			title: "Denied claims require resolution",
			description: "Denied claim balances remain in the adjudication workflow.",
			count: deniedClaims.length,
			amount: denialExposure,
			amountLabel: "denial amount",
		});
	}

	const activeExceptions = dataset.exceptions.filter(
		(exception) => !RESOLVED_EXCEPTION_STATUSES.has(exception.status),
	);
	const criticalExceptions = activeExceptions.filter(
		(exception) => exception.severity === "Critical",
	);
	const highExceptions = activeExceptions.filter(
		(exception) => exception.severity === "High",
	);
	if (criticalExceptions.length > 0) {
		alerts.push({
			id: "critical-exceptions",
			severity: "critical",
			title: "Critical exceptions remain open",
			description: "Open critical exceptions require operational escalation.",
			count: criticalExceptions.length,
		});
	}
	if (highExceptions.length > 0) {
		alerts.push({
			id: "high-exceptions",
			severity: "high",
			title: "High-severity exceptions need follow-up",
			description: "Open and in-progress exception records are not resolved.",
			count: highExceptions.length,
		});
	}

	const agedAr = dataset.arRecords.filter(
		(record) =>
			(validAge(record.arAge) ?? 0) > 60 &&
			validAmount(record.currentBalance) > 0,
	);
	if (agedAr.length > 0) {
		alerts.push({
			id: "aged-ar",
			severity: "high",
			title: "Open AR aged beyond 60 days",
			description:
				"Current balances in older aging buckets may need escalation.",
			count: agedAr.length,
			amount: sumBy(agedAr, (record) => validAmount(record.currentBalance)),
			amountLabel: "current AR",
		});
	}
	return alerts.sort((a, b) => {
		const rank = { critical: 0, high: 1, medium: 2 };
		return rank[a.severity] - rank[b.severity];
	});
}

export function getKpiDiscrepancies(
	kpis: DashboardKpis,
	dataset: ApprovedDashboardDataset,
): KpiDiscrepancy[] {
	const targets = dataset.validationTargets;
	const checks: {
		label: string;
		actual: number;
		target: number;
		unit: KpiDiscrepancy["unit"];
		matches: boolean;
	}[] = [
		{
			label: "Total Claims",
			actual: kpis.totalClaims,
			target: targets.claimCount,
			unit: "claims",
			matches: kpis.totalClaims === targets.claimCount,
		},
		{
			label: "Billed Amount",
			actual: kpis.billedAmount,
			target: targets.billedAmount,
			unit: "USD",
			matches:
				Math.round(kpis.billedAmount * 100) ===
				Math.round(targets.billedAmount * 100),
		},
		{
			label: "Denial Rate",
			actual: kpis.denialRate * 100,
			target: targets.denialRatePercent,
			unit: "%",
			matches:
				Number((kpis.denialRate * 100).toFixed(1)) ===
				targets.denialRatePercent,
		},
		{
			label: "Average AR Age",
			actual: kpis.averageArAge,
			target: targets.averageArAgeDays,
			unit: "days",
			matches:
				Math.abs(kpis.averageArAge - targets.averageArAgeDays) <=
				targets.averageArAgeToleranceDays,
		},
	];
	return checks
		.filter((check) => !check.matches)
		.map(({ label, actual, target, unit }) => ({
			label,
			actual,
			target,
			unit,
		}));
}

export function buildExecutiveDashboardModel(
	dataset: ApprovedDashboardDataset,
): ExecutiveDashboardModel {
	const totalClaims = getTotalClaims(dataset.claims);
	const kpis: DashboardKpis = {
		totalClaims,
		billedAmount: getBilledAmount(dataset.claims),
		denialRate: getDenialRate(dataset.claims, dataset.denials),
		averageArAge: getAverageArAge(dataset.arRecords),
		arPopulation: dataset.arRecords.length,
		currentArBalance: sumBy(dataset.arRecords, (record) =>
			validAmount(record.currentBalance),
		),
	};
	return {
		kpis,
		kpiDiscrepancies: getKpiDiscrepancies(kpis, dataset),
		claimStatusDistribution: getClaimStatusDistribution(dataset.claims),
		denialReasons: getDenialReasonDistribution(dataset.denials),
		denialCategories: getDenialCategoryDistribution(dataset.denials),
		agingBuckets: getArAgingDistribution(dataset.arRecords),
		priorityClaims: getPriorityClaims(dataset),
		managementAlerts: getManagementAlerts(dataset),
	};
}
