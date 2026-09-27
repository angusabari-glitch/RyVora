import {
	type AnalyticsFilters,
	buildAnalyticsModel,
} from "../business/analytics";
import { getApprovedClaimsDataset } from "../data/claimsDataset";
import { loadArManagement } from "./arService";
import { loadClaims } from "./claimsService";
import { loadDenials } from "./denialsService";
import { loadExceptions } from "./exceptionsService";
import { loadInteroperability } from "./interoperabilityService";
import { loadPayments } from "./paymentsService";

let sourcePromise: Promise<{
	claims: ReturnType<typeof loadClaims>;
	denials: ReturnType<typeof loadDenials>;
	payments: ReturnType<typeof loadPayments>;
	arRecords: Awaited<ReturnType<typeof loadArManagement>>["records"];
	exceptions: Awaited<ReturnType<typeof loadExceptions>>["records"];
	interoperability: Awaited<ReturnType<typeof loadInteroperability>>["records"];
	payers: Array<{ payerId: string; payerName: string }>;
}> | null = null;

async function loadSource() {
	if (!sourcePromise) {
		sourcePromise = Promise.all([
			loadArManagement(),
			loadExceptions(),
			loadInteroperability(),
		])
			.then(([arData, exceptionsData, interoperabilityData]) => {
				const dataset = getApprovedClaimsDataset();
				return {
					claims: loadClaims(),
					denials: loadDenials(),
					payments: loadPayments(),
					arRecords: arData.records,
					exceptions: exceptionsData.records,
					interoperability: interoperabilityData.records,
					payers: dataset.payers.map((row) => ({
						payerId: String(row.Payer_ID ?? ""),
						payerName: String(row.Payer_Name ?? "Payer name unavailable"),
					})),
				};
			})
			.catch((error: unknown) => {
				sourcePromise = null;
				throw error;
			});
	}
	return sourcePromise;
}

/** Composes existing read-only module services; Analytics does not create a new data source. */
export async function loadAnalytics(filters?: AnalyticsFilters) {
	const source = await loadSource();
	return buildAnalyticsModel({
		...source,
		filters,
	});
}
