import type { ClaimRecord } from "../data/claimsTypes";
import type { ArRecord } from "./ar";
import { getArAgingGroups, getArSummary } from "./ar";
import { getClaimSummary } from "./claims";
import type { DenialRecord } from "./denials";
import { getDenialSummary, groupDenialsByReason } from "./denials";
import type { ExceptionRecord } from "./exceptions";
import { getExceptionSummary, groupExceptionsByType } from "./exceptions";
import { getClaimStatusDistribution } from "./executiveDashboard";
import type { InteroperabilityRecord } from "./interoperability";
import {
	groupInteroperabilityByStatus,
	summarizeInteroperability,
} from "./interoperability";
import type { PaymentRecord } from "./payments";
import { getPaymentSummary } from "./payments";

export interface AnalyticsFilters {
	payerId: string;
	claimStatus: string;
	serviceDateFrom: string;
	serviceDateTo: string;
}

export interface AnalyticsTrendPoint {
	period: string;
	claimCount: number;
	billedAmount: number | null;
}

export interface AnalyticsPayerRow {
	payerId: string | null;
	payerName: string;
	claimCount: number;
	billedAmount: number | null;
	paidAmount: number | null;
	outstandingAr: number | null;
	denialCount: number;
	exceptionCount: number;
	claimIds: string[];
}

export interface AnalyticsLifecycleRow {
	label: string;
	claimCount: number;
	percent: number;
}

export interface AnalyticsModel {
	filters: AnalyticsFilters;
	options: {
		payers: Array<{ value: string; label: string }>;
		statuses: string[];
	};
	summary: {
		claims: ReturnType<typeof getClaimSummary>;
		denials: ReturnType<typeof getDenialSummary>;
		payments: ReturnType<typeof getPaymentSummary>;
		ar: ReturnType<typeof getArSummary>;
		exceptions: ReturnType<typeof getExceptionSummary>;
		interoperability: ReturnType<typeof summarizeInteroperability>;
	};
	claimStatuses: ReturnType<typeof getClaimStatusDistribution>;
	denialReasons: ReturnType<typeof groupDenialsByReason>;
	paymentStatuses: Array<{ label: string; count: number; percent: number }>;
	arAging: ReturnType<typeof getArAgingGroups>;
	exceptionTypes: ReturnType<typeof groupExceptionsByType>;
	interoperabilityStatuses: ReturnType<typeof groupInteroperabilityByStatus>;
	trend: AnalyticsTrendPoint[];
	trendLabel: string;
	payers: AnalyticsPayerRow[];
	lifecycle: AnalyticsLifecycleRow[];
	priorityClaims: ClaimRecord[];
	dateBounds: { from: string; to: string };
}

export const EMPTY_ANALYTICS_FILTERS: AnalyticsFilters = {
	payerId: "",
	claimStatus: "",
	serviceDateFrom: "",
	serviceDateTo: "",
};

function sumAmounts(values: Array<number | null>): number | null {
	const known = values.filter(
		(value): value is number =>
			typeof value === "number" && Number.isFinite(value),
	);
	return known.length
		? known.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100
		: null;
}

function filterClaims(claims: ClaimRecord[], filters: AnalyticsFilters) {
	return claims.filter((claim) => {
		if (filters.payerId && claim.payerId !== filters.payerId) return false;
		if (filters.claimStatus && claim.status !== filters.claimStatus)
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
		return true;
	});
}

function groupPaymentStatuses(payments: PaymentRecord[]) {
	const counts = new Map<string, number>();
	for (const payment of payments) {
		counts.set(
			payment.reconciliationStatus,
			(counts.get(payment.reconciliationStatus) ?? 0) + 1,
		);
	}
	return [...counts]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([label, count]) => ({
			label,
			count,
			percent: payments.length ? (count / payments.length) * 100 : 0,
		}));
}

function buildTrend(claims: ClaimRecord[]): AnalyticsTrendPoint[] {
	const groups = new Map<string, AnalyticsTrendPoint>();
	for (const claim of claims) {
		if (!claim.serviceDate || !/^\d{4}-\d{2}-\d{2}$/.test(claim.serviceDate))
			continue;
		const period = claim.serviceDate.slice(0, 7);
		const row = groups.get(period) ?? {
			period,
			claimCount: 0,
			billedAmount: null,
		};
		row.claimCount += 1;
		if (claim.billedAmount !== null && Number.isFinite(claim.billedAmount)) {
			row.billedAmount =
				(Math.round((row.billedAmount ?? 0) * 100) +
					Math.round(claim.billedAmount * 100)) /
				100;
		}
		groups.set(period, row);
	}
	return [...groups.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function byPayer(
	claims: ClaimRecord[],
	payments: PaymentRecord[],
	denials: DenialRecord[],
	exceptions: ExceptionRecord[],
	arRecords: ArRecord[],
): AnalyticsPayerRow[] {
	const groups = new Map<string, ClaimRecord[]>();
	for (const claim of claims) {
		const key = claim.payerId || "";
		groups.set(key, [...(groups.get(key) ?? []), claim]);
	}
	for (const payment of payments) {
		const key = payment.payerId || "";
		if (!groups.has(key)) groups.set(key, []);
	}
	return [...groups.entries()]
		.map(([payerId, rows]) => {
			const ids = new Set(rows.map((claim) => claim.claimId));
			// Payments carry their own source Payer_ID; do not reassign one to the
			// linked claim payer if the source values differ.
			const payerPayments = payments.filter((payment) =>
				payerId ? payment.payerId === payerId : !payment.payerId,
			);
			const payerAr = arRecords.filter((record) => ids.has(record.claimId));
			return {
				payerId: payerId || null,
				payerName:
					rows[0]?.payerName ??
					payments.find((payment) => payment.payerId === payerId)?.payerName ??
					(payerId ? "Payer name unavailable" : "Payer not recorded"),
				claimCount: rows.length,
				billedAmount: sumAmounts(rows.map((claim) => claim.billedAmount)),
				paidAmount: sumAmounts(
					payerPayments.map((payment) => payment.paidAmount),
				),
				outstandingAr: sumAmounts(
					payerAr.map((record) => record.currentBalance),
				),
				denialCount: denials.filter((denial) => ids.has(denial.claimId)).length,
				exceptionCount: exceptions.filter((exception) =>
					ids.has(exception.claimId),
				).length,
				claimIds: rows.map((claim) => claim.claimId),
			};
		})
		.sort(
			(a, b) =>
				b.claimCount - a.claimCount || a.payerName.localeCompare(b.payerName),
		);
}

export function buildAnalyticsModel(input: {
	claims: ClaimRecord[];
	denials: DenialRecord[];
	payments: PaymentRecord[];
	arRecords: ArRecord[];
	exceptions: ExceptionRecord[];
	interoperability: InteroperabilityRecord[];
	payers: Array<{ payerId: string; payerName: string }>;
	filters?: AnalyticsFilters;
}): AnalyticsModel {
	const filters = input.filters ?? EMPTY_ANALYTICS_FILTERS;
	const claims = filterClaims(input.claims, filters);
	const claimIds = new Set(claims.map((claim) => claim.claimId));
	const hasScope = Boolean(
		filters.payerId ||
			filters.claimStatus ||
			filters.serviceDateFrom ||
			filters.serviceDateTo,
	);
	const scoped = <T extends { claimId: string }>(records: T[]) =>
		hasScope
			? records.filter((record) => claimIds.has(record.claimId))
			: records;
	const denials = scoped(input.denials);
	const payments = scoped(input.payments);
	const arRecords = scoped(input.arRecords);
	const exceptions = scoped(input.exceptions);
	const interoperability = scoped(input.interoperability);
	const statusFacts = claims.map((claim) => ({
		claimId: claim.claimId,
		payerId: claim.payerId,
		billedAmount: claim.billedAmount,
		status: claim.status,
		priority: claim.priority ?? "",
		arAge: claim.arAge,
	}));
	const paymentClaimIds = new Set(payments.map((payment) => payment.claimId));
	const denialClaimIds = new Set(denials.map((denial) => denial.claimId));
	const arClaimIds = new Set(arRecords.map((record) => record.claimId));
	const exceptionClaimIds = new Set(exceptions.map((record) => record.claimId));
	const interoperabilityClaimIds = new Set(
		interoperability.map((record) => record.claimId),
	);
	const payerRows = byPayer(claims, payments, denials, exceptions, arRecords);
	const trend = buildTrend(claims);
	const validDates = input.claims
		.map((claim) => claim.serviceDate)
		.filter((value): value is string => Boolean(value));
	return {
		filters,
		options: {
			payers: input.payers
				.map((payer) => ({ value: payer.payerId, label: payer.payerName }))
				.sort((a, b) => a.label.localeCompare(b.label)),
			statuses: [...new Set(input.claims.map((claim) => claim.status))].sort(),
		},
		summary: {
			claims: getClaimSummary(claims),
			denials: getDenialSummary(denials, claims),
			payments: getPaymentSummary(payments, claims),
			ar: getArSummary(arRecords),
			exceptions: getExceptionSummary(exceptions),
			interoperability: summarizeInteroperability(interoperability),
		},
		claimStatuses: getClaimStatusDistribution(statusFacts),
		denialReasons: groupDenialsByReason(denials),
		paymentStatuses: groupPaymentStatuses(payments),
		arAging: getArAgingGroups(arRecords),
		exceptionTypes: groupExceptionsByType(exceptions),
		interoperabilityStatuses: groupInteroperabilityByStatus(interoperability),
		trend,
		trendLabel:
			trend.length > 1
				? "Monthly claims by service date"
				: "Service-date population distribution",
		payers: payerRows,
		lifecycle: [
			{
				label: "Claims",
				claimCount: claims.length,
				percent: claims.length ? 100 : 0,
			},
			{
				label: "With denial",
				claimCount: claims.filter((claim) => denialClaimIds.has(claim.claimId))
					.length,
				percent: claims.length
					? (claims.filter((claim) => denialClaimIds.has(claim.claimId))
							.length /
							claims.length) *
						100
					: 0,
			},
			{
				label: "With payment",
				claimCount: claims.filter((claim) => paymentClaimIds.has(claim.claimId))
					.length,
				percent: claims.length
					? (claims.filter((claim) => paymentClaimIds.has(claim.claimId))
							.length /
							claims.length) *
						100
					: 0,
			},
			{
				label: "With AR",
				claimCount: claims.filter((claim) => arClaimIds.has(claim.claimId))
					.length,
				percent: claims.length
					? (claims.filter((claim) => arClaimIds.has(claim.claimId)).length /
							claims.length) *
						100
					: 0,
			},
			{
				label: "With exception",
				claimCount: claims.filter((claim) =>
					exceptionClaimIds.has(claim.claimId),
				).length,
				percent: claims.length
					? (claims.filter((claim) => exceptionClaimIds.has(claim.claimId))
							.length /
							claims.length) *
						100
					: 0,
			},
			{
				label: "With 837 transaction",
				claimCount: claims.filter((claim) =>
					interoperabilityClaimIds.has(claim.claimId),
				).length,
				percent: claims.length
					? (claims.filter((claim) =>
							interoperabilityClaimIds.has(claim.claimId),
						).length /
							claims.length) *
						100
					: 0,
			},
		],
		priorityClaims: claims
			.filter((claim) => claim.followUpRequired)
			.sort(
				(a, b) =>
					(b.arAge ?? -1) - (a.arAge ?? -1) ||
					(b.billedAmount ?? -1) - (a.billedAmount ?? -1),
			)
			.slice(0, 15),
		dateBounds: {
			from: validDates.sort()[0] ?? "",
			to: validDates.sort().at(-1) ?? "",
		},
	};
}
